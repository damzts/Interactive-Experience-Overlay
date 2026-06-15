/**
 * Local WebRTC relay from server to overlay.
 * Creates a sendonly PeerConnection, offers it to the overlay via Socket.IO,
 * and uses addTrack with the source track directly.
 *
 * IMPORTANT: In werift, addTrack(remoteTrack) only works for RTP forwarding
 * when called AFTER the source track already has active RTP flowing AND when
 * the relay PC is freshly created. On overlay reconnection, we force the guest
 * to re-offer so the hub gets a fresh track that can be forwarded.
 */

import logger from '../../lib/logger.js'
import {
  RTCPeerConnection,
  MediaStreamTrack,
  type RTCIceCandidateInit,
} from 'werift'

export type SendSignalFn = (event: string, payload: unknown) => void

export class RoomRelay {
  private pc: RTCPeerConnection | null = null
  private sendSignal: SendSignalFn | null = null
  private connected = false
  private audioTrack: MediaStreamTrack | null = null
  private videoTrack: MediaStreamTrack | null = null
  private offered = false
  private offeredVideoTrack: MediaStreamTrack | null = null
  private negotiateTimer: ReturnType<typeof setTimeout> | null = null
  private rtpWaitTimer: ReturnType<typeof setTimeout> | null = null
  /** Callback to request a fresh re-offer from the active participant */
  onNeedReOffer: (() => void) | null = null

  async createOffer(sendSignal: SendSignalFn): Promise<void> {
    this.sendSignal = sendSignal
    this.cleanup()

    this.pc = new RTCPeerConnection({
      iceServers: [],
    })

    this.pc.onIceCandidate.subscribe((candidate: any) => {
      if (candidate && this.sendSignal) {
        this.sendSignal('pov-online:relay:ice', candidate.toJSON())
      }
    })

    this.pc.iceConnectionStateChange.subscribe(() => {
      logger.info(`[room-relay] ICE state: ${this.pc?.iceConnectionState}`)
    })

    this.pc.connectionStateChange.subscribe(() => {
      const state = this.pc?.connectionState
      logger.info(`[room-relay] connection state: ${state}`)
      if (state === 'failed' && this.pc !== null && this.sendSignal !== null) {
        logger.warn('[room-relay] PC failed — re-offering to overlay')
        void this.createOffer(this.sendSignal)
      }
    })

    // Don't negotiate immediately — request a re-offer from the guest
    // so we get a fresh track that werift can forward properly.
    if (this.videoTrack) {
      logger.info('[room-relay] requesting re-offer from guest for fresh track')
      if (this.onNeedReOffer) {
        this.onNeedReOffer()
      }
    }
  }

  /**
   * Called when a fresh track arrives (from guest re-offer or first offer).
   * This MUST be called synchronously from within the hub's onTrack callback
   * because werift only forwards RTP when addTrack is called in the same
   * execution context as the track event.
   */
  negotiateWithFreshTrack(audioTrack: MediaStreamTrack | null, videoTrack: MediaStreamTrack): void {
    if (!this.pc || !this.sendSignal || this.offered) return
    this.audioTrack = audioTrack
    this.videoTrack = videoTrack

    // Do NOT use scheduleNegotiate (setTimeout) here — we must addTrack
    // synchronously in the same microtask as the onTrack event for werift
    // to properly wire up RTP forwarding.
    void this.doNegotiate()
  }

  /** Debounce negotiation by 100ms. */
  private scheduleNegotiate(): void {
    if (this.offered) return
    if (this.negotiateTimer) {
      clearTimeout(this.negotiateTimer)
      this.negotiateTimer = null
    }
    logger.info('[room-relay] scheduleNegotiate: will negotiate in 100ms')
    this.negotiateTimer = setTimeout(() => {
      this.negotiateTimer = null
      void this.doNegotiate()
    }, 100)
  }

