/** Lifecycle state of a kernel manager */
export type ManagerStatus = 'idle' | 'running' | 'stopped' | 'error'

/**
 * Uniform lifecycle interface every kernel manager must implement.
 *
 * Lifecycle order:
 *   init() → start() → (running) → stop() → dispose()
 *
 * - `init`    — one-time setup (open DB, allocate resources). Called once before start.
 * - `start`   — begin active work (timers, connections, listeners).
 * - `stop`    — pause/halt active work. Manager stays in memory; can be restarted.
 * - `dispose` — full teardown, release all resources. Not restartable after this.
 * - `status`  — current lifecycle state for diagnostics / health checks.
 *
 * Optional fields for plugin extension:
 * - `bootPriority` — lower value boots first (default 0). Used as primary sort key.
 * - `configNamespace` — namespaced key for config injection (future plugin use).
 */
export interface Manager {
  readonly name: string
  readonly bootPriority?: number
  readonly configNamespace?: string
  init(): Promise<void> | void
  start(): Promise<void> | void
  stop(): Promise<void> | void
  dispose(): Promise<void> | void
  status(): ManagerStatus
  /**
   * Called by DesktopConfigService after each successful config persistence.
   * Implement this instead of holding a callback reference via onConfigUpdate.
   */
  onConfigChange?(config: import('../domain/config.js').AppConfig, section: string): void
}
