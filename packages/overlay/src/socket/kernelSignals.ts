/**
 * onKernelSignal — typed subscription to the generic 'kernel:signal' channel.
 *
 * Domain events (twitch:*, obs:*, chat:*, show:*, …) arrive from the kernel
 * as BusFrame envelopes on one socket event. This helper fans them out to
 * per-event listeners with payloads narrowed through the shared
 * KernelSignalMap — the same map the server allowlists by, so a new public
 * kernel event is consumable here with zero transport changes.
 *
 *   const off = onKernelSignal('twitch:follow', (payload) => { ... })
 */
import type { BusFrame, KernelSignalMap } from '@ieomlabs/shared'
import { socket } from './client'

type AnyListener = (payload: unknown, frame: BusFrame) => void

const listeners = new Map<string, Set<AnyListener>>()
let armed = false

function arm(): void {
  if (armed) return
  armed = true
  socket.on('kernel:signal', (frame: BusFrame) => {
    const set = listeners.get(frame.event)
    if (!set) return
    for (const listener of [...set]) listener(frame.payload, frame)
  })
}

export function onKernelSignal<K extends keyof KernelSignalMap>(
  event: K,
  listener: (payload: KernelSignalMap[K], frame: BusFrame) => void,
): () => void {
  arm()
  let set = listeners.get(event)
  if (!set) {
    set = new Set()
    listeners.set(event, set)
  }
  set.add(listener as AnyListener)
  return () => {
    set.delete(listener as AnyListener)
    if (set.size === 0) listeners.delete(event)
  }
}
