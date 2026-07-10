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
import type { Manager, ManagerStatus, AutomationRule, AutomationGate, EventConfig } from '@ieomlabs/shared'
import { STATE, isSyntheticSignalPayload, createAutomationGate } from '@ieomlabs/shared'
import type { KernelBus, BusFrame } from '../bus.js'
import type { SceneManager } from './scene.js'
import type { AutomationRuleRepository } from '../../db/repositories/AutomationRuleRepository.js'
import type { Server as SocketIOServer } from 'socket.io'
import logger from '../../lib/logger.js'
import './automation.signals.js'

type WidgetSignalFrame = { source: string; event: string; payload: unknown }

export class AutomationManager implements Manager {
  readonly name = 'AutomationManager'
  readonly bootPriority = 100

  private _status: ManagerStatus = 'idle'
  private _unsubscribe: (() => void) | null = null
  private _unsubRulesChanged: (() => void) | null = null
  private _unsubConfigChanged: (() => void) | null = null
  private rules: AutomationRule[] = []
  /** Stateful firing gate (cooldown / everyN / window). RAM-only, keyed by rule id. */
  private gate: AutomationGate = createAutomationGate()

  constructor(
    private repo: AutomationRuleRepository,
    private bus: KernelBus,
    private io: SocketIOServer,
    private machine: SceneManager,
  ) {}

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
      // Single-hop guard: a rule whose action re-emits a signal may not fire
      // off of an already-synthetic (signal-emit-produced) signal — same
      // loop protection the old inline switch had for 'signal:emit'.
      if (rule.action.kind === 'signal-emit' && signal && isSyntheticSignalPayload(signal.payload)) continue
      this.execute(rule)
    }
  }

  private matches(match: Record<string, unknown> | undefined, payload: unknown): boolean {
    if (!match || Object.keys(match).length === 0) return true
    if (typeof payload !== 'object' || payload === null) return false
    const p = payload as Record<string, unknown>
    return Object.entries(match).every(([k, v]) => p[k] === v)
  }

  /** Wraps the rule's action in a synthetic one-action EventConfig and fires
   *  it through the same scheduler:fired → executeConfiguredEvent pipeline
   *  Events, ShowSequencer, ChatReactionManager, and Twitch event reactions
   *  already use — so any action reachable from an Event (including every
   *  ACTION_CATALOG entry) is reachable from an Automation Rule too, with no
   *  dispatch logic duplicated here. */
  private execute(rule: AutomationRule): void {
    try {
      const event: EventConfig = {
        id: `automation:${rule.id}`,
        label: '', icon: '', color: '', desc: '',
        effects: [],
        actions: [rule.action],
        auto: { enabled: false, mode: 'interval', intervalMin: 0, idleMin: 0, chance: 1, cooldownMin: 0 },
      }
      this.bus.emit('scheduler:fired', { eventId: rule.id, event })
    } catch (err) {
      logger.warn({ err, rule }, '[automation] rule execution failed')
    }
  }
}
