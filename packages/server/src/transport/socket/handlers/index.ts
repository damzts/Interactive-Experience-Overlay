/**
 * Socket.IO handler orchestrator.
 *
 * Replaces the monolithic handlers.ts. Each domain module registers its own
 * event listeners. Shared mutable state is passed via HandlerContext.
 */
import {
  DEFAULT_CONFIG,
  withDesktopConfigDefaults,
  type AppConfig,
  type ObsStatusPayload,
} from '@ieom/shared'
import type { IO, HandlerContext, AppSocket } from './types.js'
import type { SceneMachine } from '../../kernel/managers/scene.js'
import type { EventScheduler } from '../../kernel/managers/scheduler.js'
import type { AmbianceManager } from '../../kernel/managers/ambiance.js'

import { registerMachineListeners, registerSceneHandlers } from './scene.js'
import { registerWidgetHandlers } from './widget.js'
import { registerAmbianceHandlers, assignOverlayLeader, clearOverlayLeader } from './ambiance.js'
import { registerDesktopHandlers } from './desktop.js'
import { registerConfigHandlers } from './config.js'
import { registerDiagnosticsHandlers, buildOverlayClientInfo, queueRuntimeDiagnosticsEmit, emitRuntimeDiagnostics } from './diagnostics.js'

export function setupSocketHandlers(
  io: IO,
  machine: SceneMachine,
  scheduler: EventScheduler,
  ambianceManager: AmbianceManager,
  options?: {
    getObsStatus?: () => ObsStatusPayload
    getManagerStatuses?: () => Record<string, import('@ieom/shared').ManagerStatus>
    povOrchestrator?: any
    onlineSessionManager?: any
    onlineSignalingServer?: any
    configService?: any
  },
): { isOverlaySlotTaken: () => boolean } {
  const ctx: HandlerContext = {
    io,
    machine,
    scheduler,
    ambianceManager,
    configService: options?.configService ?? null,
    getObsStatus: options?.getObsStatus,
    getManagerStatuses: options?.getManagerStatuses,

    openWidgetIds: new Set(),
    recycleBinFull: withDesktopConfigDefaults(DEFAULT_CONFIG.desktopConfig).recycleBin.fullOnStart,
    startMenuState: { open: false, activeRoot: null },
    runtimeConfigOverride: {},
    cachedUserConfig: DEFAULT_CONFIG as unknown as AppConfig,

    overlaySocketId: null,
    overlayClientInfo: null,
    socketClientTypes: new Map(),

    simulationLeaderSocketId: null,
    acceptedSimulatedToggles: 0,
    rejectedSimulatedToggles: 0,
  }

  // Keep cachedUserConfig always in sync with the service's in-memory cache.
  // This ensures socket handlers (applySavedWidgetLayout, executeConfiguredEvent, etc.)
  // always see the latest persisted state without needing explicit refresh calls.
  if (options?.configService) {
    let _cachedUserConfig: AppConfig = DEFAULT_CONFIG as unknown as AppConfig
    Object.defineProperty(ctx, 'cachedUserConfig', {
      get: () => options.configService!.cachedConfig ?? _cachedUserConfig,
      set: (v: AppConfig) => { _cachedUserConfig = v },
      enumerable: true, configurable: true,
    })
  }

  // Give ambiance manager live access to runtime state
  ambianceManager.setOpenWidgetIdsGetter(() => ctx.openWidgetIds)
  ambianceManager.setSimulationLeaderGetter(() => ctx.simulationLeaderSocketId)

  // Wire scheduler/ambiance → diagnostics broadcast
  scheduler.setDiagnosticsListener(() => queueRuntimeDiagnosticsEmit(ctx))
  ambianceManager.setDiagnosticsListener(() => queueRuntimeDiagnosticsEmit(ctx))

  // Wire machine → socket.io broadcast
  registerMachineListeners(ctx)

  const getSocketClientType = (socket: AppSocket): 'overlay' | 'admin' | 'unknown' => {
    const auth = socket.handshake.auth as { clientType?: string } | undefined
    return auth?.clientType === 'overlay' || auth?.clientType === 'admin' ? auth.clientType : 'unknown'
  }

  io.on('connection', (socket: AppSocket) => {
    const clientType = getSocketClientType(socket)
    ctx.socketClientTypes.set(socket.id, clientType)
    console.log(`[socket] connected: ${socket.id} (${clientType})`)

    // Single overlay gate
    if (clientType === 'overlay') {
      if (ctx.overlaySocketId && io.sockets.sockets.has(ctx.overlaySocketId)) {
        console.log(`[socket] rejected overlay ${socket.id} — slot taken by ${ctx.overlaySocketId}`)
        socket.emit('overlay:rejected', { reason: 'View is already opened, close that before opening new one' })
        setTimeout(() => socket.disconnect(true), 1000)
        return
      }
      ctx.overlaySocketId = socket.id
      ctx.overlayClientInfo = buildOverlayClientInfo(socket)
      assignOverlayLeader(ctx, socket.id)
      io.emit('overlay:owner', { socketId: socket.id })
      queueRuntimeDiagnosticsEmit(ctx)
    }

    // Load user config into cache
    const userId = socket.data.userId
    if (userId) {
      void socket.join(`user:${userId}`)
      if (ctx.configService) {
        void ctx.configService.getForUser(userId).then((config: AppConfig) => { ctx.cachedUserConfig = config })
      }
    }

    // Push initial state to the newly connected client
    socket.emit('ambiance:leader', { socketId: ctx.simulationLeaderSocketId })
    socket.emit('ambiance:metrics', { accepted: ctx.acceptedSimulatedToggles, rejected: ctx.rejectedSimulatedToggles })
    socket.emit('overlay:owner', { socketId: ctx.overlaySocketId })
    socket.emit('runtime:config:override', ctx.runtimeConfigOverride)
    socket.emit('runtime:diagnostics', {
      scheduler: scheduler.getDiagnostics(),
      ambiance: ambianceManager.getDiagnostics(),
    })
    if (options?.getObsStatus) {
      socket.emit('obs:status', options.getObsStatus())
    }

    // Register domain handlers
    registerSceneHandlers(ctx, socket)
    registerWidgetHandlers(ctx, socket)
    registerAmbianceHandlers(ctx, socket)
    registerDesktopHandlers(ctx, socket)
    registerConfigHandlers(ctx, socket)
    registerDiagnosticsHandlers(ctx, socket)

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`)
      ctx.socketClientTypes.delete(socket.id)
      if (socket.id === ctx.overlaySocketId) {
        ctx.overlaySocketId = null
        ctx.overlayClientInfo = null
        clearOverlayLeader(ctx)
        io.emit('overlay:owner', { socketId: null })
        queueRuntimeDiagnosticsEmit(ctx)
      }
    })
  })

  return { isOverlaySlotTaken: () => ctx.overlaySocketId !== null && io.sockets.sockets.has(ctx.overlaySocketId) }
}

