/**
 * Runtime config override helpers — shared by config, widget, and desktop handlers.
 * All mutations go through these helpers to keep override state consistent.
 */
import type {
  RuntimeConfigOverridePayload,
  DesktopAmbianceConfig,
} from '@ieom/shared'
import type { HandlerContext } from './types.js'

// ── Scope types ──────────────────────────────────────────────────

export const RUNTIME_OVERRIDE_RESET_SCOPES = [
  'desktop.globalThemeDefault',
  'desktop.iconAnimation',
  'desktop.iconMotion',
  'desktop.screenSaver',
  'desktop.widgetThemeOverrides',
  'ambiance.widgetSimulation',
] as const

export type RuntimeOverrideResetScope = typeof RUNTIME_OVERRIDE_RESET_SCOPES[number]

// ── Timer state (module-level, lives for the lifetime of the server instance) ──

const resetTimers = Object.fromEntries(
  RUNTIME_OVERRIDE_RESET_SCOPES.map((s) => [s, null]),
) as Record<RuntimeOverrideResetScope, ReturnType<typeof setTimeout> | null>

const resetVersions = Object.fromEntries(
  RUNTIME_OVERRIDE_RESET_SCOPES.map((s) => [s, 0]),
) as Record<RuntimeOverrideResetScope, number>

const widgetLayoutResetTimers = new Map<string, ReturnType<typeof setTimeout>>()

// ── Deep merge ───────────────────────────────────────────────────

export function mergeRuntimeConfigOverride(
  base: RuntimeConfigOverridePayload,
  updates: RuntimeConfigOverridePayload,
): RuntimeConfigOverridePayload {
  return {
    desktopConfig: updates.desktopConfig
      ? {
          ...(base.desktopConfig ?? {}),
          ...updates.desktopConfig,
          globalThemeDefault: updates.desktopConfig.globalThemeDefault
            ? {
                ...(base.desktopConfig?.globalThemeDefault ?? {}),
                ...updates.desktopConfig.globalThemeDefault,
                widgetTheme: updates.desktopConfig.globalThemeDefault.widgetTheme
                  ? {
                      ...(base.desktopConfig?.globalThemeDefault?.widgetTheme ?? {}),
                      ...updates.desktopConfig.globalThemeDefault.widgetTheme,
                    }
                  : base.desktopConfig?.globalThemeDefault?.widgetTheme,
              }
            : base.desktopConfig?.globalThemeDefault,
          widgetThemeOverrides: updates.desktopConfig.widgetThemeOverrides
            ? { ...(base.desktopConfig?.widgetThemeOverrides ?? {}), ...updates.desktopConfig.widgetThemeOverrides }
            : base.desktopConfig?.widgetThemeOverrides,
          widgetPositions: updates.desktopConfig.widgetPositions
            ? { ...(base.desktopConfig?.widgetPositions ?? {}), ...updates.desktopConfig.widgetPositions }
            : base.desktopConfig?.widgetPositions,
          widgetSizes: updates.desktopConfig.widgetSizes
            ? { ...(base.desktopConfig?.widgetSizes ?? {}), ...updates.desktopConfig.widgetSizes }
            : base.desktopConfig?.widgetSizes,
          widgetZIndices: updates.desktopConfig.widgetZIndices
            ? { ...(base.desktopConfig?.widgetZIndices ?? {}), ...updates.desktopConfig.widgetZIndices }
            : base.desktopConfig?.widgetZIndices,
          screenSaver: updates.desktopConfig.screenSaver
            ? { ...(base.desktopConfig?.screenSaver ?? {}), ...updates.desktopConfig.screenSaver } as NonNullable<RuntimeConfigOverridePayload['desktopConfig']>['screenSaver']
            : base.desktopConfig?.screenSaver,
        } as RuntimeConfigOverridePayload['desktopConfig']
      : base.desktopConfig,
    desktopAmbiance: updates.desktopAmbiance
      ? {
          ...(base.desktopAmbiance ?? {}),
          ...updates.desktopAmbiance,
          widgetSimulation: updates.desktopAmbiance.widgetSimulation
            ? {
                ...(base.desktopAmbiance?.widgetSimulation ?? {}),
                ...updates.desktopAmbiance.widgetSimulation,
                behaviors: updates.desktopAmbiance.widgetSimulation.behaviors
                  ? {
                      ...(base.desktopAmbiance?.widgetSimulation?.behaviors ?? {}),
                      ...updates.desktopAmbiance.widgetSimulation.behaviors,
                    }
                  : base.desktopAmbiance?.widgetSimulation?.behaviors,
              } as Partial<DesktopAmbianceConfig>['widgetSimulation']
            : base.desktopAmbiance?.widgetSimulation,
        } as RuntimeConfigOverridePayload['desktopAmbiance']
      : base.desktopAmbiance,
  }
}

// ── Apply / emit ─────────────────────────────────────────────────

export function applyRuntimeConfigOverride(ctx: HandlerContext, updates: RuntimeConfigOverridePayload) {
  ctx.runtimeConfigOverride = mergeRuntimeConfigOverride(ctx.runtimeConfigOverride, updates)
  ctx.io.emit('runtime:config:override', ctx.runtimeConfigOverride)
}

export function emitRuntimeConfigOverride(ctx: HandlerContext) {
  ctx.io.emit('runtime:config:override', ctx.runtimeConfigOverride)
}

// ── Scoped clear ─────────────────────────────────────────────────

