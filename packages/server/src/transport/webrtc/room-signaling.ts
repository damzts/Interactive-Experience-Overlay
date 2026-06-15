/**
 * Room signaling client — connects to ieom-api's /ws/rooms/:roomId as the hub.
 * Uses native WebSocket (ws) instead of Socket.IO for minimal overhead.
 * Routes WebRTC signaling between browser participants and the local RoomHub.
 */

import WebSocket from 'ws'
import logger from '../../lib/logger.js'
import type { RoomHub } from './room-hub.js'
import type { POVOrchestrator } from '../../kernel/managers/pov.js'

export interface RoomSignalingConfig {
  cloudUrl: string
  token: string
  roomId: string
}

interface WsMessage {
  type: string
  payload: Record<string, unknown>
  senderId: string
  timestamp: string
  targetUserId?: string
}

export type RoomStatusCallback = (status: { connected: boolean; participants: string[]; participantNames: Map<string, string>; roomId: string | null }) => void
export type ParticipantConnectionCallback = (userId: string, connected: boolean) => void

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30000
const PING_INTERVAL_MS = 15_000
const FREEZE_RECOVERY_DELAY_MS = 2_000

export class RoomSignaling {
  private ws: WebSocket | null = null
  private config: RoomSignalingConfig | null = null
  private statusCallbacks: RoomStatusCallback[] = []
  private connectionChangeCallbacks: ParticipantConnectionCallback[] = []
  private participantNames = new Map<string, string>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private freezeRecoveryTimers = new Set<ReturnType<typeof setTimeout>>()
  private participantLeaveTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private pendingOfferTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private reconnectAttempt = 0
  intentionalClose = false
  private connCounter = 0
  private pendingCandidates = new Map<string, Record<string, unknown>[]>()
  private knownParticipants = new Set<string>()
  private frozenParticipants = new Set<string>()
  private freezeRecoveryAttempts = new Map<string, number>()
  /** userId that was the active camera when ICE failed; cleared once they reconnect */
  private recoveringActiveParticipant: string | null = null
  /** Set of participant userIds managed by this signaling instance's room */
  private managedParticipants = new Set<string>()

  /** Register a participant as managed by this signaling instance */
  manageParticipant(userId: string): void {
    this.managedParticipants.add(userId)
  }

  /** Unregister a participant from this signaling instance */
  unmanageParticipant(userId: string): void {
    this.managedParticipants.delete(userId)
  }

