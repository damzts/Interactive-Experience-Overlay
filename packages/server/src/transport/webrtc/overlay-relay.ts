/**
 * Local WebRTC relay from server to overlay.
 * Creates a sendonly PeerConnection, offers it to the overlay via Socket.IO,
 * and uses replaceTrack for subsequent track changes.
 */

import {
  RTCPeerConnection,
  MediaStreamTrack,
  type RTCIceCandidateInit,
} from 'werift'

export type SendSignalFn = (event: string, payload: unknown) => void

export class OverlayRelay {
  private pc: RTCPeerConnection | null = null
  private sendSignal: SendSignalFn | null = null
  private connected = false
  private audioTrack: MediaStreamTrack | null = null
  private videoTrack: MediaStreamTrack | null = null
  private offered = false
  private offeredVideoTrack: MediaStreamTrack | null = null
  private negotiateTimer: ReturnType<typeof setTimeout> | null = null

  async createOffer(sendSignal: SendSignalFn): Promise<void> {
    this.sendSignal = sendSignal
    this.cleanup()

    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    this.pc.onIceCandidate.subscribe((candidate: any) => {
      if (candidate && this.sendSignal) {
        this.sendSignal('pov:ice-candidate', candidate.toJSON())
      }
    })

    if (this.audioTrack || this.videoTrack) {
      this.scheduleNegotiate()
    }
  }

  /**
   * Debounce negotiation by 100ms so video track is available in the first offer.
   */
  private scheduleNegotiate(): void {
    if (this.offered) return
    if (this.negotiateTimer) {
      clearTimeout(this.negotiateTimer)
      this.negotiateTimer = null
    }
    this.negotiateTimer = setTimeout(() => {
      this.negotiateTimer = null
      void this.doNegotiate()
    }, 100)
  }

  private async doNegotiate(): Promise<void> {
    if (!this.pc || !this.sendSignal || this.offered) return
    if (!this.videoTrack) return
    this.offered = true
    this.offeredVideoTrack = this.videoTrack

    this.pc.addTrack(this.videoTrack)

    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    this.sendSignal('pov:offer', { sdp: this.pc.localDescription!.sdp })
  }

  async handleAnswer(sdp: string): Promise<void> {
    if (!this.pc) {
      console.warn('[overlay-relay] handleAnswer ignored — no pc')
      return
    }
    try {
      await this.pc.setRemoteDescription({ type: 'answer', sdp })
      this.connected = true
      console.log('[overlay-relay] connected to overlay')
    } catch (err) {
      console.error('[overlay-relay] handleAnswer failed:', err)
      throw err
    }

    // If track changed while negotiating (re-offer created new track objects), replace now
    if (this.videoTrack && this.videoTrack !== this.offeredVideoTrack) {
      const sender = this.pc.getSenders().find(s => s.track?.kind === 'video')
      if (sender) await sender.replaceTrack(this.videoTrack)
    }
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) return
    await this.pc.addIceCandidate(candidate)
  }

  async switchTo(audioTrack: MediaStreamTrack | null, videoTrack: MediaStreamTrack | null): Promise<void> {
    this.audioTrack = audioTrack
    this.videoTrack = videoTrack

    if (!this.pc || !this.sendSignal) return

    if (this.connected) {
      if (videoTrack) {
        const sender = this.pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender) await sender.replaceTrack(videoTrack)
      }
      return
    }

    if (!this.offered) {
      this.scheduleNegotiate()
    }
  }

  async pause(): Promise<void> {}

  isConnected(): boolean {
    return this.connected
  }

  cleanup(): void {
    if (this.negotiateTimer) { clearTimeout(this.negotiateTimer); this.negotiateTimer = null }
    if (this.pc) { this.pc.close(); this.pc = null }
    this.connected = false
    this.offered = false
    this.offeredVideoTrack = null
  }
}

