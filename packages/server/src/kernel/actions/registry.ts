/** Action dispatch registry — the extensible counterpart to scene.ts's eight
 *  hardcoded EventAction kinds (desktop-config, widget-themes, ...).
 *
 *  Catalog action handlers (see builtinActions.ts) register themselves here
 *  by kind; executeConfiguredEvent() (scene.ts) falls back to this registry
 *  for any action kind it doesn't handle directly. Mirrors the overlay's
 *  effects dispatch registry (packages/overlay/src/effects/registry.ts).
 *
 *  Adding a new catalog action = one ACTION_CATALOG entry in
 *  @ieomlabs/shared (config schema + defaults) + one registerAction() call
 *  here (what actually happens). No scene.ts changes, no admin code.
 */
import logger from '../../lib/logger.js'
import type { HandlerContext } from '../../transport/socket/handlers/types.js'

export type ActionHandler = (ctx: HandlerContext, cfg: unknown) => void | Promise<void>

const handlers = new Map<string, ActionHandler>()

export function registerAction(kind: string, handler: ActionHandler): void {
  handlers.set(kind, handler)
}

/** Dispatches a catalog action by kind. Silently no-ops (with a warning) for
 *  an unregistered kind — including the empty string, which is what a
 *  still-blank (not-yet-typed) action draft persists as. */
export function dispatchCatalogAction(kind: string, ctx: HandlerContext, cfg: unknown): void {
  const handler = handlers.get(kind)
  if (!handler) {
    if (kind) logger.warn(`[actions] no handler registered for action kind: "${kind}"`)
    return
  }
  void handler(ctx, cfg)
}
