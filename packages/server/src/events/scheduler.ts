import type { SceneMachine } from '../state/machine.js'
import { STATE } from '@ieom/shared'
import type { EventConfig } from '@ieom/shared'
import { appendLog } from '../db/db.js'
import { getConfig } from '../routes/config.js'
import { Server } from 'socket.io'

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
  private desktopAutomationTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private machine: SceneMachine, private io: Server) {}

  /** Call this when the server is ready to start scheduling. */
  start() {
    this.stop()
    this.lastActivityAt = Date.now()
    this.intervalNextRunAt.clear()
    this.idleTriggered.clear()
    this.tickTimer = setInterval(() => this.evaluateEvents(), TICK_MS)
    this.startDesktopAutomation()
    this.evaluateEvents()
    console.log('[scheduler] auto-event scheduler started')
  }

  stop() {
    if (this.tickTimer) clearInterval(this.tickTimer)
    this.tickTimer = null
    this.stopDesktopAutomation()
  }

  noteActivity() {
    this.lastActivityAt = Date.now()
    this.idleTriggered.clear()
  }

  restartDesktopAutomation() {
    this.stopDesktopAutomation()
    this.startDesktopAutomation()
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

  private startDesktopAutomation() {
    this.stopDesktopAutomation()
    const config = getConfig()
    if (!config.desktopConfig?.desktopAutomation?.enabled) return

    const scheduleNext = () => {
      const delay = Math.random() * (config.desktopConfig!.desktopAutomation!.intervalMax - config.desktopConfig!.desktopAutomation!.intervalMin) + config.desktopConfig!.desktopAutomation!.intervalMin
      this.desktopAutomationTimer = setTimeout(() => {
        this.performDesktopAutomation()
        scheduleNext()
      }, delay * 1000)
    }
    scheduleNext()
    console.log('[scheduler] desktop automation started')
  }

  private stopDesktopAutomation() {
    if (this.desktopAutomationTimer) {
      clearTimeout(this.desktopAutomationTimer)
      this.desktopAutomationTimer = null
    }
  }

  private performDesktopAutomation() {
    const config = getConfig()
    if (!config.desktopConfig?.desktopAutomation?.enabled || config.desktopConfig.desktopAutomation.eligibleWidgets.length === 0) return

    const widgetId = config.desktopConfig.desktopAutomation.eligibleWidgets[Math.floor(Math.random() * config.desktopConfig.desktopAutomation.eligibleWidgets.length)]
    // Emit toggle to simulate user interaction
    this.io.emit('widget:toggle', widgetId)
    console.log(`[scheduler] auto-toggled widget: ${widgetId}`)
  }
}
