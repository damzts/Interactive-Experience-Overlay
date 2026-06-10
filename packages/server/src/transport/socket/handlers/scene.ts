import {
  STATE,
  DEFAULT_WIDGET_THEME_PRESETS,
  withDesktopConfigDefaults,
  withEventConfigDefaults,
  mergeAppConfig,
  type AppConfig,
  type EventConfig,
  type OverlayTriggerPayload,
  type TransitionStep,
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
  applyRuntimeConfigOverride,
  scheduleRuntimeConfigOverrideReset,
  scheduleWidgetLayoutRuntimeOverrideReset,
  type RuntimeOverrideResetScope,
} from './runtimeOverride.js'
import { toggleWidgetRuntime, setWidgetRuntimeOpenState, applySavedWidgetLayout } from './widget.js'

const RANDOMIZABLE_DESKTOP_THEMES: DesktopTheme[] = [
  'win98', 'frutiger aero', 'y2k candy', 'midnight chrome',
  'sunset boulevard', 'coastal glass', 'amber terminal',
]
const RANDOMIZABLE_WIDGET_SKINS = Object.keys(DEFAULT_WIDGET_THEME_PRESETS) as WidgetSkinTheme[]

function pickRandomEntry<T>(entries: T[]): T | null {
  if (!entries.length) return null
  return entries[Math.floor(Math.random() * entries.length)] ?? entries[0] ?? null
}

export function resolveRuntimeDesktopTheme(theme?: DesktopTheme | 'random', currentTheme?: DesktopTheme): DesktopTheme | undefined {
  if (theme === undefined) return undefined
  if (theme !== 'random') return theme
  const pool = currentTheme ? RANDOMIZABLE_DESKTOP_THEMES.filter((e) => e !== currentTheme) : RANDOMIZABLE_DESKTOP_THEMES
  return pickRandomEntry(pool) ?? currentTheme ?? 'win98'
}

export function resolveRuntimeWidgetThemePatch(patch?: EventWidgetThemePatch): Partial<WidgetThemeConfig> | undefined {
  if (!patch) return undefined
  if (patch.skin === undefined) return Object.keys(patch).length > 0 ? (patch as Partial<WidgetThemeConfig>) : undefined
  const resolvedSkin = patch.skin === 'random' ? pickRandomEntry(RANDOMIZABLE_WIDGET_SKINS) ?? 'metalheart' : patch.skin
  return { ...structuredClone(DEFAULT_WIDGET_THEME_PRESETS[resolvedSkin]), ...patch, skin: resolvedSkin }
}

/** Coerce a legacy single-string transition into a one-step array. */
function stepFromString(s: string | undefined): TransitionStep[] | undefined {
  if (!s || s === 'none') return undefined
  const qi = s.indexOf('?')
  const id = qi >= 0 ? s.slice(0, qi) : s
  const dur = qi >= 0 ? new URLSearchParams(s.slice(qi + 1)).get('duration') : null
  return [{ id, ...(dur ? { duration: parseFloat(dur) } : {}) }]
}

export function isNavigableState(value: string): value is STATE {
  return value === STATE.LOBBY || value === STATE.DESKTOP
}

export function resolvePipelines(cfg: AppConfig, fromState: STATE, toState: STATE): { exit: TransitionStep[]; intro: TransitionStep[] } {
  let exit: TransitionStep[] | undefined
  let intro: TransitionStep[] | undefined

  const resolveNames = (names?: string[]): TransitionStep[] | undefined => {
    if (!names?.length) return undefined
    const steps = names.flatMap((name) => {
      const def = cfg.sourceTransitions?.find((t) => t.id === name)
      return def ? [{ id: def.id } as TransitionStep] : (stepFromString(name) ?? [])
    })
    return steps.length ? steps : undefined
  }

  if (!intro) {
    const targetScene = cfg.scenes[toState]
    intro = resolveNames(targetScene?.onEntry)
  }
  if (!exit) {
    const fromScene = cfg.scenes[fromState]
    exit = resolveNames(fromScene?.onExit)
  }

  return { exit: exit ?? [], intro: intro ?? [] }
}

