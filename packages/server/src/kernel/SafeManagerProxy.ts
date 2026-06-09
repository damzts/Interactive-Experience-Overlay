/**
 * SafeManagerProxy — wraps a Manager to catch errors from start/stop/init/dispose.
 *
 * If a wrapped manager throws 3 times within 60 seconds, it is quarantined:
 * - Its lifecycle methods are no-ops
 * - A 'manager:quarantined' custom event is emitted on the bus
 */
import type { Manager, ManagerStatus } from '@ieomlabs/shared'
import type { KernelBus } from './bus.js'
import logger from '../lib/logger.js'

const QUARANTINE_WINDOW_MS = 60_000
const QUARANTINE_THRESHOLD = 3

export class SafeManagerProxy implements Manager {
  readonly name: string
  readonly bootPriority: number
  readonly configNamespace: string | undefined

  private _failureCount = 0
  private _firstFailureAt = 0
  private _quarantined = false

  constructor(
    private inner: Manager,
    private bus?: KernelBus,
  ) {
    this.name = inner.name
    this.bootPriority = inner.bootPriority ?? 0
    this.configNamespace = inner.configNamespace
  }

  private recordFailure(phase: string, err: unknown): void {
    const now = Date.now()
    if (this._failureCount === 0 || now - this._firstFailureAt > QUARANTINE_WINDOW_MS) {
      this._failureCount = 1
      this._firstFailureAt = now
    } else {
      this._failureCount++
    }

    logger.error({ err, manager: this.name, phase, failures: this._failureCount }, '[kernel] Manager error:')

    if (this._failureCount >= QUARANTINE_THRESHOLD && !this._quarantined) {
      this._quarantined = true
      logger.error(`[kernel] Manager '${this.name}' quarantined after ${QUARANTINE_THRESHOLD} failures in 60s`)
      this.bus?.emitCustom('manager:quarantined', { name: this.name, reason: `${QUARANTINE_THRESHOLD} failures in 60s` })
    }
  }

  private async safeCall(phase: string, fn: () => Promise<void> | void): Promise<void> {
    if (this._quarantined) return
    try {
      await fn()
    } catch (err) {
      this.recordFailure(phase, err)
    }
  }

  async init(): Promise<void> { await this.safeCall('init', () => this.inner.init()) }
  async start(): Promise<void> { await this.safeCall('start', () => this.inner.start()) }
  async stop(): Promise<void> { await this.safeCall('stop', () => this.inner.stop()) }
  async dispose(): Promise<void> { await this.safeCall('dispose', () => this.inner.dispose()) }
  status(): ManagerStatus { return this._quarantined ? 'error' : this.inner.status() }

  get isQuarantined(): boolean { return this._quarantined }
}
