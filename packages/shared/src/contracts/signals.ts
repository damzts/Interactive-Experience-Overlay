/**
 * Kernel → Userspace signals.
 *
 * These are directives the kernel sends to overlay clients. The overlay reacts
 * to them but never blocks the kernel. Adding a signal here means adding one
 * entry to the overlay's signalMap.ts.
 *
 * Direction: server emits → client listens
 */

import type { STATE } from './state.js'
import type { AppConfig } from '../domain/config.js'
import type { DesktopConfig } from '../domain/desktop.js'
import type { DesktopAmbianceConfig } from '../domain/ambiance.js'
import type { WidgetLayoutItem } from '../domain/application.js'
import type { TransitionStep } from '../domain/scene.js'
import type { OverlayTriggerPayload } from './effects.js'
import type { ObsStatusPayload, RuntimeDiagnosticsPayload } from './diagnostics.js'

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
  activeRoot: 'programs' | 'widget-layouts' | null
}

export type DesktopStartMenuRoot = 'programs' | 'widget-layouts' | null

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

export interface DesktopWidgetResizePayload {
  widgetId: string
  x: number
  y: number
  width: number
  height: number
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
  widgetId: string
  action: 'open' | 'close' | 'interact'
  mirrorPolicy: AmbianceMirrorPolicy
  sharedIntent: WidgetSimulationIntentPayload | null
}

// ── Runtime config override ───────────────────────────────────────

export interface RuntimeConfigOverridePayload {
  desktopConfig?: Pick<Partial<DesktopConfig>, 'globalThemeDefault' | 'widgetThemeOverrides' | 'iconAnimation' | 'iconMotion' | 'screenSaver'>
  /** Transient per-widget position overrides (not persisted — runtime events only) */
  widgetPositions?: Record<string, { x: number; y: number }>
  /** Transient per-widget size overrides (not persisted — runtime events only) */
  widgetSizes?: Record<string, { width?: number; height?: number }>
  /** Transient per-widget z-index overrides (not persisted — runtime events only) */
  widgetZIndices?: Record<string, number>
  desktopAmbiance?: Partial<DesktopAmbianceConfig>
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
  /** Scoped runtime config override applied */
  'runtime:config:override': (payload: RuntimeConfigOverridePayload) => void
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
  /** Custom kernel bus event forwarded from managers */
  'bus:custom': (payload: { event: string; payload: unknown }) => void
  /** Widget wire triggered a widget action */
  'widget:chain:action': (payload: { targetWidgetId: string; action: string; sourceSignal: unknown }) => void
}
