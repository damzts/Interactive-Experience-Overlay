/**
 * Runtime config helpers — shared by config, widget, and desktop handlers.
 * All mutations go through these helpers to keep runtime config state consistent.
 */
import type {
  RuntimeConfig,
  DesktopAmbianceConfig,
} from '@ieomlabs/shared'
import type { HandlerContext } from './types.js'

// ── Scope types ──────────────────────────────────────────────────

export const RUNTIME_CONFIG_RESET_SCOPES = [
  'desktop.globalThemeDefault',
  'desktop.iconAnimation',
  'desktop.iconMotion',
  'desktop.iconArrangement',
  'desktop.iconArrangementMotion',
  'desktop.screenSaver',
  'desktop.widgetThemes',
  'ambiance.widgetSimulation',
] as const

export type RuntimeConfigResetScope = typeof RUNTIME_CONFIG_RESET_SCOPES[number]

// ── Timer state (module-level, lives for the lifetime of the server instance) ──

const resetTimers = Object.fromEntries(
  RUNTIME_CONFIG_RESET_SCOPES.map((s) => [s, null]),
) as Record<RuntimeConfigResetScope, ReturnType<typeof setTimeout> | null>

const resetVersions = Object.fromEntries(
  RUNTIME_CONFIG_RESET_SCOPES.map((s) => [s, 0]),
) as Record<RuntimeConfigResetScope, number>

const widgetLayoutResetTimers = new Map<string, ReturnType<typeof setTimeout>>()

// ── Deep merge ───────────────────────────────────────────────────

export function mergeRuntimeConfig(
  base: RuntimeConfig,
  updates: RuntimeConfig,
): RuntimeConfig {
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
          widgetThemes: updates.desktopConfig.widgetThemes
            ? { ...(base.desktopConfig?.widgetThemes ?? {}), ...updates.desktopConfig.widgetThemes }
            : base.desktopConfig?.widgetThemes,
          screenSaver: updates.desktopConfig.screenSaver
            ? { ...(base.desktopConfig?.screenSaver ?? {}), ...updates.desktopConfig.screenSaver } as NonNullable<RuntimeConfig['desktopConfig']>['screenSaver']
            : base.desktopConfig?.screenSaver,
        } as RuntimeConfig['desktopConfig']
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
        } as RuntimeConfig['desktopAmbiance']
      : base.desktopAmbiance,
    widgetPositions: updates.widgetPositions
      ? { ...(base.widgetPositions ?? {}), ...updates.widgetPositions }
      : base.widgetPositions,
    widgetSizes: updates.widgetSizes
      ? { ...(base.widgetSizes ?? {}), ...updates.widgetSizes }
      : base.widgetSizes,
    widgetZIndices: updates.widgetZIndices
      ? { ...(base.widgetZIndices ?? {}), ...updates.widgetZIndices }
      : base.widgetZIndices,
  }
}

// ── Apply / emit ─────────────────────────────────────────────────

export function applyRuntimeConfig(ctx: HandlerContext, updates: RuntimeConfig) {
  ctx.runtimeConfig = mergeRuntimeConfig(ctx.runtimeConfig, updates)
  ctx.io.emit('runtime:config', ctx.runtimeConfig)
}

export function emitRuntimeConfig(ctx: HandlerContext) {
  ctx.io.emit('runtime:config', ctx.runtimeConfig)
}

// ── Scoped clear ─────────────────────────────────────────────────

export function clearRuntimeResetTimer(scope: RuntimeConfigResetScope) {
  if (resetTimers[scope]) {
    clearTimeout(resetTimers[scope]!)
    resetTimers[scope] = null
  }
}

export function clearWidgetRuntimeResetTimer(widgetId: string) {
  const t = widgetLayoutResetTimers.get(widgetId)
  if (t) { clearTimeout(t); widgetLayoutResetTimers.delete(widgetId) }
}

