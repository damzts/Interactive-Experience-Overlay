/**
 * Kernel — the central orchestrator of @ieom/server.
 *
 * Owns a registry of named managers and an internal event bus.
 * Boot order is determined by declared dependencies (topological sort).
 * Shutdown is the reverse of the resolved boot order.
 *
 * Usage:
 *   const kernel = new Kernel()
 *   kernel.register(configService)
 *   kernel.register(sceneMachine, { after: ['DesktopConfigService'] })
 *   await kernel.boot()
 *   // later:
 *   await kernel.shutdown()
 */

import logger from '../lib/logger.js'
import type { Manager } from '@ieomlabs/shared'
import { KernelBus } from './bus.js'

// Import all manager signal augmentations so KernelEvents is fully typed
// whenever this module is imported. New managers should add a signals.ts entry here.
import './managers/scheduler.signals.js'
import './managers/ambiance.signals.js'
import './managers/config.signals.js'
import './managers/obs.signals.js'
import './managers/showSequencer.signals.js'
import './managers/twitchChat.signals.js'

export { KernelBus } from './bus.js'
export type { KernelEvents } from './bus.js'
export { SafeManagerProxy } from './SafeManagerProxy.js'

export class Kernel {
  readonly bus: KernelBus = new KernelBus()
  private managers: Map<string, Manager> = new Map()
  private deps: Map<string, string[]> = new Map()
  private bootOrder: string[] = []

  /** Register a manager. `after` lists manager names that must boot before this one. */
  register(manager: Manager, options?: { after?: string[] }): void {
    if (this.managers.has(manager.name)) {
      throw new Error(`[kernel] Manager '${manager.name}' is already registered`)
    }
    this.managers.set(manager.name, manager)
    this.deps.set(manager.name, options?.after ?? [])
  }

  /** Retrieve a registered manager by name. Throws if not found. */
  getManager<T extends Manager>(name: string): T {
    const m = this.managers.get(name)
    if (!m) throw new Error(`[kernel] Manager '${name}' not found`)
    return m as T
  }

  /** Returns a snapshot of every manager's current lifecycle status. */
  getManagerStatuses(): Record<string, import('@ieomlabs/shared').ManagerStatus> {
    const result: Record<string, import('@ieomlabs/shared').ManagerStatus> = {}
    for (const [name, m] of this.managers) result[name] = m.status()
    return result
  }

  /** Kahn's algorithm — returns names in dependency-safe boot order.
   * Primary sort: bootPriority (lower = first). Topo-sort breaks ties and validates declared deps. */
  private topoSort(): string[] {
    const inDegree = new Map<string, number>()
    const adjReverse = new Map<string, string[]>()

    for (const name of this.managers.keys()) {
      inDegree.set(name, 0)
      adjReverse.set(name, [])
    }

    for (const [name, predecessors] of this.deps) {
      for (const pred of predecessors) {
        if (!this.managers.has(pred)) {
          throw new Error(`[kernel] '${name}' declares dependency on unknown manager '${pred}'`)
        }
        adjReverse.get(pred)!.push(name)
        inDegree.set(name, (inDegree.get(name) ?? 0) + 1)
      }
    }

    // Seed queue sorted by bootPriority so that within the same dependency level,
    // managers with lower bootPriority boot first.
    const queue = [...this.managers.keys()]
      .filter((n) => inDegree.get(n) === 0)
      .sort((a, b) => (this.managers.get(a)!.bootPriority ?? 0) - (this.managers.get(b)!.bootPriority ?? 0))

    const order: string[] = []

    while (queue.length > 0) {
      const node = queue.shift()!
      order.push(node)
      const dependents = (adjReverse.get(node) ?? [])
        .sort((a, b) => (this.managers.get(a)!.bootPriority ?? 0) - (this.managers.get(b)!.bootPriority ?? 0))
      for (const dependent of dependents) {
        const deg = (inDegree.get(dependent) ?? 0) - 1
        inDegree.set(dependent, deg)
        if (deg === 0) {
          // Insert in priority order
          const insertPriority = this.managers.get(dependent)!.bootPriority ?? 0
          const insertIdx = queue.findIndex((n) => (this.managers.get(n)!.bootPriority ?? 0) > insertPriority)
          queue.splice(insertIdx === -1 ? queue.length : insertIdx, 0, dependent)
        }
      }
    }

    if (order.length !== this.managers.size) {
      throw new Error('[kernel] Circular dependency detected in manager boot graph')
    }
    return order
  }

  /**
   * Boot: resolve dependency order, then init all → start all.
   */
  async boot(): Promise<void> {
    this.bootOrder = this.topoSort()
    for (const name of this.bootOrder) {
      await this.managers.get(name)!.init()
    }
    for (const name of this.bootOrder) {
      await this.managers.get(name)!.start()
    }
    logger.info(`[kernel] booted (${this.bootOrder.length} managers: ${this.bootOrder.join(' → ')})`)
  }

  /**
   * Shutdown: stop all in reverse boot order, then dispose all.
   */
  async shutdown(): Promise<void> {
    const reversed = [...this.bootOrder].reverse()
    for (const name of reversed) {
      await this.managers.get(name)!.stop()
    }
    for (const name of reversed) {
      await this.managers.get(name)!.dispose()
    }
    this.bus.removeAllListeners()
    logger.info('[kernel] shutdown complete')
  }
}