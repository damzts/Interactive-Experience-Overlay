import type {
  DesktopNotificationPayload,
  DesktopRuntimeStatePayload,
  PresentationStateReportPayload,
} from '@ieomlabs/shared'
import type { HandlerContext, AppSocket } from './types.js'
import { applyRuntimeConfig } from './runtimeConfig.js'

export function getDesktopRuntimeState(ctx: HandlerContext): DesktopRuntimeStatePayload {
  return {
    openWidgetIds: [...ctx.runtimeState.openWidgetIds],
    presentation: ctx.runtimeState.presentationState,
  }
}

export function registerDesktopHandlers(ctx: HandlerContext, socket: AppSocket): void {
  socket.on('desktop:state:request', (callback) => {
    callback(getDesktopRuntimeState(ctx))
  })

  socket.on('desktop:icon:drag', (payload) => {
    ctx.scheduler?.noteActivity()
  })

  socket.on('desktop:widget:drag', (payload) => {
    if (payload.phase !== 'move') ctx.scheduler?.noteActivity()
    if (payload.phase === 'end') {
      applyRuntimeConfig(ctx, {
        widgetPositions: {
          [payload.widgetId]: { x: Math.max(0, Math.round(payload.x)), y: Math.max(0, Math.round(payload.y)) },
        },
      })
    }
  })

  socket.on('desktop:widget:resize', (payload) => {
    if (payload.phase !== 'move') ctx.scheduler?.noteActivity()
    if (payload.phase === 'end') {
      applyRuntimeConfig(ctx, {
        widgetPositions: {
          [payload.widgetId]: { x: Math.max(0, Math.round(payload.x)), y: Math.max(0, Math.round(payload.y)) },
        },
        widgetSizes: {
          [payload.widgetId]: { width: Math.max(180, Math.round(payload.width)), height: Math.max(140, Math.round(payload.height)) },
        },
      })
    }
  })

  socket.on('desktop:notify', (payload: DesktopNotificationPayload) => {
    ctx.scheduler?.noteActivity()
    ctx.io.emit('desktop:notify', payload)
  })

  socket.on('presentation:state', (payload: PresentationStateReportPayload) => {
    if (typeof payload?.key !== 'string' || payload.key.length === 0) return
    if (payload.activity) ctx.scheduler?.noteActivity()
    ctx.runtimeState.setPresentationState(payload.key, payload.value)
    ctx.io.emit('presentation:state', { key: payload.key, value: payload.value })
  })
}

