/**
 * Kernel → Userspace signals.
 *
 * These are directives the kernel sends to overlay clients. The overlay reacts
 * to them but never blocks the kernel. Adding a signal here means adding one
 * entry to the overlay's signalMap.ts.
 *
 * Direction: server emits → client listens
 */

import type { Rect } from '../domain/geometry.js'
import type { STATE } from './state.js'
import type { AppConfig } from '../domain/config.js'
import type { RTCIceCandidateInit } from './webrtc-types.js'
import type { DesktopConfig } from '../domain/desktop.js'
import type { DesktopAmbianceConfig } from '../domain/ambiance.js'
import type { WidgetLayoutItem } from '../domain/application.js'
import type { TransitionStep } from '../domain/scene.js'
import type { OverlayTriggerPayload } from './effects.js'
import type { ObsStatusPayload, RuntimeDiagnosticsPayload } from './diagnostics.js'

// ── BusFrame (shared type for bus trace tooling) ──────────────────

export interface BusFrame {
  /** Name of the event being sent over the bus. */
  event: string
  /** Event payload; shape depends on the specific event. */
  payload: unknown
  /** Optional origin of the event, such as a subsystem or client. */
  source?: string
  /** Timestamp when the frame was created, in milliseconds. */
  t: number
  /** Monotonic sequence number used for ordering frames. */
  seq: number
}

// ── Manager signal payloads ────────────────────────────────────────

export interface ChatMessagePayload {
  user: string
  text: string
  color: string
  badges: string[]
  channel: string
  source: 'twitch' | 'simulation'
}

export interface ShowStepPayload {
  showId: string
  stepIndex: number
  label: string
}

// ── Re-exported payload types ─────────────────────────────────────

export type { ObsStatusPayload, RuntimeDiagnosticsPayload }

// ── Transition payload ────────────────────────────────────────────

/** Shape of the transition:play signal */
export interface TransitionPlayPayload {
  from: STATE
  to: STATE
  /** Ordered exit pipeline — plays before scene content swaps */
  exit: TransitionStep[]
  /** Ordered intro pipeline — plays after scene content swaps */
  intro: TransitionStep[]
}

// ── Desktop signal payloads ───────────────────────────────────────

export interface DesktopNotificationPayload {
  title: string
  body: string
  icon?: string
  durationMs?: number
}

export interface DesktopRecycleBinPayload {
  full: boolean
}

export interface DesktopScreenSaverPreviewPayload {
  preset: DesktopConfig['screenSaver']['preset']
}

export interface DesktopStartMenuStatePayload {
  open: boolean
  activeRoot: 'programs' | 'widget-layouts' | 'layouts' | 'scenes' | null
}

export type DesktopStartMenuRoot = 'programs' | 'widget-layouts' | 'layouts' | 'scenes' | null

export type DesktopStartMenuSimulationPhase =
  | 'open'
  | 'programs-hover'
  | 'programs-open'
  | 'target-hover'
  | 'target-select'
  | 'clear'

export interface DesktopStartMenuSimulationPhasePayload {
  phase: DesktopStartMenuSimulationPhase
  targetAppId?: string
}

// ── Input signal payloads ─────────────────────────────────────────

export type CursorMirrorPayload =
  | { kind: 'move'; x: number; y: number; duration?: number }
  | { kind: 'click' }
  | { kind: 'visible'; visible: boolean }

export interface MenuPathTimingStep {
  moveMs: number
  hoverMs: number
  postMs: number
}

export interface OpenWidgetMenuTimelinePayload {
  widgetLabel: string
  menuPath: string[]
  targetAppId?: string
  startMoveMs: number
  startPostMs: number
  steps: MenuPathTimingStep[]
}

// ── Desktop drag/resize signal payloads ───────────────────────────

export interface DesktopIconDragPayload {
  appId: string
  x: number
  y: number
  phase: 'start' | 'move' | 'end'
}

export interface DesktopWidgetDragPayload {
  widgetId: string
  x: number
  y: number
  phase: 'start' | 'move' | 'end'
}

export interface DesktopWidgetResizePayload extends Rect {
  widgetId: string
  phase: 'start' | 'move' | 'end'
}

// ── Ambiance signal payloads ──────────────────────────────────────

