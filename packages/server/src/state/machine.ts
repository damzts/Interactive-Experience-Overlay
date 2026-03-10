import { EventEmitter } from 'events'
import {
  STATE,
  TRANSITION_TYPE,
  type OverlayTriggerPayload,
} from '@ieom/shared'

interface MachineSnapshot {
  current: STATE
  previous: STATE
}

export class SceneMachine extends EventEmitter {
  private snap: MachineSnapshot = {
    current: STATE.DESKTOP,
    previous: STATE.DESKTOP,
  }

  get currentState() {
    return this.snap.current
  }
  get previousState() {
    return this.snap.previous
  }

  /** Attempt a transition. State updates immediately — no lock, no waiting for overlay. */
  transition(target: STATE, options?: { transitionType?: string; exitTransition?: string; introTransition?: string }): { ok: boolean; error?: string; transitionType?: string } {
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

    const previous = this.snap.current
    this.snap.previous = previous
    this.snap.current = target

    // Tell the overlay which animation to play (fire-and-forget)
    this.emit('transition:start', {
      from: previous,
      to: target,
      transitionType,
      exitTransition: options?.exitTransition,
      introTransition: options?.introTransition,
    })

    // Broadcast final state immediately — overlay is eventually consistent
    this.emit('state:change', {
      state: target,
      previousState: previous,
    })

    return { ok: true, transitionType }
  }

  /** Force a state immediately, bypassing animations. PANIC → STATE.DESKTOP. */
  forceState(target: STATE) {
    const previous = this.snap.current
    this.snap.current = target
    this.snap.previous = previous
    this.emit('state:change', { state: target, previousState: previous })
  }

  triggerOverlay(payload: OverlayTriggerPayload) {
    this.emit('overlay:trigger', payload)
  }
}

