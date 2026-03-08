import type { Server, Socket } from 'socket.io'
import {
  STATE,
  OVERLAY_EVENT,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type InterServerEvents,
  type SocketData,
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
    (payload: { from: STATE; to: STATE; transitionType: string }) => {
      io.emit('transition:play', payload)
    },
  )

  machine.on('overlay:trigger', (payload: { event: OVERLAY_EVENT }) => {
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

      // Look up per-app transition overrides from config
      const cfg = getConfig()
      const fromState = machine.currentState
      let transitionOverride: string | undefined

      // Find an app whose scene matches: introTransition (entering app) or exitTransition (leaving app back to desktop)
      for (const app of cfg.applications) {
        // Going INTO an app scene
        if (app.targetSceneId === target && app.introTransition) {
          transitionOverride = app.introTransition
          break
        }
        // Going BACK to desktop FROM an app scene
        if (app.targetSceneId === fromState && target === STATE.DESKTOP && app.exitTransition) {
          transitionOverride = app.exitTransition
          break
        }
      }

      const result = machine.transition(target, transitionOverride)
      if (callback) callback(result.ok ? null : result.error ?? 'Unknown error')
    })

    socket.on('overlay:trigger', (event) => {
      machine.triggerOverlay(event)
    })

    socket.on('transition:complete', () => {
      machine.completeTransition()
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
