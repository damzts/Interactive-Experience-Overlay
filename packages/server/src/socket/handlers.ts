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

type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

export function setupSocketHandlers(io: IO, machine: SceneMachine) {
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
      const result = machine.transition(target)
      if (callback) callback(result.ok ? null : result.error ?? 'Unknown error')
    })

    socket.on('overlay:trigger', (event) => {
      machine.triggerOverlay(event)
    })

    socket.on('transition:complete', () => {
      machine.completeTransition()
    })

    socket.on('panic', () => {
      machine.forceState(STATE.LOBBY)
    })

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`)
    })
  })
}
