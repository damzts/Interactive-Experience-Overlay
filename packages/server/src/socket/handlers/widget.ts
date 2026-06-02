import { withDesktopConfigDefaults, mergeAppConfig } from '@ieom/shared'
import type { WidgetSimulationCommandPayload } from '@ieom/shared'
import type { HandlerContext, AppSocket } from './types.js'
import { applyRuntimeConfigOverride } from './runtimeOverride.js'

// ── Core widget runtime helpers (used by scene.ts too) ───────────

export function toggleWidgetRuntime(ctx: HandlerContext, widgetId: string): void {
  if (ctx.openWidgetIds.has(widgetId)) ctx.openWidgetIds.delete(widgetId)
  else ctx.openWidgetIds.add(widgetId)
  ctx.io.emit('widget:toggle', widgetId)
}

export function setWidgetRuntimeOpenState(ctx: HandlerContext, widgetId: string, shouldOpen: boolean): void {
  const isOpen = ctx.openWidgetIds.has(widgetId)
  if (shouldOpen === isOpen) return
  if (shouldOpen) ctx.openWidgetIds.add(widgetId)
  else ctx.openWidgetIds.delete(widgetId)
  ctx.io.emit('widget:toggle', widgetId)
}

export function applySavedWidgetLayout(
  ctx: HandlerContext,
  layoutId: string,
  options?: { persist?: boolean; userId?: string },
): { ok: boolean; error?: string } {
  const currentConfig = ctx.cachedUserConfig
  const currentDesktop = withDesktopConfigDefaults(currentConfig.desktopConfig)
  const layout = (currentDesktop.widgetLayouts ?? []).find((e) => e.id === layoutId)
  if (!layout) return { ok: false, error: `Unknown widget layout: ${layoutId}` }

  const validWidgetIds = new Set(
    currentConfig.applications.filter((a) => a.appType === 'widget').map((a) => a.id),
  )
  const layoutItems = layout.items.filter((i) => validWidgetIds.has(i.widgetId))
  if (!layoutItems.length) return { ok: false, error: `Widget layout has no valid widgets: ${layoutId}` }

  const enabledItems = layoutItems.filter((i) => i.enabled)
  const defaultZIndices = currentDesktop.widgetDefaultZIndices ?? {}

  const orderedEnabled = [...enabledItems].sort((a, b) => {
    if (a.focusPriority !== b.focusPriority) return a.focusPriority - b.focusPriority
    return (defaultZIndices[a.widgetId] ?? 0) - (defaultZIndices[b.widgetId] ?? 0)
  })

  if (options?.persist === false) {
    const nextDesktop = { ...(ctx.runtimeConfigOverride.desktopConfig ?? {}) }
    const nextPositions = { ...(nextDesktop.widgetPositions ?? {}) }
    const nextSizes = { ...(nextDesktop.widgetSizes ?? {}) }
    const nextZIndices = { ...(nextDesktop.widgetZIndices ?? {}) }

    for (const item of layoutItems) {
      delete nextPositions[item.widgetId]
      delete nextSizes[item.widgetId]
      delete nextZIndices[item.widgetId]
    }
    for (const item of enabledItems) {
      nextPositions[item.widgetId] = { x: item.x, y: item.y }
      nextSizes[item.widgetId] = { width: item.width, height: item.height }
    }
    for (const item of orderedEnabled) {
      nextZIndices[item.widgetId] = item.focusPriority
    }

    if (Object.keys(nextPositions).length) nextDesktop.widgetPositions = nextPositions; else delete nextDesktop.widgetPositions
    if (Object.keys(nextSizes).length) nextDesktop.widgetSizes = nextSizes; else delete nextDesktop.widgetSizes
    if (Object.keys(nextZIndices).length) nextDesktop.widgetZIndices = nextZIndices; else delete nextDesktop.widgetZIndices

    ctx.runtimeConfigOverride = {
      desktopConfig: Object.keys(nextDesktop).length ? nextDesktop as typeof ctx.runtimeConfigOverride['desktopConfig'] : undefined,
      desktopAmbiance: ctx.runtimeConfigOverride.desktopAmbiance,
    }
    ctx.io.emit('runtime:config:override', ctx.runtimeConfigOverride)
  } else {
    const nextPositions = { ...(currentDesktop.widgetPositions ?? {}) }
    const nextSizes = { ...(currentDesktop.widgetSizes ?? {}) }
    const nextZIndices = { ...(currentDesktop.widgetZIndices ?? {}) }
    for (const item of layoutItems) {
      nextPositions[item.widgetId] = { x: item.x, y: item.y }
      nextSizes[item.widgetId] = { width: item.width, height: item.height }
    }
    for (const item of orderedEnabled) {
      nextZIndices[item.widgetId] = item.focusPriority
    }

    const nextConfig = mergeAppConfig(currentConfig, {
      desktopConfig: { widgetPositions: nextPositions, widgetSizes: nextSizes, widgetZIndices: nextZIndices } as any,
    })
    if (options?.userId) {
      void ctx.configService?.persistForUser(options.userId, nextConfig, ctx.machine, {
        desktopConfig: { widgetPositions: nextConfig.desktopConfig?.widgetPositions, widgetSizes: nextConfig.desktopConfig?.widgetSizes, widgetZIndices: nextConfig.desktopConfig?.widgetZIndices } as any,
      }).then((result: any) => { if (result) ctx.cachedUserConfig = result })
    }
  }

  for (const item of layoutItems) {
    const isOpen = ctx.openWidgetIds.has(item.widgetId)
    if (item.enabled !== isOpen) toggleWidgetRuntime(ctx, item.widgetId)
  }

  ctx.io.emit('widget:layout:apply', layoutId)
  return { ok: true }
}