  constructor(
    private hub: RoomHub,
    private pov: POVOrchestrator,
  ) {
    this.hub.onTrack((userId) => {
      if (!this.managedParticipants.has(userId)) return
      if (!this.pov.activeCameraId) {
        this.pov.switcher.manualSelect(userId)
      } else if (this.recoveringActiveParticipant === userId) {
        // Participant reconnected via ICE restart — switch relay back to them
        this.recoveringActiveParticipant = null
        this.pov.markConnected(userId)
        this.pov.switcher.manualSelect(userId)
        logger.info(`[room-signaling] ${userId} reconnected, switched relay back`)
      }
      // Track arrived → connection is live; mark connected so admin dot turns green
      this.emitConnectionChange(userId, true)
    })

    this.hub.onIceCandidate((userId, candidate) => {
      if (!this.managedParticipants.has(userId)) return
      if (this.pendingCandidates.has(userId)) {
        this.pendingCandidates.get(userId)!.push(candidate as unknown as Record<string, unknown>)
      } else {
        this.send({
          type: 'ice-candidate',
          payload: candidate as unknown as Record<string, unknown>,
          senderId: 'self',
          timestamp: new Date().toISOString(),
          targetUserId: userId,
        })
      }
    })

    this.hub.onIceFailed((userId) => {
      if (!this.managedParticipants.has(userId)) return
      if (this.frozenParticipants.has(userId)) return  // Already handling this failure
      logger.info(`[room-signaling] ICE failed for ${userId} — sending restart request`)
      this.frozenParticipants.add(userId)
      this.emitConnectionChange(userId, false)

      // Immediate viewer fallback: switch relay to another participant while reconnecting
      if (userId === this.pov.activeCameraId && this.recoveringActiveParticipant !== userId) {
        this.recoveringActiveParticipant = userId
        this.pov.markDisconnected(userId)
        this.pov.switcher.handleDisconnect(userId)
        logger.info(`[room-signaling] ${userId} was active camera — triggered fallback switch`)
      }

      this.send({
        type: 'ice-restart-request',
        payload: { userId },
        senderId: 'self',
        timestamp: new Date().toISOString(),
        targetUserId: userId,
      })
    })

    this.hub.onIceRecovered((userId) => {
      if (!this.managedParticipants.has(userId)) return
      if (!this.frozenParticipants.has(userId)) return
      logger.info(`[room-signaling] ${userId} ICE self-recovered`)
      this.frozenParticipants.delete(userId)
      this.freezeRecoveryAttempts.delete(userId)
      this.emitConnectionChange(userId, true)
      if (this.recoveringActiveParticipant === userId) {
        this.recoveringActiveParticipant = null
        this.pov.markConnected(userId)
        this.pov.switcher.manualSelect(userId)
        logger.info(`[room-signaling] ${userId} self-recovered, switched relay back`)
      }
    })

    this.hub.onTrackMuted((userId, kind) => {
      if (!this.managedParticipants.has(userId)) return
      if (kind !== 'video') return
      if (this.frozenParticipants.has(userId)) return  // ICE failure already handling this
      this.frozenParticipants.add(userId)

      // Track freeze recovery attempts per participant
      const attempts = (this.freezeRecoveryAttempts.get(userId) ?? 0) + 1
      this.freezeRecoveryAttempts.set(userId, attempts)

      if (attempts > 2) {
        // Escalate: ICE restart isn't fixing it — tell the guest to fully reconnect
        logger.info(`[room-signaling] ${userId} video frozen after ${attempts} attempts, requesting full reconnect`)
        this.send({
          type: 'full-reconnect-request',
          payload: { userId, reason: 'video-frozen-escalation' },
          senderId: 'self',
          timestamp: new Date().toISOString(),
          targetUserId: userId,
        })
        this.frozenParticipants.delete(userId)
        return
      }

      logger.info(`[room-signaling] ${userId} video frozen/muted, scheduling recovery (attempt ${attempts})`)

      const t = setTimeout(() => {
        this.freezeRecoveryTimers.delete(t)
        if (!this.frozenParticipants.has(userId)) return
        logger.info(`[room-signaling] initiating recovery for frozen participant ${userId}`)
        this.send({
          type: 'ice-restart-request',
          payload: { userId },
          senderId: 'self',
          timestamp: new Date().toISOString(),
          targetUserId: userId,
        })
        this.frozenParticipants.delete(userId)
      }, FREEZE_RECOVERY_DELAY_MS)
      this.freezeRecoveryTimers.add(t)
    })
  }

  async connect(config: RoomSignalingConfig, timeoutMs = 10_000): Promise<void> {
    // Only disconnect if this instance already has an active WebSocket (same-instance reconnect).
    // With per-room signaling, fresh instances won't have a ws — no need to tear down other rooms.
    if (this.ws) {
      this.disconnect()
    }
    this.config = config
    this.intentionalClose = false
    this.reconnectAttempt = 0
    this.frozenParticipants.clear()

    return new Promise<void>((resolve, reject) => {
      const connId = ++this.connCounter
      const { cloudUrl, token, roomId } = config

      const base = cloudUrl.replace(/^http/, 'ws')
      const url = `${base}/api/ws/rooms/${roomId}?token=${encodeURIComponent(token)}`

      const ws = new WebSocket(url)
      this.ws = ws

      const isStale = () => this.connCounter !== connId
      let settled = false

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true
          ws.close()
          reject(new Error(`WebSocket connect timeout (${timeoutMs}ms)`))
        }
      }, timeoutMs)

      ws.on('open', () => {
        if (isStale() || settled) return
        settled = true
        clearTimeout(timeout)
        this.reconnectAttempt = 0
        logger.info({ value: roomId }, '[room-signaling] connected to room')
        this.send({ type: 'join-as-hub', payload: {}, senderId: 'self', timestamp: new Date().toISOString() })
        this.emitStatus()
        this.startPingTimer()
        resolve()
      })

      ws.on('message', (data: WebSocket.Data) => {
        if (isStale()) return
        let msg: WsMessage
        try { msg = JSON.parse(data.toString()) }
        catch { return }
        this.handleMessage(msg)
      })

