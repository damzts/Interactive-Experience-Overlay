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

export interface ParticipantMedia {
  userId: string
  pc: RTCPeerConnection
  audioTrack: MediaStreamTrack | null
  videoTrack: MediaStreamTrack | null
}

export type TrackCallback = (userId: string, kind: 'audio' | 'video', track: MediaStreamTrack) => void
export type ParticipantRemovedCallback = (userId: string) => void

export class HubConnection {
  private participants = new Map<string, ParticipantMedia>()
  private trackCallbacks: TrackCallback[] = []
  private removedCallbacks: ParticipantRemovedCallback[] = []

  async handleOffer(userId: string, sdp: string): Promise<string> {
    if (this.participants.has(userId)) {
      await this.removeParticipant(userId)
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    const media: ParticipantMedia = { userId, pc, audioTrack: null, videoTrack: null }
    this.participants.set(userId, media)

    pc.ontrack = (event) => {
      const track = event.track
      if (track.kind === 'audio') {
        media.audioTrack = track
      } else if (track.kind === 'video') {
        media.videoTrack = track
      }
      for (const cb of this.trackCallbacks) cb(userId, track.kind as 'audio' | 'video', track)
    }

    await pc.setRemoteDescription({ type: 'offer', sdp })
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return pc.localDescription!.sdp
  }

  async handleIceCandidate(userId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const media = this.participants.get(userId)
    if (!media) return
    await media.pc.addIceCandidate(candidate)
  }

  async removeParticipant(userId: string): Promise<void> {
    const media = this.participants.get(userId)
    if (!media) return
    await media.pc.close()
    this.participants.delete(userId)
    for (const cb of this.removedCallbacks) cb(userId)
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

  onTrack(cb: TrackCallback): void {
    this.trackCallbacks.push(cb)
  }

  onParticipantRemoved(cb: ParticipantRemovedCallback): void {
    this.removedCallbacks.push(cb)
  }

  async closeAll(): Promise<void> {
    for (const userId of [...this.participants.keys()]) {
      await this.removeParticipant(userId)
    }
  }
}
