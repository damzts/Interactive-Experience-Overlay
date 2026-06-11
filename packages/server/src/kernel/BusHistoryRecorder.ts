/**
 * BusHistoryRecorder — ring-buffer candump for the KernelBus.
 *
 * Records every BusFrame into a fixed-capacity ring buffer.
 * When sockets are subscribed to the 'bus:trace' room, frames are batched
 * and flushed every 100ms to reduce socket pressure during high-frequency events.
 *
 * Instantiate once at startup and pass to the HTTP + socket transport layers.
 */

import type { Server } from 'socket.io'
import type { KernelBus, BusFrame } from './bus.js'

export interface BusHistoryOptions {
  capacity: number
  io: Server
}

export class BusHistoryRecorder {
  private readonly ring: BusFrame[] = []
  private readonly capacity: number
  private readonly io: Server
  private batch: BusFrame[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(bus: KernelBus, options: BusHistoryOptions) {
    this.capacity = options.capacity
    this.io = options.io

    bus.onAny((frame) => {
      this.ring.push(frame)
      if (this.ring.length > this.capacity) this.ring.shift()

      const room = this.io.sockets.adapter.rooms.get('bus:trace')
      if (!room?.size) return

      this.batch.push(frame)
      if (this.flushTimer !== null) return
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null
        const b = this.batch.splice(0)
        if (b.length) this.io.to('bus:trace').emit('bus:trace:frames', b)
      }, 100)
    })
  }

  snapshot(): BusFrame[] {
    return [...this.ring]
  }

  since(seq: number): BusFrame[] {
    return this.ring.filter((f) => f.seq > seq)
  }
}