      ws.on('close', (code?: number, reason?: Buffer) => {
        if (isStale()) return
        if (!settled) {
          settled = true
          clearTimeout(timeout)
          reject(new Error(`WebSocket closed before open (code=${code})`))
          return
        }
        logger.info({ value: code, msg: reason?.toString() }, '[room-signaling] disconnected')
        this.ws = null
        this.stopPingTimer()
        this.emitStatus()
        if (!this.intentionalClose) {
          if (code === 4401) {
            this.fetchFreshToken().finally(() => this.scheduleReconnect())
            return
          }
          this.scheduleReconnect()
        }
      })

      ws.on('error', (err) => {
        if (isStale() || settled) return
        settled = true
        clearTimeout(timeout)
        const msg = (err as any).message ?? err
        logger.info('[room-signaling] error:', msg)
        reject(new Error(`WebSocket error: ${msg}`))
      })
    })
  }

  private reconnectSocket(): void {
    if (!this.config) return
    const { cloudUrl, token, roomId } = this.config

    const connId = ++this.connCounter
    const base = cloudUrl.replace(/^http/, 'ws')
    const url = `${base}/api/ws/rooms/${roomId}?token=${encodeURIComponent(token)}`

    const ws = new WebSocket(url)
    this.ws = ws

    const isStale = () => this.connCounter !== connId

    ws.on('open', () => {
      if (isStale()) return
      this.reconnectAttempt = 0
      logger.info({ value: roomId }, '[room-signaling] reconnected to room')
      this.send({ type: 'join-as-hub', payload: {}, senderId: 'self', timestamp: new Date().toISOString() })
      this.emitStatus()
      this.startPingTimer()
    })

    ws.on('message', (data: WebSocket.Data) => {
      if (isStale()) return
      let msg: WsMessage
      try { msg = JSON.parse(data.toString()) }
      catch { return }
      this.handleMessage(msg)
    })

    ws.on('close', (code?: number, reason?: Buffer) => {
      if (isStale()) return
      logger.info({ value: code, msg: reason?.toString() }, '[room-signaling] reconnection socket disconnected')
      this.ws = null
      this.stopPingTimer()
      this.emitStatus()
      if (!this.intentionalClose) {
        if (code === 4401) {
          this.fetchFreshToken().finally(() => this.scheduleReconnect())
          return
        }
        this.scheduleReconnect()
      }
    })

    ws.on('error', (err) => {
      if (isStale()) return
      logger.info('[room-signaling] reconnection error:', (err as any).message ?? err)
    })
  }

  private handleMessage(msg: WsMessage): void {
    switch (msg.type) {
      case 'participants-list': {
        const participants = msg.payload['participants'] as string[] | undefined
        if (participants) {
          for (const userId of participants) {
            const leaveTimer = this.participantLeaveTimers.get(userId)
            if (leaveTimer) { clearTimeout(leaveTimer); this.participantLeaveTimers.delete(userId) }
            const name = `Guest-${userId.slice(0, 6)}`
            this.participantNames.set(userId, name)
            this.pov.addParticipant(userId, name)
            this.knownParticipants.add(userId)

            // If there's no active WebRTC PC for this participant (hub joined late, or
            // the cloud doesn't replay buffered offers), prompt them to re-offer now.
            if (!this.hub.hasParticipant(userId)) {
              logger.info(`[room-signaling] ${userId} already in room but no PC — requesting offer`)
              this.send({
                type: 'ice-restart-request',
                payload: { userId },
                senderId: 'self',
                timestamp: new Date().toISOString(),
                targetUserId: userId,
              })
            }
          }
        }
        this.emitStatus()
        break
      }

      case 'participant-joined': {
        const userId = msg.payload['userId'] as string
        const rawName = (msg.payload['displayName'] as string)
          ?? (msg.payload['userName'] as string)
          ?? (msg.payload['name'] as string)
        const displayName = (rawName && !rawName.includes('@')) ? rawName : `Guest-${userId.slice(0, 6)}`
        if (userId) {
          const leaveTimer = this.participantLeaveTimers.get(userId)
          if (leaveTimer) { clearTimeout(leaveTimer); this.participantLeaveTimers.delete(userId) }
          if (!this.knownParticipants.has(userId)) {
            logger.info(`[room-signaling] participant joined: ${userId} (${displayName})`)
            this.participantNames.set(userId, displayName)
            this.pov.addParticipant(userId, displayName)
            this.knownParticipants.add(userId)
            this.emitStatus()
          }
        }
        break
      }

      case 'participant-left': {
        const userId = msg.payload['userId'] as string
        if (userId) {
          this.participantNames.delete(userId)
          this.knownParticipants.delete(userId)
          this.frozenParticipants.delete(userId)
          this.freezeRecoveryAttempts.delete(userId)
          if (this.recoveringActiveParticipant === userId) this.recoveringActiveParticipant = null
          const pendingOffer = this.pendingOfferTimers.get(userId)
          if (pendingOffer) { clearTimeout(pendingOffer); this.pendingOfferTimers.delete(userId) }
          // Delay hub PC teardown — cloud signaling can bounce while the WebRTC
          // connection stays alive; if the participant rejoins within 3 s we skip
          const existing = this.participantLeaveTimers.get(userId)
          if (existing) clearTimeout(existing)
          const t = setTimeout(() => {
            this.participantLeaveTimers.delete(userId)
            if (!this.knownParticipants.has(userId)) {
              void this.hub.removeParticipant(userId)
            }
          }, 3_000)
          this.participantLeaveTimers.set(userId, t)
          this.emitStatus()
        }
        break
      }

      case 'offer': {
        const sdp = msg.payload['sdp'] as string
        const userId = msg.senderId
        if (sdp && userId) {
          const offerLeaveTimer = this.participantLeaveTimers.get(userId)
          if (offerLeaveTimer) { clearTimeout(offerLeaveTimer); this.participantLeaveTimers.delete(userId) }
          if (!this.knownParticipants.has(userId)) {
            const rawName = (msg.payload['displayName'] as string) ?? (msg.payload['userName'] as string)
            const displayName = (rawName && !rawName.includes('@')) ? rawName : `Guest-${userId.slice(0, 6)}`
            logger.info(`[room-signaling] auto-registering participant from offer: ${userId} (${displayName})`)
            this.participantNames.set(userId, displayName)
            this.pov.addParticipant(userId, displayName)
            this.knownParticipants.add(userId)
            this.emitStatus()
          }

          // Debounce rapid re-offers (e.g. client sends duplicates 200ms apart).
          // Only the last offer within the window is processed; intermediate ones are discarded.
          const existingTimer = this.pendingOfferTimers.get(userId)
          if (existingTimer) clearTimeout(existingTimer)

          const t = setTimeout(() => {
            this.pendingOfferTimers.delete(userId)
            logger.info(`[room-signaling] received offer from ${userId} (re-offer=${this.hub.hasParticipant(userId)})`)
            this.managedParticipants.add(userId)
            this.pendingCandidates.set(userId, [])
            this.hub.handleOffer(userId, sdp).then(answerSdp => {
              if (!answerSdp) {
                logger.error(`[room-signaling] handleOffer returned empty SDP for ${userId}, requesting re-offer`)
                this.pendingCandidates.delete(userId)
                // Buffered candidates are lost; tell participant to restart so they re-offer
                this.send({ type: 'ice-restart-request', payload: { userId }, senderId: 'self', timestamp: new Date().toISOString(), targetUserId: userId })
                return
              }
              this.send({ type: 'answer', payload: { sdp: answerSdp }, senderId: 'self', timestamp: new Date().toISOString(), targetUserId: userId })
              const buffered = this.pendingCandidates.get(userId) ?? []
              this.pendingCandidates.delete(userId)
              for (const candidate of buffered) {
                this.send({ type: 'ice-candidate', payload: candidate, senderId: 'self', timestamp: new Date().toISOString(), targetUserId: userId })
              }
              this.frozenParticipants.delete(userId)
              this.freezeRecoveryAttempts.delete(userId)
            }).catch(e => {
              logger.error({ err: e }, '[room-signaling] offer handling failed')
              this.pendingCandidates.delete(userId)
              // Buffered candidates are lost; tell participant to restart so they re-offer
              this.send({ type: 'ice-restart-request', payload: { userId }, senderId: 'self', timestamp: new Date().toISOString(), targetUserId: userId })
            })
          }, 80)
          this.pendingOfferTimers.set(userId, t)
        }
        break
      }

      case 'ice-candidate': {
        const userId = msg.senderId
        const candidate = msg.payload['candidate'] as string
        const sdpMid = msg.payload['sdpMid'] as string | undefined
        const sdpMLineIndex = msg.payload['sdpMLineIndex'] as number | undefined
        if (userId && candidate) {
          this.hub.handleIceCandidate(userId, { candidate, sdpMid, sdpMLineIndex })
        }
        break
      }

      case 'answer':
      case 'pong':
        break

      case 'hub-disconnected':
        logger.info('[room-signaling] received hub-disconnected (unexpected as we are hub)')
        break
    }
  }

  private send(msg: WsMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  private startPingTimer(): void {
    this.stopPingTimer()
    this.pingTimer = setInterval(() => {
      this.send({
        type: 'ping',
        payload: {},
        senderId: 'self',
        timestamp: new Date().toISOString(),
      })
    }, PING_INTERVAL_MS)
  }

  private stopPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS)
    this.reconnectAttempt++
    logger.info(`[room-signaling] scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempt})`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectSocket()
    }, delay)
  }

  private async fetchFreshToken(): Promise<void> {
    if (!this.config) return
    try {
      const res = await fetch(`${this.config.cloudUrl}/api/auth/guest-token`, { method: 'GET' })
      if (res.ok) {
        const data = await res.json() as { token: string }
        this.config = { ...this.config, token: data.token }
        logger.info('[room-signaling] obtained fresh guest token')
      } else {
        logger.warn({ status: res.status }, '[room-signaling] failed to refresh token')
      }
    } catch (e) {
      logger.warn({ err: e }, '[room-signaling] failed to refresh token')
    }
  }

  disconnect(): void {
    this.intentionalClose = true
    this.stopPingTimer()
    this.hub.stopFreezeDetection()
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    for (const t of this.freezeRecoveryTimers) clearTimeout(t)
    this.freezeRecoveryTimers.clear()
    for (const t of this.participantLeaveTimers.values()) clearTimeout(t)
    this.participantLeaveTimers.clear()
    for (const t of this.pendingOfferTimers.values()) clearTimeout(t)
    this.pendingOfferTimers.clear()
    if (this.ws) { this.ws.close(); this.ws = null }
    this.participantNames.clear()
    this.knownParticipants.clear()
    this.frozenParticipants.clear()
    this.recoveringActiveParticipant = null
    this.config = null
    this.emitStatus()
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  getStatus(): { connected: boolean; participants: string[]; participantNames: Map<string, string>; roomId: string | null } {
    return {
      connected: this.isConnected(),
      participants: [...this.participantNames.keys()],
      participantNames: new Map(this.participantNames),
      roomId: this.config?.roomId ?? null,
    }
  }

  onStatus(cb: RoomStatusCallback): void {
    this.statusCallbacks.push(cb)
  }

  onParticipantConnectionChange(cb: ParticipantConnectionCallback): void {
    this.connectionChangeCallbacks.push(cb)
  }

  kickParticipant(userId: string): void {
    this.send({
      type: 'kick-participant',
      payload: { userId },
      senderId: 'self',
      timestamp: new Date().toISOString(),
      targetUserId: userId,
    })
    logger.info(`[room-signaling] sent kick for ${userId}`)
  }

  /** Request a participant to send a fresh offer (ice-restart-request) */
  requestReOffer(userId: string): void {
    this.send({
      type: 'ice-restart-request',
      payload: { userId },
      senderId: 'self',
      timestamp: new Date().toISOString(),
      targetUserId: userId,
    })
    logger.info(`[room-signaling] sent ice-restart-request to ${userId} (relay re-offer)`)
  }

  private emitStatus(): void {
    const status = this.getStatus()
    for (const cb of this.statusCallbacks) cb(status)
  }

  private emitConnectionChange(userId: string, connected: boolean): void {
    for (const cb of this.connectionChangeCallbacks) cb(userId, connected)
  }
}

/** @deprecated Use RoomSignaling */
export { RoomSignaling as CloudSignaling }
/** @deprecated Use RoomSignalingConfig */
export type CloudSignalingConfig = RoomSignalingConfig
