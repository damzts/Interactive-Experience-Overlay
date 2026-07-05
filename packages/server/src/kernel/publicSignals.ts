/**
 * Public kernel signals — single augmentation binding the shared
 * KernelSignalMap into KernelEvents.
 *
 * Any manager event declared in @ieomlabs/shared KernelSignalMap is
 * (a) fully typed on the KernelBus and (b) automatically forwarded to
 * clients as a 'kernel:signal' BusFrame by the transport bridge.
 *
 * Manager-private events (never sent to clients) keep living in the
 * per-manager *.signals.ts files.
 */
import type { KernelSignalMap } from '@ieomlabs/shared'
import type { } from './bus.js'

declare module './bus.js' {
  interface KernelEvents extends KernelSignalMap {}
}
