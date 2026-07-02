/**
 * AutomationManager — evaluates persisted "when event X → do Y" rules
 * against every KernelBus event using field-match conditions.
 *
 * Rules are loaded from SQLite via AutomationRuleRepository.
 * Boot after all other managers (bootPriority: 100).
 */
import type { Manager, ManagerStatus, AutomationRule, OverlayTriggerPayload, DesktopNotificationPayload } from '@ieomlabs/shared'
import { STATE } from '@ieomlabs/shared'
import type { KernelBus, BusFrame } from '../bus.js'
import type { SceneManager } from './scene.js'
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
    private machine: SceneManager,
  ) {}

  init(): void { this._status = 'idle' }

  start(): void {
    this._unsubscribe = this.bus.onAny((frame: BusFrame) => {
      this.evaluate(frame.event, frame.payload)
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
        case 'widget:toggle': {
          const widgetId = params['widgetId']
          if (typeof widgetId === 'string') this.io.emit('widget:toggle', widgetId)
          break
        }
        case 'scene:change': {
          const sceneId = params['sceneId']
          if (typeof sceneId === 'string' && Object.values(STATE).includes(sceneId as STATE)) {
            this.machine.transition(sceneId as STATE)
          }
          break
        }
        case 'overlay:show':
          this.io.emit('overlay:show', params as unknown as OverlayTriggerPayload)
          break
        case 'desktop:notify':
          this.io.emit('desktop:notify', params as unknown as DesktopNotificationPayload)
          break
      }
    } catch (err) {
      logger.warn({ err, rule }, '[automation] rule execution failed')
    }
  }
}
