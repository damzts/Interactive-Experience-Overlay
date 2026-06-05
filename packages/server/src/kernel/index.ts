/**
 * Kernel — the central orchestrator of @ieom/server.
 *
 * Owns a registry of named managers and an internal event bus.
 * Boots all registered managers in registration order, shuts them
 * down in reverse order.
 *
 * Usage:
 *   const kernel = new Kernel()
 *   kernel.register(configService)
 *   kernel.register(sceneMachine)
 *   await kernel.boot()
 *   // later:
 *   await kernel.shutdown()
 */

import type { Manager } from '@ieom/shared'
import { KernelBus } from './bus.js'

export { KernelBus } from './bus.js'
export type { KernelEvents } from './bus.js'

export class Kernel {
  readonly bus: KernelBus = new KernelBus()
  private managers: Map<string, Manager> = new Map()
  private registrationOrder: string[] = []

  /** Register a manager. Must be called before boot(). */
  register(manager: Manager): void {
    if (this.managers.has(manager.name)) {
      throw new Error(`[kernel] Manager '${manager.name}' is already registered`)
    }
    this.managers.set(manager.name, manager)
    this.registrationOrder.push(manager.name)
  }

  /** Retrieve a registered manager by name. Throws if not found. */
  getManager<T extends Manager>(name: string): T {
    const m = this.managers.get(name)
    if (!m) throw new Error(`[kernel] Manager '${name}' not found`)
    return m as T
  }

  /** Returns a snapshot of every manager's current lifecycle status. */
  getManagerStatuses(): Record<string, import('@ieom/shared').ManagerStatus> {
    const result: Record<string, import('@ieom/shared').ManagerStatus> = {}
    for (const [name, m] of this.managers) result[name] = m.status()
    return result
  }

  /**
   * Boot: init all managers in registration order, then start all.
   * Each step is sequential to allow managers to depend on earlier ones.
   */
  async boot(): Promise<void> {
    for (const name of this.registrationOrder) {
      await this.managers.get(name)!.init()
    }
    for (const name of this.registrationOrder) {
      await this.managers.get(name)!.start()
    }
    console.log(`[kernel] booted (${this.registrationOrder.length} managers)`)
  }

  /**
   * Shutdown: stop all in reverse order, then dispose all in reverse order.
   */
  async shutdown(): Promise<void> {
    const reversed = [...this.registrationOrder].reverse()
    for (const name of reversed) {
      await this.managers.get(name)!.stop()
    }
    for (const name of reversed) {
      await this.managers.get(name)!.dispose()
    }
    this.bus.removeAllListeners()
    console.log('[kernel] shutdown complete')
  }
}
