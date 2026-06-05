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
 */
export interface Manager {
  readonly name: string
  init(): Promise<void> | void
  start(): Promise<void> | void
  stop(): Promise<void> | void
  dispose(): Promise<void> | void
  status(): ManagerStatus
}
