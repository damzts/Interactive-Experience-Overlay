import type { SceneMachine } from '../state/machine.js'
import { STATE } from '@ieom/shared'
import type { EventConfig, SchedulerDiagnosticsPayload } from '@ieom/shared'
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
  private lastTriggeredByEvent = new Map<string, number>()
  private idleTriggered = new Set<string>()
  private lastEvaluatedAt: number | null = null
  private lastTriggeredAt: number | null = null
  private lastTriggeredEventId: string | null = null
  private diagnosticsListener?: (payload: SchedulerDiagnosticsPayload) => void

  constructor(private machine: SceneMachine) {}

  setDiagnosticsListener(listener?: (payload: SchedulerDiagnosticsPayload) => void) {
    this.diagnosticsListener = listener
    this.emitDiagnostics()
  }

  noteActivity() {
    this.lastActivityAt = Date.now()
    this.idleTriggered.clear()
    this.emitDiagnostics()
  }

  /** Call this when the server is ready to start scheduling. */
  start() {
    this.stop()
    this.lastActivityAt = Date.now()
    this.lastEvaluatedAt = null
    this.lastTriggeredAt = null
    this.lastTriggeredEventId = null
    this.intervalNextRunAt.clear()
    this.lastTriggeredByEvent.clear()
    this.idleTriggered.clear()
    this.tickTimer = setInterval(() => this.evaluateEvents(), TICK_MS)
    this.evaluateEvents()
    console.log('[scheduler] auto-event scheduler started')
  }

  stop() {
    if (this.tickTimer) clearInterval(this.tickTimer)
    this.tickTimer = null
    this.emitDiagnostics()
  }

  private fireEvent(eventDef: EventConfig) {
    appendLog('auto-event', eventDef.id)
    const triggeredAt = Date.now()
    this.lastTriggeredEventId = eventDef.id
    this.lastTriggeredAt = triggeredAt
    this.lastTriggeredByEvent.set(eventDef.id, triggeredAt)
    this.machine.emit('event:trigger', eventDef, 'scheduler')
    this.emitDiagnostics()
  }

  private eventHasWork(eventDef: EventConfig) {
    return eventDef.effects.length > 0 || (eventDef.actions?.length ?? 0) > 0
  }

  private isInCooldown(eventDef: EventConfig, now: number) {
    const cooldownMs = Math.max(0, eventDef.auto.cooldownMin) * 60_000
    if (!cooldownMs) return false
    const lastTriggeredAt = this.lastTriggeredByEvent.get(eventDef.id)
    return lastTriggeredAt !== undefined && now - lastTriggeredAt < cooldownMs
  }

  private allowsCurrentState(eventDef: EventConfig) {
    const allowedStates = eventDef.auto.allowedStates
    if (!allowedStates?.length) return true
    return allowedStates.includes(this.machine.currentState)
  }

  getDiagnostics(): SchedulerDiagnosticsPayload {
    const now = Date.now()
    const events = (getConfig().events ?? []).map((eventDef) => {
      const nextRunAt = eventDef.auto.enabled && eventDef.auto.mode === 'interval'
        ? (this.intervalNextRunAt.get(eventDef.id) ?? null)
        : null
      const idleThresholdMs = Math.max(1, eventDef.auto.idleMin) * 60_000
      const due = eventDef.auto.enabled && this.eventHasWork(eventDef) && !this.isInCooldown(eventDef, now) && this.allowsCurrentState(eventDef) && (
        eventDef.auto.mode === 'interval'
          ? nextRunAt !== null && now >= nextRunAt
          : !this.idleTriggered.has(eventDef.id) && now - this.lastActivityAt >= idleThresholdMs
      )

      return {
        id: eventDef.id,
        label: eventDef.label,
        enabled: eventDef.auto.enabled,
        mode: eventDef.auto.mode,
        effectsCount: eventDef.effects.length,
        actionsCount: eventDef.actions?.length ?? 0,
        intervalMin: eventDef.auto.intervalMin,
        idleMin: eventDef.auto.idleMin,
        chance: eventDef.auto.chance,
        cooldownMin: eventDef.auto.cooldownMin,
        allowedStates: eventDef.auto.allowedStates,
        nextRunAt,
        idleTriggered: this.idleTriggered.has(eventDef.id),
        due,
      }
    })

    return {
      tickMs: TICK_MS,
      currentState: this.machine.currentState,
      lastEvaluatedAt: this.lastEvaluatedAt,
      lastActivityAt: this.lastActivityAt,
      lastTriggeredEventId: this.lastTriggeredEventId,
      lastTriggeredAt: this.lastTriggeredAt,
      activeEventCount: events.filter((eventDef) => eventDef.enabled).length,
      events,
    }
  }

  private emitDiagnostics() {
    this.diagnosticsListener?.(this.getDiagnostics())
  }

  private evaluateEvents() {
    const now = Date.now()
    this.lastEvaluatedAt = now
    const events = getConfig().events ?? []
    const activeIds = new Set(events.filter((eventDef) => eventDef.auto.enabled).map((eventDef) => eventDef.id))

    for (const id of [...this.intervalNextRunAt.keys()]) {
      if (!activeIds.has(id)) this.intervalNextRunAt.delete(id)
    }
    for (const id of [...this.idleTriggered]) {
      if (!activeIds.has(id)) this.idleTriggered.delete(id)
    }

    if (this.machine.currentState === STATE.TRANSITIONING) {
      this.emitDiagnostics()
      return
    }

    events.forEach((eventDef) => {
      if (!eventDef.auto.enabled || !this.eventHasWork(eventDef)) return
      if (!this.allowsCurrentState(eventDef)) return
      if (this.isInCooldown(eventDef, now)) return

      if (eventDef.auto.mode === 'interval') {
        const nextRun = this.intervalNextRunAt.get(eventDef.id) ?? (now + jitterMs(eventDef.auto.intervalMin))
        if (!this.intervalNextRunAt.has(eventDef.id)) {
          this.intervalNextRunAt.set(eventDef.id, nextRun)
          return
        }
        if (now < nextRun) return
        const passedChance = Math.random() <= eventDef.auto.chance
        this.intervalNextRunAt.set(eventDef.id, now + jitterMs(eventDef.auto.intervalMin))
        if (!passedChance) return
        this.fireEvent(eventDef)
        return
      }

      const idleThresholdMs = Math.max(1, eventDef.auto.idleMin) * 60_000
      if (this.idleTriggered.has(eventDef.id)) return
      if (now - this.lastActivityAt < idleThresholdMs) return
      this.idleTriggered.add(eventDef.id)
      if (Math.random() > eventDef.auto.chance) return
      this.fireEvent(eventDef)
    })

    this.emitDiagnostics()
  }
}
