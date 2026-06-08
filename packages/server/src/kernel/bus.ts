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
import type { EventConfig } from '@ieomlabs/shared'

// ── Kernel event type map ────────────────────────────────────────

export interface KernelEvents {
  /** SceneMachine completed a transition */
  'scene:changed': { from: string; to: string }
  /** EventScheduler fired an event */
  'scheduler:fired': { eventId: string; event: EventConfig }
  /** AmbianceManager wants to trigger a widget action */
  'ambiance:tick': { widgetId: string; action: 'open' | 'close' | 'interact' }
  /** DesktopConfigService persisted a config change */
  'config:changed': { section: string }
  /** Overlay client connected to the slot */
  'overlay:connected': { socketId: string }
  /** Overlay client disconnected */
  'overlay:disconnected': Record<string, never>
}

// ── Typed event bus ──────────────────────────────────────────────

type Listener<T> = (payload: T) => void

export class KernelBus {
  private emitter = new EventEmitter()

  constructor() {
    this.emitter.setMaxListeners(50)
  }

  emit<K extends keyof KernelEvents>(event: K, payload: KernelEvents[K]): void {
    this.emitter.emit(event, payload)
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
