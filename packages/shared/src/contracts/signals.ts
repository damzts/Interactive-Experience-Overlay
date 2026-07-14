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
import type { SequenceStep } from '../domain/sequence.js'
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

export interface PersonaSpeakPayload {
  user: string
  /** The (possibly truncated) chat message text that was spoken. */
  text: string
  /** URL to the synthesized wav, servable under /assets/. */
  audioUrl: string
  t: number
  /** What prompted the line — echoed chat, an event reaction, a chat
   *  summary for the streamer, a console reply, or an LLM viewer reply. */
  kind?: 'chat' | 'event' | 'summary' | 'console' | 'reply'
}

export interface ChatMessagePayload {
  user: string
  text: string
  color: string
  badges: string[]
  channel: string
  source: 'twitch' | 'simulation'
}

export interface TwitchFollowPayload {
  user: string
  userId: string
}

export interface TwitchSubscribePayload {
  user: string
  userId: string
  tier: string
  isGift: boolean
}

export interface TwitchGiftSubPayload {
  gifter: string
  gifterId: string
  tier: string
  total: number
  cumulative?: number
}

export interface TwitchCheerPayload {
  user: string
  userId?: string
  bits: number
  message: string
  isAnonymous: boolean
}

export interface TwitchRaidPayload {
  from: string
  fromId: string
  viewers: number
}

export interface TwitchPointsRedemptionPayload {
  user: string
  userId: string
  rewardId: string
  rewardTitle: string
  input: string
}

export interface TwitchStreamOnlinePayload {
  startedAt: string
}

export interface TwitchHypeTrainBeginPayload {
  level: number
  total: number
  goal: number
}

export interface TwitchHypeTrainEndPayload {
  level: number
  total: number
}

export interface TwitchEventSubConnectedPayload {
  sessionId: string
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
  exit: SequenceStep[]
  /** Ordered intro pipeline — plays after scene content swaps */
  intro: SequenceStep[]
}

// ── Desktop signal payloads ───────────────────────────────────────

export interface DesktopNotificationPayload {
  title: string
  body: string
  icon?: string
  durationMs?: number
}

/**
 * Generic presentation-state relay. The overlay (as the owner of the skin)
 * reports named presentation facts (`key` is skin-defined, e.g. a menu or
 * bin state); the kernel stores the latest value per key opaquely and
 * rebroadcasts so other clients (admin mirrors, future follower overlays)
 * stay in sync and reconnects can resync. The kernel never interprets
 * keys or values — skin concepts do not enter the ABI.
 */
export interface PresentationStatePayload {
  key: string
  value: unknown
}

/** Client → server report variant: `activity` marks the change as user-visible
 *  activity for the idle scheduler (e.g. a menu opening). */
export interface PresentationStateReportPayload extends PresentationStatePayload {
  activity?: boolean
}

// Start-menu simulation phases, cursor mirroring, menu timelines, and the
// start-menu/recycle-bin state shapes are overlay presentation concerns —
// their types live in the overlay (desktop/simulationTypes.ts,
// desktop/presentationState.ts), not in the kernel ABI.

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

/**
 * Generic widget simulation intent. `kind` is an action id from the
 * widget's manifest `accepts` (e.g. 'gallery:next'); `params` carries
 * values pre-generated by the action's `simulate.params` hint (e.g. a
 * sticky color) so cursor theater and widget state agree. The kernel
 * carries these opaquely — it knows no widget vocabulary.
 */
export interface WidgetSimulationIntentPayload {
  actionId: string
  widgetId: string
  kind: string
  params?: Record<string, unknown>
}

export type WidgetSimulationIntentSeed = Omit<WidgetSimulationIntentPayload, 'actionId'>

// ── Audio reactivity signal payloads ──────────────────────────────
//
// Detected client-side by the overlay's audio reactivity monitor (mic/system/
// internal engine analyser) and reported to the kernel over dedicated
// ClientToServerEvents, then re-broadcast here as public kernel signals —
// same shape as a manager-originated event like twitch:follow.

/** Frequency-band snapshot (0-1 per band) taken at the moment an audio
 *  event fired. Bands are fractions of the analyser's frequency range:
 *  bass = lowest bins (kick/bass), mid = low-mids through vocals,
 *  treble = upper quarter (hats/air). */
export interface AudioBandLevels {
  bass: number
  mid: number
  treble: number
}

