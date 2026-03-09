import { EventEmitter } from 'events'
import {
  STATE,
  OVERLAY_EVENT,
  NAVIGABLE_STATES,
  TRANSITION_TYPE,
  type OverlayTriggerPayload,
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
    current: STATE.DESKTOP,
    previous: STATE.DESKTOP,
    pendingTarget: null,
    isTransitioning: false,
    activeOverlays: [],
  }
  private safetyTimer: ReturnType<typeof setTimeout> | null = null

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
  transition(target: STATE, options?: { transitionType?: string; exitTransition?: string; introTransition?: string }): { ok: boolean; error?: string; transitionType?: string } {
    if (this.snap.isTransitioning) {
      return { ok: false, error: 'Already transitioning' }
    }

    if (target === STATE.TRANSITIONING) {
      return { ok: false, error: 'Cannot navigate to TRANSITIONING state' }
    }
    if (this.snap.current === target) {
      return { ok: false, error: `Already in ${target}` }
    }

    const transitionType =
      options?.transitionType ??
      TRANSITION_TYPE[`${this.snap.current}->${target}`] ??
      'default'

    this.snap.isTransitioning = true
    this.snap.previous = this.snap.current
    this.snap.pendingTarget = target
    this.snap.current = STATE.TRANSITIONING

    this.emit('transition:start', {
      from: this.snap.previous,
      to: target,
      transitionType,
      exitTransition: options?.exitTransition,
      introTransition: options?.introTransition,
    })

    // Safety net: auto-complete if transition:complete never arrives within 10s
    if (this.safetyTimer) clearTimeout(this.safetyTimer)
    this.safetyTimer = setTimeout(() => {
      if (this.snap.isTransitioning) {
        console.warn('[machine] transition timed out — auto-completing to', target)
        this.completeTransition()
      }
    }, 10_000)

    return { ok: true, transitionType }
  }

  /** Called when the overlay's GSAP animation finishes */
  completeTransition() {
    const target = this.snap.pendingTarget
    if (!target) return

    if (this.safetyTimer) { clearTimeout(this.safetyTimer); this.safetyTimer = null }

    this.snap.current = target
    this.snap.pendingTarget = null
    this.snap.isTransitioning = false

    this.emit('state:change', {
      state: target,
      previousState: this.snap.previous,
    })
  }

  /** Force a state immediately, bypassing all transition locks. PANIC → STATE.DESKTOP. */
  forceState(target: STATE) {
    const previous = this.snap.current
    this.snap.current = target
    this.snap.previous = previous
    this.snap.pendingTarget = null
    this.snap.isTransitioning = false
    this.snap.activeOverlays = []

    this.emit('state:change', { state: target, previousState: previous })
  }

  triggerOverlay(payload: OverlayTriggerPayload) {
    this.emit('overlay:trigger', payload)
  }

  clearOverlay(id: string) {
    this.snap.activeOverlays = this.snap.activeOverlays.filter((e) => e !== id as unknown as OVERLAY_EVENT)
  }
}
