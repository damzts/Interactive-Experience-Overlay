/**
 * Cloud signaling client — connects to the cloud's /rooms namespace as the hub.
 * Routes WebRTC signaling between browser participants and the local HubConnection.
 */

import { io, type Socket } from 'socket.io-client'
import type { HubConnection } from './hub-connection.js'
import type { POVOrchestrator } from '../pov/index.js'
import type { OverlayRelay } from './overlay-relay.js'

export interface CloudSignalingConfig {
  cloudUrl: string
  token: string
  roomId: string
}

export type RoomStatusCallback = (status: { connected: boolean; participants: string[]; roomId: string | null }) => void

export class CloudSignaling {
  private socket: Socket | null = null
  private config: CloudSignalingConfig | null = null
  private statusCallbacks: RoomStatusCallback[] = []
  private participantNames = new Map<string, string>()

  constructor(
    private hub: HubConnection,
    private pov: POVOrchestrator,
    private overlayRelay: OverlayRelay,
  ) {
    // When POV switches, forward the new participant's tracks to the overlay
    this.pov.onSwitch((_prev, next) => {
      const audioTrack = this.hub.getAudioTrack(next)
      const videoTrack = this.hub.getVideoTrack(next)
      this.overlayRelay.switchTo(audioTrack, videoTrack)
    })

    // When a new track arrives and it's the active participant, forward it
    this.hub.onTrack((userId, _kind) => {
      if (userId === this.pov.activeCameraId) {
        const audioTrack = this.hub.getAudioTrack(userId)
        const videoTrack = this.hub.getVideoTrack(userId)
        this.overlayRelay.switchTo(audioTrack, videoTrack)
      }
    })
  }

  async connect(config: CloudSignalingConfig): Promise<void> {
    this.disconnect()
    this.config = config

    this.socket = io(`${config.cloudUrl}/rooms`, {
      auth: { token: config.token, roomId: config.roomId, role: 'hub' },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    })

    this.socket.on('connect', () => {
      this.socket!.emit('join-as-hub', { roomId: config.roomId })
      this.emitStatus()
    })

    this.socket.on('participants-list', (payload: { participants: Array<{ userId: string; displayName: string }> }) => {
      for (const p of payload.participants) {
        this.participantNames.set(p.userId, p.displayName)
        this.pov.addParticipant(p.userId, p.displayName)
      }
      this.emitStatus()
    })

    this.socket.on('participant-joined', (payload: { userId: string; displayName: string }) => {
      this.participantNames.set(payload.userId, payload.displayName)
      this.pov.addParticipant(payload.userId, payload.displayName)
      this.emitStatus()
    })

    this.socket.on('participant-left', (payload: { userId: string }) => {
      this.participantNames.delete(payload.userId)
      this.hub.removeParticipant(payload.userId)
      this.emitStatus()
    })

    this.socket.on('offer', async (payload: { sdp: string; userId: string }) => {
      const answerSdp = await this.hub.handleOffer(payload.userId, payload.sdp)
      this.socket!.emit('answer', { sdp: answerSdp, userId: payload.userId })
    })

    this.socket.on('ice-candidate', (payload: { candidate: string; sdpMid?: string; sdpMLineIndex?: number; userId: string }) => {
      this.hub.handleIceCandidate(payload.userId, {
        candidate: payload.candidate,
        sdpMid: payload.sdpMid,
        sdpMLineIndex: payload.sdpMLineIndex,
      })
    })

    this.socket.on('disconnect', () => {
      this.emitStatus()
    })
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.participantNames.clear()
    this.config = null
    this.emitStatus()
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false
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
