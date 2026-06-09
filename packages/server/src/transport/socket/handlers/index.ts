/**
 * Socket.IO handler orchestrator.
 *
 * Each domain module registers its own event listeners.
 * Shared mutable state is passed via HandlerContext.
 */
import logger from '../../../lib/logger.js'
import {
  DEFAULT_CONFIG,
  withDesktopConfigDefaults,
  type AppConfig,
  type ObsStatusPayload,
} from '@ieomlabs/shared'
import type { IO, HandlerContext, AppSocket } from './types.js'
import type { SceneMachine } from '../../../kernel/managers/scene.js'
import type { EventScheduler } from '../../../kernel/managers/scheduler.js'
import type { AmbianceManager } from '../../../kernel/managers/ambiance.js'

import { registerMachineListeners, registerSceneHandlers } from './scene.js'
import { registerWidgetHandlers } from './widget.js'
import { registerAmbianceHandlers } from './ambiance.js'
import { registerDesktopHandlers } from './desktop.js'
import { registerConfigHandlers } from './config.js'
import { registerDiagnosticsHandlers, queueRuntimeDiagnosticsEmit } from './diagnostics.js'

export function setupSocketHandlers(
  io: IO,
  machine: SceneMachine,
  scheduler: EventScheduler,
  ambianceManager: AmbianceManager,
  options?: {
    getObsStatus?: () => ObsStatusPayload
    getManagerStatuses?: () => Record<string, import('@ieomlabs/shared').ManagerStatus>
    bus?: import('../../../kernel/bus.js').KernelBus
    runtimeState?: import('../../../kernel/managers/runtime.js').RuntimeStateStore
    configService?: any
  },
): { isOverlaySlotTaken: () => boolean } {
  if (options?.runtimeState) {
    const defaultFull = withDesktopConfigDefaults(DEFAULT_CONFIG.desktopConfig).recycleBin.fullOnStart
    options.runtimeState.setRecycleBinFull(defaultFull)
  }

  const ctx: HandlerContext = {
    io,
    machine,
    scheduler,
    ambianceManager,
    runtimeState: options?.runtimeState ?? (() => { throw new Error('[kernel] runtimeState required') })(),
    configService: options?.configService ?? null,
    getObsStatus: options?.getObsStatus,
    getManagerStatuses: options?.getManagerStatuses,
    bus: options?.bus,

    runtimeConfigOverride: {},
    cachedUserConfig: DEFAULT_CONFIG as unknown as AppConfig,

    overlaySocketId: null,
    socketClientTypes: new Map(),
  }

  if (options?.configService) {
    let _cachedUserConfig: AppConfig = DEFAULT_CONFIG as unknown as AppConfig
    Object.defineProperty(ctx, 'cachedUserConfig', {
      get: () => options.configService!.cachedConfig ?? _cachedUserConfig,
      set: (v: AppConfig) => { _cachedUserConfig = v },
      enumerable: true, configurable: true,
    })
  }

  // Ambiance manager reads open widget state and the overlay socket ID for dispatch
  ambianceManager.setOpenWidgetIdsGetter(() => ctx.runtimeState.openWidgetIds as Set<string>)
  ambianceManager.setSimulationLeaderGetter(() => ctx.overlaySocketId)

  scheduler.setDiagnosticsListener(() => queueRuntimeDiagnosticsEmit(ctx))
  ambianceManager.setDiagnosticsListener(() => queueRuntimeDiagnosticsEmit(ctx))

  registerMachineListeners(ctx)

  // Forward custom:* bus events to all connected overlay/admin clients
  if (options?.bus) {
    const rawEmitter = (options.bus as any).emitter as import('events').EventEmitter | undefined
    rawEmitter?.on('newListener', (event: string) => {
      // no-op — just ensures listener count doesn't silently overflow
    })
    // Subscribe to all custom:* events via wildcard-style listener on the EventEmitter
    // We monkey-patch emit to intercept 'custom:*' events and forward them
    const origEmit = (options.bus as any).emitter.emit.bind((options.bus as any).emitter)
    ;(options.bus as any).emitter.emit = function (event: string, payload: unknown) {
      const result = origEmit(event, payload)
      if (typeof event === 'string' && event.startsWith('custom:')) {
        io.emit('bus:custom', { event: event.slice(7), payload })
      }
      return result
    }
  }

  const getSocketClientType = (socket: AppSocket): 'overlay' | 'admin' | 'unknown' => {
    const auth = socket.handshake.auth as { clientType?: string } | undefined
    return auth?.clientType === 'overlay' || auth?.clientType === 'admin' ? auth.clientType : 'unknown'
  }

  io.on('connection', (socket: AppSocket) => {
    const clientType = getSocketClientType(socket)
    ctx.socketClientTypes.set(socket.id, clientType)
    logger.info(`[socket] connected: ${socket.id} (${clientType})`)

    if (clientType === 'overlay') {
      if (ctx.overlaySocketId && io.sockets.sockets.has(ctx.overlaySocketId)) {
        socket.emit('overlay:rejected', { reason: 'View is already opened, close that before opening new one' })
        setTimeout(() => socket.disconnect(true), 1000)
        return
      }
      ctx.overlaySocketId = socket.id
      ambianceManager.setOverlayReady(false)
      ambianceManager.recordHistory('leader-elected', 'overlay connected', { leaderSocketId: socket.id })
      io.emit('overlay:owner', { socketId: socket.id })
      queueRuntimeDiagnosticsEmit(ctx)
    }

    const userId = socket.data.userId
    if (userId) {
      void socket.join(`user:${userId}`)
      if (ctx.configService) {
        void ctx.configService.getForUser(userId).then((config: AppConfig) => { ctx.cachedUserConfig = config })
      }
    }

    socket.emit('ambiance:metrics', { accepted: ctx.runtimeState.acceptedSimulatedToggles, rejected: ctx.runtimeState.rejectedSimulatedToggles })
    socket.emit('overlay:owner', { socketId: ctx.overlaySocketId })
    socket.emit('runtime:config:override', ctx.runtimeConfigOverride)
    socket.emit('runtime:diagnostics', {
      scheduler: scheduler.getDiagnostics(),
      ambiance: ambianceManager.getDiagnostics(),
      managers: options?.getManagerStatuses?.(),
    })
    if (options?.getObsStatus) {
      socket.emit('obs:status', options.getObsStatus())
    }

    registerSceneHandlers(ctx, socket)
    registerWidgetHandlers(ctx, socket)
    registerAmbianceHandlers(ctx, socket)
    registerDesktopHandlers(ctx, socket)
    registerConfigHandlers(ctx, socket)
    registerDiagnosticsHandlers(ctx, socket)

    socket.on('disconnect', () => {
      logger.info(`[socket] disconnected: ${socket.id}`)
      ctx.socketClientTypes.delete(socket.id)
      if (socket.id === ctx.overlaySocketId) {
        ctx.overlaySocketId = null
        ctx.runtimeState.resetSimulationMetrics()
        ambianceManager.markSimulationCompleted(undefined, undefined, { recordHistory: false })
        ambianceManager.setOverlayReady(false)
        ambianceManager.recordHistory('leader-cleared', 'overlay disconnected', {})
        io.emit('overlay:owner', { socketId: null })
        queueRuntimeDiagnosticsEmit(ctx)
      }
    })
  })

  return { isOverlaySlotTaken: () => ctx.overlaySocketId !== null && io.sockets.sockets.has(ctx.overlaySocketId) }
}