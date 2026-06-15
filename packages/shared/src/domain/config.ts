import type { Application, TransitionDefinition, WidgetLayoutDefinition } from './application.js'
import type { DesktopAmbianceConfig } from './ambiance.js'
import type { DesktopConfig } from './desktop.js'
import type { EventAction, EventConfig } from './event.js'
import type { MediaEntry, Scene, WindowPreset } from './scene.js'
import type { WidgetWire } from '../contracts/widget.js'

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
  /** Operator-configured widget wires (Wires panel → widget_wires table) */
  widgetWires?: WidgetWire[]
  /** Scripted show sequences (Show Sequencer → shows table) */
  shows?: ShowDefinition[]
  /** Twitch chat connection (TwitchChatManager → twitch_config table) */
  twitch?: TwitchConfig
  /** Chat reaction rules (ChatReactionManager → chat_reactions table) */
  chatReactions?: ChatReactionRule[]
  /** Spotify embedded playlists */
  spotify?: SpotifyConfig
}

// ── Spotify config ───────────────────────────────────────────────

export interface SpotifyPlaylist {
  id: string
  name: string
}

export interface SpotifyConfig {
  playlists: SpotifyPlaylist[]
  activePlaylistId?: string
}

// ── Twitch config ────────────────────────────────────────────────

export interface TwitchConfig {
  /** Twitch channel name (without #) */
  channel: string
  /** Whether to connect on server start */
  enabled: boolean
  /** OAuth access token — stored server-side only, never forwarded to overlay clients */
  accessToken?: string
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
