/**
 * ACTION_CATALOG — extensible Runtime Actions, catalog-driven like
 * EFFECT_CATALOG (see effectCatalog.ts). Only two hand-coded legacy
 * EventAction kinds remain (desktop-config and widget-themes — their nested
 * theme patches don't fit the flat FieldDef schema); every other action's
 * config schema, defaults, and admin editor are generated from one entry
 * here — no per-kind editor code, no per-kind dispatch branch.
 *
 * Adding a new catalog action =
 *   1. one ActionConfigMap entry + config interface (below)
 *   2. one entry in ACTION_CATALOG (compiler enforces it — the record is total)
 *   3. one registerAction() call on the server (packages/server/src/kernel/actions)
 * No admin code, no scene.ts dispatch branch.
 */
import type { FieldDef, PluginManifestBase } from './fields.js'

// ── Per-kind config shapes ─────────────────────────────────────────

export interface DesktopNotifyActionConfig {
  title: string
  body: string
  icon?: string
  durationMs?: number
}

export interface SignalEmitActionConfig {
  /** Signal name broadcast on widget:signal, e.g. 'my-widget:action'. */
  event: string
  /** JSON object literal, e.g. '{"color":"red"}'. Invalid/empty parses to {}. */
  payload?: string
}

export interface ObsEnsureOverlaySourceActionConfig {
  sourceName?: string
  width?: number
  height?: number
}

export interface ObsStreamActionConfig {
  action: 'start' | 'stop'
  /** Optional RTMP URL override passed to ObsBridge.startStreaming() */
  rtmpUrl?: string
  streamKey?: string
}

export interface SceneChangeActionConfig {
  /** ID of any scene in config.scenes, including the built-in DESKTOP */
  target: string
}

export interface TransitionActionConfig {
  /** Sequence id (Sequences tab, `sequences` table) to play as an exit pipeline. */
  sequenceId: string
}

export interface PresetApplyActionConfig {
  /** ConfigPreset id (AppConfig.ConfigPreset, saved via the Presets panel) */
  presetId: string
}

export interface OverlayTriggerActionConfig {
  /** JSON array of EffectConfig objects, e.g. '[{"type":"level-up","cfg":{}}]' */
  effectsJson: string
}

export interface WidgetLayoutActionConfig {
  /** Saved layout id (AppConfig.widgetLayouts) applied as a runtime patch */
  layoutId: string
  /** Seconds until the affected widgets revert */
  timeoutSeconds?: number
}

export interface WidgetCommandActionConfig {
  widgetId: string
  /** 'open'/'close'/'toggle' mutate authoritative state server-side. Any
   *  other value is a custom widget/renderer verb handled locally by the
   *  overlay's DOM-bus evaluator (widgetRuleEvaluator.ts). */
  action: 'open' | 'close' | 'toggle' | (string & {})
}

export interface AmbiancePatchActionConfig {
  enabled: boolean
  intervalSeconds: number
  maxOpenWidgets: number
  openWhileOneOpenChance: number
  /** Seconds until the ghost-user settings revert */
  timeoutSeconds?: number
}

export interface TwitchChatSendActionConfig {
  /** Message text sent verbatim via IRC PRIVMSG. Requires config.twitch.accessToken
   *  with the chat:edit scope — a read-only (anonymous or unscoped) connection
   *  makes this a silent no-op (see TwitchIntegrationManager.sendMessage). */
  message: string
}

/** Config-less catalog actions (obs-virtualcam, persona-summarize, ambiance-clear-history). */
export type EmptyActionConfig = Record<string, never>

export interface ActionConfigMap {
  'desktop-notify': DesktopNotifyActionConfig
  'signal-emit': SignalEmitActionConfig
  'obs-virtualcam': EmptyActionConfig
  'obs-ensure-overlay-source': ObsEnsureOverlaySourceActionConfig
  'obs-stream': ObsStreamActionConfig
  'scene-change': SceneChangeActionConfig
  'transition': TransitionActionConfig
  'preset-apply': PresetApplyActionConfig
  'overlay-trigger': OverlayTriggerActionConfig
  'widget-layout': WidgetLayoutActionConfig
  'widget-command': WidgetCommandActionConfig
  'ambiance-patch': AmbiancePatchActionConfig
  'twitch-chat-send': TwitchChatSendActionConfig
  'persona-summarize': EmptyActionConfig
  'ambiance-clear-history': EmptyActionConfig
}

