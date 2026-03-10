/** Effect dispatch registry.
 *
 * Effect handler functions register themselves here by type name.
 * The dispatch function looks up the handler and calls it.
 * Adding a new effect type requires only: register it in effects/index.ts.
 * No switch statement, no shared-type changes, no TransitionLayer scaffold required.
 *
 * `replaceEffect` hot-swaps a handler at runtime without a page reload —
 * useful for tweaking a running stream in development.
 */

export type EffectHandler = (cfg: unknown) => void

const handlers = new Map<string, EffectHandler>()

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
  if (handler) {
    handler(cfg)
  } else {
    console.warn(`[effects] no handler registered for effect type: "${type}"`)
  }
}
