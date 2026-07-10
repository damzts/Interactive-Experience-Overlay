import {
  STATE,
  DEFAULT_WIDGET_THEME_PRESETS,
  DESKTOP_THEME_IDS,
  withDesktopConfigDefaults,
  withEventConfigDefaults,
  mergeAppConfig,
  type AppConfig,
  type EventConfig,
  type OverlayTriggerPayload,
  type SequenceStep,
  type TransitionPlayPayload,
  type DesktopTheme,
  type EventWidgetThemePatch,
  type WidgetSkinTheme,
  type WidgetThemeConfig,
  type DesktopConfig,
} from '@ieomlabs/shared'
import type { TransitionStartPayload } from '../../../kernel/managers/scene.js'
import type { HandlerContext, AppSocket } from './types.js'
import {
  applyRuntimeConfig,
  scheduleRuntimeConfigReset,
  type RuntimeConfigResetScope,
} from './runtimeConfig.js'
import { toggleWidgetRuntime } from './widget.js'
import { dispatchCatalogAction } from '../../../kernel/actions/registry.js'

const RANDOMIZABLE_WIDGET_SKINS = Object.keys(DEFAULT_WIDGET_THEME_PRESETS) as WidgetSkinTheme[]

function pickRandomEntry<T>(entries: T[]): T | null {
  if (!entries.length) return null
  return entries[Math.floor(Math.random() * entries.length)] ?? entries[0] ?? null
}

export function resolveRuntimeDesktopTheme(theme?: DesktopTheme | 'random', currentTheme?: DesktopTheme): DesktopTheme | undefined {
  if (theme === undefined) return undefined
  if (theme !== 'random') return theme
  const pool = currentTheme ? DESKTOP_THEME_IDS.filter((e) => e !== currentTheme) : DESKTOP_THEME_IDS
  return pickRandomEntry(pool) ?? currentTheme ?? 'win98'
}

export function resolveRuntimeWidgetThemePatch(patch?: EventWidgetThemePatch): Partial<WidgetThemeConfig> | undefined {
  if (!patch) return undefined
  if (patch.skin === undefined) return Object.keys(patch).length > 0 ? (patch as Partial<WidgetThemeConfig>) : undefined
  const resolvedSkin = patch.skin === 'random' ? pickRandomEntry(RANDOMIZABLE_WIDGET_SKINS) ?? 'metalheart' : patch.skin
  return { ...structuredClone(DEFAULT_WIDGET_THEME_PRESETS[resolvedSkin]), ...patch, skin: resolvedSkin }
}

function sequenceLookup(ctx: HandlerContext): (id: string) => { steps: SequenceStep[] } | undefined {
  return (id) => ctx.configService?.getSequence(id)
}

/** Resolve a scene pair's exit/intro Sequences into their step lists.
 *  `getSequence` looks up a Sequence by id (ctx.configService.getSequence). */
export function resolvePipelines(
  cfg: AppConfig,
  getSequence: (id: string) => { steps: SequenceStep[] } | undefined,
  fromState: STATE,
  toState: STATE,
): { exit: SequenceStep[]; intro: SequenceStep[] } {
  const targetScene = cfg.scenes[toState]
  const fromScene = cfg.scenes[fromState]

  const intro = targetScene?.introSequenceId ? getSequence(targetScene.introSequenceId)?.steps : undefined
  const exit = fromScene?.exitSequenceId ? getSequence(fromScene.exitSequenceId)?.steps : undefined

  return { exit: exit ?? [], intro: intro ?? [] }
}

