import type { OverlayRuntimeStatusPayload } from '@ieomlabs/shared'
import type { HandlerContext, AppSocket } from './types.js'

// ── Diagnostics throttle state ────────────────────────────────────

let runtimeDiagnosticsQueued = false
let runtimeDiagnosticsFlushTimer: ReturnType<typeof setTimeout> | null = null
let lastRuntimeDiagnosticsEmitAt = 0
const RUNTIME_DIAGNOSTICS_MIN_INTERVAL_MS = 1000

export function emitRuntimeDiagnostics(ctx: HandlerContext): void {
  runtimeDiagnosticsQueued = false
  if (runtimeDiagnosticsFlushTimer) { clearTimeout(runtimeDiagnosticsFlushTimer); runtimeDiagnosticsFlushTimer = null }
  lastRuntimeDiagnosticsEmitAt = Date.now()
  ctx.io.emit('runtime:diagnostics', {
    scheduler: ctx.scheduler.getDiagnostics(),
    ambiance: ctx.ambianceManager.getDiagnostics(),
    managers: ctx.getManagerStatuses?.(),
  })
}

export function queueRuntimeDiagnosticsEmit(ctx: HandlerContext): void {
  if (runtimeDiagnosticsQueued) return
  runtimeDiagnosticsQueued = true
  const flush = () => { runtimeDiagnosticsFlushTimer = null; emitRuntimeDiagnostics(ctx) }
  const waitMs = Math.max(0, RUNTIME_DIAGNOSTICS_MIN_INTERVAL_MS - (Date.now() - lastRuntimeDiagnosticsEmitAt))
  if (waitMs === 0) { queueMicrotask(flush); return }
  runtimeDiagnosticsFlushTimer = setTimeout(flush, waitMs)
}

export function registerDiagnosticsHandlers(ctx: HandlerContext, socket: AppSocket): void {
  socket.on('overlay:runtime:status', (payload: OverlayRuntimeStatusPayload) => {
    if (socket.id !== ctx.runtimeState.overlaySocketId) return
    ctx.ambianceManager.setOverlayReady(payload.ready)
    queueRuntimeDiagnosticsEmit(ctx)
  })

  socket.on('bus:trace:subscribe', () => {
    void socket.join('bus:trace')
  })

  socket.on('bus:trace:unsubscribe', () => {
    void socket.leave('bus:trace')
  })
}
