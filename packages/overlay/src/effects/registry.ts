/** Effect dispatch registry.
 *
 * Effect handler functions register themselves here by type name.
 * The dispatch function looks up the handler and calls it.
 * Adding a new effect type requires only: register it in effects/index.ts.
 * No switch statement, no shared-type changes, no TransitionLayer scaffold required.
 *
 * `replaceEffect` hot-swaps a handler at runtime without a page reload —
 * useful for tweaking a running stream in development.
 *
 * Concurrency budget: handlers are fire-and-forget, so the registry can't
 * observe completion directly. Instead each dispatch is counted as "active"
 * for the effect's cfg.duration (or a default estimate). Dispatches beyond
 * the per-type cap or the global budget are dropped — on a live overlay a
 * late effect is worse than a skipped one, and uncapped stacking of
 * canvas+rAF loops is what causes frame drops under load.
 *
 * Exclusive types: registerEffect(type, handler, { exclusive: true }) opts a
 * type out of the budget entirely — it is never dropped. At most one run of
 * that type is live: a new dispatch cancels the previous run first, via a
 * canceller the handler may return. Used by the 'sequence' effect (scene
 * transitions and any other ordered, must-play pipeline).
 */

export type EffectHandler = (cfg: unknown) => void

/** Exclusive handlers may return a canceller for the run they just started —
 *  called before the next dispatch of the same type is invoked. Ordinary
 *  (budgeted) handlers stay `void`-returning; the extra return is opt-in. */
export type ExclusiveEffectHandler = (cfg: unknown) => (() => void) | void

const handlers = new Map<string, EffectHandler>()
const exclusiveTypes = new Set<string>()
const activeCancellers = new Map<string, () => void>()

// ── Concurrency budget ────────────────────────────────────────────

/** Max simultaneously-active instances of one effect type. */
const MAX_CONCURRENT_PER_TYPE = 3
/** Max simultaneously-active instances across all effect types. */
const MAX_CONCURRENT_TOTAL = 12
/** Assumed lifetime when cfg carries no numeric duration (seconds). */
const DEFAULT_DURATION_S = 4
/** Ceiling so a bad config value can't pin the budget forever (seconds). */
const MAX_TRACKED_DURATION_S = 30

/** Per-type list of expiry timestamps (ms epoch) for presumed-active instances. */
const activeInstances = new Map<string, number[]>()

/** Estimate an effect's on-screen lifetime from its cfg (checks `duration`
 *  in seconds, then `durationMs`), falling back to a default. Used both for
 *  concurrency-budget bookkeeping here and by runSequence.ts to size the
 *  wait before advancing to a sequence's next step. */
export function estimateDurationMs(cfg: unknown): number {
  const c = cfg as { duration?: unknown; durationMs?: unknown } | null | undefined
  if (typeof c?.duration === 'number' && Number.isFinite(c.duration) && c.duration > 0) {
    return Math.min(c.duration, MAX_TRACKED_DURATION_S) * 1000
  }
  if (typeof c?.durationMs === 'number' && Number.isFinite(c.durationMs) && c.durationMs > 0) {
    return Math.min(c.durationMs, MAX_TRACKED_DURATION_S * 1000)
  }
  return DEFAULT_DURATION_S * 1000
}

/** Drop expired instances for one type; returns the still-active expiries. */
function pruneActive(type: string, now: number): number[] {
  const expiries = activeInstances.get(type)
  if (!expiries) return []
  const live = expiries.filter((t) => t > now)
  if (live.length) activeInstances.set(type, live)
  else activeInstances.delete(type)
  return live
}

function totalActive(now: number): number {
  let total = 0
  for (const type of [...activeInstances.keys()]) {
    total += pruneActive(type, now).length
  }
  return total
}

// ── Registry API ──────────────────────────────────────────────────

export function registerEffect(
  type: string,
  handler: EffectHandler | ExclusiveEffectHandler,
  opts?: { exclusive?: boolean },
): void {
  handlers.set(type, handler as EffectHandler)
  if (opts?.exclusive) exclusiveTypes.add(type)
  else exclusiveTypes.delete(type)
}

/** Look up a registered handler without dispatching it — bypasses the
 *  concurrency budget entirely. Used by runSequence.ts to invoke a
 *  sequence step's effect directly (a step must always fire). */
export function getEffectHandler(type: string): EffectHandler | undefined {
  return handlers.get(type)
}

export function replaceEffect(type: string, handler: EffectHandler | ExclusiveEffectHandler): void {
  if (!handlers.has(type)) {
    console.warn(`[effects] replaceEffect: no existing handler for "${type}", registering anyway`)
  }
  handlers.set(type, handler as EffectHandler)
}

export function dispatchEffect(type: string, cfg: unknown): void {
  const handler = handlers.get(type)
  if (!handler) {
    console.warn(`[effects] no handler registered for effect type: "${type}"`)
    return
  }

  // Exclusive types (e.g. 'sequence') never compete for the concurrency
  // budget and are never dropped — a scene transition or other exclusive
  // effect must always play. Instead, at most one run of a given exclusive
  // type is live at a time: dispatching cancels the previous run.
  if (exclusiveTypes.has(type)) {
    activeCancellers.get(type)?.()
    const cancel = (handler as ExclusiveEffectHandler)(cfg)
    if (cancel) activeCancellers.set(type, cancel)
    else activeCancellers.delete(type)
    return
  }

  const now = Date.now()
  const liveForType = pruneActive(type, now)
  if (liveForType.length >= MAX_CONCURRENT_PER_TYPE) {
    console.warn(`[effects] skipped "${type}": ${liveForType.length} instances already active (per-type cap ${MAX_CONCURRENT_PER_TYPE})`)
    return
  }
  if (totalActive(now) >= MAX_CONCURRENT_TOTAL) {
    console.warn(`[effects] skipped "${type}": global effect budget reached (${MAX_CONCURRENT_TOTAL})`)
    return
  }

  activeInstances.set(type, [...liveForType, now + estimateDurationMs(cfg)])
  handler(cfg)
}
