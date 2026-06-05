import type { SceneMachine } from './scene.js'
import { STATE } from '@ieom/shared'
import type { AppConfig, EventConfig, Manager, ManagerStatus, SchedulerDiagnosticsPayload } from '@ieom/shared'
import type { KernelBus } from '../bus.js'

function randBetween(minValue: number, maxValue: number) {
  return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue
}

function jitterMs(minutes: number) {
  const base = Math.max(1, minutes) * 60_000
  return randBetween(Math.floor(base * 0.8), Math.ceil(base * 1.2))
}

interface QueueEntry { eventId: string; fireAt: number }

export class EventScheduler implements Manager {
  readonly name = 'EventScheduler'
  private _status: ManagerStatus = 'idle'

  // interval events: sorted priority queue + one timer
  private queue: QueueEntry[] = []
  private queueTimer: ReturnType<typeof setTimeout> | null = null

  // idle events: one timer per event, cancelled on activity
  private idleTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private idleTriggered = new Set<string>()

  private lastActivityAt = Date.now()
  private lastTriggeredByEvent = new Map<string, number>()
  private lastProcessedAt: number | null = null
  private lastTriggeredAt: number | null = null
  private lastTriggeredEventId: string | null = null
  private diagnosticsListener?: (payload: SchedulerDiagnosticsPayload) => void

  constructor(private machine: SceneMachine, private getConfig: () => AppConfig, private bus?: KernelBus) {}

  // ── Manager interface ────────────────────────────────────────
  init(): void { this._status = 'idle' }
  dispose(): void { this.stop(); this._status = 'stopped' }
  status(): ManagerStatus { return this._status }

  setDiagnosticsListener(listener?: (payload: SchedulerDiagnosticsPayload) => void) {
    this.diagnosticsListener = listener
    this.emitDiagnostics()
  }

  noteActivity() {
    this.lastActivityAt = Date.now()
    this.idleTriggered.clear()
    this.restartIdleTimers()
    this.emitDiagnostics()
  }

  start() {
    this.stop()
    this._status = 'running'
    this.lastActivityAt = Date.now()
    this.lastProcessedAt = null
    this.lastTriggeredAt = null
    this.lastTriggeredEventId = null
    this.lastTriggeredByEvent.clear()
    this.idleTriggered.clear()
    this.buildQueue()
    this.restartIdleTimers()
    console.log('[scheduler] event scheduler started (ISR mode)')
  }

  stop() {
    if (this.queueTimer) { clearTimeout(this.queueTimer); this.queueTimer = null }
    for (const t of this.idleTimers.values()) clearTimeout(t)
    this.idleTimers.clear()
    this.queue = []
    this._status = 'stopped'
    this.emitDiagnostics()
  }

  // ── Queue helpers ────────────────────────────────────────────────

  private buildQueue() {
    if (this.queueTimer) { clearTimeout(this.queueTimer); this.queueTimer = null }
    const now = Date.now()
    this.queue = (this.getConfig().events ?? [])
      .filter((e) => e.auto.enabled && e.auto.mode === 'interval' && this.eventHasWork(e))
      .map((e) => ({ eventId: e.id, fireAt: now + jitterMs(e.auto.intervalMin) }))
    this.queue.sort((a, b) => a.fireAt - b.fireAt)
    this.armQueueTimer()
  }

  private armQueueTimer() {
    if (this.queueTimer) { clearTimeout(this.queueTimer); this.queueTimer = null }
    if (this.queue.length === 0) return
    const delay = Math.max(0, this.queue[0].fireAt - Date.now())
    this.queueTimer = setTimeout(() => this.processQueue(), delay)
  }

  private processQueue() {
    this.queueTimer = null
    if (this.machine.currentState === STATE.TRANSITIONING) {
      this.armQueueTimer()
      return
    }
    const now = Date.now()
    this.lastProcessedAt = now
    const events = this.getConfig().events ?? []
    const eventMap = new Map(events.map((e) => [e.id, e]))

    while (this.queue.length > 0 && this.queue[0].fireAt <= now) {
      const entry = this.queue.shift()!
      const eventDef = eventMap.get(entry.eventId)
      if (!eventDef || !eventDef.auto.enabled || !this.eventHasWork(eventDef)) continue
      if (!this.allowsCurrentState(eventDef) || this.isInCooldown(eventDef, now)) {
        // reschedule without firing
        this.queue.push({ eventId: entry.eventId, fireAt: now + jitterMs(eventDef.auto.intervalMin) })
        continue
      }
      if (Math.random() <= eventDef.auto.chance) this.fireEvent(eventDef)
      this.queue.push({ eventId: entry.eventId, fireAt: now + jitterMs(eventDef.auto.intervalMin) })
    }

    this.queue.sort((a, b) => a.fireAt - b.fireAt)
    this.armQueueTimer()
    this.emitDiagnostics()
  }

