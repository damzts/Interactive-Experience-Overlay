import type { HandlerContext, AppSocket } from './types.js'

/**
 * Screen-share signaling — relays WebRTC offer/answer/ICE between an admin
 * publisher (getDisplayMedia, requires a real click — only admin has one)
 * and the single connected overlay socket. Purely local; no cloud/room
 * involvement. See transport/webrtc/screen-share-relay.ts for the relay
 * bookkeeping this delegates to.
 */
export function registerScreenShareHandlers(ctx: HandlerContext, socket: AppSocket): void {
  const relay = ctx.screenShareRelay
  if (!relay) return

  socket.on('screen-share:offer', ({ widgetId, sdp }) => {
    if (ctx.socketClientTypes.get(socket.id) !== 'admin') return
    relay.relayOfferToOverlay(widgetId, socket, sdp)
  })

  socket.on('screen-share:ice:admin', ({ widgetId, candidate }) => {
    if (ctx.socketClientTypes.get(socket.id) !== 'admin') return
    relay.relayIceToOverlay(widgetId, candidate)
  })

  socket.on('screen-share:answer', ({ widgetId, sdp }) => {
    if (socket.id !== ctx.runtimeState.overlaySocketId) return
    relay.relayAnswerToAdmin(widgetId, sdp)
  })

  socket.on('screen-share:ice:overlay', ({ widgetId, candidate }) => {
    if (socket.id !== ctx.runtimeState.overlaySocketId) return
    relay.relayIceToAdmin(widgetId, candidate)
  })

  socket.on('screen-share:stop', ({ widgetId }) => {
    if (ctx.socketClientTypes.get(socket.id) !== 'admin') return
    relay.stop(widgetId, socket)
  })

  socket.on('screen-share:request-offer', ({ widgetId }) => {
    // Only the overlay subscriber should emit this — guard accordingly.
    if (socket.id !== ctx.runtimeState.overlaySocketId) return
    relay.requestOffer(widgetId)
  })
}
