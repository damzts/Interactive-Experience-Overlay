/**
 * Admin relay — forward participant video streams to the admin UI.
 *
 * Creates one sendonly RTCPeerConnection per participant that has a video track,
 * then signals the SDP offer to the admin via Socket.IO.
 *
 * The admin UI creates a <video> element per connection, answers the offer,
 * and renders the incoming stream.
 *
 * Since server and admin are both on localhost, ICE is loopback (no STUN needed).
 */

import {
  RTCPeerConnection,
  MediaStreamTrack,
  type RTCIceCandidateInit,
} from 'werift'
import type { Socket } from 'socket.io'
import type { HubConnection, ParticipantMedia } from './hub-connection.js'
import logger from '../../lib/logger.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminStreamInfo {
  userId: string
  displayName: string
  hasVideo: boolean
  hasAudio: boolean
}

export type AdminOfferCallback = (userId: string, sdp: string) => void

// ---------------------------------------------------------------------------
// Participant connection state
// ---------------------------------------------------------------------------

interface ParticipantRelay {
  userId: string
  displayName: string
  pc: RTCPeerConnection
  audioTrack: MediaStreamTrack | null
  videoTrack: MediaStreamTrack | null
  /** Set when the remote description has been set (answer received) */
  connected: boolean
}

// ---------------------------------------------------------------------------
// AdminRelay class
// ---------------------------------------------------------------------------

export class AdminRelay {
  /** Map participantId → relay state */
  private relays = new Map<string, ParticipantRelay>()
  private adminSockets = new Map<string, Socket>()
  private hub: HubConnection | null = null
  /** Callbacks to notify admin when a new offer is ready */
  private offerCallbacks: AdminOfferCallback[] = []

  private get adminSocket(): Socket | null {
    // Return first socket for legacy single-socket calls
    return this.adminSockets.values().next().value ?? null
  }

  private emit(event: string, payload: unknown): void {
    for (const sock of this.adminSockets.values()) sock.emit(event as any, payload)
  }

  // ── Wiring ──────────────────────────────────────────────────────────────

  /**
   * Bind to HubConnection to react when participants connect/disconnect.
   */
  bindHub(hub: HubConnection): void {
    this.hub = hub

    hub.onTrack((userId, kind, _track) => {
      if (this.adminSockets.size === 0) return

      if (kind === 'video') {
        // Start relay if we have video from this participant
        const existing = this.relays.get(userId)
        if (existing) {
          existing.videoTrack = _track
          // If already connected, try replaceTrack
          if (existing.connected) {
            const sender = existing.pc.getSenders().find(s => s.track?.kind === 'video')
            if (sender) sender.replaceTrack(_track).catch(() => {})
          }
          return
        }
        // No existing relay — create one
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

  /**
   * Attach the admin's Socket.IO socket for signaling.
   */
  setSocket(socket: Socket): void {
    this.adminSockets.set(socket.id, socket)
    // Send current stream status
    socket.emit('admin:stream-status', this.getStatus())
    // Recreate relays so fresh offers go to all connected sockets
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
    // Only tear down relays if no consumers remain
    if (this.adminSockets.size === 0) {
      for (const [id] of this.relays) this.removeRelay(id)
    }
  }

  // ── Signaling handlers (called from socket event handlers) ─────────────

  /**
   * Handle an answer from the admin for a participant's offer.
   */
  async handleAnswer(userId: string, sdp: string): Promise<void> {
    const relay = this.relays.get(userId)
    if (!relay) {
      logger.warn({ userId }, '[admin-relay] answer for unknown participant')
      return
    }
    try {
      await relay.pc.setRemoteDescription({ type: 'answer', sdp })
      relay.connected = true
      logger.info({ userId }, '[admin-relay] participant relay connected')
    } catch (err) {
      logger.error({ err, userId }, '[admin-relay] failed to set answer')
    }
  }

  /**
   * Handle an ICE candidate from the admin.
   */
  async handleIceCandidate(userId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const relay = this.relays.get(userId)
    if (!relay) return
    try {
      await relay.pc.addIceCandidate(candidate)
    } catch {
      // Stale candidates are fine
    }
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private async createRelay(
    userId: string,
    videoTrack: MediaStreamTrack,
    audioTrack?: MediaStreamTrack,
  ): Promise<void> {
    if (this.adminSockets.size === 0) return

    // Avoid duplicates
    const existing = this.relays.get(userId)
    if (existing) return

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

    // Forward ICE candidates to all admin consumers
    pc.onIceCandidate.subscribe((candidate: any) => {
      if (candidate) {
        this.emit('admin:ice-candidate', { userId, candidate: candidate.toJSON() })
      }
    })

    // Add the video track to the PC
    pc.addTrack(videoTrack)

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Notify all consumers of the offer
      this.emit('admin:offer', {
        userId,
        sdp: pc.localDescription!.sdp,
        displayName: relay.displayName,
        hasAudio: !!audioTrack,
        hasVideo: true,
      })

      logger.info({ userId }, '[admin-relay] offer sent to admin')
    } catch (err) {
      logger.error({ err, userId }, '[admin-relay] failed to create offer')
      this.removeRelay(userId)
    }
  }

  private removeRelay(userId: string): void {
    const relay = this.relays.get(userId)
    if (!relay) return
    try { relay.pc.close() } catch { /* ignore */ }
    this.relays.delete(userId)

    if (this.adminSockets.size > 0) {
      this.emit('admin:stream-removed', { userId })
    }

    logger.info({ userId }, '[admin-relay] relay removed')
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────

  cleanup(): void {
    for (const [id] of [...this.relays]) {
      this.removeRelay(id)
    }
    this.adminSockets.clear()
  }

  /**
   * Get current relay status for the admin.
   */
  getStatus(): AdminStreamInfo[] {
    return [...this.relays.values()].map(r => ({
      userId: r.userId,
      displayName: r.displayName,
      hasVideo: !!r.videoTrack,
      hasAudio: !!r.audioTrack,
    }))
  }
}
