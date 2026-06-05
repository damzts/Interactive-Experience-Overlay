/**
 * Userspace → Kernel commands (syscalls).
 *
 * These are requests overlay/admin clients send to the kernel to trigger
 * actions. The kernel validates and executes them. A command may result
 * in zero or more signals being emitted back.
 *
 * Direction: client emits → server handles
 */

import type { STATE } from './state.js'
import type { OverlayTriggerPayload } from './effects.js'
import type { EventConfig } from '../domain/event.js'
import type { TransitionStep } from '../domain/scene.js'
import type { WidgetLayoutItem } from '../domain/application.js'
import type {
  CursorMirrorPayload,
  DesktopIconDragPayload,
  DesktopNotificationPayload,
  DesktopRecycleBinPayload,
  DesktopScreenSaverPreviewPayload,
  DesktopStartMenuSimulationPhasePayload,
  DesktopStartMenuStatePayload,
  DesktopWidgetDragPayload,
  DesktopWidgetResizePayload,
  OpenWidgetMenuTimelinePayload,
  WidgetSimulationCommandPayload,
  WidgetSimulationIntentPayload,
} from './signals.js'

// ── Command-only payload types ────────────────────────────────────

export interface KeybindExecutionPayload {
  scope: 'obs' | 'admin'
  key?: string
  action?: string
}

export interface AmbianceSimulationAcceptedPayload {
  actionId: string
  widgetId: string
  action: 'open' | 'close' | 'interact'
}

export interface AmbianceSimulationStartedPayload {
  actionId: string
  widgetId: string
  action: 'open' | 'close' | 'interact'
  startedAt?: number
}

export interface AmbianceSimulationDonePayload {
  actionId: string
  widgetId: string
  action: 'open' | 'close' | 'interact'
  ok: boolean
  durationMs?: number
}

export interface OverlayRuntimeStatusPayload {
  mounted: boolean
  cursorReady: boolean
  widgetRegistryReady: boolean
  ready: boolean
  cameraPermission: import('./diagnostics.js').CameraPermissionState
}

export interface DesktopRuntimeStatePayload {
  openWidgetIds: string[]
  recycleBinFull: boolean
  startMenuState?: DesktopStartMenuStatePayload
}

// Re-export for convenience (import from signals.ts or @ieom/shared directly)
// (types listed here are defined in signals.ts — re-exporting would duplicate in the barrel)

// ── ClientToServerEvents (commands) ──────────────────────────────

/**
 * Commands clients send to the kernel.
 * Server socket handlers register `socket.on(...)` for these.
 */
export interface ClientToServerEvents {
  /** Request a scene transition */
  'scene:change': (target: STATE, callback?: (err: string | null) => void) => void
  /** Fire an overlay effect/trigger immediately */
  'overlay:trigger': (payload: OverlayTriggerPayload) => void
  /** Preview a scheduled event (admin use) */
  'event:preview': (event: EventConfig, callback?: (err: string | null) => void) => void
  /** Clear all runtime config overrides */
  'runtime:config:override:clear': (callback?: (err: string | null) => void) => void
  /** Clear runtime overrides for a specific widget */
  'runtime:config:override:widget:clear': (widgetId: string, callback?: (err: string | null) => void) => void
  /** Clear runtime overrides for a set of widgets (layout reset) */
  'runtime:config:override:widget-layout:clear': (widgetIds: string[], callback?: (err: string | null) => void) => void
  /** Execute a keybind action */
  'keybind:execute': (payload: KeybindExecutionPayload, callback?: (err: string | null) => void) => void
  /** Clear ambiance simulation history */
  'ambiance:history:clear': () => void
  /** Report the overlay's runtime status to the kernel */
  'overlay:runtime:status': (payload: OverlayRuntimeStatusPayload) => void
  /** Overlay accepted an ambiance simulation action */
  'ambiance:simulate:accepted': (payload: AmbianceSimulationAcceptedPayload) => void
  /** Overlay started executing an ambiance simulation action */
  'ambiance:simulate:started': (payload: AmbianceSimulationStartedPayload) => void
  /** Overlay finished an ambiance simulation action */
  'ambiance:simulate:done': (payload: AmbianceSimulationDonePayload) => void
  /** Widget-to-widget simulation intent forwarded through kernel */
  'widget:simulate:intent': (payload: WidgetSimulationIntentPayload) => void
  /** Toggle a widget open/closed */
  'widget:toggle': (widgetId: string) => void
  /** Simulate a widget open (ambiance-style) */
  'widget:simulate': (widgetId: string) => void
  /** Explicit widget action command */
  'widget:simulate:action': (payload: WidgetSimulationCommandPayload) => void
  /** Apply a named widget layout preset */
  'widget:layout:apply': (layoutId: string) => void
  /** Apply raw widget layout items */
  'widget:layout:apply:items': (items: WidgetLayoutItem[]) => void
  /** Desktop icon drag event */
  'desktop:icon:drag': (payload: DesktopIconDragPayload) => void
  /** Desktop widget drag event */
  'desktop:widget:drag': (payload: DesktopWidgetDragPayload) => void
  /** Desktop widget resize event */
  'desktop:widget:resize': (payload: DesktopWidgetResizePayload) => void
  /** Cursor mirror event */
  'cursor:mirror': (payload: CursorMirrorPayload) => void
  /** Cursor menu navigation timeline */
  'cursor:mirror:menu-timeline': (payload: OpenWidgetMenuTimelinePayload) => void
  /** Trigger a desktop notification */
  'desktop:notify': (payload: DesktopNotificationPayload) => void
  /** Set recycle bin fill state */
  'desktop:recycle-bin': (payload: DesktopRecycleBinPayload) => void
  /** Update start menu visibility state */
  'desktop:start-menu:state': (payload: DesktopStartMenuStatePayload) => void
  /** Update start menu simulation phase */
  'desktop:start-menu:phase': (payload: DesktopStartMenuSimulationPhasePayload) => void
  /** Preview a screen saver preset */
  'desktop:screen-saver:test': (payload: DesktopScreenSaverPreviewPayload) => void
  /** Preview a transition pipeline (admin use) */
  'transition:preview': (steps: TransitionStep[]) => void
  /** Immediate panic reset — clears all state to safe defaults */
  'panic': () => void
}
