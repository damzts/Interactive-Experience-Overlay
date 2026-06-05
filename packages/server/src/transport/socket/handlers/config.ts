import type { HandlerContext, AppSocket } from './types.js'
import {
  clearAllRuntimeConfigOverrides,
  clearWidgetRuntimeLayoutOverride,
  clearWidgetRuntimeLayoutOverrides,
} from './runtimeOverride.js'
import { runConfiguredAction } from './scene.js'

export function registerConfigHandlers(ctx: HandlerContext, socket: AppSocket): void {
  socket.on('runtime:config:override:clear', (callback) => {
    if (ctx.socketClientTypes.get(socket.id) !== 'admin') {
      if (callback) callback('Only admin clients can clear runtime overrides')
      return
    }
    clearAllRuntimeConfigOverrides(ctx)
    if (callback) callback(null)
  })

  socket.on('runtime:config:override:widget:clear', (widgetId, callback) => {
    if (ctx.socketClientTypes.get(socket.id) !== 'admin') {
      if (callback) callback('Only admin clients can clear widget runtime overrides')
      return
    }
    const id = widgetId.trim()
    if (!id) { if (callback) callback('Missing widget id'); return }
    clearWidgetRuntimeLayoutOverride(ctx, id)
    if (callback) callback(null)
  })

  socket.on('runtime:config:override:widget-layout:clear', (widgetIds, callback) => {
    if (ctx.socketClientTypes.get(socket.id) !== 'admin') {
      if (callback) callback('Only admin clients can clear widget layout runtime overrides')
      return
    }
    const ids = [...new Set((widgetIds ?? []).map((id) => id.trim()).filter(Boolean))]
    if (!ids.length) { if (callback) callback('Missing widget ids'); return }
    clearWidgetRuntimeLayoutOverrides(ctx, ids)
    if (callback) callback(null)
  })

  socket.on('keybind:execute', (payload, callback) => {
    ctx.scheduler?.noteActivity()
    const inlineAction = payload.action?.trim()
    const key = payload.key?.trim()
    const action = inlineAction || (key ? ctx.cachedUserConfig.keybinds[payload.scope]?.[key] : undefined)
    if (!action) {
      if (callback) callback(`No ${payload.scope} keybind action found`)
      return
    }
    const result = runConfiguredAction(ctx, action)
    if (callback) callback(result.ok ? null : result.error ?? 'Unknown error')
  })
}

