import type { EffectConfig } from '../contracts/effects.js'

/** One step in a Sequence's pipeline: an effect, or an ephemeral renderer
 *  mount. Executed by the overlay's 'sequence' effect handler
 *  (packages/overlay/src/effects/runSequence.ts) in order, exclusively. */
export interface SequenceStep {
  /** The effect to fire — same EffectConfig shape used everywhere else
   *  (EventForm's effect stack, overlay:show payloads). */
  effect?: EffectConfig
  /** Ephemeral renderer mount instead of an effect (auto-unmounts after
   *  waitMs). Rare — most steps use `effect`. */
  renderer?: string
  rendererConfig?: Record<string, unknown>
  /** ms to wait before advancing to the next step. Defaults to the
   *  effect's own duration/durationMs field if present, else 4000ms. */
  waitMs?: number
}

/** A named, ordered pipeline of steps — authored in the admin Sequences
 *  tab, persisted in the `sequences` table, and referenced by id from a
 *  Scene's introSequenceId/exitSequenceId or an EventTransitionAction. */
export interface Sequence {
  id: string
  label: string
  steps: SequenceStep[]
}
