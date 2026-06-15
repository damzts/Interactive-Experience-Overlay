/**
 * Room preview relay — forward participant video streams to the admin UI using mediasoup.
 *
 * Creates one send-only WebRtcTransport per admin socket, then creates Consumers
 * for each participant's video Producer.
 *
 * mediasoup advantage: Consumers can be created/destroyed independently of Producers.
 * When admin disconnects and reconnects, we simply create new Consumers.
 */

import type * as mediasoup from 'mediasoup'
import type { Socket } from 'socket.io'
import type { RoomHub } from './room-hub.js'
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
// Per-admin transport state
// ---------------------------------------------------------------------------

interface AdminTransport {
  socketId: string
  transport: mediasoup.types.WebRtcTransport
  connected: boolean
  consumers: Map<string, mediasoup.types.Consumer> // producerId → Consumer
}

// ---------------------------------------------------------------------------
// Participant producer tracking
// ---------------------------------------------------------------------------

interface ParticipantProducers {
  userId: string
  displayName: string
  videoProducerId: string | null
  audioProducerId: string | null
}

// ---------------------------------------------------------------------------
// RoomPreviewRelay class
// ---------------------------------------------------------------------------

export class RoomPreviewRelay {
  private participantProducers = new Map<string, ParticipantProducers>()
  private adminTransports = new Map<string, AdminTransport>() // socketId → AdminTransport
  private adminSockets = new Map<string, Socket>()
  private hub: RoomHub | null = null
  private router: mediasoup.types.Router | null = null
  private offerCallbacks: RoomPreviewOfferCallback[] = []

  /**
   * When true, producer references persist even when all admin sockets
   * disconnect. When a new admin socket connects, consumers are re-created.
   */
  persistOnDisconnect = true

  private emit(event: string, payload: unknown): void {
    for (const sock of this.adminSockets.values()) sock.emit(event as any, payload)
  }

  setRouter(router: mediasoup.types.Router): void {
    this.router = router
  }

  bindHub(hub: RoomHub): void {
    this.hub = hub

    hub.onParticipantRemoved((userId) => {
      this.removeParticipant(userId)
    })
  }

  /**
   * Notify the preview relay that a new mediasoup Producer is available for a participant.
   * Called by the RTP bridge in desktop-entry when a track is bridged.
   */
  notifyProducer(userId: string, kind: 'audio' | 'video', producerId: string): void {
    if (this.adminSockets.size === 0 && !this.persistOnDisconnect) return

    let entry = this.participantProducers.get(userId)
    if (!entry) {
      entry = { userId, displayName: 'Participant', videoProducerId: null, audioProducerId: null }
      this.participantProducers.set(userId, entry)
    }

    if (kind === 'video') {
      entry.videoProducerId = producerId
    } else {
      entry.audioProducerId = producerId
    }

    // Create consumers on all connected admin transports
    if (kind === 'video') {
      for (const adminTransport of this.adminTransports.values()) {
        if (adminTransport.connected) {
          void this.consumeForAdmin(adminTransport, userId, producerId)
        }
      }
    }
  }

  async setSocket(socket: Socket): Promise<void> {
    this.adminSockets.set(socket.id, socket)
    socket.emit('pov-online:preview:status', this.getStatus())

    if (!this.router) {
      logger.warn('[room-preview-relay] No router set — cannot create admin transport')
      return
    }

    // Create a new transport for this admin socket
    const transport = await this.router.createWebRtcTransport({
      listenInfos: [
        { protocol: 'udp', ip: '0.0.0.0', announcedAddress: getAnnouncedIp() },
        { protocol: 'tcp', ip: '0.0.0.0', announcedAddress: getAnnouncedIp() },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    })

    const adminTransport: AdminTransport = {
      socketId: socket.id,
      transport,
      connected: false,
      consumers: new Map(),
    }
    this.adminTransports.set(socket.id, adminTransport)

    // Send transport info to admin
    socket.emit('pov-online:preview:transport-offer' as any, {
      transportOptions: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
      },
      routerRtpCapabilities: this.router.rtpCapabilities,
      participants: this.getStatus(),
    })

    logger.info({ socketId: socket.id }, '[room-preview-relay] transport offer sent to admin')
  }

