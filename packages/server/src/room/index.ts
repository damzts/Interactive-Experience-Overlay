/**
 * Room module — provides REST routes and Socket.IO /room namespace
 * so the admin RoomsPanel can create/manage rooms and see live status.
 *
 * Bridges the RoomSignaling (WebRTC hub) with the admin UI.
 */

export { roomRoute } from './routes.js'
export { registerRoomNamespace } from './namespace.js'
export { RoomManager } from './manager.js'
