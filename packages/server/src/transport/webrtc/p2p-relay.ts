/**
 * P2P Relay — forwards WebRTC signaling between guests and the overlay.
 *
 * The server does NOT process media. It only relays:
 *   Guest offer → Server → Overlay
 *   Overlay answer → Server → Guest
 *   ICE candidates bidirectionally
 *
 * The overlay establishes direct P2P WebRTC connections with each guest.
 * Switch is instant (CSS swap between video elements in the overlay).
 */

import type { Socket } from 'socket.io'
import logger from '../../lib/logger.js'

export type SendToGuestFn = (userId: string, type: string, payload: Record<string, unknown>) => void

export class P2PRelay {
  private overlaySocket: Socket | null = null
  private sendToGuest: SendToGuestFn | null = null

  /**
   * Set the overlay socket. Called when overlay connects.
   */
  setOverlaySocket(socket: Socket): void {
    this.overlaySocket = socket
    logger.info('[p2p-relay] overlay socket set')
  }

  clearOverlaySocket(): void {
    this.overlaySocket = null
  }

  /**
   * Set the function to send messages back to guests (via cloud signaling).
   */
  setSendToGuest(fn: SendToGuestFn): void {
    this.sendToGuest = fn
  }

  /**
   * Called when a guest sends an SDP offer (via cloud signaling).
   * Relay it to the overlay so it can create a P2P connection.
   */
  relayOfferToOverlay(userId: string, sdp: string): void {
    if (!this.overlaySocket) {
      logger.warn(`[p2p-relay] offer from ${userId} but no overlay socket`)
      return
    }
    this.overlaySocket.emit('pov-online:p2p:offer' as any, { userId, sdp })
    logger.info(`[p2p-relay] relayed offer from ${userId} to overlay`)
  }

  /**
   * Called when a guest sends an ICE candidate.
   * Relay to overlay.
   */
  relayIceCandidateToOverlay(userId: string, candidate: unknown): void {
    if (!this.overlaySocket) return
    this.overlaySocket.emit('pov-online:p2p:ice' as any, { userId, candidate })
  }

  /**
   * Called when the overlay sends an SDP answer for a guest.
   * Relay back to the guest via cloud signaling.
   */
  relayAnswerToGuest(userId: string, sdp: string): void {
    if (!this.sendToGuest) {
      logger.warn(`[p2p-relay] answer for ${userId} but no sendToGuest function`)
      return
    }
    this.sendToGuest(userId, 'answer', { sdp })
    logger.info(`[p2p-relay] relayed answer to guest ${userId}`)
  }

  /**
   * Called when the overlay sends an ICE candidate for a guest.
   * Relay back to guest.
   */
  relayIceCandidateToGuest(userId: string, candidate: unknown): void {
    if (!this.sendToGuest) return
    this.sendToGuest(userId, 'ice-candidate', { candidate } as Record<string, unknown>)
  }

  /**
   * Tell the overlay to switch to a specific guest's video.
   */
  switchTo(userId: string): void {
    if (!this.overlaySocket) return
    this.overlaySocket.emit('pov-online:p2p:switch' as any, { userId })
    logger.info(`[p2p-relay] switch overlay to ${userId}`)
  }

  /**
   * Tell the overlay to remove a guest's connection.
   */
  removeGuest(userId: string): void {
    if (!this.overlaySocket) return
    this.overlaySocket.emit('pov-online:p2p:remove' as any, { userId })
  }

  hasOverlay(): boolean {
    return this.overlaySocket !== null
  }
}
