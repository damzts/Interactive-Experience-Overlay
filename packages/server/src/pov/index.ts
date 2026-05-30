import OBSWebSocket from 'obs-websocket-js'
import type { Server as SocketIOServer } from 'socket.io'
import type { POVSwitchingConfig, CameraConnectionStatus } from '@ieom/shared'
import type { PovConfigRepository } from '../db/repositories/povConfigRepo.js'
import type { PovFeedsRepository } from '../db/repositories/povFeedsRepo.js'
import { CameraRegistry } from './registry.js'
import { CameraConnectionManager } from './connections.js'
import { AudioMonitor } from './audio-monitor.js'
import { POVSwitcher } from './switcher.js'
import { TransitionQueue } from './transition-queue.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface POVOrchestratorOptions {
  /** Socket.IO server instance for broadcasting events to admin clients */
  io: SocketIOServer
  /** Repository for persisted POV switching configuration */
  povConfigRepo: PovConfigRepository
  /** Repository for persisted camera feed registrations */
  povFeedsRepo: PovFeedsRepository
  /** OBS WebSocket URL for the output/program OBS instance */
  outputObsUrl?: string
  /** OBS WebSocket password for the output OBS instance */
  outputObsPassword?: string
}

// ── POVOrchestrator ──────────────────────────────────────────────────────────

/**
 * POVOrchestrator wires all POV switching modules together and manages their
 * lifecycle. It is the single entry point for the rest of the server to interact
 * with the multi-camera POV switching system.
 *
 * Responsibilities:
 * - Instantiate and connect CameraRegistry, CameraConnectionManager,
 *   AudioMonitor, POVSwitcher, and TransitionQueue
 * - Load persisted config and feeds on startup
 * - Wire AudioMonitor score updates → POVSwitcher.evaluateScores()
 * - Wire POVSwitcher switch decisions → TransitionQueue.enqueue()
 * - Wire connection status changes → CameraRegistry.updateStatus() + Socket.IO broadcasts
 */
export class POVOrchestrator {
  public readonly registry: CameraRegistry
  public readonly connectionManager: CameraConnectionManager
  public readonly audioMonitor: AudioMonitor
  public readonly switcher: POVSwitcher
  public readonly transitionQueue: TransitionQueue

  private io: SocketIOServer
  private povConfigRepo: PovConfigRepository
  private povFeedsRepo: PovFeedsRepository
  private outputObs: OBSWebSocket
  private config: POVSwitchingConfig | null = null
  private started = false
  private userId: string = ''

  constructor(options: POVOrchestratorOptions) {
    this.io = options.io
    this.povConfigRepo = options.povConfigRepo
    this.povFeedsRepo = options.povFeedsRepo

    // Create the output OBS WebSocket connection (used by TransitionQueue)
    this.outputObs = new OBSWebSocket()

    // Instantiate core modules
    this.registry = new CameraRegistry()
    this.connectionManager = new CameraConnectionManager()
    this.audioMonitor = new AudioMonitor(this.connectionManager, this.registry)
    this.switcher = new POVSwitcher(this.registry)
    this.transitionQueue = new TransitionQueue({
      outputObs: this.outputObs,
      isFeedConnected: (feedId: string) => this.connectionManager.isConnected(feedId),
    })

    // Wire up inter-module connections
    this.wireModules()
  }

  /**
   * Initialize the POV system: load persisted config and feeds, start monitoring.
   * Call this once during server startup.
   */
  async start(outputObsUrl?: string, outputObsPassword?: string, userId?: string): Promise<void> {
    if (this.started) return
    this.started = true
    if (userId) this.userId = userId

    // 1. Load persisted configuration and apply to all modules
    this.config = await this.povConfigRepo.getPovConfig(this.userId)
    this.applyConfig(this.config)

    // 2. Connect to the output OBS instance (for scene transitions)
    if (outputObsUrl) {
      try {
        await this.outputObs.connect(outputObsUrl, outputObsPassword || undefined)
        console.log('[pov] Connected to output OBS for transitions')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.warn(`[pov] Failed to connect to output OBS: ${message}`)
      }
    }

    // 3. Load persisted feeds and register them in the registry + initiate connections
    const persistedFeeds = await this.povFeedsRepo.getAllFeeds(this.userId)
    for (const row of persistedFeeds) {
      // Register in the in-memory registry
      const feed = this.registry.register({
        label: row.label,
        obsAddress: row.obs_address,
        obsPassword: row.obs_password,
        sceneName: row.scene_name,
      })

      // If registration succeeded, override the generated ID with the persisted one
      // and initiate the connection
      if ('id' in feed && !('error' in feed)) {
        // Remove the auto-generated entry and re-insert with the persisted ID
        this.registry.feeds.delete(feed.id)
        const restoredFeed = {
          ...feed,
          id: row.id,
          registeredAt: row.registered_at,
        }
        this.registry.feeds.set(row.id, restoredFeed)

        // Initiate connection to this feed's OBS instance
        void this.connectionManager.connect(restoredFeed).catch((err) => {
          const message = err instanceof Error ? err.message : String(err)
          console.warn(`[pov] Failed to initiate connection for feed "${row.label}": ${message}`)
        })
      }
    }

    // 4. Start audio monitoring
    this.audioMonitor.start({
      pollIntervalMs: this.config.pollIntervalMs,
      rollingWindowMs: this.config.rollingWindowMs,
      dbFloor: this.config.dbFloor,
      dbCeiling: this.config.dbCeiling,
      emitIntervalMs: this.config.scoreEmitIntervalMs,
    })

    // 5. Start health checks
    this.connectionManager.startHealthChecks(this.config.healthCheckIntervalMs)

    console.log(`[pov] POV system started with ${persistedFeeds.length} persisted feed(s)`)
  }

