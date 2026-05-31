/**
 * Online rooms module — provides REST routes and Socket.IO /online namespace
 * so the admin OnlineRoomsPanel can create/manage rooms and see live status.
 *
 * Bridges the CloudSignaling (WebRTC hub) with the admin UI.
 */

export { onlineRoute } from './routes.js'
export { registerOnlineNamespace } from './namespace.js'
export { OnlineRoomManager } from './manager.js'