export interface AudioBeatPayload {
  /** Overall smoothed RMS level (0-1) at the moment of the beat. */
  energy: number
  /** Bass-band average (0-1) that triggered the beat. */
  bass: number
  /** Per-band levels at the moment of the beat. */
  bands: AudioBandLevels
}

export interface AudioEnergyPayload {
  /** Smoothed RMS level (0-1) at the moment of the threshold crossing. */
  energy: number
  /** Per-band levels at the moment of the crossing. */
  bands: AudioBandLevels
}

/** Throttled live level sample for the Admin Audio panel's VU meter —
 *  decoupled from beat/energy/silence event thresholds, just a continuous
 *  "how loud is the analyser right now" readout. */
export interface AudioLevelPayload {
  /** Overall smoothed RMS level (0-1). */
  level: number
  /** Per-band levels (0-1 each). */
  bands: AudioBandLevels
}

export interface AmbianceSimulationPayload {
  actionId: string
  /** Target ID — widget ID for widget actions, layout ID or scene ID for select actions. */
  widgetId: string
  action: 'open' | 'close' | 'interact' | 'select'
  /** Discriminates the target type. Absent means 'widget' for backward compatibility. */
  targetKind?: 'widget' | 'layout' | 'scene'
  mirrorPolicy: AmbianceMirrorPolicy
  sharedIntent: WidgetSimulationIntentPayload | null
}

// ── Kernel signal fabric ──────────────────────────────────────────
//
// Domain events (integrations, sequencers, chat) are NOT bespoke socket
// events. They travel kernel → clients inside a single generic
// 'kernel:signal' channel carrying BusFrame envelopes. This map is the
// single source of truth for which KernelBus events are public and what
// their payloads look like — the server's KernelEvents interface extends
// it, the forwarder allowlists by its keys, and clients narrow payloads
// through it (overlay: onKernelSignal helper).
//
// Adding a public manager event = add ONE entry here (+ its flag below,
// compiler-enforced). Zero transport changes.

export interface KernelSignalMap {
  'chat:message': ChatMessagePayload
  'chat:connected': { channel: string }
  'twitch:eventsub:connected': TwitchEventSubConnectedPayload
  'twitch:follow': TwitchFollowPayload
  'twitch:subscribe': TwitchSubscribePayload
  'twitch:gift-sub': TwitchGiftSubPayload
  'twitch:cheer': TwitchCheerPayload
  'twitch:raid': TwitchRaidPayload
  'twitch:points:redemption': TwitchPointsRedemptionPayload
  'twitch:stream:online': TwitchStreamOnlinePayload
  'twitch:stream:offline': Record<string, never>
  'twitch:hype-train:begin': TwitchHypeTrainBeginPayload
  'twitch:hype-train:end': TwitchHypeTrainEndPayload
  'obs:stream:started': Record<string, never>
  'obs:stream:stopped': Record<string, never>
  'obs:recording:started': Record<string, never>
  'obs:recording:stopped': Record<string, never>
  'obs:virtualcam:changed': { active: boolean }
  'show:step': ShowStepPayload
  'audio:beat': AudioBeatPayload
  'audio:energy:high': AudioEnergyPayload
  'audio:energy:low': AudioEnergyPayload
  'audio:silence': Record<string, never>
  'persona:speak': PersonaSpeakPayload
}

export type KernelSignalEvent = keyof KernelSignalMap

/** Total record — adding a KernelSignalMap entry fails compilation until
 *  its flag exists here, and vice versa. Keeps map and allowlist in sync. */
const PUBLIC_KERNEL_SIGNAL_FLAGS: Record<KernelSignalEvent, true> = {
  'chat:message': true,
  'chat:connected': true,
  'twitch:eventsub:connected': true,
  'twitch:follow': true,
  'twitch:subscribe': true,
  'twitch:gift-sub': true,
  'twitch:cheer': true,
  'twitch:raid': true,
  'twitch:points:redemption': true,
  'twitch:stream:online': true,
  'twitch:stream:offline': true,
  'twitch:hype-train:begin': true,
  'twitch:hype-train:end': true,
  'obs:stream:started': true,
  'obs:stream:stopped': true,
  'obs:recording:started': true,
  'obs:recording:stopped': true,
  'obs:virtualcam:changed': true,
  'show:step': true,
  'audio:beat': true,
  'audio:energy:high': true,
  'audio:energy:low': true,
  'audio:silence': true,
  'persona:speak': true,
}

