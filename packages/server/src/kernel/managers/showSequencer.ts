/**
 * ShowSequencer — executes scripted show sequences as a timed step chain.
 *
 * A ShowDefinition is an ordered list of ShowSteps, each with a delayMs offset
 * from show start and an EventAction to execute. Steps run via setTimeout chains
 * and are cancellable. Emits 'show:step' on the KernelBus for diagnostics.
 *
 * Reuses the existing executeConfiguredEvent / scheduler:fired path for actions
 * so that all action kinds (desktop-config, widget-command, obs-stream, etc.) work
 * without duplicating dispatch logic here.
 */

import type { Manager, ManagerStatus, AppConfig, ShowDefinition, EventAction } from '@ieomlabs/shared'
import type { KernelBus } from '../bus.js'
import type { SceneMachine } from './scene.js'
import type { ObsBridge } from './obs.js'
import logger from '../../lib/logger.js'

export class ShowSequencer implements Manager {
  readonly name = 'ShowSequencer'
  readonly bootPriority = 50

  private _status: ManagerStatus = 'idle'
  private runningShows = new Map<string, ReturnType<typeof setTimeout>[]>()

  constructor(
    private getConfig: () => AppConfig,
    private bus: KernelBus,
    private machine: SceneMachine,
    private obsBridge?: ObsBridge,
  ) {}

  init(): void { this._status = 'idle' }
  start(): void { this._status = 'running' }

  stop(): void {
    for (const timers of this.runningShows.values()) {
      timers.forEach(clearTimeout)
    }
    this.runningShows.clear()
    this._status = 'stopped'
  }

  dispose(): void { this.stop() }
  status(): ManagerStatus { return this._status }

  /** Run a show by ID. Cancels any already-running instance of the same show. */
  run(showId: string): { ok: boolean; error?: string } {
    const show = (this.getConfig().shows ?? []).find((s) => s.id === showId)
    if (!show) return { ok: false, error: `Show not found: ${showId}` }

    // Cancel any currently running instance
    this.cancel(showId)

    const timers: ReturnType<typeof setTimeout>[] = []

    show.steps.forEach((step, index) => {
      const t = setTimeout(() => {
        const label = step.label ?? `step ${index}`
        logger.info(`[show:${showId}] ${label}`)
        this.bus.emit('show:step', { showId, stepIndex: index, label })
        this.executeStep(showId, step.action)
      }, step.delayMs)
      timers.push(t)
    })

    this.runningShows.set(showId, timers)
    logger.info(`[show] started: ${showId} (${show.steps.length} steps)`)
    return { ok: true }
  }

  /** Cancel a running show. No-op if the show is not running. */
  cancel(showId: string): void {
    const timers = this.runningShows.get(showId)
    if (timers) {
      timers.forEach(clearTimeout)
      this.runningShows.delete(showId)
      logger.info(`[show] cancelled: ${showId}`)
    }
  }

  getRunningShows(): string[] {
    return Array.from(this.runningShows.keys())
  }

  private executeStep(showId: string, action: EventAction): void {
    if (action.kind === 'obs-stream') {
      if (!this.obsBridge) {
        logger.warn(`[show:${showId}] obs-stream action skipped — ObsBridge not available`)
        return
      }
      if (action.action === 'start') {
        void this.obsBridge.startStreaming(action.rtmpUrl, action.streamKey)
      } else {
        void this.obsBridge.stopStreaming()
      }
      return
    }

    // All other action kinds are dispatched via the scheduler:fired bus event,
    // which the scene handler picks up and routes through executeConfiguredEvent.
    this.bus.emit('scheduler:fired', {
      eventId: `${showId}:step`,
      event: {
        id: `${showId}:step`,
        label: '',
        icon: '',
        color: '',
        desc: '',
        effects: [],
        actions: [action],
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
  }
}
