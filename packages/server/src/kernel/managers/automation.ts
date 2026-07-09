/**
 * AutomationManager — evaluates persisted automation rules against every
 * KernelBus event using field-match conditions.
 *
 * Unified model: kernel-trigger rules match bus events directly; widget-trigger
 * rules match `widget:signal` frames forwarded from the overlay. The overlay
 * executes `widget:action` rules synchronously on its DOM bus, EXCEPT
 * open/close/toggle, which mutate authoritative open state and are executed
 * here. All other action kinds always execute here.
 *
 * Rules are loaded from SQLite via AutomationRuleRepository once on start
 * and cached in memory; the cache refreshes on `automation:rules:changed`
 * (emitted by the HTTP CRUD route) so evaluation never touches disk.
 * Boot after all other managers (bootPriority: 100).
 */
import type { Manager, ManagerStatus, AutomationRule, OverlayTriggerPayload, DesktopNotificationPayload, AutomationGate } from '@ieomlabs/shared'
import { STATE, SYNTHETIC_SIGNAL_KEY, isSyntheticSignalPayload, createAutomationGate } from '@ieomlabs/shared'
import type { KernelBus, BusFrame } from '../bus.js'
import type { SceneManager } from './scene.js'
import type { AutomationRuleRepository } from '../../db/repositories/AutomationRuleRepository.js'
import type { Server as SocketIOServer } from 'socket.io'
import logger from '../../lib/logger.js'
import './automation.signals.js'

type WidgetSignalFrame = { source: string; event: string; payload: unknown }

/** Authoritative widget open-state mutators (bound to the socket runtime in desktop-entry). */
export interface WidgetRuntimeDelegate {
  setOpen(widgetId: string, open: boolean): void
  toggle(widgetId: string): void
}

export class AutomationManager implements Manager {
  readonly name = 'AutomationManager'
  readonly bootPriority = 100

  private _status: ManagerStatus = 'idle'
  private _unsubscribe: (() => void) | null = null
  private _unsubRulesChanged: (() => void) | null = null
  private _unsubConfigChanged: (() => void) | null = null
  private rules: AutomationRule[] = []
  private widgetRuntime: WidgetRuntimeDelegate | null = null
  /** Stateful firing gate (cooldown / everyN / window). RAM-only, keyed by rule id. */
  private gate: AutomationGate = createAutomationGate()

  constructor(
    private repo: AutomationRuleRepository,
    private bus: KernelBus,
    private io: SocketIOServer,
    private machine: SceneManager,
  ) {}

  /** Bind the authoritative widget open-state mutators (called from desktop-entry once sockets exist). */
  setWidgetRuntime(delegate: WidgetRuntimeDelegate): void {
    this.widgetRuntime = delegate
  }

  init(): void { this._status = 'idle' }

  start(): void {
    this.reloadRules()
    this._unsubRulesChanged = this.bus.on('automation:rules:changed', () => this.reloadRules())
    this._unsubConfigChanged = this.bus.on('config:changed', ({ section }) => {
      if (section === 'all') this.reloadRules()
    })
    this._unsubscribe = this.bus.onAny((frame: BusFrame) => {
      this.evaluate(frame.event, frame.payload)
    })
    this._status = 'running'
  }

  stop(): void {
    this._unsubscribe?.()
    this._unsubscribe = null
    this._unsubRulesChanged?.()
    this._unsubRulesChanged = null
    this._unsubConfigChanged?.()
    this._unsubConfigChanged = null
    this._status = 'stopped'
  }

  dispose(): void { this._status = 'stopped' }
  status(): ManagerStatus { return this._status }

  /** Refresh the in-memory rule cache from SQLite. Keeps the old cache on failure. */
  reloadRules(): void {
    try {
      this.rules = this.repo.list()
    } catch (err) {
      logger.warn({ err }, '[automation] failed to reload rules — keeping previous cache')
    }
  }

  private evaluate(event: string, payload: unknown): void {
    const signal = event === 'widget:signal' ? payload as WidgetSignalFrame : null
    for (const rule of this.rules) {
      if (!rule.enabled) continue
      const t = rule.trigger
      if (t.source === 'widget') {
        if (!signal) continue
        if (t.event !== signal.event) continue
        if (t.widgetId && t.widgetId !== signal.source) continue
        if (!this.matches(t.match, signal.payload)) continue
      } else {
        if (t.event !== event) continue
        if (!this.matches(t.match, payload)) continue
      }
      if (t.sceneIs?.length && !t.sceneIs.includes(this.machine.currentState as STATE)) continue
      if (!this.gate(rule)) continue
      this.execute(rule, signal)
    }
  }

  private matches(match: Record<string, unknown> | undefined, payload: unknown): boolean {
    if (!match || Object.keys(match).length === 0) return true
    if (typeof payload !== 'object' || payload === null) return false
    const p = payload as Record<string, unknown>
    return Object.entries(match).every(([k, v]) => p[k] === v)
  }

  private execute(rule: AutomationRule, signal: WidgetSignalFrame | null): void {
    const { kind, params } = rule.action
    try {
      switch (kind) {
        case 'widget:action': {
          // Only authoritative open-state actions execute here; custom actions
          // run synchronously in the overlay's DOM-bus evaluator.
          const targetWidgetId = params['targetWidgetId']
          const action = params['action']
          if (typeof targetWidgetId !== 'string' || typeof action !== 'string') break
          if (action === 'open' || action === 'close') {
            this.widgetRuntime?.setOpen(targetWidgetId, action === 'open')
          } else if (action === 'toggle') {
            this.widgetRuntime?.toggle(targetWidgetId)
          }
          break
        }
        case 'widget:toggle': {
          const widgetId = params['widgetId']
          if (typeof widgetId !== 'string') break
          if (this.widgetRuntime) this.widgetRuntime.toggle(widgetId)
          else this.io.emit('widget:toggle', widgetId)
          break
        }
        case 'scene:change': {
          const sceneId = params['sceneId']
          // Scene ids are data-driven — the machine itself rejects
          // TRANSITIONING and no-op transitions.
          if (typeof sceneId === 'string' && sceneId.length > 0) {
            this.machine.transition(sceneId)
          }
          break
        }
        case 'overlay:show':
          this.io.emit('overlay:show', params as unknown as OverlayTriggerPayload)
          break
        case 'desktop:notify':
          this.io.emit('desktop:notify', params as unknown as DesktopNotificationPayload)
          break
        case 'signal:emit': {
          const event = params['event']
          if (typeof event !== 'string' || !event) break
          // Single-hop guard: a synthetic signal may not mint another one.
          if (signal && isSyntheticSignalPayload(signal.payload)) break
          const payload = {
            ...(typeof params['payload'] === 'object' && params['payload'] !== null ? params['payload'] as Record<string, unknown> : {}),
            [SYNTHETIC_SIGNAL_KEY]: true,
          }
          const synthetic: WidgetSignalFrame = { source: 'automation', event, payload }
          this.bus.emit('widget:signal', synthetic) // other server rules can react
          this.io.emit('widget:signal', synthetic)  // overlay widgets/renderers can react
          break
        }
      }
    } catch (err) {
      logger.warn({ err, rule }, '[automation] rule execution failed')
    }
  }
}
