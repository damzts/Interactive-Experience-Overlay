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

import type { Manager } from '@ieom/shared'
import { KernelBus } from './bus.js'
import logger from '../lib/logger.js';


export { KernelBus } from './bus.js'
export type { KernelEvents } from './bus.js'

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
  getManagerStatuses(): Record<string, import('@ieom/shared').ManagerStatus> {
    const result: Record<string, import('@ieom/shared').ManagerStatus> = {}
    for (const [name, m] of this.managers) result[name] = m.status()
    return result
  }

  /** Kahn's algorithm — returns names in dependency-safe boot order. */
  private topoSort(): string[] {
    const inDegree = new Map<string, number>()
    const adjReverse = new Map<string, string[]>() // name → who depends on it

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

    const queue = [...this.managers.keys()].filter((n) => inDegree.get(n) === 0)
    const order: string[] = []

    while (queue.length > 0) {
      const node = queue.shift()!
      order.push(node)
      for (const dependent of adjReverse.get(node) ?? []) {
        const deg = (inDegree.get(dependent) ?? 0) - 1
        inDegree.set(dependent, deg)
        if (deg === 0) queue.push(dependent)
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
    logger.log({}, `[kernel] booted (${this.bootOrder.length} managers: ${this.bootOrder.join(' → ')})`)
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
    logger.log('[kernel] shutdown complete')
  }
}
