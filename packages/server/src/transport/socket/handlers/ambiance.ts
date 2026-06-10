import type {
  AmbianceSimulationAcceptedPayload,
  AmbianceSimulationStartedPayload,
  AmbianceSimulationDonePayload,
  WidgetSimulationIntentPayload,
} from '@ieomlabs/shared'
import logger from '../../../lib/logger.js'
import type { HandlerContext, AppSocket } from './types.js'

export function registerAmbianceHandlers(ctx: HandlerContext, socket: AppSocket): void {
  socket.on('ambiance:history:clear', () => {
    if (ctx.socketClientTypes.get(socket.id) !== 'admin') return
    ctx.ambianceManager.clearHistory()
  })

  socket.on('ambiance:simulate:accepted', (payload: AmbianceSimulationAcceptedPayload) => {
    if (socket.id !== ctx.runtimeState.overlaySocketId) return
    ctx.ambianceManager.markSimulationAccepted(payload.actionId)
  })

  socket.on('ambiance:simulate:started', (payload: AmbianceSimulationStartedPayload) => {
    if (socket.id !== ctx.runtimeState.overlaySocketId) return
    ctx.ambianceManager.markSimulationStarted(payload.actionId)
  })

  socket.on('ambiance:simulate:done', (payload: AmbianceSimulationDonePayload) => {
    if (socket.id !== ctx.runtimeState.overlaySocketId) return
    ctx.ambianceManager.markSimulationCompleted(payload.actionId, payload)
    if (!payload.ok) {
      logger.warn(`[ambiance] Simulation failure: ${payload.widgetId} (${payload.action}, actionId=${payload.actionId})`)
    }
  })

  socket.on('cursor:mirror', (payload) => {
    if (socket.id !== ctx.runtimeState.overlaySocketId) return
    socket.broadcast.emit('cursor:mirror', payload)
  })

  socket.on('cursor:mirror:menu-timeline', (payload) => {
    if (socket.id !== ctx.runtimeState.overlaySocketId) return
    socket.broadcast.emit('cursor:mirror:menu-timeline', payload)
  })
}