export type AmbianceMirrorPolicy = 'shared-safe' | 'leader-only' | 'unsafe-requires-runtime-event'

export interface WidgetSimulationCommandPayload {
  widgetId: string
  action: 'open' | 'close' | 'toggle'
}

export type WidgetSimulationIntentSeedBase = { widgetId: string }

export type WidgetSimulationIntentSeed =
  | (WidgetSimulationIntentSeedBase & { kind: 'gallery:next' })
  | (WidgetSimulationIntentSeedBase & { kind: 'gallery:previous' })
  | (WidgetSimulationIntentSeedBase & { kind: 'music:prev' })
  | (WidgetSimulationIntentSeedBase & { kind: 'music:play-pause' })
  | (WidgetSimulationIntentSeedBase & { kind: 'music:next' })
  | (WidgetSimulationIntentSeedBase & { kind: 'sticky:set-color'; color: string })
  | (WidgetSimulationIntentSeedBase & { kind: 'chat:add-message'; message: { user: string; text: string; color: string } })

type WidgetSimulationIntentBase = { actionId: string; widgetId: string }

export type WidgetSimulationIntentPayload =
  | (WidgetSimulationIntentBase & { kind: 'gallery:next' })
  | (WidgetSimulationIntentBase & { kind: 'gallery:previous' })
  | (WidgetSimulationIntentBase & { kind: 'music:prev' })
  | (WidgetSimulationIntentBase & { kind: 'music:play-pause' })
  | (WidgetSimulationIntentBase & { kind: 'music:next' })
  | (WidgetSimulationIntentBase & { kind: 'sticky:set-color'; color: string })
  | (WidgetSimulationIntentBase & { kind: 'chat:add-message'; message: { user: string; text: string; color: string } })

export interface AmbianceSimulationPayload {
  actionId: string
  /** Target ID — widget ID for widget actions, layout ID or scene ID for select actions. */
  widgetId: string
  action: 'open' | 'close' | 'interact' | 'select'
  /** Discriminates the target type. Absent means 'widget' for backward compatibility. */
  targetKind?: 'widget' | 'layout' | 'scene'
  /** Explicit start-menu navigation path for layout/scene select actions, e.g. ['Layouts', 'My Layout']. */
  menuPath?: string[]
  mirrorPolicy: AmbianceMirrorPolicy
  sharedIntent: WidgetSimulationIntentPayload | null
}

// ── Runtime config ────────────────────────────────────────────────

export interface RuntimeConfig {
  desktopConfig?: Pick<Partial<DesktopConfig>, 'globalThemeDefault' | 'widgetThemes' | 'iconAnimation' | 'iconMotion' | 'screenSaver'>
  /** Transient per-widget positions (not persisted — runtime state only) */
  widgetPositions?: Record<string, { x: number; y: number }>
  /** Transient per-widget sizes (not persisted — runtime state only) */
  widgetSizes?: Record<string, { width?: number; height?: number }>
  /** Transient per-widget z-indices (not persisted — runtime state only) */
  widgetZIndices?: Record<string, number>
  desktopAmbiance?: Partial<DesktopAmbianceConfig>
}

// ── Spotify signal payloads ───────────────────────────────────────

export interface SpotifyStatePayload {
  activePlaylistId?: string
  activePlaylistName?: string
}

// ── ServerToClientEvents (signals) ───────────────────────────────

/**
 * Signals the kernel sends to overlay/admin clients.
 * Client hooks register `socket.on(...)` for these.
 */
