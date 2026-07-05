/**
 * Kernel signal bridge — forwards every public KernelBus event to clients
 * as a single generic 'kernel:signal' BusFrame envelope.
 *
 * Which events are public is decided by the shared KernelSignalMap
 * allowlist (isPublicKernelSignal) — a manager makes an event public by
 * adding it there, with zero transport changes. Replaces the old
 * per-event managers.ts bridge.
 *
 * Call registerKernelSignalBridge(ctx) once, outside the per-socket
 * connection handler.
 */
import { isPublicKernelSignal, type BusFrame, type KernelSignalEvent, type KernelSignalMap } from '@ieomlabs/shared'
import type { HandlerContext } from './types.js'

export function registerKernelSignalBridge(ctx: HandlerContext): void {
  const { bus, io } = ctx
  bus.onAny((frame) => {
    if (isPublicKernelSignal(frame.event)) {
      io.emit('kernel:signal', frame)
    }
  })
}

/** Synthesize a BusFrame for state replay to a late-joining client
 *  (e.g. re-announcing chat:connected on socket connect). seq 0 marks
 *  the frame as synthetic replay rather than a live bus emission. */
export function makeKernelSignalFrame<K extends KernelSignalEvent>(
  event: K,
  payload: KernelSignalMap[K],
): BusFrame {
  return { event, payload, source: 'replay', t: Date.now(), seq: 0 }
}
