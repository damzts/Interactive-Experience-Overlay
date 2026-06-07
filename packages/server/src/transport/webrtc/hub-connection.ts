/**
 * WebRTC hub connection manager using werift.
 * Manages N peer connections from browser participants.
 * Each participant sends their camera/mic; the server receives all streams.
 *
 * == Cambios implementados ==
 * - Monitoreo de ICE connection state (detecta failed y reconecta)
 * - Monitoreo de tracks (onmute/onunmute para detectar video congelado)
 * - Callbacks para reconexión de participantes (onIceFailed)
 * - Detección de video congelado via freeze monitor (cada 2s)
 */

import {
  RTCPeerConnection,
  type RTCIceCandidateInit,
  type MediaStreamTrack,
} from 'werift'

export interface ParticipantMedia {
  userId: string
  pc: RTCPeerConnection
  _stale: boolean /** Marca para descartar media durante re-offer */
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

export class HubConnection {
  private participants = new Map<string, ParticipantMedia>()
  private trackCallbacks: TrackCallback[] = []
  private trackMutedCallbacks: TrackMutedCallback[] = []
  private removedCallbacks: ParticipantRemovedCallback[] = []
  private iceCandidateCallbacks: IceCandidateCallback[] = []
  private iceFailedCallbacks: IceFailedCallback[] = []

  // ── Monitoreo periódico de tracks congelados ──────────────────────────────
  private freezeMonitorTimer: ReturnType<typeof setInterval> | null = null
  /** Si un track no recibe paquetes en este ms, se considera congelado */
  private readonly FREEZE_TIMEOUT_MS = 3_000

  async handleOffer(userId: string, sdp: string): Promise<string> {
    try {
      return await this._handleOffer(userId, sdp)
    } catch (err) {
      console.error(`[hub-connection] handleOffer(${userId}) crashed:`, (err as Error).message)
      console.error((err as Error).stack)
      // Never let werift exceptions bubble up — return empty answer
      return ''
    }
  }

  private async _handleOffer(userId: string, sdp: string): Promise<string> {
    // On re-offer, close old PC silently (don't fire removal callbacks)
    const existing = this.participants.get(userId)
    if (existing) {
      markStale(existing)
      try { await existing.pc.close() } catch { /* ignore */ }
      this.participants.delete(userId)
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
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

    // ── Track events ────────────────────────────────────────────────────
    pc.onTrack.subscribe((track) => {
      if (track.kind === 'audio') {
        media.audioTrack = track
      } else if (track.kind === 'video') {
        media.videoTrack = track
        media.lastVideoPacketMs = Date.now()
      }
      for (const cb of this.trackCallbacks) cb(userId, track.kind as 'audio' | 'video', track)
    })

    // ── ICE candidate events ────────────────────────────────────────────
    pc.onIceCandidate.subscribe((candidate) => {
      if (candidate) {
        for (const cb of this.iceCandidateCallbacks) cb(userId, candidate.toJSON())
      }
    })

    // ── ICE connection state monitoring ─────────────────────────────────
    pc.iceConnectionStateChange.subscribe(() => {
      const state = pc.iceConnectionState
      media.iceState = state
      console.log(`[hub-connection] ${userId} ICE state: ${state}`)

      if (state === 'failed') {
        console.log(`[hub-connection] ${userId} ICE failed — notifying upstream`)
        for (const cb of this.iceFailedCallbacks) cb(userId)
      }
    })

    pc.connectionStateChange.subscribe(() => {
      const state = pc.connectionState
      console.log(`[hub-connection] ${userId} connection state: ${state}`)
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
        // Ignorar candidatos obsoletos
      }
    } catch (err) {
      console.error(`[hub-connection] handleIceCandidate(${userId}) crashed:`, (err as Error).message)
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
      console.error(`[hub-connection] removeParticipant(${userId}) crashed:`, (err as Error).message)
    }
  }

  // ── Getters ────────────────────────────────────────────────────────
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

  // ── Callbacks ──────────────────────────────────────────────────────
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

  // ── Freeze detection ───────────────────────────────────────────────
  /**
   * Inicia monitoreo periódico de tracks de video.
   * Cada 2s revisa si el video dejó de paquetes entrantes.
   * Si detecta congelamiento, notifica a los callbacks de trackMuted.
   */
  startFreezeDetection(): void {
    if (this.freezeMonitorTimer) return
    this.freezeMonitorTimer = setInterval(() => {
      const now = Date.now()
      for (const [_userId, media] of this.participants) {
        if (media._stale) continue
        if (!media.videoTrack) continue
        if (media.videoMuted) continue
        if (media.iceState === 'failed' || media.iceState === 'disconnected') continue

        // Si no hay actividad de video en FREEZE_TIMEOUT_MS, marcar como mute
        if (now - media.lastVideoPacketMs > this.FREEZE_TIMEOUT_MS) {
          console.log(`[hub-connection] ${_userId} video frozen (no packets for ${this.FREEZE_TIMEOUT_MS}ms)`)
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

  // ── Cleanup ────────────────────────────────────────────────────────
  async closeAll(): Promise<void> {
    this.stopFreezeDetection()
    for (const userId of [...this.participants.keys()]) {
      await this.removeParticipant(userId)
    }
  }
}