export function executeConfiguredEvent(ctx: HandlerContext, eventDef: EventConfig): { ok: boolean; error?: string } {
  if (eventDef.effects.length > 0) {
    ctx.machine.triggerOverlay({ id: eventDef.id, effects: eventDef.effects })
  }

  for (const action of eventDef.actions ?? []) {
    if (action.kind === 'desktop-config') {
      const currentEffective = withDesktopConfigDefaults(
        mergeAppConfig(ctx.cachedUserConfig, ctx.runtimeConfigOverride as unknown as Partial<AppConfig>).desktopConfig,
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
        ...(action.patch.screenSaver ? { screenSaver: action.patch.screenSaver } : {}),
      }
      applyRuntimeConfigOverride(ctx, { desktopConfig: desktopPatch as typeof ctx.runtimeConfigOverride['desktopConfig'] })
      const resetScopes: RuntimeOverrideResetScope[] = []
      if (globalPatch) resetScopes.push('desktop.globalThemeDefault')
      if (desktopPatch.iconAnimation !== undefined) resetScopes.push('desktop.iconAnimation')
      if (desktopPatch.iconMotion !== undefined) resetScopes.push('desktop.iconMotion')
      if (desktopPatch.screenSaver) resetScopes.push('desktop.screenSaver')
      if (resetScopes.length) scheduleRuntimeConfigOverrideReset(ctx, resetScopes, action.timeoutSeconds ?? 30)
      continue
    }

    if (action.kind === 'widget-theme-overrides') {
      const currentDesktop = withDesktopConfigDefaults(ctx.cachedUserConfig.desktopConfig)
      const resolvedPatch = resolveRuntimeWidgetThemePatch(action.theme)
      const nextOverrides: NonNullable<DesktopConfig['widgetThemeOverrides']> = {}
      for (const widgetId of action.widgetIds) {
        const globalTheme = currentDesktop.globalThemeDefault.widgetTheme
        const persistedOverride = ctx.cachedUserConfig.applications.find((a) => a.id === widgetId)?.themeOverride
        const base = action.clearExisting
          ? globalTheme
          : currentDesktop.widgetThemeOverrides?.[widgetId] ?? persistedOverride ?? globalTheme
        nextOverrides[widgetId] = { ...base, ...(resolvedPatch ?? {}) }
      }
      applyRuntimeConfigOverride(ctx, { desktopConfig: { widgetThemeOverrides: nextOverrides } })
      scheduleRuntimeConfigOverrideReset(ctx, ['desktop.widgetThemeOverrides'], action.timeoutSeconds ?? 30)
      continue
    }

    if (action.kind === 'widget-layout') {
      const layout = (ctx.cachedUserConfig.widgetLayouts ?? []).find((e) => e.id === action.layoutId)
      const result = applySavedWidgetLayout(ctx, action.layoutId, { persist: false })
      if (!result.ok) return result
      const layoutWidgetIds = Array.from(new Set((layout?.items ?? []).map((i) => i.widgetId).filter(Boolean)))
      if (layoutWidgetIds.length) scheduleWidgetLayoutRuntimeOverrideReset(ctx, layoutWidgetIds, action.timeoutSeconds ?? 30)
      continue
    }

    if (action.kind === 'widget-command') {
      if (action.action === 'toggle') toggleWidgetRuntime(ctx, action.widgetId)
      else setWidgetRuntimeOpenState(ctx, action.widgetId, action.action === 'open')
      continue
    }

    applyRuntimeConfigOverride(ctx, {
      desktopAmbiance: { widgetSimulation: { ...action.patch } as any },
    })
    scheduleRuntimeConfigOverrideReset(ctx, ['ambiance.widgetSimulation'], action.timeoutSeconds ?? 30)
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

  if (action === 'panic') { ctx.machine.forceState(STATE.DESKTOP); return { ok: true } }

  if (action.startsWith('scene:')) {
    const target = action.slice(6).trim()
    if (!isNavigableState(target)) return { ok: false, error: `Unknown scene target: ${target}` }
    const { exit, intro } = resolvePipelines(ctx.cachedUserConfig, ctx.machine.currentState, target)
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
    const { exit, intro } = resolvePipelines(ctx.cachedUserConfig, ctx.machine.currentState, target)
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

  socket.on('transition:preview', (steps: TransitionStep[]) => {
    ctx.scheduler?.noteActivity()
    const payload: TransitionPlayPayload = {
      from: ctx.machine.currentState,
      to: ctx.machine.currentState,
      exit: steps,
      intro: [],
    }
    ctx.io.emit('transition:play', payload)
  })

  socket.on('panic', () => {
    ctx.scheduler?.noteActivity()
    ctx.machine.forceState(STATE.DESKTOP)
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

