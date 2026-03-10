/**
 * scheduler.ts — Auto-event scheduler.
 *
 * Manages one timer:
 * 1. NetworkGlitch — fires at a random interval, emits the glitch overlay event
 */
import type { Server } from 'socket.io'
import type { SceneMachine } from '../state/machine.js'
import { OVERLAY_EVENT } from '@ieom/shared'
import { appendLog } from '../db/db.js'

// ── Config (values in seconds, can be read from AppConfig later) ──
const GLITCH_MIN_SECONDS   = 8 * 60   // min 8 min between random glitches
const GLITCH_MAX_SECONDS   = 20 * 60  // max 20 min between random glitches

function randBetween(minMs: number, maxMs: number) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

export class EventScheduler {
  private glitchTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private io:      Server,
    private machine: SceneMachine,
  ) {}

  /** Call this when the server is ready to start scheduling. */
  start() {
    // Start glitch scheduler unconditionally
    this.scheduleNextGlitch()

    console.log('[scheduler] auto-event scheduler started')
  }

  stop() {
    if (this.glitchTimer) clearTimeout(this.glitchTimer)
    this.glitchTimer = null
  }

  private scheduleNextGlitch() {
    const delayMs = randBetween(GLITCH_MIN_SECONDS * 1000, GLITCH_MAX_SECONDS * 1000)
    this.glitchTimer = setTimeout(() => {
      // Only fire if not currently transitioning (check by comparing state)
      if (this.machine.currentState !== 'TRANSITIONING') {
        console.log('[scheduler] auto network glitch')
        appendLog('auto-event', 'network_glitch')
        this.machine.triggerOverlay({ id: OVERLAY_EVENT.NETWORK_GLITCH, effects: [{ type: 'network-glitch', cfg: { message: '[ NETWORK INTERRUPTION ]', duration: 2 } }] })
      }
      this.scheduleNextGlitch()
    }, delayMs)
  }
}
