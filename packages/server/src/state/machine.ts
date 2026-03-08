import { EventEmitter } from 'events'
import {
  STATE,
  OVERLAY_EVENT,
  VALID_TRANSITIONS,
  TRANSITION_TYPE,
} from '@ieom/shared'

interface MachineSnapshot {
  current: STATE
  previous: STATE
  pendingTarget: STATE | null
  isTransitioning: boolean
  activeOverlays: OVERLAY_EVENT[]
}

export class SceneMachine extends EventEmitter {
  private snap: MachineSnapshot = {
    current: STATE.LOBBY,
    previous: STATE.LOBBY,
    pendingTarget: null,
    isTransitioning: false,
    activeOverlays: [],
  }

  get currentState() {
    return this.snap.current
  }
  get previousState() {
    return this.snap.previous
  }
  get isTransitioning() {
    return this.snap.isTransitioning
  }

  /** Attempt a transition. Returns error string on failure. */
  transition(target: STATE): { ok: boolean; error?: string; transitionType?: string } {
    if (this.snap.isTransitioning) {
      return { ok: false, error: 'Already transitioning' }
    }

    const valid = VALID_TRANSITIONS[this.snap.current]
    if (!valid?.includes(target)) {
      return {
        ok: false,
        error: `Cannot go from ${this.snap.current} to ${target}`,
      }
    }

    const transitionType =
      TRANSITION_TYPE[`${this.snap.current}->${target}`] ?? 'default'

    this.snap.isTransitioning = true
    this.snap.previous = this.snap.current
    this.snap.pendingTarget = target
    this.snap.current = STATE.TRANSITIONING

    this.emit('transition:start', {
      from: this.snap.previous,
      to: target,
      transitionType,
    })

    return { ok: true, transitionType }
  }

  /** Called when the overlay's GSAP animation finishes */
  completeTransition() {
    const target = this.snap.pendingTarget
    if (!target) return

    this.snap.current = target
    this.snap.pendingTarget = null
    this.snap.isTransitioning = false

    this.emit('state:change', {
      state: target,
      previousState: this.snap.previous,
    })
  }

  /** PANIC — force LOBBY immediately, bypass locks */
  forceState(target: STATE) {
    const previous = this.snap.current
    this.snap.current = target
    this.snap.previous = previous
    this.snap.pendingTarget = null
    this.snap.isTransitioning = false
    this.snap.activeOverlays = []

    this.emit('state:change', { state: target, previousState: previous })
  }

  triggerOverlay(event: OVERLAY_EVENT) {
    this.snap.activeOverlays.push(event)
    this.emit('overlay:trigger', { event })
  }

  clearOverlay(event: OVERLAY_EVENT) {
    this.snap.activeOverlays = this.snap.activeOverlays.filter((e) => e !== event)
  }
}