export function executeConfiguredEvent(ctx: HandlerContext, eventDef: EventConfig): { ok: boolean; error?: string } {
  if (eventDef.effects.length > 0) {
    ctx.machine.triggerOverlay({ id: eventDef.id, effects: eventDef.effects })
  }

  for (const action of eventDef.actions ?? []) {
    if (action.kind === 'desktop-config') {
      const currentEffective = withDesktopConfigDefaults(
        mergeAppConfig(ctx.cachedUserConfig, ctx.runtimeConfig as unknown as Partial<AppConfig>).desktopConfig,
      )
      const resolvedTheme = resolveRuntimeDesktopTheme(action.patch.theme, currentEffective.globalThemeDefault.theme)
      const resolvedWidgetPatch = resolveRuntimeWidgetThemePatch(action.patch.widgetTheme)
      const globalPatch = resolvedTheme !== undefined || resolvedWidgetPatch
        ? {
            ...(resolvedTheme !== undefined ? { theme: resolvedTheme } : {}),
            ...(resolvedWidgetPatch ? { widgetTheme: resolvedWidgetPatch } : {}),
          }
        : undefined
      const desktopPatch = {
        ...(globalPatch ? { globalThemeDefault: globalPatch } : {}),
        ...(action.patch.iconAnimation !== undefined ? { iconAnimation: action.patch.iconAnimation } : {}),
        ...(action.patch.iconMotion !== undefined ? { iconMotion: action.patch.iconMotion } : {}),
        ...(action.patch.iconArrangement !== undefined ? { iconArrangement: action.patch.iconArrangement } : {}),
        ...(action.patch.iconArrangementMotion !== undefined ? { iconArrangementMotion: action.patch.iconArrangementMotion } : {}),
      }
      applyRuntimeConfig(ctx, { desktopConfig: desktopPatch as typeof ctx.runtimeConfig['desktopConfig'] })
      if (!action.persistent) {
        const resetScopes: RuntimeConfigResetScope[] = []
        if (globalPatch) resetScopes.push('desktop.globalThemeDefault')
        if (desktopPatch.iconAnimation !== undefined) resetScopes.push('desktop.iconAnimation')
        if (desktopPatch.iconMotion !== undefined) resetScopes.push('desktop.iconMotion')
        if (desktopPatch.iconArrangement !== undefined) resetScopes.push('desktop.iconArrangement')
        if (desktopPatch.iconArrangementMotion !== undefined) resetScopes.push('desktop.iconArrangementMotion')
        if (resetScopes.length) scheduleRuntimeConfigReset(ctx, resetScopes, action.timeoutSeconds ?? 30)
      }
      // persistent actions (e.g. ThemeDriftManager) skip reset scheduling —
      // the patch sticks as the new baseline until the next drift or an
      // explicit runtime:config:reset.
      continue
    }

    if (action.kind === 'widget-themes') {
      const currentDesktop = withDesktopConfigDefaults(ctx.cachedUserConfig.desktopConfig)
      const resolvedPatch = resolveRuntimeWidgetThemePatch(action.theme)
      const nextThemes: NonNullable<DesktopConfig['widgetThemes']> = {}
      for (const widgetId of action.widgetIds) {
        const globalTheme = currentDesktop.globalThemeDefault.widgetTheme
        const persistedTheme = ctx.cachedUserConfig.applications.find((a) => a.id === widgetId)?.theme
        const base = action.clearExisting
          ? globalTheme
          : currentDesktop.widgetThemes?.[widgetId] ?? persistedTheme ?? globalTheme
        nextThemes[widgetId] = { ...base, ...(resolvedPatch ?? {}) }
      }
      applyRuntimeConfig(ctx, { desktopConfig: { widgetThemes: nextThemes } })
      scheduleRuntimeConfigReset(ctx, ['desktop.widgetThemes'], action.timeoutSeconds ?? 30)
      continue
    }

    // Catalog-driven actions (see @ieomlabs/shared's ACTION_CATALOG and
    // kernel/actions/registry.ts) — anything not one of the hardcoded kinds
    // above is dispatched through the action registry. A blank (not-yet-typed
    // draft) or otherwise unrecognized kind is a no-op there, same as an
    // unknown effect type in the overlay's dispatchEffect.
    //
    // Pre-catalog persisted rows (events saved before widget-layout /
    // widget-command / ambiance-patch joined ACTION_CATALOG, and automation
    // rules migrated from the old {kind, params} shape) store their config
    // flat on the action — ambiance-patch nesting it under `patch` — so lift
    // those onto cfg here before dispatch.
    let cfg: unknown
    if ('cfg' in action) {
      cfg = (action as { cfg?: unknown }).cfg
    } else {
      const { kind: _kind, patch, ...flat } = action as unknown as Record<string, unknown> & { patch?: Record<string, unknown> }
      cfg = { ...(patch ?? {}), ...flat }
    }
    dispatchCatalogAction(action.kind, ctx, cfg)
  }

  return { ok: true }
}