export function clearRuntimeOverrideResetTimer(scope: RuntimeOverrideResetScope) {
  if (resetTimers[scope]) {
    clearTimeout(resetTimers[scope]!)
    resetTimers[scope] = null
  }
}

export function clearWidgetLayoutOverrideResetTimer(widgetId: string) {
  const t = widgetLayoutResetTimers.get(widgetId)
  if (t) { clearTimeout(t); widgetLayoutResetTimers.delete(widgetId) }
}

export function clearRuntimeConfigOverrideScopes(ctx: HandlerContext, scopes: RuntimeOverrideResetScope[]) {
  const nextDesktop = { ...(ctx.runtimeConfigOverride.desktopConfig ?? {}) }
  const nextAmbiance = { ...(ctx.runtimeConfigOverride.desktopAmbiance ?? {}) }

  for (const scope of scopes) {
    if (scope === 'desktop.globalThemeDefault') delete nextDesktop.globalThemeDefault
    if (scope === 'desktop.iconAnimation') delete nextDesktop.iconAnimation
    if (scope === 'desktop.iconMotion') delete nextDesktop.iconMotion
    if (scope === 'desktop.screenSaver') delete nextDesktop.screenSaver
    if (scope === 'desktop.widgetThemeOverrides') delete nextDesktop.widgetThemeOverrides
    if (scope === 'ambiance.widgetSimulation') delete nextAmbiance.widgetSimulation
  }

  ctx.runtimeConfigOverride = {
    desktopConfig: Object.keys(nextDesktop).length ? nextDesktop : undefined,
    desktopAmbiance: Object.keys(nextAmbiance).length ? nextAmbiance : undefined,
  }
  ctx.io.emit('runtime:config:override', ctx.runtimeConfigOverride)
}

export function scheduleRuntimeConfigOverrideReset(ctx: HandlerContext, scopes: RuntimeOverrideResetScope[], timeoutSeconds: number) {
  for (const scope of scopes) {
    clearRuntimeOverrideResetTimer(scope)
    const version = resetVersions[scope] + 1
    resetVersions[scope] = version
    resetTimers[scope] = setTimeout(() => {
      if (resetVersions[scope] !== version) return
      resetTimers[scope] = null
      clearRuntimeConfigOverrideScopes(ctx, [scope])
    }, timeoutSeconds * 1000)
  }
}

export function clearAllRuntimeConfigOverrides(ctx: HandlerContext) {
  for (const scope of RUNTIME_OVERRIDE_RESET_SCOPES) {
    clearRuntimeOverrideResetTimer(scope)
    resetVersions[scope] += 1
  }
  for (const widgetId of widgetLayoutResetTimers.keys()) {
    clearWidgetLayoutOverrideResetTimer(widgetId)
  }
  widgetLayoutResetTimers.clear()
  ctx.runtimeConfigOverride = {}
  ctx.io.emit('runtime:config:override', ctx.runtimeConfigOverride)
}

// ── Widget layout override ────────────────────────────────────────

export function clearWidgetRuntimeLayoutOverride(ctx: HandlerContext, widgetId: string): boolean {
  const nextDesktop = { ...(ctx.runtimeConfigOverride.desktopConfig ?? {}) }
  const nextPositions = { ...(nextDesktop.widgetPositions ?? {}) }
  const nextSizes = { ...(nextDesktop.widgetSizes ?? {}) }
  const nextZIndices = { ...(nextDesktop.widgetZIndices ?? {}) }
  let changed = false

  if (widgetId in nextPositions) { delete nextPositions[widgetId]; changed = true }
  if (widgetId in nextSizes) { delete nextSizes[widgetId]; changed = true }
  if (widgetId in nextZIndices) { delete nextZIndices[widgetId]; changed = true }
  if (!changed) return false

  if (Object.keys(nextPositions).length) nextDesktop.widgetPositions = nextPositions
  else delete nextDesktop.widgetPositions
  if (Object.keys(nextSizes).length) nextDesktop.widgetSizes = nextSizes
  else delete nextDesktop.widgetSizes
  if (Object.keys(nextZIndices).length) nextDesktop.widgetZIndices = nextZIndices
  else delete nextDesktop.widgetZIndices

  ctx.runtimeConfigOverride = {
    desktopConfig: Object.keys(nextDesktop).length ? nextDesktop as RuntimeConfigOverridePayload['desktopConfig'] : undefined,
    desktopAmbiance: ctx.runtimeConfigOverride.desktopAmbiance,
  }
  ctx.io.emit('runtime:config:override', ctx.runtimeConfigOverride)
  return true
}

export function clearWidgetRuntimeLayoutOverrides(ctx: HandlerContext, widgetIds: string[]): boolean {
  let changed = false
  for (const id of widgetIds) {
    clearWidgetLayoutOverrideResetTimer(id)
    if (clearWidgetRuntimeLayoutOverride(ctx, id)) changed = true
  }
  return changed
}

export function scheduleWidgetLayoutRuntimeOverrideReset(ctx: HandlerContext, widgetIds: string[], timeoutSeconds: number) {
  for (const widgetId of widgetIds) {
    clearWidgetLayoutOverrideResetTimer(widgetId)
    const timer = setTimeout(() => {
      widgetLayoutResetTimers.delete(widgetId)
      clearWidgetRuntimeLayoutOverride(ctx, widgetId)
    }, timeoutSeconds * 1000)
    widgetLayoutResetTimers.set(widgetId, timer)
  }
}

