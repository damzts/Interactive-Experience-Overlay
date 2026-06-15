/**
 * Room preview relay — forward participant video streams to the admin UI.
 *
 * Creates one sendonly RTCPeerConnection per participant that has a video track,
 * then signals the SDP offer to the admin via Socket.IO.
 */

import {
  RTCPeerConnection,
  MediaStreamTrack,
  type RTCIceCandidateInit,
} from 'werift'
import type { Socket } from 'socket.io'
import type { RoomHub, ParticipantMedia } from './room-hub.js'
import logger from '../../lib/logger.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoomPreviewStreamInfo {
  userId: string
  displayName: string
  hasVideo: boolean
  hasAudio: boolean
}

export type RoomPreviewOfferCallback = (userId: string, sdp: string) => void

// ---------------------------------------------------------------------------
// Participant connection state
// ---------------------------------------------------------------------------

interface ParticipantRelay {
  userId: string
  displayName: string
  pc: RTCPeerConnection
  audioTrack: MediaStreamTrack | null
  videoTrack: MediaStreamTrack | null
  connected: boolean
}

// ---------------------------------------------------------------------------
// RoomPreviewRelay class
// ---------------------------------------------------------------------------

export class RoomPreviewRelay {
  private relays = new Map<string, ParticipantRelay>()
  private adminSockets = new Map<string, Socket>()
  private hub: RoomHub | null = null
  private offerCallbacks: RoomPreviewOfferCallback[] = []

  /**
   * When true, relay PeerConnections persist even when all admin sockets
   * disconnect. This provides defense-in-depth: if the admin socket briefly
   * disconnects (network hiccup or navigation), relays survive and are
   * re-bound when a new admin socket connects via `setSocket()`.
   */
  persistOnDisconnect = true

  private get adminSocket(): Socket | null {
    return this.adminSockets.values().next().value ?? null
  }

  private emit(event: string, payload: unknown): void {
    for (const sock of this.adminSockets.values()) sock.emit(event as any, payload)
  }

  bindHub(hub: RoomHub): void {
    this.hub = hub

    hub.onTrack((userId, kind, _track) => {
      if (this.adminSockets.size === 0 && !this.persistOnDisconnect) return

      if (kind === 'video') {
        const existing = this.relays.get(userId)
        if (existing) {
          existing.videoTrack = _track
          if (existing.connected) {
            const sender = existing.pc.getSenders().find(s => s.track?.kind === 'video')
            if (sender) sender.replaceTrack(_track).catch(() => {})
          }
          return
        }
        this.createRelay(userId, _track, hub.getAudioTrack(userId) ?? undefined)
      } else if (kind === 'audio') {
        const existing = this.relays.get(userId)
        if (existing) existing.audioTrack = _track
      }
    })

    hub.onParticipantRemoved((userId) => {
      this.removeRelay(userId)
    })
  }

  setSocket(socket: Socket): void {
    this.adminSockets.set(socket.id, socket)
    socket.emit('pov-online:preview:status', this.getStatus())
    const existingRelays = [...this.relays.values()]
    for (const relay of existingRelays) this.removeRelay(relay.userId)
    if (this.hub) {
      for (const userId of this.hub.getParticipantIds()) {
        const videoTrack = this.hub.getVideoTrack(userId)
        if (videoTrack) {
          const audioTrack = this.hub.getAudioTrack(userId) ?? undefined
          void this.createRelay(userId, videoTrack, audioTrack)
        }
      }
    }
  }

  clearSocket(socketId: string): void {
    this.adminSockets.delete(socketId)
    if (this.adminSockets.size === 0 && !this.persistOnDisconnect) {
      for (const [id] of this.relays) this.removeRelay(id)
    }
    // When persistOnDisconnect is true (default), relays stay alive even
    // after the last admin socket disconnects. They will be re-bound when
    // a new admin socket calls setSocket().
  }

  async handleAnswer(userId: string, sdp: string): Promise<void> {
    const relay = this.relays.get(userId)
    if (!relay) {
      logger.warn({ userId }, '[room-preview-relay] answer for unknown participant')
      return
    }
    try {
      await relay.pc.setRemoteDescription({ type: 'answer', sdp })
      relay.connected = true
      logger.info({ userId }, '[room-preview-relay] participant relay connected')
    } catch (err) {
      logger.error({ err, userId }, '[room-preview-relay] failed to set answer')
    }
  }

  async handleIceCandidate(userId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const relay = this.relays.get(userId)
    if (!relay) return
    try {
      await relay.pc.addIceCandidate(candidate)
    } catch {
      // Stale candidates are fine
    }
  }

  private async createRelay(
    userId: string,
    videoTrack: MediaStreamTrack,
    audioTrack?: MediaStreamTrack,
  ): Promise<void> {
    if (this.adminSockets.size === 0 && !this.persistOnDisconnect) return

    const existing = this.relays.get(userId)
    if (existing) return

    // When no admin socket is connected but persistOnDisconnect is active,
    // store a lightweight relay entry without creating a PeerConnection.
    // When an admin reconnects via setSocket(), relays are rebuilt with
    // proper PeerConnections and signaling.
    if (this.adminSockets.size === 0) {
      const relay: ParticipantRelay = {
        userId,
        displayName: `Participant`,
        pc: null as unknown as RTCPeerConnection,
        audioTrack: audioTrack ?? null,
        videoTrack,
        connected: false,
      }
      this.relays.set(userId, relay)
      logger.info({ userId }, '[room-preview-relay] relay persisted (no admin socket)')
      return
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    const relay: ParticipantRelay = {
      userId,
      displayName: `Participant`,
      pc,
      audioTrack: audioTrack ?? null,
      videoTrack,
      connected: false,
    }
    this.relays.set(userId, relay)

    pc.onIceCandidate.subscribe((candidate: any) => {
      if (candidate) {
        this.emit('pov-online:preview:ice', { userId, candidate: candidate.toJSON() })
      }
    })

    pc.addTrack(videoTrack)

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      this.emit('pov-online:preview:offer', {
        userId,
        sdp: pc.localDescription!.sdp,
        displayName: relay.displayName,
        hasAudio: !!audioTrack,
        hasVideo: true,
      })

      logger.info({ userId }, '[room-preview-relay] offer sent to admin')
    } catch (err) {
      logger.error({ err, userId }, '[room-preview-relay] failed to create offer')
      this.removeRelay(userId)
    }
  }

  private removeRelay(userId: string): void {
    const relay = this.relays.get(userId)
    if (!relay) return
    try { if (relay.pc) relay.pc.close() } catch { /* ignore */ }
    this.relays.delete(userId)

    if (this.adminSockets.size > 0) {
      this.emit('pov-online:preview:removed', { userId })
    }

    logger.info({ userId }, '[room-preview-relay] relay removed')
  }

  cleanup(): void {
    for (const [id] of [...this.relays]) {
      this.removeRelay(id)
    }
    this.adminSockets.clear()
  }

  getStatus(): RoomPreviewStreamInfo[] {
    return [...this.relays.values()].map(r => ({
      userId: r.userId,
      displayName: r.displayName,
      hasVideo: !!r.videoTrack,
      hasAudio: !!r.audioTrack,
    }))
  }
}

/** @deprecated Use RoomPreviewRelay */
export { RoomPreviewRelay as AdminRelay }