export interface ServerToClientEvents {
  /** Scene state changed — overlay updates its visual state */
  'state:update': (payload: { state: STATE; previousState: STATE }) => void
  /** Transition pipeline to play before/after scene swap */
  'transition:play': (payload: TransitionPlayPayload) => void
  /** One-shot effect/overlay trigger (effects, SFX) */
  'overlay:show': (payload: OverlayTriggerPayload) => void
  /** Full config replaced — re-render everything */
  'config:update': (config: AppConfig) => void
  /** Partial config update — merge into existing config */
  'config:patch': (updates: Partial<AppConfig>) => void
  /** OBS bridge connection status changed */
  'obs:status': (payload: ObsStatusPayload) => void
  /** Ambiance accept/reject counters updated */
  'ambiance:metrics': (payload: { accepted: number; rejected: number }) => void
  /** Periodic diagnostics snapshot from scheduler + ambiance managers */
  'runtime:diagnostics': (payload: RuntimeDiagnosticsPayload) => void
  /** Overlay slot ownership changed */
  'overlay:owner': (payload: { socketId: string | null }) => void
  /** Scoped runtime config applied */
  'runtime:config': (payload: RuntimeConfig) => void
  /** Ambiance manager wants the overlay to simulate a widget action */
  'ambiance:simulate': (payload: AmbianceSimulationPayload) => void
  /** Full state resync requested (e.g. after reconnect) */
  'overlay:resync': (payload: { reason: string }) => void
  /** Overlay slot rejected — already taken */
  'overlay:rejected': (payload: { reason: string }) => void
  /** Kernel wants a specific widget interaction (e.g. gallery:next) */
  'widget:simulate:intent': (payload: WidgetSimulationIntentPayload) => void
  /** Cursor mirroring directive */
  'cursor:mirror': (payload: CursorMirrorPayload) => void
  /** Cursor menu navigation timeline for simulated interaction */
  'cursor:mirror:menu-timeline': (payload: OpenWidgetMenuTimelinePayload) => void
  /** Toggle a widget open/closed */
  'widget:toggle': (widgetId: string) => void
  /** Apply a named layout preset */
  'widget:layout:apply': (layoutId: string) => void
  /** Apply raw layout items */
  'widget:layout:apply:items': (items: WidgetLayoutItem[]) => void
  /** Desktop icon drag from ambiance */
  'desktop:icon:drag': (payload: DesktopIconDragPayload) => void
  /** Desktop widget drag from ambiance */
  'desktop:widget:drag': (payload: DesktopWidgetDragPayload) => void
  /** Desktop widget resize from ambiance */
  'desktop:widget:resize': (payload: DesktopWidgetResizePayload) => void
  /** OS-style desktop notification */
  'desktop:notify': (payload: DesktopNotificationPayload) => void
  /** Recycle bin fill state changed */
  'desktop:recycle-bin': (payload: DesktopRecycleBinPayload) => void
  /** Start menu visibility / active root changed */
  'desktop:start-menu:state': (payload: DesktopStartMenuStatePayload) => void
  /** Start menu simulation phase directive */
  'desktop:start-menu:phase': (payload: DesktopStartMenuSimulationPhasePayload) => void
  /** Screen saver preview command */
  'desktop:screen-saver:test': (payload: DesktopScreenSaverPreviewPayload) => void
  /** Widget wire triggered a widget action */
  'widget:chain:action': (payload: { targetWidgetId: string; action: string; sourceSignal: unknown }) => void
  /** Twitch chat message received */
  'chat:message': (payload: ChatMessagePayload) => void
  /** Twitch chat connected to a channel */
  'chat:connected': (payload: { channel: string }) => void
  /** OBS stream started */
  'obs:stream:started': (payload: Record<string, never>) => void
  /** OBS stream stopped */
  'obs:stream:stopped': (payload: Record<string, never>) => void
  /** OBS recording started */
  'obs:recording:started': (payload: Record<string, never>) => void
  /** OBS recording stopped */
  'obs:recording:stopped': (payload: Record<string, never>) => void
  /** OBS virtual cam state changed */
  'obs:virtualcam:changed': (payload: { active: boolean }) => void
  /** Show sequencer executed a step */
  'show:step': (payload: ShowStepPayload) => void
  /** Spotify active playlist changed */
  'spotify:state': (payload: SpotifyStatePayload) => void
  /** Spotify playback control command (broadcast to overlay for embed control) */
  'spotify:control': (payload: { command: 'play-pause' | 'next' | 'prev' | 'stop' | 'volume'; value?: number }) => void
  /** Bus trace frames batch (for dev tooling subscribers) */
  'bus:trace:frames': (frames: BusFrame[]) => void
  /** POV relay: SDP offer from server to overlay for active participant stream */
  'pov-online:relay:offer': (payload: { sdp: string }) => void
  /** POV relay: ICE candidate from server to overlay */
  'pov-online:relay:ice': (candidate: RTCIceCandidateInit) => void
}
