/**
 * WebRTC relay from server to overlay using mediasoup.
 * Creates a send-only WebRtcTransport and Consumers that forward
 * Producers from the hub to the overlay.
 *
 * KEY ADVANTAGE over werift:
 * When the overlay reconnects (OBS refresh), we simply create a new transport
 * and new Consumers from the existing Producers — no need to force the guest
 * to re-offer. This eliminates the freeze-on-reconnect problem.
 */

import type * as mediasoup from 'mediasoup'
import logger from '../../lib/logger.js'

export type SendSignalFn = (event: string, payload: unknown) => void

export class RoomRelay {
  private transport: mediasoup.types.WebRtcTransport | null = null
  private sendSignal: SendSignalFn | null = null
  private connected = false
  private audioConsumer: mediasoup.types.Consumer | null = null
  private videoConsumer: mediasoup.types.Consumer | null = null
  private activeVideoProducerId: string | null = null
  private activeAudioProducerId: string | null = null
  private router: mediasoup.types.Router | null = null

  /** No longer needed — mediasoup doesn't require re-offers from the guest */
  onNeedReOffer: (() => void) | null = null

  setRouter(router: mediasoup.types.Router): void {
    this.router = router
  }

  /**
   * Create a send transport for the overlay.
   * Called when the overlay subscribes (or reconnects).
   * Returns transport parameters that the overlay uses to establish the connection.
   */
  async createOffer(sendSignal: SendSignalFn): Promise<void> {
    this.sendSignal = sendSignal
    this.cleanup()

    if (!this.router) {
      logger.error('[room-relay] No router set — cannot create transport')
      return
    }

    this.transport = await this.router.createWebRtcTransport({
      listenInfos: [
        { protocol: 'udp', ip: '0.0.0.0', announcedAddress: getAnnouncedIp() },
        { protocol: 'tcp', ip: '0.0.0.0', announcedAddress: getAnnouncedIp() },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    })

    this.transport.on('icestatechange', (state) => {
      logger.info(`[room-relay] ICE state: ${state}`)
    })

    this.transport.on('dtlsstatechange', (state) => {
      logger.info(`[room-relay] DTLS state: ${state}`)
      if (state === 'failed' && this.sendSignal) {
        logger.warn('[room-relay] DTLS failed — re-creating transport for overlay')
        void this.createOffer(this.sendSignal)
      }
    })

    // Send transport info to overlay
    sendSignal('pov-online:relay:offer', {
      transportOptions: {
        id: this.transport.id,
        iceParameters: this.transport.iceParameters,
        iceCandidates: this.transport.iceCandidates,
        dtlsParameters: this.transport.dtlsParameters,
        sctpParameters: this.transport.sctpParameters,
      },
      // Also include router RTP capabilities so overlay can create its Device
      routerRtpCapabilities: this.router.rtpCapabilities,
    })

    logger.info('[room-relay] transport offer sent to overlay')

    // If we already have an active producer, consume it after the overlay connects
    // (handled in handleAnswer after DTLS completes)
  }

  /**
   * Called when overlay connects its transport (provides DTLS parameters).
   */
  async handleAnswer(payload: { dtlsParameters: mediasoup.types.DtlsParameters }): Promise<void> {
    if (!this.transport) {
      logger.warn('[room-relay] handleAnswer ignored — no transport')
      return
    }
    try {
      await this.transport.connect({ dtlsParameters: payload.dtlsParameters })
      this.connected = true
      logger.info('[room-relay] overlay transport connected')
    } catch (err) {
      logger.error({ err }, '[room-relay] handleAnswer failed')
      throw err
    }
  }

  async handleIceCandidate(_candidate: unknown): Promise<void> {
    // mediasoup handles ICE internally — kept for API compatibility
  }

  /**
   * Switch the relay to consume from a different participant's producers.
   * This is the key operation — we just close old consumers and create new ones.
   * No guest re-offer needed!
   *
   * If transport isn't connected yet, we send consumer info eagerly so the overlay
   * can call transport.consume() which triggers the 'connect' event → DTLS handshake.
   */
  async switchTo(audioProducer: mediasoup.types.Producer | null, videoProducer: mediasoup.types.Producer | null): Promise<void> {
    this.activeAudioProducerId = audioProducer?.id ?? null
    this.activeVideoProducerId = videoProducer?.id ?? null

    logger.info(`[room-relay] switchTo: video=${!!videoProducer}, audio=${!!audioProducer}, connected=${this.connected}`)

    if (!this.transport || !this.sendSignal) {
      logger.info('[room-relay] switchTo: no transport yet — will consume when transport is ready')
      return
    }

    // Send consumer info eagerly — the overlay needs this to initiate consume()
    // which triggers the transport 'connect' event (DTLS handshake)
    await this.consumeActiveProducers()
  }

  /**
   * Consume a producer by ID — creates a new Consumer on this transport.
   * Used when a new producer arrives for the active participant.
   */
  async consumeProducer(kind: 'audio' | 'video', producer: mediasoup.types.Producer): Promise<void> {
    if (kind === 'video') {
      this.activeVideoProducerId = producer.id
    } else {
      this.activeAudioProducerId = producer.id
    }

    if (!this.transport || !this.connected) return

    await this.createConsumerForKind(kind, producer.id)
  }

  private async consumeActiveProducers(): Promise<void> {
    if (!this.transport || !this.router) return

    // Close existing consumers
    if (this.videoConsumer) { this.videoConsumer.close(); this.videoConsumer = null }
    if (this.audioConsumer) { this.audioConsumer.close(); this.audioConsumer = null }

    // Create consumers even before transport is connected — mediasoup allows this.
    // The consumer data (id, rtpParameters) is sent to the overlay which calls
    // transport.consume(), triggering the 'connect' event → DTLS handshake.
    if (this.activeVideoProducerId) {
      await this.createConsumerForKind('video', this.activeVideoProducerId)
    }
    if (this.activeAudioProducerId) {
      await this.createConsumerForKind('audio', this.activeAudioProducerId)
    }
  }

  private async createConsumerForKind(kind: 'audio' | 'video', producerId: string): Promise<void> {
    if (!this.transport || !this.router || !this.sendSignal) return

    // Check if we can consume this producer
    if (!this.router.canConsume({ producerId, rtpCapabilities: this.router.rtpCapabilities })) {
      logger.warn(`[room-relay] cannot consume ${kind} producer ${producerId}`)
      return
    }

    try {
      const consumer = await this.transport.consume({
        producerId,
        rtpCapabilities: this.router.rtpCapabilities,
        paused: false,
      })

      if (kind === 'video') {
        if (this.videoConsumer) this.videoConsumer.close()
        this.videoConsumer = consumer
      } else {
        if (this.audioConsumer) this.audioConsumer.close()
        this.audioConsumer = consumer
      }

      // Notify overlay about the new consumer
      this.sendSignal('pov-online:relay:new-consumer', {
        consumerId: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      })

      // Request a keyframe immediately so video appears faster on reconnect
      if (kind === 'video') {
        consumer.requestKeyFrame()
        // Also request multiple keyframes over 1.5s to ensure one arrives
        setTimeout(() => { try { consumer.requestKeyFrame() } catch {} }, 500)
        setTimeout(() => { try { consumer.requestKeyFrame() } catch {} }, 1000)
        setTimeout(() => { try { consumer.requestKeyFrame() } catch {} }, 1500)
      }

      logger.info(`[room-relay] consuming ${kind} (consumer=${consumer.id}, producer=${producerId})`)
    } catch (err) {
      logger.error({ err }, `[room-relay] failed to consume ${kind} producer ${producerId}`)
    }
  }

  /** Whether the relay is waiting (transport created but not yet connected) */
  isWaitingForTrack(): boolean {
    return !!this.transport && !this.connected
  }

  /**
   * Legacy compatibility — called by desktop-entry when a fresh track arrives.
   * In mediasoup, we just consume the producer directly.
   */
  negotiateWithFreshTrack(_audioProducer: mediasoup.types.Producer | null, videoProducer: mediasoup.types.Producer): void {
    void this.switchTo(_audioProducer, videoProducer)
  }

  async pause(): Promise<void> {
    if (this.videoConsumer) await this.videoConsumer.pause()
    if (this.audioConsumer) await this.audioConsumer.pause()
  }

  isConnected(): boolean {
    return this.connected
  }

  cleanup(): void {
    if (this.videoConsumer) { this.videoConsumer.close(); this.videoConsumer = null }
    if (this.audioConsumer) { this.audioConsumer.close(); this.audioConsumer = null }
    if (this.transport) { try { this.transport.close() } catch {} this.transport = null }
    this.connected = false
    this.activeVideoProducerId = null
    this.activeAudioProducerId = null
  }
}

// ── Helpers ──────────────────────────────────────────────────────

/** Relay is always localhost — overlay runs on the same machine */
function getAnnouncedIp(): string {
  return '127.0.0.1'
}

/** @deprecated Use RoomRelay */
export { RoomRelay as OverlayRelay }