  /**
   * Handle admin transport connect (DTLS handshake).
   */
  async handleTransportConnect(socketId: string, dtlsParameters: mediasoup.types.DtlsParameters): Promise<void> {
    const adminTransport = this.adminTransports.get(socketId)
    if (!adminTransport) {
      logger.warn({ socketId }, '[room-preview-relay] connect for unknown admin transport')
      return
    }

    await adminTransport.transport.connect({ dtlsParameters })
    adminTransport.connected = true
    logger.info({ socketId }, '[room-preview-relay] admin transport connected')

    // Create consumers for all current participants
    for (const [userId, entry] of this.participantProducers) {
      if (entry.videoProducerId) {
        await this.consumeForAdmin(adminTransport, userId, entry.videoProducerId)
      }
    }
  }

  clearSocket(socketId: string): void {
    this.adminSockets.delete(socketId)

    const adminTransport = this.adminTransports.get(socketId)
    if (adminTransport) {
      // Close all consumers for this admin
      for (const consumer of adminTransport.consumers.values()) {
        consumer.close()
      }
      adminTransport.transport.close()
      this.adminTransports.delete(socketId)
    }

    if (this.adminSockets.size === 0 && !this.persistOnDisconnect) {
      this.participantProducers.clear()
    }
  }

  // Legacy SDP-based methods kept for backward compat (no-ops in mediasoup mode)
  async handleAnswer(_userId: string, _sdp: string): Promise<void> {
    // Handled via handleTransportConnect in mediasoup mode
  }

  async handleIceCandidate(_userId: string, _candidate: unknown): Promise<void> {
    // mediasoup handles ICE internally
  }

  private async consumeForAdmin(adminTransport: AdminTransport, userId: string, producerId: string): Promise<void> {
    if (!this.router) return

    // Check if already consuming this producer
    if (adminTransport.consumers.has(producerId)) return

    if (!this.router.canConsume({ producerId, rtpCapabilities: this.router.rtpCapabilities })) {
      logger.warn(`[room-preview-relay] cannot consume producer ${producerId} for admin`)
      return
    }

    try {
      const consumer = await adminTransport.transport.consume({
        producerId,
        rtpCapabilities: this.router.rtpCapabilities,
        paused: false,
      })

      adminTransport.consumers.set(producerId, consumer)

      // Notify the specific admin socket
      const socket = this.adminSockets.get(adminTransport.socketId)
      if (socket) {
        socket.emit('pov-online:preview:new-consumer' as any, {
          userId,
          consumerId: consumer.id,
          producerId: consumer.producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          displayName: this.participantProducers.get(userId)?.displayName ?? 'Participant',
        })
      }

      logger.info({ userId, socketId: adminTransport.socketId }, '[room-preview-relay] consumer created for admin')
    } catch (err) {
      logger.error({ err, userId }, '[room-preview-relay] failed to create consumer for admin')
    }
  }

  private removeParticipant(userId: string): void {
    const entry = this.participantProducers.get(userId)
    if (!entry) return

    // Close consumers for this participant across all admin transports
    for (const adminTransport of this.adminTransports.values()) {
      if (entry.videoProducerId) {
        const consumer = adminTransport.consumers.get(entry.videoProducerId)
        if (consumer) { consumer.close(); adminTransport.consumers.delete(entry.videoProducerId) }
      }
      if (entry.audioProducerId) {
        const consumer = adminTransport.consumers.get(entry.audioProducerId)
        if (consumer) { consumer.close(); adminTransport.consumers.delete(entry.audioProducerId) }
      }
    }

    this.participantProducers.delete(userId)

    if (this.adminSockets.size > 0) {
      this.emit('pov-online:preview:removed', { userId })
    }

    logger.info({ userId }, '[room-preview-relay] participant removed')
  }

  cleanup(): void {
    for (const adminTransport of this.adminTransports.values()) {
      for (const consumer of adminTransport.consumers.values()) consumer.close()
      adminTransport.transport.close()
    }
    this.adminTransports.clear()
    this.participantProducers.clear()
    this.adminSockets.clear()
  }

  getStatus(): RoomPreviewStreamInfo[] {
    return [...this.participantProducers.values()].map(r => ({
      userId: r.userId,
      displayName: r.displayName,
      hasVideo: !!r.videoProducerId,
      hasAudio: !!r.audioProducerId,
    }))
  }
}

// ── Helpers ──────────────────────────────────────────────────────

/** Preview relay is always localhost — admin runs on the same machine */
function getAnnouncedIp(): string {
  return '127.0.0.1'
}

/** @deprecated Use RoomPreviewRelay */
export { RoomPreviewRelay as AdminRelay }
