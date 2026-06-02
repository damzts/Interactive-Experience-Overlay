import type {
  AmbianceSimulationAcceptedPayload,
  AmbianceSimulationStartedPayload,
  AmbianceSimulationDonePayload,
  WidgetSimulationIntentPayload,
} from '@ieom/shared'
import type { HandlerContext, AppSocket } from './types.js'

export function emitSimulationLeader(ctx: HandlerContext): void {
  ctx.io.emit('ambiance:leader', { socketId: ctx.simulationLeaderSocketId })
}

export function assignOverlayLeader(ctx: HandlerContext, socketId: string): void {
  ctx.simulationLeaderSocketId = socketId
  emitSimulationLeader(ctx)
  ctx.ambianceManager.setLeaderLeaseState({ ready: false, leaseDurationMs: 0, expiresAt: null, lastHeartbeatAt: null })
  ctx.ambianceManager.recordHistory('leader-elected', 'overlay connected', { leaderSocketId: socketId })
}

export function clearOverlayLeader(ctx: HandlerContext): void {
  if (!ctx.simulationLeaderSocketId) return
  ctx.ambianceManager.markSimulationCompleted(undefined, undefined, { recordHistory: false })
  ctx.simulationLeaderSocketId = null
  emitSimulationLeader(ctx)
  ctx.ambianceManager.setLeaderLeaseState({ ready: false, leaseDurationMs: 0, expiresAt: null, lastHeartbeatAt: null })
  ctx.ambianceManager.recordHistory('leader-cleared', 'overlay disconnected', {})
}

export function registerAmbianceHandlers(ctx: HandlerContext, socket: AppSocket): void {
  socket.on('ambiance:leader:request', (callback) => {
    callback({ socketId: ctx.simulationLeaderSocketId })
  })

  socket.on('ambiance:history:clear', () => {
    if (ctx.socketClientTypes.get(socket.id) !== 'admin') return
    ctx.ambianceManager.clearHistory()
  })

  socket.on('ambiance:simulate:accepted', (payload: AmbianceSimulationAcceptedPayload) => {
    if (socket.id !== ctx.simulationLeaderSocketId) return
    ctx.ambianceManager.markSimulationAccepted(payload.actionId)
  })

  socket.on('ambiance:simulate:started', (payload: AmbianceSimulationStartedPayload) => {
    if (socket.id !== ctx.simulationLeaderSocketId) return
    ctx.ambianceManager.markSimulationStarted(payload.actionId)
  })

  socket.on('ambiance:simulate:done', (payload: AmbianceSimulationDonePayload) => {
    if (socket.id !== ctx.simulationLeaderSocketId) return
    ctx.ambianceManager.markSimulationCompleted(payload.actionId, payload)
    if (!payload.ok) {
      console.warn(`[ambiance] Simulation failure: ${payload.widgetId} (${payload.action}, actionId=${payload.actionId})`)
    }
  })

  socket.on('cursor:mirror', (payload) => {
    if (socket.id !== ctx.simulationLeaderSocketId) return
    socket.broadcast.emit('cursor:mirror', payload)
  })

  socket.on('cursor:mirror:menu-timeline', (payload) => {
    if (socket.id !== ctx.simulationLeaderSocketId) return
    socket.broadcast.emit('cursor:mirror:menu-timeline', payload)
  })
}