  /**
   * Gracefully stop the POV system: disconnect all feeds, stop monitoring.
   */
  stop(): void {
    if (!this.started) return
    this.started = false

    this.audioMonitor.stop()
    this.connectionManager.stopHealthChecks()
    this.connectionManager.disconnectAll()

    try {
      this.outputObs.disconnect()
    } catch {
      // Ignore disconnect errors
    }

    console.log('[pov] POV system stopped')
  }

  /**
   * Update the POV switching configuration at runtime.
   * Persists to the database and applies to all modules.
   */
  async updateConfig(config: Partial<POVSwitchingConfig>, userId?: string): Promise<POVSwitchingConfig> {
    const uid = userId ?? this.userId
    const validated = await this.povConfigRepo.upsertPovConfig(uid, config)
    this.config = validated
    this.applyConfig(validated)
    return validated
  }

  /**
   * Get the current POV switching configuration.
   */
  getConfig(): POVSwitchingConfig | null {
    return this.config
  }

  /**
   * Get the current runtime status for broadcasting to admin clients.
   */
  getStatus() {
    return {
      mode: this.switcher.mode,
      activeCameraId: this.switcher.activeCameraId,
      feeds: this.registry.getAllFeeds().map((feed) => ({
        id: feed.id,
        label: feed.label,
        connectionStatus: feed.connectionStatus,
        activityScore: feed.activityScore,
      })),
    }
  }

  // ── Private Methods ──────────────────────────────────────────────────────

  /**
   * Wire inter-module event flows:
   * - AudioMonitor scores → POVSwitcher evaluation + Registry score updates + Socket.IO broadcast
   * - POVSwitcher switch decisions → TransitionQueue + Socket.IO broadcast
   * - POVSwitcher mode changes → Socket.IO broadcast
   * - ConnectionManager status changes → Registry + POVSwitcher disconnect handling + Socket.IO broadcast
   * - TransitionQueue errors → Socket.IO broadcast
   */
  private wireModules(): void {
    // AudioMonitor → POVSwitcher + Registry + Socket.IO
    this.audioMonitor.onScoresUpdated((scores: Map<string, number>) => {
      // Update activity scores in the registry
      for (const [feedId, score] of scores) {
        this.registry.updateActivityScore(feedId, score)
      }

      // Feed scores into the switcher for evaluation
      this.switcher.evaluateScores(scores)

      // Broadcast scores to admin clients
      this.io.emit('pov:scores', {
        scores: Array.from(scores.entries()).map(([feedId, score]) => ({ feedId, score })),
        timestamp: Date.now(),
      })
    })

    // POVSwitcher switch decisions → TransitionQueue + Socket.IO
    this.switcher.onSwitch((prev, next, timestamp, reason) => {
      // Look up the scene name for the target feed
      const targetFeed = this.registry.getActiveFeed(next)
      if (targetFeed) {
        // Enqueue the transition using the scene name
        this.transitionQueue.enqueue(targetFeed.sceneName)
      }

      // Broadcast switch event to admin clients
      this.io.emit('pov:switch', {
        previousFeedId: prev,
        newFeedId: next,
        timestamp,
        reason,
      })
    })

    // POVSwitcher mode changes → Socket.IO
    this.switcher.onModeChange((mode) => {
      this.io.emit('pov:status', this.getStatus())
    })

    // ConnectionManager status changes → Registry + POVSwitcher + Socket.IO
    this.connectionManager.on('statusChange', (event: { feedId: string; status: CameraConnectionStatus; previousStatus: CameraConnectionStatus }) => {
      // Update the registry
      this.registry.updateStatus(event.feedId, event.status)

      // If a feed disconnected, notify the switcher for potential fallback
      if (event.status === 'disconnected' || event.status === 'unreachable') {
        this.switcher.handleDisconnect(event.feedId)
      }

      // Broadcast feed status change to admin clients
      const feed = this.registry.getActiveFeed(event.feedId)
      if (feed) {
        this.io.emit('pov:feed:status', {
          feedId: event.feedId,
          connectionStatus: event.status,
          label: feed.label,
        })
      }
    })

    // TransitionQueue errors → Socket.IO
    this.transitionQueue.on('error', (payload) => {
      this.io.emit('pov:error', payload)
    })
  }

  /**
   * Apply a configuration to all modules.
   */
  private applyConfig(config: POVSwitchingConfig): void {
    // Update AudioMonitor config
    this.audioMonitor.updateConfig({
      pollIntervalMs: config.pollIntervalMs,
      rollingWindowMs: config.rollingWindowMs,
      dbFloor: config.dbFloor,
      dbCeiling: config.dbCeiling,
      emitIntervalMs: config.scoreEmitIntervalMs,
    })

    // Update POVSwitcher config
    this.switcher.updateConfig({
      cooldownMs: config.cooldownMs,
      activityThreshold: config.activityThreshold,
      silenceThreshold: config.silenceThreshold,
    })

    // Update TransitionQueue config
    this.transitionQueue.updateConfig(config.transition)

    // Update health check interval
    if (this.started) {
      this.connectionManager.stopHealthChecks()
      this.connectionManager.startHealthChecks(config.healthCheckIntervalMs)
    }
  }
}
