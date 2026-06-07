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
import type { HubConnection } from './hub-connection.js'
import type { POVOrchestrator } from '../../kernel/managers/pov.js'
import type { OverlayRelay } from './overlay-relay.js'
import logger from '../../lib/logger.js';


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
    private overlayRelay: OverlayRelay,
  ) {
    this.pov.onSwitch((_prev, next) => {
      this.overlayRelay.switchTo(this.hub.getAudioTrack(next), this.hub.getVideoTrack(next))
    })

    this.hub.onTrack((userId, kind) => {
      // Auto-select first participant if none active
      if (!this.pov.activeCameraId) {
        this.pov.switcher.manualSelect(userId)
      } else if (userId === this.pov.activeCameraId) {
        this.overlayRelay.switchTo(this.hub.getAudioTrack(userId), this.hub.getVideoTrack(userId))
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
      logger.warn({ userId }, 'ICE failed for ${userId}, will re-negotiate')
      // Si el WS aún está vivo, el participante puede re-conectar por su lado
      // Si no, esperamos a que re-conecte al WS y reciba nueva offer
      this.frozenParticipants.add(userId)
    })

    // ── Detectar video congelado → recovery ─────────────────────────────
    this.hub.onTrackMuted((userId, kind) => {
      if (kind !== 'video') return
      logger.warn({ userId }, '${userId} video frozen/muted, scheduling recovery')
      this.frozenParticipants.add(userId)

      // Dar chance a que el participante se recupere solo
      setTimeout(() => {
        if (!this.frozenParticipants.has(userId)) return
        logger.info({ userId }, 'initiating recovery for frozen participant ${userId}')

        // Forzar re-negociación: el hub envía una notificación al participante
        // En este modelo, el hub no puede iniciar re-negociación — el participante
        // debe ofrecer de nuevo. Pero notificamos al sistema para que lo maneje.
        // Alternativa: si el WS está vivo, pedir un ICE restart
        this.send({
          type: 'ice-restart-request',
          payload: { userId },
          senderId: 'self',
          timestamp: new Date().toISOString(),
          targetUserId: userId,
        })

        this.frozenParticipants.delete(userId)
      }, FREEZE_RECOVERY_DELAY_MS)
    })
  }

  async connect(config: CloudSignalingConfig): Promise<void> {
    this.disconnect()
    this.config = config
    this.intentionalClose = false
    this.reconnectAttempt = 0
    this.frozenParticipants.clear()
    this.openSocket()
  }

  private openSocket(): void {
    if (!this.config) return
    const { cloudUrl, token, roomId } = this.config

    // Connection counter para detectar sockets stale
    // Cuando disconnect()+openSocket() se llaman en secuencia, el close
    // asíncrono del socket viejo no debe afectar al nuevo.
    const connId = ++this.connCounter

    // Build WebSocket URL: ws(s)://host/api/ws/rooms/:roomId?token=***
    const base = cloudUrl.replace(/^http/, 'ws')
    const url = `${base}/api/ws/rooms/${roomId}?token=${encodeURIComponent(token)}`

    const ws = new WebSocket(url)
    this.ws = ws

    const isStale = () => this.connCounter !== connId

    ws.on('open', () => {
      if (isStale()) return
      this.reconnectAttempt = 0
      logger.log({ roomId }, '[cloud-signaling] connected to room:')
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

    ws.on('close', () => {
      if (isStale()) return // <-- CRÍTICO: no nullificar el socket nuevo
      logger.log('[cloud-signaling] disconnected')
      this.ws = null
      this.stopPingTimer()
      this.emitStatus()
      if (!this.intentionalClose) this.scheduleReconnect()
    })

    ws.on('error', (err) => {
      if (isStale()) return
      logger.log({ (err as any) }, '[cloud-signaling] error:')
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
        if (userId) {
          logger.info({ userId, displayName }, 'participant joined')
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
            logger.info({ userId, displayName }, 'auto-registering participant from offer')
            this.participantNames.set(userId, displayName)
            this.pov.addParticipant(userId, displayName)
            this.knownParticipants.add(userId)
            this.emitStatus()
          }

          logger.log({}, `[cloud-signaling] received offer from ${userId} (re-offer=${this.hub.hasParticipant(userId)})`)
          this.pendingCandidates.set(userId, [])
          this.hub.handleOffer(userId, sdp).then(answerSdp => {
            this.send({ type: 'answer', payload: { sdp: answerSdp }, senderId: 'self', timestamp: new Date().toISOString(), targetUserId: userId })
            // Flush buffered ICE candidates after answer
            const buffered = this.pendingCandidates.get(userId) ?? []
            this.pendingCandidates.delete(userId)
            for (const candidate of buffered) {
              this.send({ type: 'ice-candidate', payload: candidate, senderId: 'self', timestamp: new Date().toISOString(), targetUserId: userId })
            }
            // Si este participante estaba congelado, marcar como recuperado
            this.frozenParticipants.delete(userId)
          logger.error({ e }, '[cloud-signaling] offer handling failed:')
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
        logger.log('[cloud-signaling] received hub-disconnected (unexpected as we are hub)')
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
    logger.info({ delay, attempt: this.reconnectAttempt }, 'scheduling reconnect')
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.openSocket()
    }, delay)
  }

  // ── Public API ─────────────────────────────────────────────────
  disconnect(): void {
    this.intentionalClose = true
    this.stopPingTimer()
    this.hub.stopFreezeDetection()
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
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
    logger.info({ userId }, 'sent kick')
  }

  private emitStatus(): void {
    const status = this.getStatus()
    for (const cb of this.statusCallbacks) cb(status)
  }
}
