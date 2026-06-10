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
  /** SceneMachine completed a transition */
  'scene:changed': { from: string; to: string }
  /** Overlay client connected to the slot */
  'overlay:connected': { socketId: string }
  /** Overlay client disconnected */
  'overlay:disconnected': Record<string, never>
}

// ── Typed event bus ──────────────────────────────────────────────

type Listener<T> = (payload: T) => void

export class KernelBus {
  private emitter = new EventEmitter()
  private _anyHandlers = new Set<(event: string, payload: unknown) => void>()

  constructor() {
    this.emitter.setMaxListeners(50)
  }

  emit<K extends keyof KernelEvents>(event: K, payload: KernelEvents[K]): void {
    this.emitter.emit(event, payload)
    for (const h of this._anyHandlers) h(event as string, payload)
  }

  /**
   * Emit a custom event (any string name). Used by third-party managers to
   * publish domain-specific signals without coupling to KernelEvents.
   * The socket orchestrator subscribes to 'custom:*' and forwards to overlay clients.
   */
  emitCustom(event: string, payload: unknown): void {
    const fullEvent = `custom:${event}`
    this.emitter.emit(fullEvent, payload)
    for (const h of this._anyHandlers) h(fullEvent, payload)
  }

  /**
   * Subscribe to all events emitted by the bus (both typed KernelEvents and custom:* events).
   * Returns an unsubscribe function.
   */
  onAny(handler: (event: string, payload: unknown) => void): () => void {
    this._anyHandlers.add(handler)
    return () => { this._anyHandlers.delete(handler) }
  }

  onCustom(event: string, listener: (payload: unknown) => void): () => void {
    const fullEvent = `custom:${event}`
    this.emitter.on(fullEvent, listener)
    return () => this.emitter.off(fullEvent, listener)
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
}
