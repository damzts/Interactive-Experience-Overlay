/**
 * Manager signal bridge — forwards typed KernelBus events to Socket.IO clients.
 *
 * Each manager emits typed events on the KernelBus. This module subscribes once
 * at startup and translates them into first-class ServerToClientEvents signals.
 * Call registerManagerSignals(ctx) once, outside the per-socket connection handler.
 */

import type { HandlerContext } from './types.js'

export function registerManagerSignals(ctx: HandlerContext): void {
  const { bus, io } = ctx

  bus.on('chat:message', (payload) => {
    io.emit('chat:message', payload)
  })

  bus.on('chat:connected', (payload) => {
    io.emit('chat:connected', payload)
  })

  bus.on('obs:stream:started', (payload) => {
    io.emit('obs:stream:started', payload)
  })

  bus.on('obs:stream:stopped', (payload) => {
    io.emit('obs:stream:stopped', payload)
  })

  bus.on('obs:recording:started', (payload) => {
    io.emit('obs:recording:started', payload)
  })

  bus.on('obs:recording:stopped', (payload) => {
    io.emit('obs:recording:stopped', payload)
  })

  bus.on('obs:virtualcam:changed', (payload) => {
    io.emit('obs:virtualcam:changed', payload)
  })

  bus.on('show:step', (payload) => {
    io.emit('show:step', payload)
  })
}
