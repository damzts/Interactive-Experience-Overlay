import type { Server, Socket } from 'socket.io'
import {
  STATE,
  withDesktopAmbianceDefaults,
  withDesktopConfigDefaults,
  type TransitionStep,
  type TransitionPlayPayload,
  type DesktopNotificationPayload,
  type DesktopRuntimeStatePayload,
  type DesktopRecycleBinPayload,
  type DesktopScreenSaverPreviewPayload,
  type DesktopStartMenuSimulationPhasePayload,
  type AmbianceSimulationAcceptedPayload,
  type AmbianceSimulationDonePayload,
  type OverlayClientDiagnostics,
  type OverlayClientKind,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type InterServerEvents,
  type SocketData,
  type KeybindExecutionPayload,
  type OverlayTriggerPayload,
  type WidgetSimulationCommandPayload,
} from '@ieom/shared'
import type { AppConfig } from '@ieom/shared'
import type { SceneMachine, TransitionStartPayload } from '../state/machine.js'
import type { EventScheduler } from '../events/scheduler.js'
import type { AmbianceManager } from '../ambiance/manager.js'
import { getConfig, persistConfig } from '../routes/config.js'

type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

/** Coerce a legacy single-string transition into a one-step array.
 *  Returns undefined (not []) when nothing is configured so callers can
 *  distinguish "explicitly empty" from "unset". */
function stepFromString(s: string | undefined): TransitionStep[] | undefined {
  if (!s || s === 'none') return undefined
  // Parse optional ?duration=N suffix
  const qi  = s.indexOf('?')
  const id  = qi >= 0 ? s.slice(0, qi) : s
  const dur = qi >= 0 ? new URLSearchParams(s.slice(qi + 1)).get('duration') : null
  return [{ id, ...(dur ? { duration: parseFloat(dur) } : {}) }]
}

function isNavigableState(value: string): value is STATE {
  return value === STATE.LOBBY || value === STATE.DESKTOP
}

function normalizeActionId(value: string) {
  return value.toLowerCase().replace(/[_\s]+/g, '-')
}

/** Resolve exit + intro TransitionStep[] for a scene:change.
 *  Precedence: app-level arrays → app-level legacy strings → scene-level arrays → scene-level legacy strings */
function resolvePipelines(
  cfg: AppConfig,
  fromState: STATE,
  toState: STATE,
): { exit: TransitionStep[]; intro: TransitionStep[] } {
  let exit:  TransitionStep[] | undefined
  let intro: TransitionStep[] | undefined

  // App-level (highest priority)
  for (const app of cfg.applications) {
    if (app.targetSceneId === toState && intro === undefined) {
      intro = app.introTransitions?.length
        ? app.introTransitions
        : stepFromString(app.introTransition)
    }
    if (app.targetSceneId === fromState && exit === undefined) {
      exit = app.exitTransitions?.length
        ? app.exitTransitions
        : stepFromString(app.exitTransition)
    }
  }

  // Scene-level fallback
  if (!intro) {
    const targetScene = cfg.scenes[toState]
    intro = targetScene?.introTransitions?.length
      ? targetScene.introTransitions
      : stepFromString(targetScene?.introTransition)
  }
  if (!exit) {
    const fromScene = cfg.scenes[fromState]
    exit = fromScene?.exitTransitions?.length
      ? fromScene.exitTransitions
      : stepFromString(fromScene?.exitTransition)
  }

  return { exit: exit ?? [], intro: intro ?? [] }
}

