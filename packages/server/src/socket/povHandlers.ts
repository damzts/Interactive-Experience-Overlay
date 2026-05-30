import type { Server, Socket } from 'socket.io'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  POVSwitchingConfig,
} from '@ieom/shared'
import type { POVOrchestrator } from '../pov/index.js'

type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

/**
 * Set up POV-related Socket.IO event handlers.
 *
 * Handles:
 * - `pov:mode:set` — switch between automatic/manual mode
 * - `pov:select` — manually select a camera feed
 * - `pov:config:update` — update POV switching configuration
 *
 * Emits to newly connected admin clients:
 * - `pov:status` — current mode, active camera, and feed list
 *
 * Broadcasts (wired via POVOrchestrator):
 * - `pov:scores` — activity scores at configured interval
 * - `pov:feed:status` — connection state changes
 * - `pov:switch` — camera switches
 */
export function setupPovSocketHandlers(
  io: IO,
  orchestrator: POVOrchestrator | null,
  getClientType: (socket: AppSocket) => 'overlay' | 'admin' | 'unknown',
) {
  io.on('connection', (socket: AppSocket) => {
    // Emit current POV status to newly connected admin clients
    if (getClientType(socket) === 'admin' && orchestrator) {
      socket.emit('pov:status', orchestrator.getStatus())
    }

    // ── pov:mode:set ─────────────────────────────────────────────────────────
    socket.on('pov:mode:set', (mode, callback) => {
      if (!orchestrator) {
        if (callback) callback('POV system not initialized')
        return
      }

      if (mode !== 'automatic' && mode !== 'manual') {
        if (callback) callback('Invalid mode. Must be "automatic" or "manual"')
        return
      }

      orchestrator.switcher.setMode(mode)

      // Broadcast updated status to all clients
      io.emit('pov:status', orchestrator.getStatus())

      if (callback) callback(null)
    })

    // ── pov:select ───────────────────────────────────────────────────────────
    socket.on('pov:select', (feedId, callback) => {
      if (!orchestrator) {
        if (callback) callback('POV system not initialized')
        return
      }

      if (!feedId || typeof feedId !== 'string') {
        if (callback) callback('Invalid feed ID')
        return
      }

      const result = orchestrator.switcher.manualSelect(feedId)

      if (!result.ok) {
        // Emit error to the requesting client
        const errorMessage = result.error === 'feed_unavailable'
          ? 'Camera feed is unavailable (disconnected or unresponsive)'
          : result.error === 'feed_not_found'
            ? 'Camera feed not found'
            : result.error ?? 'Unknown error'

        io.emit('pov:error', {
          feedId,
          message: errorMessage,
          code: 'feed_unavailable',
        })

        if (callback) callback(errorMessage)
        return
      }

      // Switch event is already broadcast via the orchestrator's wired callbacks
      // (POVSwitcher.onSwitch → io.emit('pov:switch'))
      // Broadcast updated status
      io.emit('pov:status', orchestrator.getStatus())

      if (callback) callback(null)
    })

    // ── pov:config:update ────────────────────────────────────────────────────
    socket.on('pov:config:update', (config, callback) => {
      if (!orchestrator) {
        if (callback) callback('POV system not initialized')
        return
      }

      if (!config || typeof config !== 'object') {
        if (callback) callback('Invalid configuration object')
        return
      }

      // Read userId from authenticated socket for user-scoped persistence
      const userId = socket.data.userId

      try {
        // Validate, persist, and apply config changes via the orchestrator
        const updatePromise = orchestrator.updateConfig(config as Partial<POVSwitchingConfig>, userId)

        void updatePromise.then((updatedConfig) => {
          // Emit config:patch so admin clients receive the updated values
          io.emit('config:patch', { povConfig: updatedConfig })
          if (callback) callback(null)
        }).catch((err) => {
          const message = err instanceof Error ? err.message : 'Failed to update POV configuration'
          if (callback) callback(message)
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update POV configuration'
        if (callback) callback(message)
      }
    })
  })
}
