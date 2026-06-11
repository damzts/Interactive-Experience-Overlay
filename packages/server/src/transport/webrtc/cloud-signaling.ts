/**
 * Cloud signaling client — connects to ieom-api's /ws/rooms/:roomId as the hub.
 * Uses native WebSocket (ws) instead of Socket.IO for minimal overhead.
 * Routes WebRTC signaling between browser participants and the local HubConnection.
 *
 * == Cambios implementados ==
 * - Ping periódico cada 15s para mantener el WebSocket vivo (complementa heartbeat nativo)
 * - Re-negociación automática cuando un participante reconecta después de ICE failure
 * - Detección de video congelado + recuperación forzando re-negociación
 * - Manejo de participantes re-joining con re-offer
 */

import WebSocket from 'ws'
import logger from '../../lib/logger.js'
import type { HubConnection } from './hub-connection.js'
import type { POVOrchestrator } from '../../kernel/managers/pov.js'

export interface CloudSignalingConfig {
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

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30000
const PING_INTERVAL_MS = 15_000        // enviar ping cada 15s
const FREEZE_RECOVERY_DELAY_MS = 2_000 // esperar 2s antes de re-negociar

export class CloudSignaling {
  private ws: WebSocket | null = null
  private config: CloudSignalingConfig | null = null
  private statusCallbacks: RoomStatusCallback[] = []
  private participantNames = new Map<string, string>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private freezeRecoveryTimers = new Set<ReturnType<typeof setTimeout>>()
  private reconnectAttempt = 0
  private intentionalClose = false
  private connCounter = 0
  private pendingCandidates = new Map<string, Record<string, unknown>[]>()
  /** Participantes que sabemos que están en la sala (para re-negociar tras reconexión WS) */
  private knownParticipants = new Set<string>()
  /** Participantes cuyo video está congelado (para recovery) */
  private frozenParticipants = new Set<string>()

  constructor(
    private hub: HubConnection,
    private pov: POVOrchestrator,
  ) {
    this.hub.onTrack((userId) => {
      // Auto-select first participant if none active
      if (!this.pov.activeCameraId) {
        this.pov.switcher.manualSelect(userId)
      }
    })

    this.hub.onIceCandidate((userId, candidate) => {
      // Buffer candidates if answer hasn't been sent yet
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

    // ── Detectar ICE failure → intentar re-negociación ─────────────────
    this.hub.onIceFailed((userId) => {
      logger.info(`[cloud-signaling] ICE failed for ${userId}, will re-negotiate`)
      // Si el WS aún está vivo, el participante puede re-conectar por su lado
      // Si no, esperamos a que re-conecte al WS y reciba nueva offer
      this.frozenParticipants.add(userId)
    })

    // ── Detectar video congelado → recovery ─────────────────────────────
    this.hub.onTrackMuted((userId, kind) => {
      if (kind !== 'video') return
      logger.info(`[cloud-signaling] ${userId} video frozen/muted, scheduling recovery`)
      this.frozenParticipants.add(userId)

      // Dar chance a que el participante se recupere solo
      const t = setTimeout(() => {
        this.freezeRecoveryTimers.delete(t)
        if (!this.frozenParticipants.has(userId)) return
        logger.info(`[cloud-signaling] initiating recovery for frozen participant ${userId}`)
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

  /**
   * Connect to cloud room as hub.
   * Returns when the WebSocket is open (or throws on timeout/error).
   */
  async connect(config: CloudSignalingConfig, timeoutMs = 10_000): Promise<void> {
    this.disconnect()
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
        logger.info({ value: roomId }, '[cloud-signaling] connected to room')
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
        logger.info({ value: code, msg: reason?.toString() }, '[cloud-signaling] disconnected')
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
        logger.info('[cloud-signaling] error:', msg)
        reject(new Error(`WebSocket error: ${msg}`))
      })
    })
  }

  /**
   * Reconnect (reconnection path) — non-blocking, fires and forgets.
   * Signals are wired so the emitStatus / startPingTimer happen on 'open'.
   */
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
      logger.info({ value: roomId }, '[cloud-signaling] reconnected to room')
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
      logger.info({ value: code, msg: reason?.toString() }, '[cloud-signaling] reconnection socket disconnected')
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
      logger.info('[cloud-signaling] reconnection error:', (err as any).message ?? err)
    })
  }