function triggerConfiguredEvent(ctx: HandlerContext, eventId: string): { ok: boolean; error?: string } {
  const normalized = eventId.toLowerCase().replace(/[_\s]+/g, '-')
  const eventDef = (ctx.cachedUserConfig.sourceEvents ?? []).find((e) => e.id.toLowerCase().replace(/[_\s]+/g, '-') === normalized)
  if (!eventDef) return { ok: false, error: `Unknown event: ${eventId}` }
  return executeConfiguredEvent(ctx, eventDef)
}

export function runConfiguredAction(ctx: HandlerContext, action: string): { ok: boolean; error?: string } {
  if (!action) return { ok: false, error: 'No action provided' }

  if (action.startsWith('scene:')) {
    const target = action.slice(6).trim()
    if (!(ctx.cachedUserConfig.scenes ?? {})[target]) return { ok: false, error: `Unknown scene target: ${target}` }
    const { exit, intro } = resolvePipelines(ctx.cachedUserConfig, sequenceLookup(ctx), ctx.machine.currentState, target)
    return ctx.machine.transition(target, { exit, intro })
  }

  if (action.startsWith('widget:')) {
    const widgetId = action.slice(7).trim()
    if (!widgetId) return { ok: false, error: 'Missing widget id' }
    toggleWidgetRuntime(ctx, widgetId)
    return { ok: true }
  }

  if (action.startsWith('event:')) return triggerConfiguredEvent(ctx, action.slice(6))
  if (action.startsWith('overlay:')) return triggerConfiguredEvent(ctx, action.slice(8))

  return { ok: false, error: `Unsupported action: ${action}` }
}

/** Register machine event listeners and scene/event socket handlers on a socket. */
export function registerSceneHandlers(ctx: HandlerContext, socket: AppSocket): void {
  socket.on('state:request', (callback) => {
    callback(ctx.machine.currentState)
  })

  socket.on('scene:change', (target, callback) => {
    ctx.scheduler?.noteActivity()
    const { exit, intro } = resolvePipelines(ctx.cachedUserConfig, sequenceLookup(ctx), ctx.machine.currentState, target)
    const result = ctx.machine.transition(target, { exit, intro })
    if (callback) callback(result.ok ? null : result.error ?? 'Unknown error')
  })

  socket.on('overlay:trigger', (payload: OverlayTriggerPayload) => {
    ctx.scheduler?.noteActivity()
    ctx.machine.triggerOverlay(payload)
  })

  socket.on('event:preview', (eventDef: EventConfig, callback) => {
    ctx.scheduler?.noteActivity()
    const result = executeConfiguredEvent(ctx, withEventConfigDefaults(eventDef))
    if (callback) callback(result.ok ? null : result.error ?? 'Unknown error')
  })

  socket.on('transition:preview', (steps: SequenceStep[]) => {
    ctx.scheduler?.noteActivity()
    const payload: TransitionPlayPayload = {
      from: ctx.machine.currentState,
      to: ctx.machine.currentState,
      exit: steps,
      intro: [],
    }
    ctx.io.emit('transition:play', payload)
  })

}

/** Wire machine → socket.io broadcast listeners. Call once at startup. */
export function registerMachineListeners(ctx: HandlerContext): void {
  ctx.machine.on('state:change', (payload: { state: STATE; previousState: STATE }) => {
    ctx.io.emit('state:update', payload)
  })

  ctx.machine.on('transition:start', (payload: TransitionStartPayload) => {
    const out: TransitionPlayPayload = { from: payload.from, to: payload.to, exit: payload.exit, intro: payload.intro }
    ctx.io.emit('transition:play', out)
  })

  ctx.machine.on('overlay:trigger', (payload: OverlayTriggerPayload) => {
    ctx.io.emit('overlay:show', payload)
  })

  ctx.bus.on('scheduler:fired', ({ event }) => {
    void executeConfiguredEvent(ctx, event)
  })
}

