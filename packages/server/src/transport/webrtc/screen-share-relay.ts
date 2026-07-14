/**
 * Screen Share Relay — forwards WebRTC signaling between an admin publisher
 * and the overlay subscriber, keyed by widgetId so multiple screen-share
 * widgets can be active independently.
 *
 * This is local-only (same machine, admin tab + OBS/overlay tab) — there is
 * no cloud/room concept involved. getDisplayMedia() requires a genuine user
 * gesture, which only exists in the admin app; the overlay is a passive
 * render target (OBS browser source) with no one to click anything. So:
 *
 *   Admin (publisher)              Server (relay only)         Overlay (subscriber)
 *   getDisplayMedia() ──offer──────────▶│──────────offer────────────▶
 *                    ◀─────────answer──│◀─────────answer─────────────
 *                    ◀───ICE──────────▶│◀───ICE──────────────────────▶
 *
 * The server does not touch media — it only relays SDP/ICE by widgetId
 * between whichever admin socket published that widgetId and the single
 * connected overlay socket.
 */

import type { Socket } from 'socket.io'
import type { RTCIceCandidateInit } from '@ieomlabs/shared'
import logger from '../../lib/logger.js'

export class ScreenShareRelay {
  private overlaySocket: Socket | null = null
  /** widgetId → the admin socket currently publishing that widget's screen share */
  private publishers = new Map<string, Socket>()

  setOverlaySocket(socket: Socket | null): void {
    this.overlaySocket = socket
    if (!socket) {
      // Overlay disconnected — tell every active publisher to stop; they'll
      // re-offer once a new overlay connects and they re-publish.
      for (const widgetId of this.publishers.keys()) {
        this.publishers.delete(widgetId)
      }
    }
  }

  hasOverlay(): boolean {
    return this.overlaySocket !== null
  }

  /** Admin socket publishing widgetId sent an SDP offer — relay to the overlay. */
  relayOfferToOverlay(widgetId: string, adminSocket: Socket, sdp: string): void {
    this.publishers.set(widgetId, adminSocket)
    if (!this.overlaySocket) {
      logger.warn(`[screen-share-relay] offer for "${widgetId}" but no overlay connected`)
      return
    }
    this.overlaySocket.emit('screen-share:offer', { widgetId, sdp })
    logger.info(`[screen-share-relay] relayed offer for "${widgetId}" to overlay`)
  }

  /** Admin sent an ICE candidate for its publisher connection — relay to the overlay. */
  relayIceToOverlay(widgetId: string, candidate: RTCIceCandidateInit): void {
    if (!this.overlaySocket) return
    this.overlaySocket.emit('screen-share:ice:admin', { widgetId, candidate })
  }

  /** Overlay answered a relayed offer — relay back to the publishing admin socket. */
  relayAnswerToAdmin(widgetId: string, sdp: string): void {
    const publisher = this.publishers.get(widgetId)
    if (!publisher) {
      logger.warn(`[screen-share-relay] answer for "${widgetId}" but no publisher on file`)
      return
    }
    publisher.emit('screen-share:answer', { widgetId, sdp })
  }

  /** Overlay sent an ICE candidate for its subscriber connection — relay to the publishing admin. */
  relayIceToAdmin(widgetId: string, candidate: RTCIceCandidateInit): void {
    const publisher = this.publishers.get(widgetId)
    if (!publisher) return
    publisher.emit('screen-share:ice:overlay', { widgetId, candidate })
  }

  /** Admin stopped sharing (button click or widget closed) — tell the overlay to tear down. */
  stop(widgetId: string, adminSocket: Socket): void {
    const publisher = this.publishers.get(widgetId)
    if (publisher && publisher.id !== adminSocket.id) return
    this.publishers.delete(widgetId)
    this.overlaySocket?.emit('screen-share:stop', { widgetId })
  }

  /** Called when any socket disconnects — clears it if it was publishing. */
  handleSocketDisconnect(socket: Socket): void {
    for (const [widgetId, publisher] of this.publishers) {
      if (publisher.id === socket.id) {
        this.publishers.delete(widgetId)
        this.overlaySocket?.emit('screen-share:stop', { widgetId })
      }
    }
  }

  /**
   * Overlay subscriber has mounted and is ready to receive an offer for
   * widgetId. Forward the request to the admin publisher so it can
   * re-create and re-send the SDP offer to complete the handshake.
   * No-op if no publisher is registered for this widgetId.
   */
  requestOffer(widgetId: string): void {
    const publisher = this.publishers.get(widgetId)
    if (!publisher) {
      logger.warn(`[screen-share-relay] request-offer for "${widgetId}" but no publisher on file`)
      return
    }
    publisher.emit('screen-share:request-offer', { widgetId })
    logger.info(`[screen-share-relay] forwarded request-offer for "${widgetId}" to admin`)
  }

  getActiveWidgetIds(): string[] {
    return [...this.publishers.keys()]
  }
}
