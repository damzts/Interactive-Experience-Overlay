/**
 * EffectAmbianceManager — runs one or more independent "storms" of randomly
 * selected overlay effects, each on its own jittered timer.
 *
 * Reads AppConfig.effectStorms (falling back to a one-time migration from
 * the legacy single-pool AppConfig.effectAmbiance via withEffectStormsDefaults)
 * and, for each enabled storm, picks `countPerTick` effects from its pool at
 * random on each tick and fires them via the existing 'scheduler:fired' bus
 * path (same path used by EventScheduler and ChatReactionManager), so the
 * scene handler's executeConfiguredEvent dispatches them exactly like any
 * other configured event.
 */

import type { Manager, ManagerStatus, AppConfig, EffectStormConfig } from '@ieomlabs/shared'
import { withEffectStormsDefaults } from '@ieomlabs/shared'
import type { KernelBus } from '../bus.js'
import logger from '../../lib/logger.js'

function randBetween(minValue: number, maxValue: number) {
  return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue
}

function jitterMs(seconds: number, jitterFactor: number) {
  const base = Math.max(1, seconds) * 1000
  const jitter = Math.min(Math.max(jitterFactor, 0), 1)
  return randBetween(Math.floor(base * (1 - jitter)), Math.ceil(base * (1 + jitter)))
}

export class EffectAmbianceManager implements Manager {
  readonly name = 'EffectAmbianceManager'
  readonly bootPriority = 40

  private _status: ManagerStatus = 'idle'
  /** One timer per storm, keyed by storm id. */
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private tickCount = 0

  constructor(
    private getConfig: () => AppConfig,
    private bus: KernelBus,
  ) {}

  init(): void { this._status = 'idle' }

  start(): void {
    this._status = 'running'
    this.rearmAll()
  }

  stop(): void {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
    this._status = 'stopped'
  }

  dispose(): void { this.stop() }
  status(): ManagerStatus { return this._status }

  onConfigChange(): void {
    if (this._status !== 'running') return
    this.rearmAll()
  }

  private getStorms(): EffectStormConfig[] {
    const config = this.getConfig()
    return withEffectStormsDefaults(config.effectStorms, config.effectAmbiance)
  }

  /** Reconciles the timer set with the current storm list — clears timers
   *  for storms that were removed/disabled, and arms timers for any storm
   *  that doesn't have one yet (new or newly enabled). Storms that already
   *  have a running timer are left alone so editing an unrelated field
   *  (or another storm) doesn't reset their in-flight countdown. */
  private rearmAll() {
    const storms = this.getStorms()
    const liveIds = new Set(storms.filter((s) => s.enabled && s.pool.length > 0).map((s) => s.id))

    for (const [id, timer] of this.timers) {
      if (!liveIds.has(id)) {
        clearTimeout(timer)
        this.timers.delete(id)
      }
    }

    for (const storm of storms) {
      if (!storm.enabled || storm.pool.length === 0) continue
      if (this.timers.has(storm.id)) continue
      this.armTimer(storm.id)
    }
  }

  private armTimer(stormId: string) {
    const existing = this.timers.get(stormId)
    if (existing) clearTimeout(existing)
    const storm = this.getStorms().find((s) => s.id === stormId)
    if (!storm?.enabled || storm.pool.length === 0) {
      this.timers.delete(stormId)
      return
    }
    const delay = jitterMs(storm.intervalSeconds, storm.jitterFactor ?? 0.3)
    this.timers.set(stormId, setTimeout(() => this.tick(stormId), delay))
  }

  private tick(stormId: string) {
    this.timers.delete(stormId)
    const storm = this.getStorms().find((s) => s.id === stormId)
    if (!storm?.enabled || storm.pool.length === 0) {
      return
    }

    const count = Math.max(1, storm.countPerTick ?? 1)
    const effects = Array.from({ length: count }, () => storm.pool[randBetween(0, storm.pool.length - 1)])

    this.tickCount += 1
    const tickId = `effect-storm-${storm.id}-${this.tickCount}`
    logger.info(`[effect-storms] "${storm.label}" firing ${effects.length} effect(s) from pool of ${storm.pool.length}`)

    this.bus.emit('scheduler:fired', {
      eventId: tickId,
      event: {
        id: tickId,
        label: storm.label,
        icon: '',
        color: '',
        desc: '',
        effects,
        actions: [],
        auto: {
          enabled: false,
          mode: 'interval' as const,
          intervalMin: 0,
          idleMin: 0,
          chance: 1,
          cooldownMin: 0,
        },
      },
    })

    this.armTimer(stormId)
  }
}