  // ── Idle timers ──────────────────────────────────────────────────

  private restartIdleTimers() {
    for (const t of this.idleTimers.values()) clearTimeout(t)
    this.idleTimers.clear()
    if (this.machine.currentState === STATE.TRANSITIONING) return

    const events = this.getConfig().events ?? []
    for (const eventDef of events) {
      if (!eventDef.auto.enabled || eventDef.auto.mode !== 'idle' || !this.eventHasWork(eventDef)) continue
      if (this.idleTriggered.has(eventDef.id)) continue
      const delay = Math.max(1, eventDef.auto.idleMin) * 60_000
      const t = setTimeout(() => this.fireIdleEvent(eventDef.id), delay)
      this.idleTimers.set(eventDef.id, t)
    }
  }

  private fireIdleEvent(eventId: string) {
    this.idleTimers.delete(eventId)
    if (this.machine.currentState === STATE.TRANSITIONING) return
    const eventDef = (this.getConfig().events ?? []).find((e) => e.id === eventId)
    if (!eventDef || !eventDef.auto.enabled || !this.eventHasWork(eventDef)) return
    if (!this.allowsCurrentState(eventDef) || this.isInCooldown(eventDef, Date.now())) return
    this.idleTriggered.add(eventId)
    if (Math.random() <= eventDef.auto.chance) this.fireEvent(eventDef)
    this.emitDiagnostics()
  }

  // ── Shared helpers ───────────────────────────────────────────────

  private fireEvent(eventDef: EventConfig) {
    const triggeredAt = Date.now()
    this.lastTriggeredEventId = eventDef.id
    this.lastTriggeredAt = triggeredAt
    this.lastTriggeredByEvent.set(eventDef.id, triggeredAt)
    if (this.bus) {
      this.bus.emit('scheduler:fired', { eventId: eventDef.id, event: eventDef })
    } else {
      // fallback: emit on machine for backward compat if no bus provided
      this.machine.emit('event:trigger', eventDef, 'scheduler')
    }
    this.emitDiagnostics()
  }

  private eventHasWork(eventDef: EventConfig) {
    return eventDef.effects.length > 0 || (eventDef.actions?.length ?? 0) > 0
  }

  private isInCooldown(eventDef: EventConfig, now: number) {
    const cooldownMs = Math.max(0, eventDef.auto.cooldownMin) * 60_000
    if (!cooldownMs) return false
    const last = this.lastTriggeredByEvent.get(eventDef.id)
    return last !== undefined && now - last < cooldownMs
  }

  private allowsCurrentState(eventDef: EventConfig) {
    const allowed = eventDef.auto.allowedStates
    if (!allowed?.length) return true
    return allowed.includes(this.machine.currentState)
  }

  // ── Diagnostics ──────────────────────────────────────────────────

  getDiagnostics(): SchedulerDiagnosticsPayload {
    const now = Date.now()
    const events = (this.getConfig().events ?? []).map((eventDef) => {
      const nextRunAt = eventDef.auto.mode === 'interval'
        ? (this.queue.find((e) => e.eventId === eventDef.id)?.fireAt ?? null)
        : null
      const due = eventDef.auto.enabled && this.eventHasWork(eventDef) &&
        !this.isInCooldown(eventDef, now) && this.allowsCurrentState(eventDef) && (
          eventDef.auto.mode === 'interval'
            ? nextRunAt !== null && now >= nextRunAt
            : !this.idleTriggered.has(eventDef.id) && now - this.lastActivityAt >= Math.max(1, eventDef.auto.idleMin) * 60_000
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
      nextFireAt: this.queue[0]?.fireAt ?? null,
      currentState: this.machine.currentState,
      lastProcessedAt: this.lastProcessedAt,
      lastActivityAt: this.lastActivityAt,
      lastTriggeredEventId: this.lastTriggeredEventId,
      lastTriggeredAt: this.lastTriggeredAt,
      activeEventCount: events.filter((e) => e.enabled).length,
      events,
    }
  }

  private emitDiagnostics() {
    this.diagnosticsListener?.(this.getDiagnostics())
  }
}
