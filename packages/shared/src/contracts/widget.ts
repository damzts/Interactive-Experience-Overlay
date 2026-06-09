/**
 * Widget lifecycle contract.
 *
 * Widgets are React components and don't need to implement this interface —
 * it's opt-in. Widgets that need initialization, cleanup, or config-reactive
 * behavior implement WidgetLifecycle and register via registerWidgetLifecycle().
 *
 * The server-side equivalent of this contract is the widget:toggle / widget:simulate
 * event pair in the Socket.IO contract.
 */
import type { AppConfig } from '../domain/config.js'
import type { WidgetComponentType } from '../domain/application.js'

/** Context provided to a widget when it mounts. */
export interface WidgetContext {
  /** The application ID for this widget instance. */
  appId: string
  /** Current merged config (persisted + runtime overrides). */
  config: AppConfig
  /**
   * Emit an event to the server. Reserved for future use — widgets should
   * prefer consuming server-pushed state rather than emitting their own.
   */
  emit?: (event: string, payload: unknown) => void
}

/**
 * Optional lifecycle hooks for widgets that need more than passive rendering.
 *
 * Implement only the hooks you need — all are optional.
 */
export interface WidgetLifecycle {
  /** Widget component type this lifecycle applies to. */
  componentType: WidgetComponentType

  /**
   * Called once when the widget window opens (transitions from closed → open).
   * Use for acquiring resources: camera, audio context, WebRTC, etc.
   */
  onMount?: (ctx: WidgetContext) => void | Promise<void>

  /**
   * Called when the widget window closes (after close animation completes).
   * Use for releasing resources.
   */
  onUnmount?: () => void

  /**
   * Called whenever the merged config changes while the widget is open.
   * Receives the full new config — derive what you need.
   */
  onConfigUpdate?: (config: AppConfig) => void

  /**
   * Called when the widget transitions to 'closing' state (animation starting).
   * Use to begin teardown before the DOM is removed.
   */
  onClosing?: () => void

  /**
   * Serialize ephemeral widget state for overlay reload/reconnect recovery.
   * Return value is passed to deserialize() on next mount if available.
   * Only serialize state that meaningfully improves the reconnect experience.
   */
  serialize?: () => Record<string, unknown>

  /**
   * Restore serialized state after a reconnect. Called before onMount.
   */
  deserialize?: (state: Record<string, unknown>) => void
}

/** Registry of widget lifecycle implementations, keyed by componentType. */
const lifecycleRegistry = new Map<WidgetComponentType, WidgetLifecycle>()

export function registerWidgetLifecycle(lifecycle: WidgetLifecycle): void {
  lifecycleRegistry.set(lifecycle.componentType, lifecycle)
}

export function getWidgetLifecycle(componentType: WidgetComponentType): WidgetLifecycle | undefined {
  return lifecycleRegistry.get(componentType)
}

// ── Widget intent manifest (pub/sub vocabulary declaration) ──────

/** A signal this widget can emit (publish). */
export interface WidgetSignalDescriptor {
  event: string    // e.g. 'weather:storm'
  label: string    // human-readable, e.g. 'Storm detected'
}

/** An action this widget can receive (subscribe/consume). */
export interface WidgetActionDescriptor {
  action: string   // e.g. 'gallery:next'
  label: string    // human-readable, e.g. 'Next slide'
}

/**
 * Static declaration of a widget's pub/sub vocabulary.
 * Registered once per componentType, never persisted — it lives in code.
 * The admin UI reads manifests to populate the Wires editor source/target columns.
 */
export interface WidgetIntentManifest {
  componentType: import('../domain/application.js').WidgetComponentType
  /** Signals this widget type can emit */
  emits: WidgetSignalDescriptor[]
  /** Actions this widget type can receive */
  accepts: WidgetActionDescriptor[]
}

const intentRegistry = new Map<string, WidgetIntentManifest>()

export function registerWidgetIntentManifest(manifest: WidgetIntentManifest): void {
  intentRegistry.set(manifest.componentType, manifest)
}

export function getWidgetIntentManifest(componentType: string): WidgetIntentManifest | undefined {
  return intentRegistry.get(componentType)
}

export function getAllWidgetIntentManifests(): WidgetIntentManifest[] {
  return [...intentRegistry.values()]
}

/**
 * WidgetSignal — a typed event emitted by a widget into the kernel event bus.
 * Used as the trigger side of widget wires.
 */
export interface WidgetSignal {
  /** Widget instance ID (appId) that produced this signal */
  source: string
  /** Signal event name (e.g. 'weather:storm', 'music:track-changed') */
  event: string
  /** Arbitrary payload */
  payload: unknown
}

/**
 * WidgetWire — defines an automatic trigger from one widget to another.
 * Stored in SQLite and evaluated by the overlay when a matching signal arrives.
 */
export interface WidgetWire {
  id: string
  triggerWidgetId: string
  triggerEvent: string
  targetWidgetId: string
  /** Action to invoke on the target widget */
  targetAction: string
  enabled: boolean
}
