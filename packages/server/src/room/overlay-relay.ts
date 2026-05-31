/**
 * Local WebRTC relay from server to overlay.
 * Creates a sendonly PeerConnection, offers it to the overlay via Socket.IO,
 * and uses replaceTrack() to swap the active participant's media on POV switch.
 */

import {
  RTCPeerConnection,
  MediaStreamTrack,
  type RTCIceCandidateInit,
} from 'werift'

export type SendSignalFn = (event: string, payload: unknown) => void

export class OverlayRelay {
  private pc: RTCPeerConnection | null = null
  private audioSender: any = null
  private videoSender: any = null
  private sendSignal: SendSignalFn | null = null
  private connected = false

  /**
   * Initialize the relay. Call this when the overlay connects and is ready.
   * @param sendSignal - function to send signaling messages to the overlay socket
   */
  async createOffer(sendSignal: SendSignalFn): Promise<void> {
    this.sendSignal = sendSignal
    this.cleanup()

    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    // Add sendonly transceivers for audio and video
    const audioTransceiver = this.pc.addTransceiver('audio', { direction: 'sendonly' })
    const videoTransceiver = this.pc.addTransceiver('video', { direction: 'sendonly' })
    this.audioSender = audioTransceiver.sender
    this.videoSender = videoTransceiver.sender

    this.pc.onIceCandidate.subscribe((candidate: any) => {
      if (candidate && this.sendSignal) {
        this.sendSignal('pov:ice-candidate', candidate.toJSON())
      }
    })

    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)

    sendSignal('pov:offer', { sdp: this.pc.localDescription!.sdp })
  }

  async handleAnswer(sdp: string): Promise<void> {
    if (!this.pc) return
    await this.pc.setRemoteDescription({ type: 'answer', sdp })
    this.connected = true
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) return
    await this.pc.addIceCandidate(candidate)
  }

  /**
   * Switch the forwarded tracks to a new participant's media.
   */
  async switchTo(audioTrack: MediaStreamTrack | null, videoTrack: MediaStreamTrack | null): Promise<void> {
    if (!this.pc || !this.connected) return
    if (this.audioSender && audioTrack) {
      await this.audioSender.replaceTrack(audioTrack)
    }
    if (this.videoSender && videoTrack) {
      await this.videoSender.replaceTrack(videoTrack)
    }
  }

  /**
   * Stop sending (e.g., no participants connected).
   */
  async pause(): Promise<void> {
    if (this.audioSender) await this.audioSender.replaceTrack(null)
    if (this.videoSender) await this.videoSender.replaceTrack(null)
  }

  isConnected(): boolean {
    return this.connected
  }

  cleanup(): void {
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }
    this.audioSender = null
    this.videoSender = null
    this.connected = false
  }
}
