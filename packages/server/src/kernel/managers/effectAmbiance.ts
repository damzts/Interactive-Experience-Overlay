/**
 * EffectAmbianceManager — fires randomly selected overlay effects on a jittered timer.
 *
 * Reads AppConfig.effectAmbiance (pool, intervalSeconds, jitterFactor, countPerTick) and,
 * when enabled, picks `countPerTick` effects from the pool at random on each tick and fires
 * them via the existing 'scheduler:fired' bus path (same path used by EventScheduler and
 * ChatReactionManager), so the scene handler's executeConfiguredEvent dispatches them exactly
 * like any other configured event.
 */

import type { Manager, ManagerStatus, AppConfig } from '@ieomlabs/shared'
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
  private timer: ReturnType<typeof setTimeout> | null = null
  private tickCount = 0

  constructor(
    private getConfig: () => AppConfig,
    private bus: KernelBus,
  ) {}

  init(): void { this._status = 'idle' }

  start(): void {
    this._status = 'running'
    this.armTimer()
  }

  stop(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    this._status = 'stopped'
  }

  dispose(): void { this.stop() }
  status(): ManagerStatus { return this._status }

  onConfigChange(): void {
    if (this._status !== 'running') return
    this.armTimer()
  }

  private armTimer() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    const config = this.getConfig().effectAmbiance
    if (!config?.enabled || config.pool.length === 0) return
    const delay = jitterMs(config.intervalSeconds, config.jitterFactor ?? 0.3)
    this.timer = setTimeout(() => this.tick(), delay)
  }

  private tick() {
    this.timer = null
    const config = this.getConfig().effectAmbiance
    if (!config?.enabled || config.pool.length === 0) {
      this.armTimer()
      return
    }

    const count = Math.max(1, config.countPerTick ?? 1)
    const effects = Array.from({ length: count }, () => config.pool[randBetween(0, config.pool.length - 1)])

    this.tickCount += 1
    const tickId = `effect-ambiance-${this.tickCount}`
    logger.info(`[effect-ambiance] firing ${effects.length} effect(s) from pool of ${config.pool.length}`)

    this.bus.emit('scheduler:fired', {
      eventId: tickId,
      event: {
        id: tickId,
        label: 'Effect Ambiance',
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

    this.armTimer()
  }
}
