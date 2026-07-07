import type { Application, TransitionDefinition, WidgetLayoutDefinition } from './application.js'
import type { DesktopAmbianceConfig, EffectAmbianceConfig } from './ambiance.js'
import type { DesktopConfig } from './desktop.js'
import type { DesktopThemeDriftConfig } from './themeDrift.js'
import type { PersonaConfig } from './persona.js'
import type { EventAction, EventConfig } from './event.js'
import type { MediaEntry, Scene, WindowPreset } from './scene.js'
import type { AutomationRule } from '../contracts/automation.js'

// ── Show Sequencer types ─────────────────────────────────────────

/** A single step in a scripted show sequence */
export interface ShowStep {
  /** Milliseconds from show start before this step executes */
  delayMs: number
  /** Human-readable label shown in diagnostics / bus events */
  label?: string
  /** The engine action to execute at this step */
  action: EventAction
}

/** A named scripted sequence of engine actions */
export interface ShowDefinition {
  id: string
  label: string
  steps: ShowStep[]
}

// ── Audio reactivity config ───────────────────────────────────────

/** Where audio-reactivity (beat/energy detection, audio-reactive backgrounds)
 *  reads its signal from. 'internal' taps the engine's own SFX/music/ambient
 *  bus (no permission prompt); 'microphone'/'system' capture a live
 *  MediaStream via getUserMedia/getDisplayMedia in the overlay's own browser
 *  context. */
export type AudioReactiveSourceMode = 'internal' | 'microphone' | 'system'

export interface AudioReactivityConfig {
  enabled: boolean
  source: AudioReactiveSourceMode
  /** 0–1, scales the beat detection threshold */
  sensitivity: number
  /** 0–1, level smoothing factor fed to useAudioLevel */
  smoothing: number
}

/** Root application config — stored in server memory */
export interface AppConfig {
  scenes: Record<string, Scene>
  applications: Application[]
  keybinds: {
    obs: Record<string, string>
    admin: Record<string, string>
  }
  obs: {
    url: string
    password: string
  }
  audio: {
    masterVolume: number
    sfxVolume: number
    musicVolume: number
    /** Global looping ambient track URL. Scene.ambientTrack overrides when set. */
    ambientTrack?: string
    /** 0–1 gain for the ambient layer, default 0.6 */
    ambientVolume?: number
    /** Audio-reactivity wiring — which audio feeds beat/energy detection and
     *  audio-reactive backgrounds (AudioEngine.setReactiveSource). */
    reactivity?: AudioReactivityConfig
  }
  desktopConfig?: DesktopConfig
  desktopAmbiance?: DesktopAmbianceConfig
  /** Named widget layout presets (owned by WidgetLayoutPanel → widget_layouts table) */
  widgetLayouts?: WidgetLayoutDefinition[]
  /** Media effects (Media Library → Effects tab → media_effects table) */
  sourceEvents?: EventConfig[]
  /** Saved media gallery entries (Media Library → Gallery tab → media_gallery table) */
  sourceMedia?: MediaEntry[]
  /** Reusable renderer presets (Media Library → Renders tab → media_renders table) */
  windowPresets?: WindowPreset[]
  /** Named transition definitions (Media Library → Transitions tab → media_transitions table) */
  sourceTransitions?: TransitionDefinition[]
  /** Operator-configured automation rules (Automation panel → automation_rules table).
   *  Widget-source rules are evaluated in the overlay; kernel-source rules in the server. */
  automationRules?: AutomationRule[]
  /** Scripted show sequences (Show Sequencer → shows table) */
  shows?: ShowDefinition[]
  /** Twitch connection config (TwitchIntegrationManager → twitch_config table) */
  twitch?: TwitchConfig
  /** Ambient random effect loop config (EffectAmbianceManager) */
  effectAmbiance?: EffectAmbianceConfig
  /** Chat reaction rules (ChatReactionManager → chat_reactions table) */
  chatReactions?: ChatReactionRule[]
  /** Ambient art-style drift config (ThemeDriftManager → desktop_theme_drift table) */
  desktopThemeDrift?: DesktopThemeDriftConfig
  /** Chat-to-voice companion config (PersonaManager → desktop_persona table) */
  persona?: PersonaConfig
}

// ── Twitch config ────────────────────────────────────────────────

export type TwitchEventKind =
  | 'follow'
  | 'subscribe'
  | 'gift-sub'
  | 'cheer'
  | 'raid'
  | 'points-redemption'
  | 'stream-online'
  | 'stream-offline'
  | 'hype-train-begin'
  | 'hype-train-end'

export interface TwitchEventReaction {
  event: TwitchEventKind
  enabled: boolean
  actions?: EventAction[]
  effects?: import('../contracts/effects.js').EffectConfig[]
}

export interface TwitchConfig {
  /** Twitch channel name (without #) */
  channel: string
  /** Whether to connect on server start */
  enabled: boolean
  /** OAuth access token — stored server-side only, never forwarded to overlay clients */
  accessToken?: string
  /** Twitch application Client-ID (required for EventSub subscriptions) */
  clientId?: string
  /** Per-event reactions fired when an EventSub notification arrives */
  eventReactions?: TwitchEventReaction[]
}

// ── Chat reaction types ──────────────────────────────────────────

export interface ChatReactionMatch {
  /** keyword: case-insensitive substring; command: message starts with !value; regex: JS regex string */
  type: 'keyword' | 'command' | 'regex'
  value: string
}

export interface ChatReactionRule {
  id: string
  label: string
  enabled: boolean
  match: ChatReactionMatch
  /** Engine actions to execute when the rule fires (same EventAction union as EventConfig) */
  actions?: EventAction[]
  /** Overlay effects to trigger when the rule fires */
  effects?: import('../contracts/effects.js').EffectConfig[]
  /** Minimum milliseconds between firings of this rule (cooldown) */
  cooldownMs?: number
}

// ── Config presets (full-system snapshot/load) ────────────────────

/** A named snapshot of an arbitrary subset of AppConfig sections, saved/loaded as a unit. */
export interface ConfigPreset {
  id: string
  label: string
  sections: Partial<AppConfig>
  createdAt: number
}