  private handleMessage(msg: WsMessage): void {
    switch (msg.type) {
      case 'participants-list': {
        const participants = msg.payload['participants'] as string[] | undefined
        if (participants) {
          for (const userId of participants) {
            const name = `Guest-${userId.slice(0, 6)}`
            this.participantNames.set(userId, name)
            this.pov.addParticipant(userId, name)
            this.knownParticipants.add(userId)
          }
        }
        this.emitStatus()
        break
      }

      case 'participant-joined': {
        const userId = msg.payload['userId'] as string
        // Prefer displayName/userName over email for privacy
        const rawName = (msg.payload['displayName'] as string)
          ?? (msg.payload['userName'] as string)
          ?? (msg.payload['name'] as string)
        // If name looks like an email or is missing, use a generic guest name
        const displayName = (rawName && !rawName.includes('@')) ? rawName : `Guest-${userId.slice(0, 6)}`
        if (userId && !this.knownParticipants.has(userId)) {
          logger.info(`[cloud-signaling] participant joined: ${userId} (${displayName})`)
          this.participantNames.set(userId, displayName)
          this.pov.addParticipant(userId, displayName)
          this.knownParticipants.add(userId)
          this.emitStatus()
        }
        break
      }

      case 'participant-left': {
        const userId = msg.payload['userId'] as string
        if (userId) {
          this.participantNames.delete(userId)
          this.knownParticipants.delete(userId)
          this.frozenParticipants.delete(userId)
          this.hub.removeParticipant(userId)
          this.emitStatus()
        }
        break
      }

      case 'offer': {
        const sdp = msg.payload['sdp'] as string
        const userId = msg.senderId
        if (sdp && userId) {
          // Auto-register participant if we haven't seen a participant-joined event
          if (!this.knownParticipants.has(userId)) {
            const rawName = (msg.payload['displayName'] as string) ?? (msg.payload['userName'] as string)
            const displayName = (rawName && !rawName.includes('@')) ? rawName : `Guest-${userId.slice(0, 6)}`
            logger.info(`[cloud-signaling] auto-registering participant from offer: ${userId} (${displayName})`)
            this.participantNames.set(userId, displayName)
            this.pov.addParticipant(userId, displayName)
            this.knownParticipants.add(userId)
            this.emitStatus()
          }

          logger.info(`[cloud-signaling] received offer from ${userId} (re-offer=${this.hub.hasParticipant(userId)})`)
          this.pendingCandidates.set(userId, [])
          this.hub.handleOffer(userId, sdp).then(answerSdp => {
            if (!answerSdp) {
              logger.error(`[cloud-signaling] handleOffer returned empty SDP for ${userId}, skipping answer`)
              this.pendingCandidates.delete(userId)
              return
            }
            this.send({ type: 'answer', payload: { sdp: answerSdp }, senderId: 'self', timestamp: new Date().toISOString(), targetUserId: userId })
            // Flush buffered ICE candidates after answer
            const buffered = this.pendingCandidates.get(userId) ?? []
            this.pendingCandidates.delete(userId)
            for (const candidate of buffered) {
              this.send({ type: 'ice-candidate', payload: candidate, senderId: 'self', timestamp: new Date().toISOString(), targetUserId: userId })
            }
            // Si este participante estaba congelado, marcar como recuperado
            this.frozenParticipants.delete(userId)
          }).catch(e => logger.error({ err: e }, '[cloud-signaling] offer handling failed'))
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

      case 'answer': {
        // Ignored — hub doesn't receive answers in normal flow
        break
      }

      case 'pong': {
        // Respuesta al ping — solo sirve para mantener el tráfico activo
        break
      }

      case 'hub-disconnected':
        // Shouldn't happen since we ARE the hub, but handle gracefully
        logger.info('[cloud-signaling] received hub-disconnected (unexpected as we are hub)')
        break
    }
  }

  private send(msg: WsMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  // ── Ping periódico ─────────────────────────────────────────────
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

  // ── Reconexión con backoff exponencial ─────────────────────────
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS)
    this.reconnectAttempt++
    logger.info(`[cloud-signaling] scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempt})`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectSocket()
    }, delay)
  }

  // ── Token refresh ──────────────────────────────────────────
  private async fetchFreshToken(): Promise<void> {
    if (!this.config) return
    try {
      const res = await fetch(`${this.config.cloudUrl}/api/auth/guest-token`, { method: 'GET' })
      if (res.ok) {
        const data = await res.json() as { token: string }
        this.config = { ...this.config, token: data.token }
        logger.info('[cloud-signaling] obtained fresh guest token')
      } else {
        logger.warn({ status: res.status }, '[cloud-signaling] failed to refresh token')
      }
    } catch (e) {
      logger.warn({ err: e }, '[cloud-signaling] failed to refresh token')
    }
  }

  // ── Public API ─────────────────────────────────────────────────
  disconnect(): void {
    this.intentionalClose = true
    this.stopPingTimer()
    this.hub.stopFreezeDetection()
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    for (const t of this.freezeRecoveryTimers) clearTimeout(t)
    this.freezeRecoveryTimers.clear()
    if (this.ws) { this.ws.close(); this.ws = null }
    this.participantNames.clear()
    this.knownParticipants.clear()
    this.frozenParticipants.clear()
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

  /** Tell the cloud to kick a participant (cloud will disconnect their WS + notify them) */
  kickParticipant(userId: string): void {
    this.send({
      type: 'kick-participant',
      payload: { userId },
      senderId: 'self',
      timestamp: new Date().toISOString(),
      targetUserId: userId,
    })
    logger.info(`[cloud-signaling] sent kick for ${userId}`)
  }

  private emitStatus(): void {
    const status = this.getStatus()
    for (const cb of this.statusCallbacks) cb(status)
  }
}
