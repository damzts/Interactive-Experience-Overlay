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
 */

export type EffectHandler = (cfg: unknown) => void

const handlers = new Map<string, EffectHandler>()

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

function estimateDurationMs(cfg: unknown): number {
  const duration = (cfg as { duration?: unknown } | null | undefined)?.duration
  const seconds = typeof duration === 'number' && Number.isFinite(duration) && duration > 0
    ? Math.min(duration, MAX_TRACKED_DURATION_S)
    : DEFAULT_DURATION_S
  return seconds * 1000
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

export function registerEffect(type: string, handler: EffectHandler): void {
  handlers.set(type, handler)
}

export function replaceEffect(type: string, handler: EffectHandler): void {
  if (!handlers.has(type)) {
    console.warn(`[effects] replaceEffect: no existing handler for "${type}", registering anyway`)
  }
  handlers.set(type, handler)
}

export function dispatchEffect(type: string, cfg: unknown): void {
  const handler = handlers.get(type)
  if (!handler) {
    console.warn(`[effects] no handler registered for effect type: "${type}"`)
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
