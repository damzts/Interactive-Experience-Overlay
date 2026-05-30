/**
 * Online Mode Orchestrator — instantiates and connects all online mode
 * components: OnlineSessionManager, SignalingServer, and config integration.
 *
 * Follows the same pattern as POVOrchestrator (packages/server/src/pov/index.ts):
 * a single entry point that wires modules together and manages their lifecycle.
 *
 * Requirements: 11.2, 12.1, 12.2, 12.4, 12.5
 */

import type { Server as SocketIOServer } from 'socket.io'
import type { OnlineModeConfig } from '@ieom/shared'
import type { OnlineConfigRepository } from '../db/repositories/onlineConfigRepo.js'
import { OnlineSessionManager } from './session-manager.js'
import type { OnlineRoomConfig } from './session-manager.js'
import { SignalingServer } from './signaling.js'
import { registerOnlineNamespace } from '../socket/onlineHandlers.js'

// ── Types ────────────────────────────────────────────────────────

export interface OnlineOrchestratorDeps {
  /** Socket.IO server instance for broadcasting events */
  io: SocketIOServer
  /** Repository for persisted online mode configuration */
  onlineConfigRepo: OnlineConfigRepository
}

export interface OnlineOrchestrator {
  /** The session manager instance (used by routes and socket handlers) */
  sessionManager: OnlineSessionManager
  /** The signaling server instance (used by socket handlers) */
  signalingServer: SignalingServer
  /** Update online config at runtime (called from REST route PATCH handler) */
  updateConfig(config: Partial<OnlineModeConfig>): Promise<OnlineModeConfig>
  /** Get current online config */
  getConfig(): OnlineModeConfig
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Convert persisted OnlineModeConfig to the OnlineRoomConfig shape
 * expected by OnlineSessionManager.
 */
function toRoomConfig(config: OnlineModeConfig): OnlineRoomConfig {
  return {
    maxPlayersPerRoom: config.maxPlayersPerRoom,
    maxActiveRooms: config.maxActiveRooms,
    audioReportIntervalMs: config.audioReportIntervalMs,
    rollingWindowMs: config.rollingWindowMs,
    cooldownMs: config.cooldownMs,
    activityThreshold: config.activityThreshold,
    silenceThreshold: config.silenceThreshold,
    scoreEmitIntervalMs: config.scoreEmitIntervalMs,
    idleTimeoutMs: config.idleTimeoutMs,
  }
}

// ── Factory ──────────────────────────────────────────────────────

/**
 * Create and initialize the online mode orchestrator.
 *
 * Loads persisted config from the database, creates the session manager
 * and signaling server, registers the Socket.IO namespace, and wires
 * everything together. Returns an object with the session manager,
 * signaling server, and config update function for use by routes.
 *
 * @param deps - Dependencies: Socket.IO server and config repository
 * @returns The online orchestrator with session manager, signaling server, and config methods
 */
export async function createOnlineMode(deps: OnlineOrchestratorDeps): Promise<OnlineOrchestrator> {
  const { io, onlineConfigRepo } = deps

  // 1. Load persisted online config on startup (Req 11.2)
  let currentConfig = await onlineConfigRepo.getOnlineConfig('default')

  // 2. Create OnlineSessionManager with loaded config (Req 12.2, 12.4)
  //    Each online room gets its own POVSwitcher instance, separate from LAN mode (Req 12.1, 12.5)
  const sessionManager = new OnlineSessionManager(toRoomConfig(currentConfig))

  // 3. Create a shared overlay subscriptions map.
  //    The namespace handler populates this when overlays subscribe,
  //    and the signaling server reads from it to relay messages to overlays.
  const overlaySubscriptions = new Map<string, string>()

  // 4. Create SignalingServer wired to the session manager and overlay map
  const signalingServer = new SignalingServer({
    getRoom: (roomCode) => sessionManager.getRoom(roomCode),
    sendToSocket: (socketId, event, payload) => {
      const onlineNsp = io.of('/online')
      const socket = onlineNsp.sockets.get(socketId)
      if (socket) {
        socket.emit(event, payload)
      }
    },
    getOverlaySocket: (roomCode) => overlaySubscriptions.get(roomCode),
  })

  // 5. Register the /online Socket.IO namespace handler (Req 12.1)
  //    This wires all client-to-server events and session manager event broadcasting.
  registerOnlineNamespace(io, sessionManager, signalingServer)

  // 6. Return the orchestrator interface
  return {
    sessionManager,
    signalingServer,

    /**
     * Update online config at runtime. Persists to DB and applies to
     * the session manager. Called from the PATCH /api/config/online route.
     * (Req 11.2, 12.1)
     */
    async updateConfig(config: Partial<OnlineModeConfig>): Promise<OnlineModeConfig> {
      // Persist to database (validates bounds, applies defaults)
      const validated = await onlineConfigRepo.upsertOnlineConfig('default', config)
      currentConfig = validated

      // Apply to session manager — updates all active rooms (Req 12.4)
      sessionManager.updateConfig(toRoomConfig(validated))

      // Emit config update to connected admin clients
      const onlineNsp = io.of('/online')
      onlineNsp.emit('pov-online:config:updated' as any, validated)

      return validated
    },

    /**
     * Get the current online mode configuration.
     */
    getConfig(): OnlineModeConfig {
      return currentConfig
    },
  }
}
