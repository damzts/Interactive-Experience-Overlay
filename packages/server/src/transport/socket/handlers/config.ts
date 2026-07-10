import type { HandlerContext, AppSocket } from './types.js'
import {
  resetRuntimeConfig,
  resetWidgetRuntimeConfig,
  resetWidgetRuntimeConfigs,
} from './runtimeConfig.js'
import { triggerConfiguredEvent } from './scene.js'

export function registerConfigHandlers(ctx: HandlerContext, socket: AppSocket): void {
  socket.on('runtime:config:reset', (callback) => {
    if (ctx.socketClientTypes.get(socket.id) !== 'admin') {
      if (callback) callback('Only admin clients can reset runtime config')
      return
    }
    resetRuntimeConfig(ctx)
    if (callback) callback(null)
  })

  socket.on('runtime:config:widget:reset', (widgetId, callback) => {
    if (ctx.socketClientTypes.get(socket.id) !== 'admin') {
      if (callback) callback('Only admin clients can reset widget runtime config')
      return
    }
    const id = widgetId.trim()
    if (!id) { if (callback) callback('Missing widget id'); return }
    resetWidgetRuntimeConfig(ctx, id)
    if (callback) callback(null)
  })

  socket.on('runtime:config:widget-layout:reset', (widgetIds, callback) => {
    if (ctx.socketClientTypes.get(socket.id) !== 'admin') {
      if (callback) callback('Only admin clients can reset widget layout runtime config')
      return
    }
    const ids = [...new Set((widgetIds ?? []).map((id) => id.trim()).filter(Boolean))]
    if (!ids.length) { if (callback) callback('Missing widget ids'); return }
    resetWidgetRuntimeConfigs(ctx, ids)
    if (callback) callback(null)
  })

  socket.on('keybind:execute', (payload, callback) => {
    ctx.scheduler?.noteActivity()
    const key = payload.key?.trim()
    const presetId = payload.presetId?.trim() || (key ? ctx.cachedUserConfig.keybinds[key] : undefined)
    if (!presetId) {
      if (callback) callback('No preset bound to this key')
      return
    }
    const result = triggerConfiguredEvent(ctx, presetId)
    if (callback) callback(result.ok ? null : result.error ?? 'Unknown error')
  })
}

