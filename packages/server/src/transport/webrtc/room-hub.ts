/**
 * WebRTC hub connection manager using werift.
 * Manages N peer connections from browser participants.
 * Each participant sends their camera/mic; the server receives all streams.
 */

import {
  RTCPeerConnection,
  type RTCIceCandidateInit,
  type MediaStreamTrack,
} from 'werift'
import logger from '../../lib/logger.js'

export interface ParticipantMedia {
  userId: string
  pc: RTCPeerConnection
  _stale: boolean
  audioTrack: MediaStreamTrack | null
  videoTrack: MediaStreamTrack | null
  iceState: 'new' | 'checking' | 'connected' | 'completed' | 'failed' | 'disconnected' | 'closed'
  lastVideoPacketMs: number
  videoMuted: boolean
}

function markStale(media: ParticipantMedia): void {
  media._stale = true
}

export type TrackCallback = (userId: string, kind: 'audio' | 'video', track: MediaStreamTrack) => void
export type TrackMutedCallback = (userId: string, kind: 'audio' | 'video') => void
export type ParticipantRemovedCallback = (userId: string) => void
export type IceCandidateCallback = (userId: string, candidate: RTCIceCandidateInit) => void
export type IceFailedCallback = (userId: string) => void

export class RoomHub {
  private participants = new Map<string, ParticipantMedia>()
  private trackCallbacks: TrackCallback[] = []
  private trackMutedCallbacks: TrackMutedCallback[] = []
  private removedCallbacks: ParticipantRemovedCallback[] = []
  private iceCandidateCallbacks: IceCandidateCallback[] = []
  private iceFailedCallbacks: IceFailedCallback[] = []

  private freezeMonitorTimer: ReturnType<typeof setInterval> | null = null
  private readonly FREEZE_TIMEOUT_MS = 3_000

  async handleOffer(userId: string, sdp: string): Promise<string> {
    try {
      return await this._handleOffer(userId, sdp)
    } catch (err) {
      logger.error({ err }, `[room-hub] handleOffer(${userId}) crashed`)
      if ((err as Error).stack) logger.error({ stack: (err as Error).stack }, "stack trace")
      return ''
    }
  }

  private async _handleOffer(userId: string, sdp: string): Promise<string> {
    const existing = this.participants.get(userId)
    if (existing) {
      markStale(existing)
      try { await existing.pc.close() } catch { /* ignore */ }
      this.participants.delete(userId)
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'turn:turn.ieom.app:3478', username: 'ieom', credential: 'ieom-turn-secret' },
      ],
    })

    const media: ParticipantMedia = {
      userId,
      pc,
      _stale: false,
      audioTrack: null,
      videoTrack: null,
      iceState: 'new',
      lastVideoPacketMs: Date.now(),
      videoMuted: false,
    }
    this.participants.set(userId, media)

    pc.onTrack.subscribe((track) => {
      if (track.kind === 'audio') {
        media.audioTrack = track
      } else if (track.kind === 'video') {
        media.videoTrack = track
        media.lastVideoPacketMs = Date.now()
        track.onReceiveRtp.subscribe(() => {
          media.lastVideoPacketMs = Date.now()
          if (media.videoMuted) {
            media.videoMuted = false
          }
        })
      }
      for (const cb of this.trackCallbacks) cb(userId, track.kind as 'audio' | 'video', track)
    })

    pc.onIceCandidate.subscribe((candidate) => {
      if (candidate) {
        for (const cb of this.iceCandidateCallbacks) cb(userId, candidate.toJSON())
      }
    })

    pc.iceConnectionStateChange.subscribe(() => {
      const state = pc.iceConnectionState
      media.iceState = state
      logger.info(`[room-hub] ${userId} ICE state: ${state}`)

      if (state === 'failed') {
        logger.info(`[room-hub] ${userId} ICE failed — notifying upstream`)
        for (const cb of this.iceFailedCallbacks) cb(userId)
      }
    })

    pc.connectionStateChange.subscribe(() => {
      const state = pc.connectionState
      logger.info(`[room-hub] ${userId} connection state: ${state}`)
      if (state === 'failed') {
        for (const cb of this.iceFailedCallbacks) cb(userId)
      }
    })

    await pc.setRemoteDescription({ type: 'offer', sdp })
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return pc.localDescription!.sdp
  }

  async handleIceCandidate(userId: string, candidate: RTCIceCandidateInit): Promise<void> {
    try {
      const media = this.participants.get(userId)
      if (!media) return
      try {
        await media.pc.addIceCandidate(candidate)
      } catch {
        // Stale candidates are normal
      }
    } catch (err) {
      logger.error({ err }, `[room-hub] handleIceCandidate(${userId}) crashed`)
    }
  }

  async removeParticipant(userId: string): Promise<void> {
    try {
      const media = this.participants.get(userId)
      if (!media) return
      try { await media.pc.close() } catch { /* ignore */ }
      this.participants.delete(userId)
      for (const cb of this.removedCallbacks) cb(userId)
    } catch (err) {
      logger.error({ err }, `[room-hub] removeParticipant(${userId}) crashed`)
    }
  }

  getAudioTrack(userId: string): MediaStreamTrack | null {
    return this.participants.get(userId)?.audioTrack ?? null
  }

  getVideoTrack(userId: string): MediaStreamTrack | null {
    return this.participants.get(userId)?.videoTrack ?? null
  }

  getParticipantIds(): string[] {
    return [...this.participants.keys()]
  }

  hasParticipant(userId: string): boolean {
    return this.participants.has(userId)
  }

  getParticipantState(userId: string): { iceState: string; videoMuted: boolean; lastVideoPacketMs: number } | null {
    const m = this.participants.get(userId)
    if (!m) return null
    return { iceState: m.iceState, videoMuted: m.videoMuted, lastVideoPacketMs: m.lastVideoPacketMs }
  }

  onTrack(cb: TrackCallback): void {
    this.trackCallbacks.push(cb)
  }

  onTrackMuted(cb: TrackMutedCallback): void {
    this.trackMutedCallbacks.push(cb)
  }

  onIceCandidate(cb: IceCandidateCallback): void {
    this.iceCandidateCallbacks.push(cb)
  }

  onParticipantRemoved(cb: ParticipantRemovedCallback): void {
    this.removedCallbacks.push(cb)
  }

  onIceFailed(cb: IceFailedCallback): void {
    this.iceFailedCallbacks.push(cb)
  }

  startFreezeDetection(): void {
    if (this.freezeMonitorTimer) return
    this.freezeMonitorTimer = setInterval(() => {
      const now = Date.now()
      for (const [_userId, media] of this.participants) {
        if (media._stale) continue
        if (!media.videoTrack) continue
        if (media.videoMuted) continue
        if (media.iceState === 'failed' || media.iceState === 'disconnected') continue

        if (now - media.lastVideoPacketMs > this.FREEZE_TIMEOUT_MS) {
          logger.info(`[room-hub] ${_userId} video frozen (no packets for ${this.FREEZE_TIMEOUT_MS}ms)`)
          media.videoMuted = true
          for (const cb of this.trackMutedCallbacks) cb(_userId, 'video')
        }
      }
    }, 2_000)
  }

  stopFreezeDetection(): void {
    if (this.freezeMonitorTimer) {
      clearInterval(this.freezeMonitorTimer)
      this.freezeMonitorTimer = null
    }
  }

  async closeAll(): Promise<void> {
    this.stopFreezeDetection()
    for (const userId of [...this.participants.keys()]) {
      await this.removeParticipant(userId)
    }
  }
}

/** @deprecated Use RoomHub */
export { RoomHub as HubConnection }