// ── Socket handlers ───────────────────────────────────────────────

export function registerWidgetHandlers(ctx: HandlerContext, socket: AppSocket): void {
  socket.on('widget:toggle', (widgetId: string) => {
    ctx.scheduler?.noteActivity()
    toggleWidgetRuntime(ctx, widgetId)
  })

  socket.on('widget:simulate', (widgetId: string) => {
    if (socket.id !== ctx.simulationLeaderSocketId) {
      ctx.rejectedSimulatedToggles += 1
      ctx.io.emit('ambiance:metrics', { accepted: ctx.acceptedSimulatedToggles, rejected: ctx.rejectedSimulatedToggles })
      console.warn(`[ambiance] Ignored simulated toggle from non-leader ${socket.id} for ${widgetId}`)
      return
    }
    ctx.acceptedSimulatedToggles += 1
    ctx.io.emit('ambiance:metrics', { accepted: ctx.acceptedSimulatedToggles, rejected: ctx.rejectedSimulatedToggles })
    toggleWidgetRuntime(ctx, widgetId)
  })

  socket.on('widget:simulate:action', (payload: WidgetSimulationCommandPayload) => {
    if (socket.id !== ctx.simulationLeaderSocketId) {
      ctx.rejectedSimulatedToggles += 1
      ctx.io.emit('ambiance:metrics', { accepted: ctx.acceptedSimulatedToggles, rejected: ctx.rejectedSimulatedToggles })
      console.warn(`[ambiance] Ignored simulated action from non-leader ${socket.id} for ${payload.widgetId}`)
      return
    }
    ctx.acceptedSimulatedToggles += 1
    ctx.io.emit('ambiance:metrics', { accepted: ctx.acceptedSimulatedToggles, rejected: ctx.rejectedSimulatedToggles })
    if (payload.action === 'toggle') toggleWidgetRuntime(ctx, payload.widgetId)
    else setWidgetRuntimeOpenState(ctx, payload.widgetId, payload.action === 'open')
  })

  socket.on('widget:layout:apply', (layoutId) => {
    ctx.scheduler?.noteActivity()
    applySavedWidgetLayout(ctx, layoutId, { persist: false, userId: socket.data.userId })
  })

  socket.on('widget:simulate:intent', (payload) => {
    if (socket.id !== ctx.simulationLeaderSocketId) return
    ctx.io.emit('widget:simulate:intent', payload)
  })
}
