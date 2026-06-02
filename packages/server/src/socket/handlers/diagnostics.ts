import type { OverlayRuntimeStatusPayload, OverlayClientKind, OverlayClientDiagnostics } from '@ieom/shared'
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

export function buildOverlayClientInfo(socket: AppSocket): OverlayClientDiagnostics {
  const auth = socket.handshake.auth as { overlayKind?: string; overlayPort?: string; overlayLabel?: string } | undefined
  const kind: OverlayClientKind = auth?.overlayKind === 'runtime' || auth?.overlayKind === 'dev' ? auth.overlayKind : 'unknown'
  const port = auth?.overlayPort?.trim() || null
  const label = auth?.overlayLabel?.trim()
    || (kind === 'runtime' ? 'OBS Browser Source (3000)' : kind === 'dev' ? `Direct Overlay Browser${port ? ` (${port})` : ''}` : `Overlay${port ? ` (${port})` : ''}`)

  return { socketId: socket.id, kind, port, label, mounted: false, cursorReady: false, widgetRegistryReady: false, ready: false, readyAt: null, lastHeartbeatAt: null, cameraPermission: 'unknown' }
}

export function registerDiagnosticsHandlers(ctx: HandlerContext, socket: AppSocket): void {
  socket.on('overlay:runtime:status', (payload: OverlayRuntimeStatusPayload) => {
    if (socket.id !== ctx.overlaySocketId || !ctx.overlayClientInfo) return
    ctx.overlayClientInfo = {
      ...ctx.overlayClientInfo,
      mounted: payload.mounted,
      cursorReady: payload.cursorReady,
      widgetRegistryReady: payload.widgetRegistryReady,
      ready: payload.ready,
      readyAt: payload.ready ? ctx.overlayClientInfo.readyAt ?? Date.now() : null,
      cameraPermission: payload.cameraPermission,
    }
    ctx.ambianceManager.setLeaderLeaseState({
      ready: payload.ready,
      leaseDurationMs: 0,
      expiresAt: null,
      lastHeartbeatAt: null,
    })
    queueRuntimeDiagnosticsEmit(ctx)
  })
}
