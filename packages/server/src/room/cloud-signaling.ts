/**
 * Cloud signaling client — connects to ieom-api's /ws/rooms/:roomId as the hub.
 * Uses native WebSocket (ws) instead of Socket.IO for minimal overhead.
 * Routes WebRTC signaling between browser participants and the local HubConnection.
 */

import WebSocket from 'ws'
import type { HubConnection } from './hub-connection.js'
import type { POVOrchestrator } from '../pov/index.js'
import type { OverlayRelay } from './overlay-relay.js'

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

export type RoomStatusCallback = (status: { connected: boolean; participants: string[]; roomId: string | null }) => void

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30000

export class CloudSignaling {
  private ws: WebSocket | null = null
  private config: CloudSignalingConfig | null = null
  private statusCallbacks: RoomStatusCallback[] = []
  private participantNames = new Map<string, string>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private intentionalClose = false
  private pendingCandidates = new Map<string, Record<string, unknown>[]>()

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
  }

  async connect(config: CloudSignalingConfig): Promise<void> {
    this.disconnect()
    this.config = config
    this.intentionalClose = false
    this.reconnectAttempt = 0
    this.openSocket()
  }

  private openSocket(): void {
    if (!this.config) return
    const { cloudUrl, token, roomId } = this.config

    // Build WebSocket URL: ws(s)://host/api/ws/rooms/:roomId?token=jwt
    const base = cloudUrl.replace(/^http/, 'ws')
    const url = `${base}/api/ws/rooms/${roomId}?token=${encodeURIComponent(token)}`

    const ws = new WebSocket(url)
    this.ws = ws

    ws.on('open', () => {
      if (this.ws !== ws) return // stale socket
      this.reconnectAttempt = 0
      console.log('[cloud-signaling] connected to room:', roomId)
      this.send({ type: 'join-as-hub', payload: {}, senderId: 'self', timestamp: new Date().toISOString() })
      this.emitStatus()
    })

    ws.on('message', (data: WebSocket.Data) => {
      if (this.ws !== ws) return
      let msg: WsMessage
      try { msg = JSON.parse(data.toString()) }
      catch { return }
      this.handleMessage(msg)
    })

    this.ws.on('close', () => {
      console.log('[cloud-signaling] disconnected')
      this.ws = null
      this.emitStatus()
      if (!this.intentionalClose) this.scheduleReconnect()
    })

    this.ws.on('error', (err) => {
      console.log('[cloud-signaling] error:', (err as any).message ?? err)
    })
  }

  private handleMessage(msg: WsMessage): void {
    switch (msg.type) {
      case 'participants-list': {
        const participants = msg.payload['participants'] as string[] | undefined
        if (participants) {
          for (const userId of participants) {
            this.participantNames.set(userId, userId)
            this.pov.addParticipant(userId, userId)
          }
        }
        this.emitStatus()
        break
      }

      case 'participant-joined': {
        const userId = msg.payload['userId'] as string
        const displayName = (msg.payload['userEmail'] as string) ?? userId
        if (userId) {
          this.participantNames.set(userId, displayName)
          this.pov.addParticipant(userId, displayName)
          this.emitStatus()
        }
        break
      }

      case 'participant-left': {
        const userId = msg.payload['userId'] as string
        if (userId) {
          this.participantNames.delete(userId)
          this.hub.removeParticipant(userId)
          this.emitStatus()
        }
        break
      }

      case 'offer': {
        const sdp = msg.payload['sdp'] as string
        const userId = msg.senderId
        if (sdp && userId) {
          this.pendingCandidates.set(userId, [])
          this.hub.handleOffer(userId, sdp).then(answerSdp => {
            this.send({ type: 'answer', payload: { sdp: answerSdp }, senderId: 'self', timestamp: new Date().toISOString(), targetUserId: userId })
            // Flush buffered ICE candidates after answer
            const buffered = this.pendingCandidates.get(userId) ?? []
            this.pendingCandidates.delete(userId)
            for (const candidate of buffered) {
              this.send({ type: 'ice-candidate', payload: candidate, senderId: 'self', timestamp: new Date().toISOString(), targetUserId: userId })
            }
          }).catch(e => console.error('[cloud-signaling] offer handling failed:', e.message))
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

      case 'hub-disconnected':
        // Shouldn't happen since we ARE the hub, but handle gracefully
        break
    }
  }

  private send(msg: WsMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS)
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.openSocket()
    }, delay)
  }

  disconnect(): void {
    this.intentionalClose = true
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    if (this.ws) { this.ws.close(); this.ws = null }
    this.participantNames.clear()
    this.config = null
    this.emitStatus()
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  getStatus(): { connected: boolean; participants: string[]; roomId: string | null } {
    return {
      connected: this.isConnected(),
      participants: [...this.participantNames.keys()],
      roomId: this.config?.roomId ?? null,
    }
  }

  onStatus(cb: RoomStatusCallback): void {
    this.statusCallbacks.push(cb)
  }

  private emitStatus(): void {
    const status = this.getStatus()
    for (const cb of this.statusCallbacks) cb(status)
  }
}