export const PUBLIC_KERNEL_SIGNALS = Object.keys(PUBLIC_KERNEL_SIGNAL_FLAGS) as KernelSignalEvent[]

const PUBLIC_KERNEL_SIGNAL_SET: ReadonlySet<string> = new Set(PUBLIC_KERNEL_SIGNALS)

export function isPublicKernelSignal(event: string): event is KernelSignalEvent {
  return PUBLIC_KERNEL_SIGNAL_SET.has(event)
}

// ── Runtime config ────────────────────────────────────────────────

export interface RuntimeConfig {
  desktopConfig?: Pick<Partial<DesktopConfig>, 'globalThemeDefault' | 'widgetThemes' | 'iconAnimation' | 'iconMotion' | 'iconArrangement' | 'iconArrangementMotion'>
  /** Transient per-widget positions (not persisted — runtime state only) */
  widgetPositions?: Record<string, { x: number; y: number }>
  /** Transient per-widget sizes (not persisted — runtime state only) */
  widgetSizes?: Record<string, { width?: number; height?: number }>
  /** Transient per-widget z-indices (not persisted — runtime state only) */
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
  /** Scoped runtime config applied */
  'runtime:config': (payload: RuntimeConfig) => void
  /** Ambiance manager wants the overlay to simulate a widget action */
  'ambiance:simulate': (payload: AmbianceSimulationPayload) => void
  /** Full state resync requested (e.g. after reconnect) */
  'overlay:resync': (payload: { reason: string }) => void
  /** Overlay slot rejected — already taken */
  'overlay:rejected': (payload: { reason: string }) => void
  /** Toggle a widget open/closed */
  'widget:toggle': (widgetId: string) => void
  /** Apply a named layout preset */
  'widget:layout:apply': (layoutId: string) => void
  /** Apply raw layout items */
  'widget:layout:apply:items': (items: WidgetLayoutItem[]) => void
  /** OS-style desktop notification */
  'desktop:notify': (payload: DesktopNotificationPayload) => void
  /** Generic presentation-state relay — a client-reported skin fact changed */
  'presentation:state': (payload: PresentationStatePayload) => void
  /** Widget wire triggered a widget action */
  'widget:chain:action': (payload: { targetWidgetId: string; action: string; sourceSignal: unknown }) => void
  /** Server-produced widget-style signal (signal:emit automation action) — overlay re-enters it on the DOM bus */
  'widget:signal': (payload: { source: string; event: string; payload: unknown }) => void
  /** Generic domain-event channel — BusFrame envelopes for every public
   *  KernelBus event (see KernelSignalMap). Clients subscribe via a typed
   *  helper (overlay: onKernelSignal) instead of bespoke socket events. */
  'kernel:signal': (frame: BusFrame) => void
  /** Bus trace frames batch (for dev tooling subscribers) */
  'bus:trace:frames': (frames: BusFrame[]) => void
  /** Server → admin: passthrough relay of the overlay's throttled audio:level
   *  sample, for the Audio panel's live VU meter. */
  'audio:level': (payload: AudioLevelPayload) => void
  /** POV relay: SDP offer from server to overlay for active participant stream */
  'pov-online:relay:offer': (payload: { sdp: string }) => void
  /** POV relay: ICE candidate from server to overlay */
  'pov-online:relay:ice': (candidate: RTCIceCandidateInit) => void

  // ── Screen-share relay (admin ↔ server ↔ overlay WebRTC, local only) ──
  /** Server → overlay: relayed SDP offer from the admin publisher for widgetId */
  'screen-share:offer': (payload: { widgetId: string; sdp: string }) => void
  /** Server → overlay: relayed ICE candidate from the admin publisher */
  'screen-share:ice:admin': (payload: { widgetId: string; candidate: RTCIceCandidateInit }) => void
  /** Server → admin: relayed SDP answer from the overlay subscriber */
  'screen-share:answer': (payload: { widgetId: string; sdp: string }) => void
  /** Server → admin: relayed ICE candidate from the overlay subscriber */
  'screen-share:ice:overlay': (payload: { widgetId: string; candidate: RTCIceCandidateInit }) => void
  /** Server → overlay: the publisher stopped sharing — tear down the subscriber PC for widgetId */
  'screen-share:stop': (payload: { widgetId: string }) => void
}
