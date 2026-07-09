import type { EffectConfig } from '../contracts/effects.js'

/** One step in a Sequence's pipeline: an effect, an ephemeral renderer
 *  mount, a signal wait/emit, or a parallel group. Executed by the
 *  overlay's 'sequence' effect handler
 *  (packages/overlay/src/effects/runSequence.ts) in order, exclusively.
 *  Exactly one of effect / renderer / waitForSignal / emitSignal /
 *  parallel should be set per step. */
export interface SequenceStep {
  /** The effect to fire — same EffectConfig shape used everywhere else
   *  (EventForm's effect stack, overlay:show payloads). */
  effect?: EffectConfig
  /** Ephemeral renderer mount instead of an effect (auto-unmounts after
   *  waitMs). Rare — most steps use `effect`. */
  renderer?: string
  rendererConfig?: Record<string, unknown>
  /** Pause the sequence until this signal arrives — a public kernel
   *  signal (e.g. 'twitch:follow', 'audio:beat') or a widget DOM-bus
   *  signal (e.g. 'quest:complete') — then advance. Advances anyway
   *  after timeoutMs (default 30000). */
  waitForSignal?: { event: string; timeoutMs?: number }
  /** Emit a widget-style signal (source 'sequence') into the DOM bus —
   *  widgets, renderers, and automation rules react; the overlay
   *  forwards it to the kernel like any widget signal. */
  emitSignal?: { event: string; payload?: Record<string, unknown> }
  /** Run these sub-steps concurrently; the group advances when every
   *  sub-step has finished (waitMs on the group overrides with a fixed
   *  duration and cancels stragglers). */
  parallel?: SequenceStep[]
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