export type CatalogActionKind = keyof ActionConfigMap

export const ACTION_CATEGORY_ORDER = [
  'Notifications',
  'Signals',
  'OBS',
  'Scene',
  'Widgets',
  'Twitch',
  'Persona',
  'Ambiance',
] as const

export type ActionCategory = (typeof ACTION_CATEGORY_ORDER)[number]

/** Action manifest — extends the unified PluginManifestBase (label, icon,
 *  desc, fields) with action-specific defaults. */
export interface ActionManifest<K extends CatalogActionKind = CatalogActionKind> extends PluginManifestBase {
  label: string
  category: ActionCategory
  /** Draft config for a newly added instance of this action */
  defaults: ActionConfigMap[K]
  /** Schema for the generated admin editor */
  fields: FieldDef[]
}

export const ACTION_CATALOG: { [K in CatalogActionKind]: ActionManifest<K> } = {
  'desktop-notify': {
    label: 'Desktop Notification',
    category: 'Notifications',
    desc: 'Shows a toast notification on the desktop overlay.',
    defaults: { title: 'Alert', body: '', durationMs: 6000 },
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'body', label: 'Body', type: 'textarea' },
      { key: 'icon', label: 'Icon', type: 'text', optional: true, placeholder: '⚡' },
      { key: 'durationMs', label: 'Duration', type: 'slider', min: 1000, max: 20000, step: 500, unit: 'ms' },
    ],
  },
  'signal-emit': {
    label: 'Emit Custom Signal',
    category: 'Signals',
    desc: 'Broadcasts a widget:signal frame any widget or automation rule can react to — a catch-all for anything not covered by a dedicated action.',
    defaults: { event: '', payload: '' },
    fields: [
      { key: 'event', label: 'Signal name', type: 'text', placeholder: 'my-widget:action' },
      { key: 'payload', label: 'Payload (JSON)', type: 'textarea', optional: true, placeholder: '{"key":"value"}' },
    ],
  },
  'obs-virtualcam': {
    label: 'Toggle OBS Virtual Camera',
    category: 'OBS',
    desc: 'Starts or stops the OBS virtual camera.',
    defaults: {},
    fields: [],
  },
  'obs-ensure-overlay-source': {
    label: 'Repair OBS Overlay Source',
    category: 'OBS',
    desc: 'Creates or updates the browser source pointing at this overlay in OBS.',
    defaults: { sourceName: 'IEOM Overlay', width: 1920, height: 1080 },
    fields: [
      { key: 'sourceName', label: 'Source name', type: 'text' },
      { key: 'width', label: 'Width', type: 'number', min: 320, max: 7680 },
      { key: 'height', label: 'Height', type: 'number', min: 240, max: 4320 },
    ],
  },
  'obs-stream': {
    label: 'OBS: Start/Stop Stream',
    category: 'OBS',
    desc: 'Starts or stops streaming via the connected OBS instance.',
    defaults: { action: 'start' },
    fields: [
      { key: 'action', label: 'Action', type: 'select', options: ['start', 'stop'] },
      { key: 'rtmpUrl', label: 'RTMP URL override', type: 'text', optional: true },
      { key: 'streamKey', label: 'Stream key override', type: 'text', optional: true },
    ],
  },
  'scene-change': {
    label: 'Change Scene',
    category: 'Scene',
    desc: 'Transitions the active scene, running its configured intro/exit sequences.',
    defaults: { target: '' },
    fields: [
      { key: 'target', label: 'Target scene', type: 'ref', refKind: 'scene' },
    ],
  },
  'transition': {
    label: 'Play Transition',
    category: 'Scene',
    desc: 'Plays a saved transition sequence as a one-off overlay pipeline.',
    defaults: { sequenceId: '' },
    fields: [
      { key: 'sequenceId', label: 'Sequence', type: 'ref', refKind: 'sequence' },
    ],
  },
  'preset-apply': {
    label: 'Apply Config Preset',
    category: 'Scene',
    desc: 'Applies a saved config preset — persisted, not a runtime patch.',
    defaults: { presetId: '' },
    fields: [
      { key: 'presetId', label: 'Preset', type: 'ref', refKind: 'preset' },
    ],
  },
  'overlay-trigger': {
    label: 'Trigger Overlay Effects',
    category: 'Scene',
    desc: 'Fires a raw list of overlay effects directly, bypassing an Event’s effects list — mainly for Automation Rules, which have no effects array of their own.',
    defaults: { effectsJson: '[]' },
    fields: [
      { key: 'effectsJson', label: 'Effects (JSON array)', type: 'textarea', placeholder: '[{"type":"level-up","cfg":{}}]' },
    ],
  },
  'widget-layout': {
    label: 'Widget Layout',
    category: 'Widgets',
    desc: 'Applies a saved widget layout as a runtime patch — affected widgets revert after the timeout.',
    defaults: { layoutId: '', timeoutSeconds: 30 },
    fields: [
      { key: 'layoutId', label: 'Layout', type: 'ref', refKind: 'widget-layout' },
      { key: 'timeoutSeconds', label: 'Revert after', type: 'slider', min: 5, max: 600, step: 5, unit: 's' },
    ],
  },
  'widget-command': {
    label: 'Widget State',
    category: 'Widgets',
    desc: 'Opens, closes, or toggles a desktop widget window.',
    defaults: { widgetId: '', action: 'toggle' },
    fields: [
      { key: 'widgetId', label: 'Widget', type: 'ref', refKind: 'widget' },
      { key: 'action', label: 'Action', type: 'select', options: ['toggle', 'open', 'close'] },
    ],
  },
  'ambiance-patch': {
    label: 'Ghost User Override',
    category: 'Ambiance',
    desc: 'Temporarily overrides the ghost-user widget simulation, reverting after the timeout.',
    defaults: { enabled: true, intervalSeconds: 30, maxOpenWidgets: 2, openWhileOneOpenChance: 0.35, timeoutSeconds: 30 },
    fields: [
      { key: 'enabled', label: 'Ambiance enabled', type: 'boolean' },
      { key: 'intervalSeconds', label: 'Interval', type: 'slider', min: 1, max: 120, step: 1, unit: 's' },
      { key: 'maxOpenWidgets', label: 'Max open', type: 'slider', min: 1, max: 8, step: 1 },
      { key: 'openWhileOneOpenChance', label: 'Open chance', type: 'slider', min: 0, max: 1, step: 0.05 },
      { key: 'timeoutSeconds', label: 'Revert after', type: 'slider', min: 5, max: 600, step: 5, unit: 's' },
    ],
  },
  'persona-summarize': {
    label: 'Persona: Summarize Now',
    category: 'Persona',
    desc: 'Asks the active persona to summarize recent stream activity immediately.',
    defaults: {},
    fields: [],
  },
  'twitch-chat-send': {
    label: 'Twitch: Send Chat Message',
    category: 'Twitch',
    desc: 'Posts a message to Twitch chat via IRC. Requires a connected accessToken with the chat:edit scope — otherwise this silently does nothing.',
    defaults: { message: '' },
    fields: [
      { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Thanks for the follow!' },
    ],
  },
  'ambiance-clear-history': {
    label: 'Ambiance: Clear History',
    category: 'Ambiance',
    desc: 'Clears the ambient widget-simulation interaction history.',
    defaults: {},
    fields: [],
  },
}

export const ALL_CATALOG_ACTION_KINDS = Object.keys(ACTION_CATALOG) as CatalogActionKind[]

export function getActionCategories(): { label: ActionCategory; kinds: CatalogActionKind[] }[] {
  return ACTION_CATEGORY_ORDER
    .map((label) => ({
      label,
      kinds: ALL_CATALOG_ACTION_KINDS.filter((kind) => ACTION_CATALOG[kind].category === label),
    }))
    .filter((group) => group.kinds.length > 0)
}

export function getActionLabel(kind: CatalogActionKind): string {
  return ACTION_CATALOG[kind]?.label ?? kind
}

export function isCatalogActionKind(kind: string): kind is CatalogActionKind {
  return kind in ACTION_CATALOG
}
