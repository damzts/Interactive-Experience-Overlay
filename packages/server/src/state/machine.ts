import { EventEmitter } from 'events'
import {
  STATE,
  type TransitionStep,
  type OverlayTriggerPayload,
} from '@ieom/shared'

interface MachineSnapshot {
  current: STATE
  previous: STATE
}

export interface TransitionStartPayload {
  from: STATE
  to: STATE
  exit: TransitionStep[]
  intro: TransitionStep[]
}

export class SceneMachine extends EventEmitter {
  private snap: MachineSnapshot = {
    current: STATE.DESKTOP,
    previous: STATE.DESKTOP,
  }

  get currentState() { return this.snap.current }
  get previousState() { return this.snap.previous }

  /** Attempt a transition. State updates immediately — overlay is eventually consistent. */
  transition(
    target: STATE,
    options?: { exit?: TransitionStep[]; intro?: TransitionStep[] },
  ): { ok: boolean; error?: string } {
    if (target === STATE.TRANSITIONING) {
      return { ok: false, error: 'Cannot navigate to TRANSITIONING state' }
    }
    if (this.snap.current === target) {
      return { ok: false, error: `Already in ${target}` }
    }

    const previous = this.snap.current
    this.snap.previous = previous
    this.snap.current = target

    // Fire transition pipeline to overlay (fire-and-forget)
    this.emit('transition:start', {
      from: previous,
      to: target,
      exit:  options?.exit  ?? [],
      intro: options?.intro ?? [],
    } satisfies TransitionStartPayload)

    // Broadcast final state immediately
    this.emit('state:change', { state: target, previousState: previous })

    return { ok: true }
  }

  /** Force a state immediately, bypassing animations. */
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

