import { withDesktopConfigDefaults, mergeAppConfig } from '@ieom/shared'
import type { WidgetSimulationCommandPayload } from '@ieom/shared'
import type { HandlerContext, AppSocket } from './types.js'
import { applyRuntimeConfigOverride } from './runtimeOverride.js'

// ── Core widget runtime helpers (used by scene.ts too) ───────────

export function toggleWidgetRuntime(ctx: HandlerContext, widgetId: string): void {
  ctx.runtimeState.toggleWidget(widgetId)
  ctx.io.emit('widget:toggle', widgetId)
}

export function setWidgetRuntimeOpenState(ctx: HandlerContext, widgetId: string, shouldOpen: boolean): void {
  const isOpen = ctx.runtimeState.openWidgetIds.has(widgetId)
  if (shouldOpen === isOpen) return
  if (shouldOpen) ctx.runtimeState.openWidget(widgetId)
  else ctx.runtimeState.closeWidget(widgetId)
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
    const isOpen = ctx.runtimeState.openWidgetIds.has(item.widgetId)
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
    if (socket.id !== ctx.overlaySocketId) {
      ctx.runtimeState.incrementRejected()
      ctx.io.emit('ambiance:metrics', { accepted: ctx.runtimeState.acceptedSimulatedToggles, rejected: ctx.runtimeState.rejectedSimulatedToggles })
      console.warn(`[ambiance] Ignored simulated toggle from non-leader ${socket.id} for ${widgetId}`)
      return
    }
    ctx.runtimeState.incrementAccepted()
    ctx.io.emit('ambiance:metrics', { accepted: ctx.runtimeState.acceptedSimulatedToggles, rejected: ctx.runtimeState.rejectedSimulatedToggles })
    toggleWidgetRuntime(ctx, widgetId)
  })

  socket.on('widget:simulate:action', (payload: WidgetSimulationCommandPayload) => {
    if (socket.id !== ctx.overlaySocketId) {
      ctx.runtimeState.incrementRejected()
      ctx.io.emit('ambiance:metrics', { accepted: ctx.runtimeState.acceptedSimulatedToggles, rejected: ctx.runtimeState.rejectedSimulatedToggles })
      console.warn(`[ambiance] Ignored simulated action from non-leader ${socket.id} for ${payload.widgetId}`)
      return
    }
    ctx.runtimeState.incrementAccepted()
    ctx.io.emit('ambiance:metrics', { accepted: ctx.runtimeState.acceptedSimulatedToggles, rejected: ctx.runtimeState.rejectedSimulatedToggles })
    if (payload.action === 'toggle') toggleWidgetRuntime(ctx, payload.widgetId)
    else setWidgetRuntimeOpenState(ctx, payload.widgetId, payload.action === 'open')
  })

  socket.on('widget:layout:apply', (layoutId) => {
    ctx.scheduler?.noteActivity()
    applySavedWidgetLayout(ctx, layoutId, { persist: false, userId: socket.data.userId })
  })

  socket.on('widget:layout:apply:items', (items) => {
    ctx.scheduler?.noteActivity()
    const currentConfig = ctx.cachedUserConfig
    const currentDesktop = withDesktopConfigDefaults(currentConfig.desktopConfig)
    const validWidgetIds = new Set(currentConfig.applications.filter((a) => a.appType === 'widget').map((a) => a.id))
    const validItems = items.filter((i) => validWidgetIds.has(i.widgetId))
    if (!validItems.length) return

    const nextDesktop = { ...(ctx.runtimeConfigOverride.desktopConfig ?? {}) }
    const nextPositions = { ...(nextDesktop.widgetPositions ?? {}) }
    const nextSizes = { ...(nextDesktop.widgetSizes ?? {}) }
    const nextZIndices = { ...(nextDesktop.widgetZIndices ?? {}) }
    const defaultZIndices = currentDesktop.widgetDefaultZIndices ?? {}

    for (const item of validItems) {
      delete nextPositions[item.widgetId]
      delete nextSizes[item.widgetId]
      delete nextZIndices[item.widgetId]
    }
    const enabledItems = [...validItems.filter((i) => i.enabled)].sort((a, b) =>
      a.focusPriority !== b.focusPriority ? a.focusPriority - b.focusPriority : (defaultZIndices[a.widgetId] ?? 0) - (defaultZIndices[b.widgetId] ?? 0)
    )
    for (const item of enabledItems) {
      nextPositions[item.widgetId] = { x: item.x, y: item.y }
      nextSizes[item.widgetId] = { width: item.width, height: item.height }
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

    for (const item of validItems) {
      const isOpen = ctx.runtimeState.openWidgetIds.has(item.widgetId)
      if (item.enabled !== isOpen) toggleWidgetRuntime(ctx, item.widgetId)
    }
    ctx.io.emit('widget:layout:apply:items', validItems)
  })

  socket.on('widget:simulate:intent', (payload) => {
    if (socket.id !== ctx.overlaySocketId) return
    ctx.io.emit('widget:simulate:intent', payload)
  })
}

