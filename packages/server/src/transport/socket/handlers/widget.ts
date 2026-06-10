import { mergeAppConfig } from '@ieomlabs/shared'
import type { WidgetSimulationCommandPayload } from '@ieomlabs/shared'
import type { HandlerContext, AppSocket } from './types.js'
import { applyRuntimeConfigOverride } from './runtimeOverride.js'
import logger from '../../../lib/logger.js';


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
  const layout = (currentConfig.widgetLayouts ?? []).find((e) => e.id === layoutId)
  if (!layout) return { ok: false, error: `Unknown widget layout: ${layoutId}` }

  const validWidgetIds = new Set(
    currentConfig.applications.map((a) => a.id),
  )
  const layoutItems = layout.items.filter((i) => validWidgetIds.has(i.widgetId))
  if (!layoutItems.length) return { ok: false, error: `Widget layout has no valid widgets: ${layoutId}` }

  const enabledItems = layoutItems.filter((i) => i.enabled)
  const defaultZIndices = Object.fromEntries(currentConfig.applications.map((a) => [a.id, a.zIndexDefault ?? 0]))

  const orderedEnabled = [...enabledItems].sort((a, b) => {
    if (a.focusPriority !== b.focusPriority) return a.focusPriority - b.focusPriority
    return (defaultZIndices[a.widgetId] ?? 0) - (defaultZIndices[b.widgetId] ?? 0)
  })

  if (options?.persist === false) {
    const nextPositions = { ...(ctx.runtimeConfigOverride.widgetPositions ?? {}) }
    const nextSizes = { ...(ctx.runtimeConfigOverride.widgetSizes ?? {}) }
    const nextZIndices = { ...(ctx.runtimeConfigOverride.widgetZIndices ?? {}) }

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

    ctx.runtimeConfigOverride = {
      ...ctx.runtimeConfigOverride,
      ...(Object.keys(nextPositions).length ? { widgetPositions: nextPositions } : { widgetPositions: undefined }),
      ...(Object.keys(nextSizes).length ? { widgetSizes: nextSizes } : { widgetSizes: undefined }),
      ...(Object.keys(nextZIndices).length ? { widgetZIndices: nextZIndices } : { widgetZIndices: undefined }),
    }
    ctx.io.emit('runtime:config:override', ctx.runtimeConfigOverride)
  } else {
    // Persist path: update application geometry directly
    const nextApplications = currentConfig.applications.map((app) => {
      const item = layoutItems.find((i) => i.widgetId === app.id)
      if (!item) return app
      const zItem = orderedEnabled.find((e) => e.widgetId === app.id)
      return {
        ...app,
        windowPosition: { x: item.x, y: item.y },
        windowSize: { width: item.width, height: item.height },
        ...(zItem ? { zIndexCurrent: zItem.focusPriority } : {}),
      }
    })
    const nextConfig = mergeAppConfig(currentConfig, { applications: nextApplications })
    if (options?.userId) {
      void ctx.configService?.persistForUser(options.userId, nextConfig, { applications: nextApplications }).then((result: any) => {
        if (result) ctx.cachedUserConfig = result
      })
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
    if (socket.id !== ctx.runtimeState.overlaySocketId) {
      ctx.runtimeState.incrementRejected()
      ctx.io.emit('ambiance:metrics', { accepted: ctx.runtimeState.acceptedSimulatedToggles, rejected: ctx.runtimeState.rejectedSimulatedToggles })
      logger.info({ socketId: socket.id }, 'socket disconnected')
        return
    }
    ctx.runtimeState.incrementAccepted()
    ctx.io.emit('ambiance:metrics', { accepted: ctx.runtimeState.acceptedSimulatedToggles, rejected: ctx.runtimeState.rejectedSimulatedToggles })
    toggleWidgetRuntime(ctx, widgetId)
  })

  socket.on('widget:simulate:action', (payload: WidgetSimulationCommandPayload) => {
    if (socket.id !== ctx.runtimeState.overlaySocketId) {
      ctx.runtimeState.incrementRejected()
      ctx.io.emit('ambiance:metrics', { accepted: ctx.runtimeState.acceptedSimulatedToggles, rejected: ctx.runtimeState.rejectedSimulatedToggles })
      logger.info({ socketId: socket.id }, 'socket disconnected')
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
    const validWidgetIds = new Set(currentConfig.applications.map((a) => a.id))
    const validItems = items.filter((i) => validWidgetIds.has(i.widgetId))
    if (!validItems.length) return

    const nextPositions = { ...(ctx.runtimeConfigOverride.widgetPositions ?? {}) }
    const nextSizes     = { ...(ctx.runtimeConfigOverride.widgetSizes ?? {}) }
    const nextZIndices  = { ...(ctx.runtimeConfigOverride.widgetZIndices ?? {}) }
    const defaultZIndices = Object.fromEntries(currentConfig.applications.map((a) => [a.id, a.zIndexDefault ?? 0]))

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
      nextSizes[item.widgetId]     = { width: item.width, height: item.height }
      nextZIndices[item.widgetId]  = item.focusPriority
    }

    ctx.runtimeConfigOverride = {
      ...ctx.runtimeConfigOverride,
      widgetPositions: Object.keys(nextPositions).length ? nextPositions : undefined,
      widgetSizes:     Object.keys(nextSizes).length     ? nextSizes     : undefined,
      widgetZIndices:  Object.keys(nextZIndices).length  ? nextZIndices  : undefined,
    }
    ctx.io.emit('runtime:config:override', ctx.runtimeConfigOverride)

    for (const item of validItems) {
      const isOpen = ctx.runtimeState.openWidgetIds.has(item.widgetId)
      if (item.enabled !== isOpen) toggleWidgetRuntime(ctx, item.widgetId)
    }
    ctx.io.emit('widget:layout:apply:items', validItems)
  })

  socket.on('widget:simulate:intent', (payload) => {
    if (socket.id !== ctx.runtimeState.overlaySocketId) return
    ctx.io.emit('widget:simulate:intent', payload)
  })

  // Widget wire routing — only open/close/toggle go through kernel
  // (they mutate authoritative open state). Custom actions are evaluated
  // locally in the overlay via the DOM bus without a server round-trip.
  socket.on('widget:signal', (payload: { source: string; event: string; payload: unknown }) => {
    if (!ctx.configService?.routeWidgetSignal) return
    const chains = ctx.configService.routeWidgetSignal(payload.source, payload.event)
    for (const chain of chains) {
      if (chain.targetAction === 'open' || chain.targetAction === 'close') {
        setWidgetRuntimeOpenState(ctx, chain.targetWidgetId, chain.targetAction === 'open')
      } else if (chain.targetAction === 'toggle') {
        toggleWidgetRuntime(ctx, chain.targetWidgetId)
      }
      // custom actions intentionally not handled here — overlay evaluates them locally
    }
  })
}

