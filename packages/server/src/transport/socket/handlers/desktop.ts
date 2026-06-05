import type {
  DesktopNotificationPayload,
  DesktopRecycleBinPayload,
  DesktopScreenSaverPreviewPayload,
  DesktopStartMenuStatePayload,
  DesktopStartMenuSimulationPhasePayload,
  DesktopRuntimeStatePayload,
} from '@ieom/shared'
import type { HandlerContext, AppSocket } from './types.js'
import { applyRuntimeConfigOverride } from './runtimeOverride.js'

export function getDesktopRuntimeState(ctx: HandlerContext): DesktopRuntimeStatePayload {
  return {
    openWidgetIds: [...ctx.openWidgetIds],
    recycleBinFull: ctx.recycleBinFull,
    startMenuState: ctx.startMenuState,
  }
}

export function registerDesktopHandlers(ctx: HandlerContext, socket: AppSocket): void {
  socket.on('desktop:state:request', (callback) => {
    callback(getDesktopRuntimeState(ctx))
  })

  socket.on('desktop:icon:drag', (payload) => {
    ctx.scheduler?.noteActivity()
    socket.broadcast.emit('desktop:icon:drag', payload)
  })

  socket.on('desktop:widget:drag', (payload) => {
    if (payload.phase !== 'move') ctx.scheduler?.noteActivity()
    if (payload.phase === 'end') {
      applyRuntimeConfigOverride(ctx, {
        desktopConfig: {
          widgetPositions: {
            [payload.widgetId]: { x: Math.max(0, Math.round(payload.x)), y: Math.max(0, Math.round(payload.y)) },
          },
        },
      })
    }
    socket.broadcast.emit('desktop:widget:drag', payload)
  })

  socket.on('desktop:widget:resize', (payload) => {
    if (payload.phase !== 'move') ctx.scheduler?.noteActivity()
    if (payload.phase === 'end') {
      applyRuntimeConfigOverride(ctx, {
        desktopConfig: {
          widgetPositions: {
            [payload.widgetId]: { x: Math.max(0, Math.round(payload.x)), y: Math.max(0, Math.round(payload.y)) },
          },
          widgetSizes: {
            [payload.widgetId]: { width: Math.max(180, Math.round(payload.width)), height: Math.max(140, Math.round(payload.height)) },
          },
        },
      })
    }
    socket.broadcast.emit('desktop:widget:resize', payload)
  })

  socket.on('desktop:notify', (payload: DesktopNotificationPayload) => {
    ctx.scheduler?.noteActivity()
    ctx.io.emit('desktop:notify', payload)
  })

  socket.on('desktop:recycle-bin', (payload: DesktopRecycleBinPayload) => {
    ctx.scheduler?.noteActivity()
    ctx.recycleBinFull = payload.full
    ctx.io.emit('desktop:recycle-bin', payload)
  })

  socket.on('desktop:start-menu:state', (payload: DesktopStartMenuStatePayload) => {
    if (payload.open) ctx.scheduler?.noteActivity()
    ctx.startMenuState = {
      open: payload.open,
      activeRoot: payload.open ? payload.activeRoot : null,
    }
    ctx.io.emit('desktop:start-menu:state', ctx.startMenuState)
  })

  socket.on('desktop:start-menu:phase', (payload: DesktopStartMenuSimulationPhasePayload) => {
    if (socket.id !== ctx.simulationLeaderSocketId) return
    ctx.io.emit('desktop:start-menu:phase', payload)
  })

  socket.on('desktop:screen-saver:test', (payload: DesktopScreenSaverPreviewPayload) => {
    ctx.scheduler?.noteActivity()
    ctx.io.emit('desktop:screen-saver:test', payload)
  })
}

