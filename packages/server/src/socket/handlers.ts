import type { Server, Socket } from 'socket.io'
import {
  STATE,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type InterServerEvents,
  type SocketData,
  type OverlayTriggerPayload,
} from '@ieom/shared'
import type { AppConfig } from '@ieom/shared'
import type { SceneMachine } from '../state/machine.js'
import type { EventScheduler } from '../events/scheduler.js'
import { getConfig } from '../routes/config.js'

type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

export function setupSocketHandlers(io: IO, machine: SceneMachine, scheduler?: EventScheduler) {
  // Broadcast machine state events to all clients
  machine.on('state:change', (payload: { state: STATE; previousState: STATE }) => {
    io.emit('state:update', payload)
  })

  machine.on('config:update', (config: AppConfig) => {
    io.emit('config:update', config)
  })

  machine.on(
    'transition:start',
    (payload: { from: STATE; to: STATE; transitionType: string; exitTransition?: string; introTransition?: string }) => {
      io.emit('transition:play', payload)
    },
  )

  machine.on('overlay:trigger', (payload: OverlayTriggerPayload) => {
    io.emit('overlay:show', payload)
  })

  io.on('connection', (socket: AppSocket) => {
    console.log(`[socket] connected: ${socket.id}`)

    // New client: send current state immediately
    socket.on('state:request', (callback) => {
      callback(machine.currentState)
    })

    socket.on('scene:change', (target, callback) => {
      scheduler?.resetIdleTimer()

      // Look up exit + intro transitions independently so they can be chained client-side
      const cfg = getConfig()
      const fromState = machine.currentState

      // Collect exit and intro transitions independently so they can be chained
      let exitTransition: string | undefined
      let introTransition: string | undefined

      // App-level overrides (application scenes)
      for (const app of cfg.applications) {
        if (app.targetSceneId === target && app.introTransition) introTransition = app.introTransition
        if (app.targetSceneId === fromState && app.exitTransition) exitTransition = app.exitTransition
      }

      // Scene-level overrides (built-in environments: LOBBY, DESKTOP, etc.)
      if (!introTransition) {
        const targetScene = cfg.scenes[target]
        if (targetScene?.introTransition) introTransition = targetScene.introTransition
      }
      if (!exitTransition) {
        const fromScene = cfg.scenes[fromState]
        if (fromScene?.exitTransition) exitTransition = fromScene.exitTransition
      }

      const result = machine.transition(target, { exitTransition, introTransition })
      if (callback) callback(result.ok ? null : result.error ?? 'Unknown error')
    })

    socket.on('overlay:trigger', (payload: OverlayTriggerPayload) => {
      machine.triggerOverlay(payload)
    })

    socket.on('panic', () => {
      scheduler?.resetIdleTimer()
      machine.forceState(STATE.DESKTOP)
    })

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`)
    })
  })
}