  private async doNegotiate(): Promise<void> {
    if (!this.pc || !this.sendSignal || this.offered) return
    if (!this.videoTrack) { logger.warn('[room-relay] doNegotiate: no video track'); return }

    try {
      this.offered = true
      this.offeredVideoTrack = this.videoTrack

      if (this.audioTrack) this.pc.addTrack(this.audioTrack)
      this.pc.addTrack(this.videoTrack)

      logger.info('[room-relay] creating offer')

      const offer = await this.pc.createOffer()
      await this.pc.setLocalDescription(offer)
      logger.info('[room-relay] offer sent to overlay')
      this.sendSignal('pov-online:relay:offer', { sdp: this.pc.localDescription!.sdp })

      // In werift, addTrack doesn't forward RTP immediately.
      // Request another re-offer from the guest so that when the hub gets
      // a fresh track, replaceTrack will be called on the now-connected relay
      // which DOES forward RTP correctly.
      setTimeout(() => {
        if (this.onNeedReOffer && !this.connected) {
          // Wait a bit, then if still not seeing video, force re-offer
        }
        if (this.onNeedReOffer) {
          logger.info('[room-relay] requesting second re-offer for replaceTrack')
          this.onNeedReOffer()
        }
      }, 1500)
    } catch (err: any) {
      logger.error({ err: err?.message ?? err, stack: err?.stack }, '[room-relay] doNegotiate crashed')
      this.offered = false
    }
  }

  async handleAnswer(sdp: string): Promise<void> {
    if (!this.pc) {
      logger.warn('[room-relay] handleAnswer ignored — no pc')
      return
    }
    try {
      await this.pc.setRemoteDescription({ type: 'answer', sdp })
      this.connected = true
      logger.info('[room-relay] connected to overlay')
    } catch (err) {
      logger.error({ err: err }, '[room-relay] handleAnswer failed')
      throw err
    }
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) return
    await this.pc.addIceCandidate(candidate)
  }

  async switchTo(audioTrack: MediaStreamTrack | null, videoTrack: MediaStreamTrack | null): Promise<void> {
    this.audioTrack = audioTrack
    this.videoTrack = videoTrack
    logger.info(`[room-relay] switchTo: video=${!!videoTrack}, audio=${!!audioTrack}, pc=${!!this.pc}, connected=${this.connected}, offered=${this.offered}`)

    if (!this.pc || !this.sendSignal) {
      logger.warn('[room-relay] switchTo: no PC or sendSignal — cannot relay')
      return
    }

    // If the PC is closed/failed, re-create the offer from scratch
    if (this.pc.connectionState === 'closed' || this.pc.connectionState === 'failed') {
      logger.info('[room-relay] PC is dead, re-creating offer')
      this.offered = false
      void this.createOffer(this.sendSignal)
      return
    }

    if (this.connected) {
      if (videoTrack) {
        const senders = this.pc.getSenders()
        logger.info(`[room-relay] senders: ${senders.map(s => `${s.track?.kind ?? 'null'}:${s.track?.id?.slice(0,8) ?? 'none'}`).join(', ')}`)
        const sender = senders.find(s => s.track?.kind === 'video') ?? senders.find(s => !s.track || s.track.kind === 'video')
        if (sender) {
          await sender.replaceTrack(videoTrack)
          logger.info('[room-relay] replaced video track on connected relay')
        } else {
          logger.warn('[room-relay] no video sender found — cannot replaceTrack')
        }
      }
      if (audioTrack) {
        const audioSender = this.pc.getSenders().find(s => s.track?.kind === 'audio')
        if (audioSender) await audioSender.replaceTrack(audioTrack)
      }
      return
    }

    // If we haven't offered yet, this is a fresh track arriving (from re-offer) — negotiate now
    if (!this.offered && videoTrack) {
      this.scheduleNegotiate()
    }
  }

  /** Whether the relay has a PC ready but hasn't offered yet (waiting for fresh track) */
  isWaitingForTrack(): boolean {
    return !!this.pc && !!this.sendSignal && !this.offered
  }

  async pause(): Promise<void> {}

  isConnected(): boolean {
    return this.connected
  }

  cleanup(): void {
    if (this.negotiateTimer) { clearTimeout(this.negotiateTimer); this.negotiateTimer = null }
    if (this.rtpWaitTimer) { clearTimeout(this.rtpWaitTimer); this.rtpWaitTimer = null }
    if (this.pc) { try { this.pc.close() } catch {} this.pc = null }
    this.connected = false
    this.offered = false
    this.offeredVideoTrack = null
  }
}

/** @deprecated Use RoomRelay */
export { RoomRelay as OverlayRelay }