export function setupSocketHandlers(
  io: IO,
  machine: SceneMachine,
  scheduler: EventScheduler,
  ambianceManager: AmbianceManager,
  options?: {
    getObsStatus?: () => import('@ieom/shared').ObsStatusPayload
  },
) {
  const openWidgetIds = new Set<string>()
  const socketClientTypes = new Map<string, 'overlay' | 'admin' | 'unknown'>()
  const overlayClientDiagnostics = new Map<string, OverlayClientDiagnostics>()
  let recycleBinFull = withDesktopConfigDefaults(getConfig().desktopConfig).recycleBin.fullOnStart
  let startMenuState: { open: boolean; activeRoot: 'programs' | 'widget-layouts' | null } = { open: false, activeRoot: null }
  let simulationLeaderSocketId: string | null = null
  let acceptedSimulatedToggles = 0
  let rejectedSimulatedToggles = 0
  let runtimeDiagnosticsQueued = false

  // Give managers access to live widget state
  ambianceManager.setOpenWidgetIdsGetter(() => openWidgetIds)
  ambianceManager.setSimulationLeaderGetter(() => simulationLeaderSocketId)
  ambianceManager.setOverlayClientDiagnosticsGetter(() => [...overlayClientDiagnostics.values()])

  const getDesktopRuntimeState = (): DesktopRuntimeStatePayload => ({
    openWidgetIds: [...openWidgetIds],
    recycleBinFull,
    startMenuState,
  })

  const toggleWidgetRuntime = (widgetId: string) => {
    if (openWidgetIds.has(widgetId)) openWidgetIds.delete(widgetId)
    else openWidgetIds.add(widgetId)
    io.emit('widget:toggle', widgetId)
    queueRuntimeDiagnosticsEmit()
  }

  const setWidgetRuntimeOpenState = (widgetId: string, shouldOpen: boolean) => {
    const isOpen = openWidgetIds.has(widgetId)
    if (shouldOpen === isOpen) return
    if (shouldOpen) openWidgetIds.add(widgetId)
    else openWidgetIds.delete(widgetId)
    io.emit('widget:toggle', widgetId)
    queueRuntimeDiagnosticsEmit()
  }

  const emitSimulationLeader = () => {
    io.emit('ambiance:leader', { socketId: simulationLeaderSocketId })
  }

  const emitSimulationMetrics = () => {
    io.emit('ambiance:metrics', {
      accepted: acceptedSimulatedToggles,
      rejected: rejectedSimulatedToggles,
    })
  }

  const emitRuntimeDiagnostics = () => {
    runtimeDiagnosticsQueued = false
    io.emit('runtime:diagnostics', {
      scheduler: scheduler.getDiagnostics(),
      ambiance: ambianceManager.getDiagnostics(),
    })
  }

  const queueRuntimeDiagnosticsEmit = () => {
    if (runtimeDiagnosticsQueued) return
    runtimeDiagnosticsQueued = true
    queueMicrotask(() => {
      emitRuntimeDiagnostics()
    })
  }

  scheduler.setDiagnosticsListener(() => {
    queueRuntimeDiagnosticsEmit()
  })
  ambianceManager.setDiagnosticsListener(() => {
    queueRuntimeDiagnosticsEmit()
  })

  const getSocketClientType = (socket: AppSocket): 'overlay' | 'admin' | 'unknown' => {
    const auth = socket.handshake.auth as { clientType?: string } | undefined
    return auth?.clientType === 'overlay' || auth?.clientType === 'admin'
      ? auth.clientType
      : 'unknown'
  }

  const getOverlayClientDiagnosticsFromSocket = (socket: AppSocket): OverlayClientDiagnostics | null => {
    const auth = socket.handshake.auth as {
      overlayKind?: string
      overlayPort?: string
      overlayLabel?: string
    } | undefined

    const kind: OverlayClientKind = auth?.overlayKind === 'runtime'
      || auth?.overlayKind === 'embedded-preview'
      || auth?.overlayKind === 'dev'
      ? auth.overlayKind
      : 'unknown'

    if (socketClientTypes.get(socket.id) !== 'overlay') {
      return null
    }

    const port = auth?.overlayPort?.trim() ? auth.overlayPort.trim() : null
    const label = auth?.overlayLabel?.trim()
      || (kind === 'runtime'
        ? 'OBS Browser Source (3000)'
        : kind === 'embedded-preview'
          ? `Admin Preview${port ? ` (${port})` : ''}`
          : kind === 'dev'
            ? `Direct Overlay Browser${port ? ` (${port})` : ''}`
            : `Overlay${port ? ` (${port})` : ''}`)

    return {
      socketId: socket.id,
      kind,
      port,
      label,
    }
  }

  const getOverlayLeaderRank = (client: OverlayClientDiagnostics | undefined) => {
    if (!client) return -1
    if (client.kind === 'runtime') return 3
    if (client.kind === 'embedded-preview') return 2
    if (client.kind === 'dev') return 1
    return 0
  }

  const isAmbianceLeaderEnabled = () => withDesktopAmbianceDefaults(getConfig().desktopAmbiance).widgetSimulation.enabled

  const clearSimulationLeader = () => {
    if (!simulationLeaderSocketId) return
    ambianceManager.markSimulationCompleted()
    simulationLeaderSocketId = null
    emitSimulationLeader()
    queueRuntimeDiagnosticsEmit()
  }

  const syncSimulationLeaderState = () => {
    if (!isAmbianceLeaderEnabled()) {
      clearSimulationLeader()
      return
    }
    electSimulationLeaderIfNeeded()
  }

  const electSimulationLeaderIfNeeded = () => {
    if (!isAmbianceLeaderEnabled()) {
      clearSimulationLeader()
      return
    }
    if (
      simulationLeaderSocketId
      && io.sockets.sockets.has(simulationLeaderSocketId)
      && socketClientTypes.get(simulationLeaderSocketId) === 'overlay'
    ) {
      return
    }
    const nextLeader = [...overlayClientDiagnostics.values()]
      .sort((left, right) => getOverlayLeaderRank(right) - getOverlayLeaderRank(left))[0]
    simulationLeaderSocketId = nextLeader?.socketId ?? null
    emitSimulationLeader()
    queueRuntimeDiagnosticsEmit()
  }

  const triggerConfiguredEvent = (eventId: string): { ok: boolean; error?: string } => {
    const normalized = normalizeActionId(eventId)
    const eventDef = (getConfig().events ?? []).find((entry) => normalizeActionId(entry.id) === normalized)
    if (!eventDef) {
      return { ok: false, error: `Unknown event: ${eventId}` }
    }
    machine.triggerOverlay({ id: eventDef.id, effects: eventDef.effects })
    return { ok: true }
  }

  const runConfiguredAction = (action: string): { ok: boolean; error?: string } => {
    if (!action) return { ok: false, error: 'No action provided' }

    if (action === 'panic') {
      machine.forceState(STATE.DESKTOP)
      return { ok: true }
    }

    if (action.startsWith('scene:')) {
      const target = action.slice(6).trim()
      if (!isNavigableState(target)) {
        return { ok: false, error: `Unknown scene target: ${target}` }
      }
      const cfg = getConfig()
      const { exit, intro } = resolvePipelines(cfg, machine.currentState, target)
      return machine.transition(target, { exit, intro })
    }

    if (action.startsWith('widget:')) {
      const widgetId = action.slice(7).trim()
      if (!widgetId) return { ok: false, error: 'Missing widget id' }
      toggleWidgetRuntime(widgetId)
      return { ok: true }
    }

    if (action.startsWith('event:')) {
      return triggerConfiguredEvent(action.slice(6))
    }

    if (action.startsWith('overlay:')) {
      return triggerConfiguredEvent(action.slice(8))
    }

    return { ok: false, error: `Unsupported action: ${action}` }
  }

  const applySavedWidgetLayout = (layoutId: string): { ok: boolean; error?: string } => {
    const currentConfig = getConfig()
    const currentDesktop = withDesktopConfigDefaults(currentConfig.desktopConfig)
    const layout = (currentDesktop.widgetLayouts ?? []).find((entry) => entry.id === layoutId)
    if (!layout) {
      return { ok: false, error: `Unknown widget layout: ${layoutId}` }
    }

    const validWidgetIds = new Set(
      currentConfig.applications
        .filter((app) => app.appType === 'widget')
        .map((app) => app.id),
    )
    const layoutItems = layout.items.filter((item) => validWidgetIds.has(item.widgetId))
    if (layoutItems.length === 0) {
      return { ok: false, error: `Widget layout has no valid widgets: ${layoutId}` }
    }

    const nextPositions = { ...(currentDesktop.widgetPositions ?? {}) }
    const nextSizes = { ...(currentDesktop.widgetSizes ?? {}) }
    const nextRuntimeZIndices = { ...(currentDesktop.widgetZIndices ?? {}) }
    const defaultZIndices = currentDesktop.widgetDefaultZIndices ?? {}

    for (const item of layoutItems) {
      nextPositions[item.widgetId] = { x: item.x, y: item.y }
      nextSizes[item.widgetId] = { width: item.width, height: item.height }
    }

    const orderedEnabledItems = [...layoutItems]
      .filter((item) => item.enabled)
      .sort((a, b) => {
        if (a.focusPriority !== b.focusPriority) return a.focusPriority - b.focusPriority
        return (defaultZIndices[a.widgetId] ?? 0) - (defaultZIndices[b.widgetId] ?? 0)
      })

    for (const [index, item] of orderedEnabledItems.entries()) {
      nextRuntimeZIndices[item.widgetId] = index
    }

    persistConfig({
      ...currentConfig,
      desktopConfig: withDesktopConfigDefaults({
        ...currentDesktop,
        widgetPositions: nextPositions,
        widgetSizes: nextSizes,
        widgetZIndices: nextRuntimeZIndices,
      }),
    }, machine)

    for (const item of layoutItems) {
      const isOpen = openWidgetIds.has(item.widgetId)
      if (item.enabled !== isOpen) {
        toggleWidgetRuntime(item.widgetId)
      }
    }

    io.emit('widget:layout:apply', layoutId)
    return { ok: true }
  }

  const resolveKeybindAction = (payload: KeybindExecutionPayload) => {
    const inlineAction = payload.action?.trim()
    if (inlineAction) return inlineAction
    const key = payload.key?.trim()
    if (!key) return undefined
    return getConfig().keybinds[payload.scope]?.[key]
  }

  // Broadcast machine state events to all clients
  machine.on('state:change', (payload: { state: STATE; previousState: STATE }) => {
    io.emit('state:update', payload)
  })

  machine.on('config:patch', (updates: Partial<AppConfig>, _config: AppConfig) => {
    io.emit('config:patch', updates)
  })

  machine.on('config:update', (config: AppConfig) => {
    const nextRecycleBinFull = withDesktopConfigDefaults(config.desktopConfig).recycleBin.fullOnStart
    if (nextRecycleBinFull !== recycleBinFull) {
      recycleBinFull = nextRecycleBinFull
      io.emit('desktop:recycle-bin', { full: recycleBinFull })
    }

    syncSimulationLeaderState()
  })

  machine.on('transition:start', (payload: TransitionStartPayload) => {
    const out: TransitionPlayPayload = {
      from: payload.from,
      to:   payload.to,
      exit: payload.exit,
      intro: payload.intro,
    }
    io.emit('transition:play', out)
  })

  machine.on('overlay:trigger', (payload: OverlayTriggerPayload) => {
    io.emit('overlay:show', payload)
  })

  io.on('connection', (socket: AppSocket) => {
    const clientType = getSocketClientType(socket)
    socketClientTypes.set(socket.id, clientType)
    const overlayInfo = clientType === 'overlay' ? getOverlayClientDiagnosticsFromSocket(socket) : null
    if (overlayInfo) {
      overlayClientDiagnostics.set(socket.id, overlayInfo)
      queueRuntimeDiagnosticsEmit()
    }
    console.log(`[socket] connected: ${socket.id}`)

    const currentLeaderInfo = simulationLeaderSocketId ? overlayClientDiagnostics.get(simulationLeaderSocketId) : undefined
    const shouldPromoteOverlayLeader = clientType === 'overlay'
      && getOverlayLeaderRank(overlayInfo ?? undefined) > getOverlayLeaderRank(currentLeaderInfo)
    if (clientType === 'overlay' && isAmbianceLeaderEnabled() && (!simulationLeaderSocketId || shouldPromoteOverlayLeader)) {
      simulationLeaderSocketId = socket.id
      emitSimulationLeader()
      queueRuntimeDiagnosticsEmit()
    } else {
      socket.emit('ambiance:leader', { socketId: simulationLeaderSocketId })
    }
    socket.emit('ambiance:metrics', {
      accepted: acceptedSimulatedToggles,
      rejected: rejectedSimulatedToggles,
    })
    socket.emit('runtime:diagnostics', {
      scheduler: scheduler.getDiagnostics(),
      ambiance: ambianceManager.getDiagnostics(),
    })
    if (options?.getObsStatus) {
      socket.emit('obs:status', options.getObsStatus())
    }

    socket.on('state:request', (callback) => {
      callback(machine.currentState)
    })

    socket.on('ambiance:leader:request', (callback) => {
      callback({ socketId: simulationLeaderSocketId })
    })

    socket.on('desktop:state:request', (callback) => {
      callback(getDesktopRuntimeState())
    })

    socket.on('widget:layout:apply', (layoutId) => {
      scheduler?.noteActivity()
      applySavedWidgetLayout(layoutId)
    })

    socket.on('desktop:icon:drag', (payload) => {
      scheduler?.noteActivity()
      socket.broadcast.emit('desktop:icon:drag', payload)
    })

    socket.on('desktop:widget:drag', (payload) => {
      if (payload.phase !== 'move') {
        scheduler?.noteActivity()
      }
      socket.broadcast.emit('desktop:widget:drag', payload)
    })

    socket.on('desktop:widget:resize', (payload) => {
      if (payload.phase !== 'move') {
        scheduler?.noteActivity()
      }
      socket.broadcast.emit('desktop:widget:resize', payload)
    })

    socket.on('scene:change', (target, callback) => {
      scheduler?.noteActivity()
      const cfg = getConfig()
      const { exit, intro } = resolvePipelines(cfg, machine.currentState, target)
      const result = machine.transition(target, { exit, intro })
      if (callback) callback(result.ok ? null : result.error ?? 'Unknown error')
    })

    socket.on('overlay:trigger', (payload: OverlayTriggerPayload) => {
      scheduler?.noteActivity()
      machine.triggerOverlay(payload)
    })

    socket.on('keybind:execute', (payload, callback) => {
      scheduler?.noteActivity()
      const action = resolveKeybindAction(payload)
      if (!action) {
        if (callback) callback(`No ${payload.scope} keybind action found`)
        return
      }
      const result = runConfiguredAction(action)
      if (callback) callback(result.ok ? null : result.error ?? 'Unknown error')
    })

    socket.on('panic', () => {
      scheduler?.noteActivity()
      machine.forceState(STATE.DESKTOP)
    })

    socket.on('widget:toggle', (widgetId: string) => {
      scheduler?.noteActivity()
      toggleWidgetRuntime(widgetId)
    })

    socket.on('widget:simulate', (widgetId: string) => {
      if (socket.id !== simulationLeaderSocketId) {
        rejectedSimulatedToggles += 1
        emitSimulationMetrics()
        console.warn(`[ambiance] Ignored simulated widget toggle from non-leader ${socket.id} for ${widgetId}`)
        return
      }
      acceptedSimulatedToggles += 1
      emitSimulationMetrics()
      toggleWidgetRuntime(widgetId)
    })

    socket.on('widget:simulate:action', (payload: WidgetSimulationCommandPayload) => {
      if (socket.id !== simulationLeaderSocketId) {
        rejectedSimulatedToggles += 1
        emitSimulationMetrics()
        console.warn(`[ambiance] Ignored simulated widget action from non-leader ${socket.id} for ${payload.widgetId}`)
        return
      }

      acceptedSimulatedToggles += 1
      emitSimulationMetrics()

      if (payload.action === 'toggle') {
        toggleWidgetRuntime(payload.widgetId)
        return
      }

      setWidgetRuntimeOpenState(payload.widgetId, payload.action === 'open')
    })

    socket.on('ambiance:simulate:accepted', (payload: AmbianceSimulationAcceptedPayload) => {
      if (socket.id !== simulationLeaderSocketId) {
        return
      }
      ambianceManager.markSimulationAccepted(payload.actionId)
    })

    socket.on('ambiance:simulate:done', (payload: AmbianceSimulationDonePayload) => {
      if (socket.id !== simulationLeaderSocketId) {
        return
      }
      ambianceManager.markSimulationCompleted(payload.actionId)
      if (!payload.ok) {
        console.warn(`[ambiance] Simulation reported failure for ${payload.widgetId} (${payload.action}, actionId=${payload.actionId})`)
      }
    })

    socket.on('cursor:mirror', (payload) => {
      if (socket.id !== simulationLeaderSocketId) {
        return
      }
      socket.broadcast.emit('cursor:mirror', payload)
    })

    socket.on('cursor:mirror:menu-timeline', (payload) => {
      if (socket.id !== simulationLeaderSocketId) {
        return
      }
      socket.broadcast.emit('cursor:mirror:menu-timeline', payload)
    })

    socket.on('desktop:notify', (payload: DesktopNotificationPayload) => {
      scheduler?.noteActivity()
      io.emit('desktop:notify', payload)
    })

    socket.on('desktop:recycle-bin', (payload: DesktopRecycleBinPayload) => {
      scheduler?.noteActivity()
      recycleBinFull = payload.full
      io.emit('desktop:recycle-bin', payload)
    })

    socket.on('desktop:start-menu:state', (payload) => {
      if (payload.open) {
        scheduler?.noteActivity()
      }
      startMenuState = {
        open: payload.open,
        activeRoot: payload.open ? payload.activeRoot : null,
      }
      io.emit('desktop:start-menu:state', startMenuState)
    })

    socket.on('desktop:start-menu:phase', (payload: DesktopStartMenuSimulationPhasePayload) => {
      if (socket.id !== simulationLeaderSocketId) {
        return
      }
      io.emit('desktop:start-menu:phase', payload)
    })

    socket.on('desktop:screen-saver:test', (payload: DesktopScreenSaverPreviewPayload) => {
      scheduler?.noteActivity()
      io.emit('desktop:screen-saver:test', payload)
    })

    socket.on('transition:preview', (steps: TransitionStep[]) => {
      scheduler?.noteActivity()
      // Dry-run: emit a transition:play with the same steps for both exit and intro
      // so the overlay plays them without a real scene change.
      const payload: TransitionPlayPayload = {
        from: machine.currentState,
        to:   machine.currentState,
        exit:  steps,
        intro: [],
      }
      io.emit('transition:play', payload)
    })

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`)
      socketClientTypes.delete(socket.id)
      overlayClientDiagnostics.delete(socket.id)
      if (socket.id === simulationLeaderSocketId) {
        ambianceManager.markSimulationCompleted()
        simulationLeaderSocketId = null
        syncSimulationLeaderState()
      } else {
        queueRuntimeDiagnosticsEmit()
      }
    })
  })
}
