/**
 * AutomationManager — evaluates persisted "when event X → do Y" rules
 * against every KernelBus event using field-match conditions.
 *
 * Rules are loaded from SQLite via AutomationRuleRepository.
 * Boot after all other managers (bootPriority: 100).
 */
import type { Manager, ManagerStatus, AutomationRule } from '@ieomlabs/shared'
import { STATE } from '@ieomlabs/shared'
import type { KernelBus } from '../bus.js'
import type { SceneMachine } from './scene.js'
import type { AutomationRuleRepository } from '../../db/repositories/AutomationRuleRepository.js'
import type { Server as SocketIOServer } from 'socket.io'
import logger from '../../lib/logger.js'

export class AutomationManager implements Manager {
  readonly name = 'AutomationManager'
  readonly bootPriority = 100

  private _status: ManagerStatus = 'idle'
  private _unsubscribe: (() => void) | null = null

  constructor(
    private repo: AutomationRuleRepository,
    private bus: KernelBus,
    private io: SocketIOServer,
    private machine: SceneMachine,
  ) {}

  init(): void { this._status = 'idle' }

  start(): void {
    this._unsubscribe = this.bus.onAny((event, payload) => {
      this.evaluate(event, payload)
    })
    this._status = 'running'
  }

  stop(): void {
    this._unsubscribe?.()
    this._unsubscribe = null
    this._status = 'stopped'
  }

  dispose(): void { this._status = 'stopped' }
  status(): ManagerStatus { return this._status }

  private evaluate(event: string, payload: unknown): void {
    let rules: AutomationRule[]
    try {
      rules = this.repo.list()
    } catch (err) {
      logger.warn({ err }, '[automation] failed to load rules')
      return
    }
    for (const rule of rules) {
      if (!rule.enabled) continue
      if (rule.condition.event !== event) continue
      if (!this.matches(rule.condition.match, payload)) continue
      this.execute(rule)
    }
  }

  private matches(match: Record<string, unknown> | undefined, payload: unknown): boolean {
    if (!match || Object.keys(match).length === 0) return true
    if (typeof payload !== 'object' || payload === null) return false
    const p = payload as Record<string, unknown>
    return Object.entries(match).every(([k, v]) => p[k] === v)
  }

  private execute(rule: AutomationRule): void {
    const { kind, params } = rule.action
    try {
      switch (kind) {
        case 'widget:toggle':
          this.io.emit('widget:toggle', params)
          break
        case 'scene:change': {
          const sceneId = params['sceneId']
          if (typeof sceneId === 'string' && Object.values(STATE).includes(sceneId as STATE)) {
            this.machine.transition(sceneId as STATE)
          }
          break
        }
        case 'bus:emit':
          if (typeof params['event'] === 'string') {
            this.bus.emitCustom(params['event'], params['payload'] ?? null)
          }
          break
      }
    } catch (err) {
      logger.warn({ err, rule }, '[automation] rule execution failed')
    }
  }
}
