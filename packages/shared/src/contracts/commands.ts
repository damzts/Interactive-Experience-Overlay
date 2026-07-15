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
import type { RTCIceCandidateInit } from './webrtc-types.js'
import type { EventConfig } from '../domain/event.js'
import type { SequenceStep } from '../domain/sequence.js'
import type { WidgetLayoutItem } from '../domain/application.js'
import type { AppConfig } from '../domain/config.js'
import type {
  DesktopIconDragPayload,
  DesktopNotificationPayload,
  DesktopWidgetDragPayload,
  DesktopWidgetResizePayload,
  PresentationStateReportPayload,
  WidgetSimulationCommandPayload,
  WidgetSimulationIntentPayload,
  AudioBeatPayload,
  AudioEnergyPayload,
  AudioLevelPayload,
} from './signals.js'

// ── Command-only payload types ────────────────────────────────────

export interface KeybindExecutionPayload {
  /** Looks up the bound preset id from config.keybinds[key] server-side. */
  key?: string
  /** Fires this preset id directly, bypassing the keybind map — used by the
   *  Input Engine's "Run" preview button to validate a binding before save. */
  presetId?: string
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
  /** The overlay's ambient-simulation performer is ready (skin-defined machinery). */
  simulatorReady: boolean
  widgetRegistryReady: boolean
  ready: boolean
  cameraPermission: import('./diagnostics.js').CameraPermissionState
}

export interface DesktopRuntimeStatePayload {
  openWidgetIds: string[]
  /** Latest client-reported presentation facts, keyed by skin-defined key.
   *  Opaque to the kernel — see PresentationStatePayload. */
  presentation: Record<string, unknown>
}

export interface OverlaySyncSnapshot {
  state: STATE
  desktop: DesktopRuntimeStatePayload
  config: AppConfig
}

// Re-export for convenience (import from signals.ts or @ieomlabs/shared directly)
// (types listed here are defined in signals.ts — re-exporting would duplicate in the barrel)

// ── ClientToServerEvents (commands) ──────────────────────────────

/**
 * Commands clients send to the kernel.
 * Server socket handlers register `socket.on(...)` for these.
 *
 * Categories:
 *   Syscalls      — scene:change, widget:toggle, overlay:trigger, keybind:execute,
 *                   widget:layout:apply*, event:preview, transition:preview,
 *                   desktop:notify, runtime:config:reset, runtime:config:widget:reset, runtime:config:widget-layout:reset
 *   State reports — presentation:state, overlay:runtime:status,
 *                   desktop:icon:drag, desktop:widget:drag, desktop:widget:resize
 *   Ambiance      — ambiance:simulate:accepted/started/done,
 *                   widget:simulate, widget:simulate:action, widget:signal
 *   Queries       — state:request, desktop:state:request, overlay:sync
 *   Audio         — audio:beat, audio:energy:high, audio:energy:low, audio:silence
 *   Dev tooling   — bus:trace:subscribe, bus:trace:unsubscribe
 */
export interface ClientToServerEvents {
  // ── Syscalls ─────────────────────────────────────────────────────
  /** Request a scene transition */
  'scene:change': (target: STATE, callback?: (err: string | null) => void) => void
  /** Fire an overlay effect/trigger immediately */
  'overlay:trigger': (payload: OverlayTriggerPayload) => void
  /** Preview a scheduled event (admin use) */
  'event:preview': (event: EventConfig, callback?: (err: string | null) => void) => void
  /** Reset all runtime config to persisted state */
  'runtime:config:reset': (callback?: (err: string | null) => void) => void
  /** Reset runtime config for a specific widget */
  'runtime:config:widget:reset': (widgetId: string, callback?: (err: string | null) => void) => void
  /** Reset runtime config for a set of widgets (layout reset) */
  'runtime:config:widget-layout:reset': (widgetIds: string[], callback?: (err: string | null) => void) => void
  /** Execute a keybind action */
  'keybind:execute': (payload: KeybindExecutionPayload, callback?: (err: string | null) => void) => void
  /** Streamer ↔ persona console message (admin); ack carries the persona's
   *  reply (also spoken via persona:speak) or null when the brain can't answer */
  'persona:console': (payload: { text: string }, callback: (reply: string | null) => void) => void
  /** Ask the persona to summarize recent chat out loud (admin) */
  'persona:summarize': (callback?: (err: string | null) => void) => void
  /** Toggle a widget open/closed */
  'widget:toggle': (widgetId: string) => void
  /** Apply a named widget layout preset */
  'widget:layout:apply': (layoutId: string) => void
  /** Apply raw widget layout items */
  'widget:layout:apply:items': (items: WidgetLayoutItem[]) => void
  /** Trigger a desktop notification */
  'desktop:notify': (payload: DesktopNotificationPayload) => void
  /** Preview a transition pipeline (admin use) */
  'transition:preview': (steps: SequenceStep[]) => void
  // ── State reports ─────────────────────────────────────────────────
  /** Report the overlay's runtime status to the kernel */
  'overlay:runtime:status': (payload: OverlayRuntimeStatusPayload) => void
  /** Rolling render-performance sample (fps, long frames) from the overlay */
  'overlay:perf': (payload: import('./diagnostics.js').OverlayPerfPayload) => void
  /** Report a named presentation fact (skin-defined key/value; kernel stores + rebroadcasts) */
  'presentation:state': (payload: PresentationStateReportPayload) => void
  /** Desktop icon drag event */
  'desktop:icon:drag': (payload: DesktopIconDragPayload) => void
  /** Desktop widget drag event */
  'desktop:widget:drag': (payload: DesktopWidgetDragPayload) => void
  /** Desktop widget resize event */
  'desktop:widget:resize': (payload: DesktopWidgetResizePayload) => void

