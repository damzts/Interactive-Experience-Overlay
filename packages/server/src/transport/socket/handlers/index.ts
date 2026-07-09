/**
 * Socket.IO handler orchestrator.
 *
 * Each domain module registers its own event listeners.
 * Shared mutable state is passed via HandlerContext.
 */
import logger from '../../../lib/logger.js'
import {
  DEFAULT_CONFIG,
  type AppConfig,
  type ObsStatusPayload,
} from '@ieomlabs/shared'
import type { IO, HandlerContext, AppSocket } from './types.js'
import type { SceneManager } from '../../../kernel/managers/scene.js'
import type { EventScheduler } from '../../../kernel/managers/scheduler.js'
import type { AmbianceManager } from '../../../kernel/managers/ambiance.js'

import { registerMachineListeners, registerSceneHandlers } from './scene.js'
import { registerWidgetHandlers } from './widget.js'
import { registerAmbianceHandlers } from './ambiance.js'
import { registerAudioHandlers } from './audio.js'
import { registerDesktopHandlers, getDesktopRuntimeState } from './desktop.js'
import { registerConfigHandlers } from './config.js'
import { registerPersonaHandlers } from './persona.js'
import { registerDiagnosticsHandlers, queueRuntimeDiagnosticsEmit } from './diagnostics.js'
import { registerKernelSignalBridge, makeKernelSignalFrame } from './kernelSignal.js'

export function setupSocketHandlers(
  io: IO,
  machine: SceneManager,
  scheduler: EventScheduler,
  ambianceManager: AmbianceManager,
  options?: {
    getObsStatus?: () => ObsStatusPayload
    getManagerStatuses?: () => Record<string, import('@ieomlabs/shared').ManagerStatus>
    getTwitchStatus?: () => { ircConnected: boolean; channel: string; eventSubConnected: boolean }
    bus?: import('../../../kernel/bus.js').KernelBus
    runtimeState?: import('../../../kernel/managers/runtime.js').RuntimeStateStore
    configService?: import('../../../kernel/managers/config.js').IConfigService
    obsBridge?: import('../../../kernel/managers/obs.js').ObsBridgeManager
    personaBrain?: HandlerContext['personaBrain']
  },
): { isOverlaySlotTaken: () => boolean } {
  const ctx: HandlerContext = {
    io,
    machine,
    scheduler,
    ambianceManager,
    runtimeState: options?.runtimeState ?? (() => { throw new Error('[kernel] runtimeState required') })(),
    configService: options?.configService ?? null,
    getObsStatus: options?.getObsStatus,
    getManagerStatuses: options?.getManagerStatuses,
    bus: options?.bus ?? (() => { throw new Error('[kernel] bus required') })(),
    obsBridge: options?.obsBridge,
    personaBrain: options?.personaBrain,

    runtimeConfig: {},
    cachedUserConfig: DEFAULT_CONFIG as unknown as AppConfig,

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
  ambianceManager.setSimulationLeaderGetter(() => ctx.runtimeState.overlaySocketId)

  scheduler.setDiagnosticsListener(() => queueRuntimeDiagnosticsEmit(ctx))
  ambianceManager.setDiagnosticsListener(() => queueRuntimeDiagnosticsEmit(ctx))

  registerMachineListeners(ctx)
  registerKernelSignalBridge(ctx)

  const getSocketClientType = (socket: AppSocket): 'overlay' | 'admin' | 'unknown' => {
    const auth = socket.handshake.auth as { clientType?: string } | undefined
    return auth?.clientType === 'overlay' || auth?.clientType === 'admin' ? auth.clientType : 'unknown'
  }

  io.on('connection', (socket: AppSocket) => {
    const clientType = getSocketClientType(socket)
    ctx.socketClientTypes.set(socket.id, clientType)
    logger.info(`[socket] connected: ${socket.id} (${clientType})`)

    if (clientType === 'overlay') {
      const currentOverlayId = ctx.runtimeState.overlaySocketId
      if (currentOverlayId && io.sockets.sockets.has(currentOverlayId)) {
        socket.emit('overlay:rejected', { reason: 'View is already opened, close that before opening new one' })
        setTimeout(() => socket.disconnect(true), 1000)
        return
      }
      ctx.runtimeState.setOverlaySocketId(socket.id)
      ambianceManager.setOverlayReady(false)
      ambianceManager.recordHistory('leader-elected', 'overlay connected', { leaderSocketId: socket.id })
      ctx.bus.emit('overlay:connected', { socketId: socket.id })
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
    socket.emit('overlay:owner', { socketId: ctx.runtimeState.overlaySocketId })
    socket.emit('runtime:config', ctx.runtimeConfig)
    socket.emit('runtime:diagnostics', {
      scheduler: scheduler.getDiagnostics(),
      ambiance: ambianceManager.getDiagnostics(),
      managers: options?.getManagerStatuses?.(),
    })
    if (options?.getObsStatus) {
      socket.emit('obs:status', options.getObsStatus())
    }
    if (options?.getTwitchStatus) {
      const ts = options.getTwitchStatus()
      if (ts.ircConnected) socket.emit('kernel:signal', makeKernelSignalFrame('chat:connected', { channel: ts.channel }))
      if (ts.eventSubConnected) socket.emit('kernel:signal', makeKernelSignalFrame('twitch:eventsub:connected', { sessionId: '' }))
    }

    socket.on('overlay:sync', (callback) => {
      callback({
        state: ctx.machine.currentState,
        desktop: getDesktopRuntimeState(ctx),
        config: ctx.cachedUserConfig,
      })
    })

    registerSceneHandlers(ctx, socket)
    registerWidgetHandlers(ctx, socket)
    registerAmbianceHandlers(ctx, socket)
    registerAudioHandlers(ctx, socket)
    registerDesktopHandlers(ctx, socket)
    registerConfigHandlers(ctx, socket)
    registerPersonaHandlers(ctx, socket)
    registerDiagnosticsHandlers(ctx, socket)


    socket.on('disconnect', () => {
      logger.info(`[socket] disconnected: ${socket.id}`)
      ctx.socketClientTypes.delete(socket.id)
      if (socket.id === ctx.runtimeState.overlaySocketId) {
        ctx.runtimeState.setOverlaySocketId(null)
        ctx.runtimeState.resetSimulationMetrics()
        ambianceManager.markSimulationCompleted(undefined, undefined, { recordHistory: false })
        ambianceManager.setOverlayReady(false)
        ambianceManager.recordHistory('leader-cleared', 'overlay disconnected', {})
        ctx.bus.emit('overlay:disconnected', {})
        io.emit('overlay:owner', { socketId: null })
        queueRuntimeDiagnosticsEmit(ctx)
      }
    })
  })

  return { isOverlaySlotTaken: () => ctx.runtimeState.overlaySocketId !== null && io.sockets.sockets.has(ctx.runtimeState.overlaySocketId) }
}