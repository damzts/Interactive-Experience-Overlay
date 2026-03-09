/**
 * scheduler.ts — Auto-event scheduler.
 *
 * Manages two independent timers:
 * 1. IdleToTV    — fires when LOBBY is idle for N minutes, switches to TV
 * 2. NetworkGlitch — fires at a random interval, emits the glitch overlay event
 *
 * Both timers are reset when the streamer manually changes scenes.
 */
import type { Server } from 'socket.io'
import type { SceneMachine } from '../state/machine.js'
import { STATE, OVERLAY_EVENT } from '@ieom/shared'
import { appendLog } from '../db/db.js'

// ── Config (values in seconds, can be read from AppConfig later) ──
const IDLE_TO_TV_SECONDS   = 5 * 60   // 5 minutes idle in LOBBY → auto-switch TV
const GLITCH_MIN_SECONDS   = 8 * 60   // min 8 min between random glitches
const GLITCH_MAX_SECONDS   = 20 * 60  // max 20 min between random glitches

function randBetween(minMs: number, maxMs: number) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

export class EventScheduler {
  private idleTimer:   ReturnType<typeof setTimeout> | null = null
  private glitchTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private io:      Server,
    private machine: SceneMachine,
  ) {}

  /** Call this when the server is ready to start scheduling. */
  start() {
    // Listen for state changes to reset/start idle timer
    this.machine.on('state:change', ({ state }: { state: STATE }) => {
      if (state === STATE.LOBBY) {
        this.startIdleTimer()
      } else {
        this.clearIdleTimer()
      }
    })

    // Start glitch scheduler unconditionally
    this.scheduleNextGlitch()

    // If server starts while already in LOBBY (initial state), start timer
    if (this.machine.currentState === STATE.LOBBY) {
      this.startIdleTimer()
    }

    console.log('[scheduler] auto-event scheduler started')
  }

  /** Reset idle timer — call this on any streamer input (OBS hotkey, admin click) */
  resetIdleTimer() {
    if (this.machine.currentState === STATE.LOBBY) {
      this.startIdleTimer()
    }
  }

  stop() {
    this.clearIdleTimer()
    if (this.glitchTimer) clearTimeout(this.glitchTimer)
    this.glitchTimer = null
  }

  private startIdleTimer() {
    this.clearIdleTimer()
    this.idleTimer = setTimeout(() => {
      if (this.machine.currentState === STATE.LOBBY) {
        console.log('[scheduler] idle timeout — switching to TV')
        appendLog('auto-event', 'idle → TV')
        this.machine.transition(STATE.TV)
      }
    }, IDLE_TO_TV_SECONDS * 1000)
  }

  private clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  private scheduleNextGlitch() {
    const delayMs = randBetween(GLITCH_MIN_SECONDS * 1000, GLITCH_MAX_SECONDS * 1000)
    this.glitchTimer = setTimeout(() => {
      // Only fire if not in the middle of a transition
      if (!this.machine.isTransitioning) {
        console.log('[scheduler] auto network glitch')
        appendLog('auto-event', 'network_glitch')
        this.machine.triggerOverlay({ id: OVERLAY_EVENT.NETWORK_GLITCH, effects: [{ type: 'network-glitch', cfg: { message: '[ NETWORK INTERRUPTION ]', duration: 2 } }] })
      }
      this.scheduleNextGlitch()
    }, delayMs)
  }
}