  // ── Ambiance handshake ────────────────────────────────────────────
  /** Clear ambiance simulation history */
  'ambiance:history:clear': () => void
  /** Overlay accepted an ambiance simulation action */
  'ambiance:simulate:accepted': (payload: AmbianceSimulationAcceptedPayload) => void
  /** Overlay started executing an ambiance simulation action */
  'ambiance:simulate:started': (payload: AmbianceSimulationStartedPayload) => void
  /** Overlay finished an ambiance simulation action */
  'ambiance:simulate:done': (payload: AmbianceSimulationDonePayload) => void
  /** Simulate a widget open (ambiance-style) */
  'widget:simulate': (widgetId: string) => void
  /** Explicit widget action command */
  'widget:simulate:action': (payload: WidgetSimulationCommandPayload) => void
  /** Widget signal for widget wire routing */
  'widget:signal': (payload: { source: string; event: string; payload: unknown }) => void
  /** Overlay reports a detected beat from its audio reactivity monitor */
  'audio:beat': (payload: AudioBeatPayload) => void
  /** Overlay reports sustained high energy from its audio reactivity monitor */
  'audio:energy:high': (payload: AudioEnergyPayload) => void
  /** Overlay reports sustained low energy from its audio reactivity monitor */
  'audio:energy:low': (payload: AudioEnergyPayload) => void
  /** Overlay reports sustained silence from its audio reactivity monitor */
  'audio:silence': () => void
  /** Overlay reports a throttled live level sample from whatever analyser
   *  audioEngine.getReactiveAnalyser() currently points at — decoupled from
   *  the reactivity enabled/disabled toggle so operators can verify a source
   *  (e.g. a screen-share widget's audio) is actually reaching the analyser
   *  before turning reactivity on. Only emitted while an analyser exists. */
  'audio:level': (payload: AudioLevelPayload) => void

  // ── Queries (request/response via callback) ──────────────────────
  /** Request current scene state */
  'state:request': (callback: (state: STATE) => void) => void
  /** Request desktop runtime state snapshot */
  'desktop:state:request': (callback: (payload: DesktopRuntimeStatePayload) => void) => void
  /** Atomic initial sync — returns scene state, desktop state, and config in one round-trip */
  'overlay:sync': (callback: (snapshot: OverlaySyncSnapshot) => void) => void

  // ── Dev tooling ───────────────────────────────────────────────────
  /** Subscribe to live bus trace stream */
  'bus:trace:subscribe': () => void
  /** Unsubscribe from live bus trace stream */
  'bus:trace:unsubscribe': () => void

  // ── POV relay (overlay ↔ server WebRTC) ──────────────────────────
  /** Subscribe to the POV relay stream — server creates a sendonly WebRTC PC and offers it */
  'pov-online:relay:subscribe': () => void
  /** SDP answer from overlay back to server for the relay connection */
  'pov-online:relay:answer': (payload: { sdp: string }) => void
  /** ICE candidate from overlay to server for the relay connection */
  'pov-online:relay:ice': (candidate: RTCIceCandidateInit) => void

  // ── Screen-share relay (admin ↔ server ↔ overlay WebRTC, local only) ──
  // getDisplayMedia() requires a real user gesture, which only exists in
  // the admin app (the overlay is a passive OBS render target with nobody
  // to click anything). Admin captures the stream and publishes it here;
  // the server relays signaling to the single connected overlay socket —
  // no cloud/room involved, this is same-machine P2P.
  /** Admin → server: SDP offer publishing a screen-share capture for widgetId */
  'screen-share:offer': (payload: { widgetId: string; sdp: string }) => void
  /** Admin → server: ICE candidate for its publisher connection */
  'screen-share:ice:admin': (payload: { widgetId: string; candidate: RTCIceCandidateInit }) => void
  /** Overlay → server: SDP answer accepting a relayed screen-share offer */
  'screen-share:answer': (payload: { widgetId: string; sdp: string }) => void
  /** Overlay → server: ICE candidate for its subscriber connection */
  'screen-share:ice:overlay': (payload: { widgetId: string; candidate: RTCIceCandidateInit }) => void
  /** Admin → server: publisher stopped sharing (browser "Stop sharing" or widget closed) */
  'screen-share:stop': (payload: { widgetId: string }) => void
  /**
   * Overlay → server → admin: overlay subscriber has mounted (or changed its
   * watched widgetId) and is now ready to receive an offer. If the admin has
   * an active publisher for this widgetId it should re-create and re-send the
   * SDP offer so the overlay can complete the WebRTC handshake even when it
   * joined after the initial offer was already forwarded.
   */
  'screen-share:request-offer': (payload: { widgetId: string }) => void
}
