/**
 * Kernel internal event bus.
 *
 * Managers publish events here instead of reaching into each other.
 * The transport/socket layer subscribes and translates bus events into
 * outward Socket.IO signals.
 *
 * This is internal to @ieom/server — never exported to clients.
 */

import { EventEmitter } from 'events'

// ── Kernel event type map ────────────────────────────────────────
//
// This interface contains ONLY kernel orchestration events.
// Each manager contributes its own events via declaration merging
// in packages/server/src/kernel/managers/*.signals.ts — do not
// add manager-specific events here.

export interface KernelEvents {
  /** SceneManager completed a transition */
  'scene:changed': { from: string; to: string }
  /** Overlay client connected to the slot */
  'overlay:connected': { socketId: string }
  /** Overlay client disconnected */
  'overlay:disconnected': Record<string, never>
}

// ── BusFrame — metadata envelope for every bus event ─────────────

export interface BusFrame {
  /** Event name */
  event: string
  /** Event payload */
  payload: unknown
  /** Optional source identifier (set when emitting via bus.for(source)) */
  source?: string
  /** Millisecond timestamp at emit time */
  t: number
  /** Monotonically increasing sequence number */
  seq: number
}

// ── Typed event bus ──────────────────────────────────────────────

type Listener<T> = (payload: T) => void

export class KernelBus {
  private emitter = new EventEmitter()
  private _anyHandlers = new Set<(frame: BusFrame) => void>()
  private _seq = 0

  constructor() {
    this.emitter.setMaxListeners(50)
  }

  emit<K extends keyof KernelEvents>(event: K, payload: KernelEvents[K], source?: string): void {
    const frame: BusFrame = { event: event as string, payload, source, t: Date.now(), seq: ++this._seq }
    this.emitter.emit(event, payload)
    for (const h of this._anyHandlers) h(frame)
  }

  /**
   * Subscribe to all events emitted by the bus.
   * Returns an unsubscribe function.
   */
  onAny(handler: (frame: BusFrame) => void): () => void {
    this._anyHandlers.add(handler)
    return () => { this._anyHandlers.delete(handler) }
  }

  on<K extends keyof KernelEvents>(event: K, listener: Listener<KernelEvents[K]>): () => void {
    this.emitter.on(event, listener as (...args: unknown[]) => void)
    return () => this.emitter.off(event, listener as (...args: unknown[]) => void)
  }

  off<K extends keyof KernelEvents>(event: K, listener: Listener<KernelEvents[K]>): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void)
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners()
  }

  /** Return a bound handle that stamps every emitted frame with the given source. */
  for(source: string): BoundBus {
    return new BoundBus(this, source)
  }
}

/** Thin wrapper that attaches a fixed source to every emitted frame. */
export class BoundBus {
  constructor(
    private readonly bus: KernelBus,
    private readonly source: string,
  ) {}

  emit<K extends keyof KernelEvents>(event: K, payload: KernelEvents[K]): void {
    this.bus.emit(event, payload, this.source)
  }

  on<K extends keyof KernelEvents>(event: K, listener: (payload: KernelEvents[K]) => void): () => void {
    return this.bus.on(event, listener)
  }

  onAny(handler: (frame: BusFrame) => void): () => void {
    return this.bus.onAny(handler)
  }
}
