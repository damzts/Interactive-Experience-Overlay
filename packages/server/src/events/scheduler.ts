import type { SceneMachine } from '../state/machine.js'
import { STATE } from '@ieom/shared'
import type { EventConfig } from '@ieom/shared'
import { appendLog } from '../db/db.js'
import { getConfig } from '../routes/config.js'

const TICK_MS = 5_000

function randBetween(minValue: number, maxValue: number) {
  return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue
}

function jitterMs(minutes: number) {
  const base = Math.max(1, minutes) * 60_000
  return randBetween(Math.floor(base * 0.8), Math.ceil(base * 1.2))
}

export class EventScheduler {
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private lastActivityAt = Date.now()
  private intervalNextRunAt = new Map<string, number>()
  private idleTriggered = new Set<string>()

  constructor(private machine: SceneMachine) {}

  noteActivity() {
    this.lastActivityAt = Date.now()
    this.idleTriggered.clear()
  }

  /** Call this when the server is ready to start scheduling. */
  start() {
    this.stop()
    this.lastActivityAt = Date.now()
    this.intervalNextRunAt.clear()
    this.idleTriggered.clear()
    this.tickTimer = setInterval(() => this.evaluateEvents(), TICK_MS)
    this.evaluateEvents()
    console.log('[scheduler] auto-event scheduler started')
  }

  stop() {
    if (this.tickTimer) clearInterval(this.tickTimer)
    this.tickTimer = null
  }

  private fireEvent(eventDef: EventConfig) {
    appendLog('auto-event', eventDef.id)
    this.machine.triggerOverlay({ id: eventDef.id, effects: eventDef.effects })
  }

  private evaluateEvents() {
    const now = Date.now()
    const events = getConfig().events ?? []
    const activeIds = new Set(events.filter((eventDef) => eventDef.auto.enabled).map((eventDef) => eventDef.id))

    for (const id of [...this.intervalNextRunAt.keys()]) {
      if (!activeIds.has(id)) this.intervalNextRunAt.delete(id)
    }
    for (const id of [...this.idleTriggered]) {
      if (!activeIds.has(id)) this.idleTriggered.delete(id)
    }

    if (this.machine.currentState === STATE.TRANSITIONING) return

    events.forEach((eventDef) => {
      if (!eventDef.auto.enabled || eventDef.effects.length === 0) return

      if (eventDef.auto.mode === 'interval') {
        const nextRun = this.intervalNextRunAt.get(eventDef.id) ?? (now + jitterMs(eventDef.auto.intervalMin))
        if (!this.intervalNextRunAt.has(eventDef.id)) {
          this.intervalNextRunAt.set(eventDef.id, nextRun)
          return
        }
        if (now < nextRun) return
        this.fireEvent(eventDef)
        this.intervalNextRunAt.set(eventDef.id, now + jitterMs(eventDef.auto.intervalMin))
        return
      }

      const idleThresholdMs = Math.max(1, eventDef.auto.idleMin) * 60_000
      if (this.idleTriggered.has(eventDef.id)) return
      if (now - this.lastActivityAt < idleThresholdMs) return
      this.fireEvent(eventDef)
      this.idleTriggered.add(eventDef.id)
    })
  }
}
