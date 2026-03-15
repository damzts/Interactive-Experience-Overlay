import type { Server, Socket } from 'socket.io'
import {
  STATE,
  withDesktopConfigDefaults,
  type TransitionStep,
  type TransitionPlayPayload,
  type DesktopNotificationPayload,
  type DesktopRuntimeStatePayload,
  type DesktopRecycleBinPayload,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type InterServerEvents,
  type SocketData,
  type KeybindExecutionPayload,
  type OverlayTriggerPayload,
} from '@ieom/shared'
import type { AppConfig } from '@ieom/shared'
import type { SceneMachine, TransitionStartPayload } from '../state/machine.js'
import type { EventScheduler } from '../events/scheduler.js'
import type { AmbianceManager } from '../ambiance/manager.js'
import { getConfig } from '../routes/config.js'

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
) {
  const openWidgetIds = new Set<string>()
  let recycleBinFull = withDesktopConfigDefaults(getConfig().desktopConfig).recycleBin.fullOnStart

  // Give managers access to live widget state
  ambianceManager.setOpenWidgetIdsGetter(() => openWidgetIds)

  const getDesktopRuntimeState = (): DesktopRuntimeStatePayload => ({
    openWidgetIds: [...openWidgetIds],
    recycleBinFull,
  })

  const toggleWidgetRuntime = (widgetId: string) => {
    if (openWidgetIds.has(widgetId)) openWidgetIds.delete(widgetId)
    else openWidgetIds.add(widgetId)
    io.emit('widget:toggle', widgetId)
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

  machine.on('config:update', (config: AppConfig) => {
    io.emit('config:update', config)

    const nextRecycleBinFull = withDesktopConfigDefaults(config.desktopConfig).recycleBin.fullOnStart
    if (nextRecycleBinFull !== recycleBinFull) {
      recycleBinFull = nextRecycleBinFull
      io.emit('desktop:recycle-bin', { full: recycleBinFull })
    }
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
    console.log(`[socket] connected: ${socket.id}`)

    socket.on('state:request', (callback) => {
      callback(machine.currentState)
    })

    socket.on('desktop:state:request', (callback) => {
      callback(getDesktopRuntimeState())
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

    socket.on('desktop:notify', (payload: DesktopNotificationPayload) => {
      scheduler?.noteActivity()
      io.emit('desktop:notify', payload)
    })

    socket.on('desktop:recycle-bin', (payload: DesktopRecycleBinPayload) => {
      scheduler?.noteActivity()
      recycleBinFull = payload.full
      io.emit('desktop:recycle-bin', payload)
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
    })
  })
}