export function clearRuntimeConfigScopes(ctx: HandlerContext, scopes: RuntimeConfigResetScope[]) {
  const nextDesktop = { ...(ctx.runtimeConfig.desktopConfig ?? {}) }
  const nextAmbiance = { ...(ctx.runtimeConfig.desktopAmbiance ?? {}) }

  for (const scope of scopes) {
    if (scope === 'desktop.globalThemeDefault') delete nextDesktop.globalThemeDefault
    if (scope === 'desktop.iconAnimation') delete nextDesktop.iconAnimation
    if (scope === 'desktop.iconMotion') delete nextDesktop.iconMotion
    if (scope === 'desktop.iconArrangement') delete nextDesktop.iconArrangement
    if (scope === 'desktop.iconArrangementMotion') delete nextDesktop.iconArrangementMotion
    if (scope === 'desktop.screenSaver') delete nextDesktop.screenSaver
    if (scope === 'desktop.widgetThemes') delete nextDesktop.widgetThemes
    if (scope === 'ambiance.widgetSimulation') delete nextAmbiance.widgetSimulation
  }

  ctx.runtimeConfig = {
    desktopConfig: Object.keys(nextDesktop).length ? nextDesktop : undefined,
    desktopAmbiance: Object.keys(nextAmbiance).length ? nextAmbiance : undefined,
  }
  ctx.io.emit('runtime:config', ctx.runtimeConfig)
}

export function scheduleRuntimeConfigReset(ctx: HandlerContext, scopes: RuntimeConfigResetScope[], timeoutSeconds: number) {
  for (const scope of scopes) {
    clearRuntimeResetTimer(scope)
    const version = resetVersions[scope] + 1
    resetVersions[scope] = version
    resetTimers[scope] = setTimeout(() => {
      if (resetVersions[scope] !== version) return
      resetTimers[scope] = null
      clearRuntimeConfigScopes(ctx, [scope])
    }, timeoutSeconds * 1000)
  }
}

export function resetRuntimeConfig(ctx: HandlerContext) {
  for (const scope of RUNTIME_CONFIG_RESET_SCOPES) {
    clearRuntimeResetTimer(scope)
    resetVersions[scope] += 1
  }
  for (const widgetId of widgetLayoutResetTimers.keys()) {
    clearWidgetRuntimeResetTimer(widgetId)
  }
  widgetLayoutResetTimers.clear()
  ctx.runtimeConfig = {}
  ctx.io.emit('runtime:config', ctx.runtimeConfig)
}

// ── Widget runtime config ─────────────────────────────────────────

export function resetWidgetRuntimeConfig(ctx: HandlerContext, widgetId: string): boolean {
  const nextPositions = { ...(ctx.runtimeConfig.widgetPositions ?? {}) }
  const nextSizes     = { ...(ctx.runtimeConfig.widgetSizes ?? {}) }
  const nextZIndices  = { ...(ctx.runtimeConfig.widgetZIndices ?? {}) }
  let changed = false

  if (widgetId in nextPositions) { delete nextPositions[widgetId]; changed = true }
  if (widgetId in nextSizes)     { delete nextSizes[widgetId];     changed = true }
  if (widgetId in nextZIndices)  { delete nextZIndices[widgetId];  changed = true }
  if (!changed) return false

  ctx.runtimeConfig = {
    ...ctx.runtimeConfig,
    widgetPositions: Object.keys(nextPositions).length ? nextPositions : undefined,
    widgetSizes:     Object.keys(nextSizes).length     ? nextSizes     : undefined,
    widgetZIndices:  Object.keys(nextZIndices).length  ? nextZIndices  : undefined,
  }
  ctx.io.emit('runtime:config', ctx.runtimeConfig)
  return true
}

export function resetWidgetRuntimeConfigs(ctx: HandlerContext, widgetIds: string[]): boolean {
  let changed = false
  for (const id of widgetIds) {
    clearWidgetRuntimeResetTimer(id)
    if (resetWidgetRuntimeConfig(ctx, id)) changed = true
  }
  return changed
}

export function scheduleWidgetRuntimeConfigReset(ctx: HandlerContext, widgetIds: string[], timeoutSeconds: number) {
  for (const widgetId of widgetIds) {
    clearWidgetRuntimeResetTimer(widgetId)
    const timer = setTimeout(() => {
      widgetLayoutResetTimers.delete(widgetId)
      resetWidgetRuntimeConfig(ctx, widgetId)
    }, timeoutSeconds * 1000)
    widgetLayoutResetTimers.set(widgetId, timer)
  }
}
