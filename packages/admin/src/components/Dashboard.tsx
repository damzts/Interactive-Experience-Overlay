import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS,
  DEFAULT_RECYCLE_BIN_SETTINGS,
  DEFAULT_STICKY_NOTES_SETTINGS,
  DEFAULT_WIDGET_THEME_PRESETS,
  getDefaultWidgetWindowSize,
  getDefaultWidgetZIndex,
  getWidgetComponent,
  getWidgetSource,
  isSystemWidget,
  STATE,
  OVERLAY_EVENT,
  withDesktopConfigDefaults,
  withLobbyConfigDefaults,
  withOverlayStyleDefaults,
} from '@ieom/shared'
import type {
  OverlayStyle, BackgroundType, PatternPreset, ParticlePreset,
  Application, LobbyConfig, DesktopConfig, ApplicationType, Scene, SourceInstance,
  DesktopNotificationEffectConfig, EffectType, EffectConfig, MediaEntry, TransitionStep, WidgetLayoutDefinition, WidgetLayoutItem,
  RecycleBinSettings, StickyNotesSettings, WidgetComponentType,
} from '@ieom/shared'
import { socket } from '../socket/client'
import { useAdminStore } from '../store/useAdminStore'
import { inferAssetKindFromUrl, type AssetKind } from '../assets/catalog'
import { AssetCatalogPanel, AssetSelectionInput } from './AssetLibrary'
import { Panel, Toggle, Slider, Btn, HexColorInput, isSameDraft, IconGlyph, ConfigApplyBar, ConfigSectionPanel, FloatingWindowShell, FloatingWindowHeader, ConfigCard, ConfigNotice, ConfigChoiceButton, ConfigPreviewButton, ConfigSwatchButton, ConfigToolbar } from './ui'
import { SettingsPage } from '../pages/SettingsPage'
import { ArchivePanel } from '../pages/ArchivePanel'
import { KeybindEditor } from '../pages/KeybindEditor'
import { AudioPanel }   from '../pages/AudioPanel'
import { AmbiancePanel } from '../pages/AmbiancePanel'

// ── Presets ────────────────────────────────────────────────────────

const GRADIENT_PRESETS = [
  { name: 'Deep Space',   value: 'linear-gradient(135deg, #0c0c1e 0%, #1a0533 50%, #0c0c1e 100%)' },
  { name: 'Cyberpunk',    value: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 40%, #0a1a2e 100%)' },
  { name: 'Forest Night', value: 'linear-gradient(135deg, #080f08 0%, #0a1f0a 60%, #040a04 100%)' },
  { name: 'Blood Moon',   value: 'linear-gradient(135deg, #1a0000 0%, #3d0000 50%, #1a0010 100%)' },
  { name: 'Arctic Abyss', value: 'linear-gradient(135deg, #050f1a 0%, #051525 60%, #020710 100%)' },
  { name: 'Gold Ember',   value: 'linear-gradient(135deg, #1a0f00 0%, #2d1f00 50%, #0d0900 100%)' },
  { name: 'Plasma',       value: 'radial-gradient(ellipse at 20% 20%, #1a0040 0%, #000010 60%, #001a3d 100%)' },
  { name: 'Void',         value: 'radial-gradient(ellipse at center, #0a0a0a 0%, #000000 100%)' },
  { name: 'Amethyst',     value: 'linear-gradient(45deg, #1a0033 0%, #330066 50%, #1a0033 100%)' },
]

const PATTERN_CSS: Record<PatternPreset, React.CSSProperties> = {
  none:       {},
  grid:       { backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '50px 50px', backgroundColor: '#0a0a0f' },
  dots:       { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)', backgroundSize: '28px 28px', backgroundColor: '#0a0a0f' },
  diagonal:   { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.04) 8px, rgba(255,255,255,0.04) 9px)', backgroundColor: '#0a0a0f' },
  honeycomb:  { backgroundSize: '28px 48px', backgroundImage: 'radial-gradient(circle farthest-side at 0% 50%, transparent 23.5%, rgba(255,255,255,.05) 24%, rgba(255,255,255,.05) 26%, transparent 27.75%)', backgroundColor: '#0a0a0f' },
  circuit:    { backgroundImage: 'linear-gradient(rgba(0,204,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,204,255,.05) 1px, transparent 1px)', backgroundSize: '50px 50px', backgroundColor: '#030810' },
  topography: { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.07)' d='M20 40Q40 20 60 40Q80 60 100 40Q120 20 140 40Q160 60 180 40'/%3E%3C/svg%3E\")", backgroundColor: '#0a0a0f' },
}

const PARTICLE_PRESETS: { id: ParticlePreset; icon: string; label: string }[] = [
  { id: 'none',      icon: '○', label: 'None'      },
  { id: 'stars',     icon: '✦', label: 'Stars'     },
  { id: 'snow',      icon: '❄', label: 'Snow'      },
  { id: 'matrix',    icon: '⌥', label: 'Matrix'    },
  { id: 'fireflies', icon: '◉', label: 'Fireflies' },
  { id: 'ash',       icon: '◦', label: 'Ash'       },
]

const GOOGLE_FONTS = [
  { name: 'System Default',  css: 'default'         },
  { name: 'Press Start 2P',  css: 'Press Start 2P'  },
  { name: 'VT323',           css: 'VT323'           },
  { name: 'Orbitron',        css: 'Orbitron'        },
  { name: 'Share Tech Mono', css: 'Share Tech Mono' },
  { name: 'Rajdhani',        css: 'Rajdhani'        },
  { name: 'Audiowide',       css: 'Audiowide'       },
  { name: 'Electrolize',     css: 'Electrolize'     },
]

const ACCENT_SWATCHES = ['#00ff41', '#06b6d4', '#a855f7', '#f97316', '#ec4899', '#eab308', '#ef4444', '#ffffff']


type ThemeAppearance = Pick<OverlayStyle, 'fontFamily' | 'accentColor' | 'textColor'>

function clampWidgetDimension(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function resolveAppWidgetComponent(app: Pick<Application, 'id' | 'appType' | 'widgetComponent'>): WidgetComponentType {
  return getWidgetComponent(app) ?? 'generic'
}

function getDefaultWidgetSize(app: Pick<Application, 'id' | 'appType' | 'widgetComponent'>) {
  return getDefaultWidgetWindowSize(app.id, resolveAppWidgetComponent(app))
}

function resolveWidgetSizeFromConfig(app: Pick<Application, 'id' | 'appType' | 'widgetComponent'>, desktopConfig: DesktopConfig) {
  const defaults = getDefaultWidgetSize(app)
  const raw = desktopConfig.widgetSizes?.[app.id]
  return {
    width: clampWidgetDimension(raw?.width ?? defaults.width, 180, 1400, defaults.width),
    height: clampWidgetDimension(raw?.height ?? defaults.height, 140, 1000, defaults.height),
  }
}

function resolveWidgetDefaultZIndexFromConfig(app: Pick<Application, 'id' | 'appType' | 'widgetComponent'>, desktopConfig: DesktopConfig) {
  const value = desktopConfig.widgetDefaultZIndices?.[app.id]
  return Number.isFinite(value)
    ? Math.max(0, Math.round(value as number))
    : getDefaultWidgetZIndex(app.id, resolveAppWidgetComponent(app))
}

function buildWidgetLayoutFallbackPosition(widgetIndex: number) {
  return {
    x: 80 + (widgetIndex % 2) * 48,
    y: 72 + widgetIndex * 28,
  }
}

function buildWidgetLayoutItem(
  app: Application,
  widgetIndex: number,
  desktopConfig: DesktopConfig,
  enabled: boolean,
): WidgetLayoutItem {
  const position = desktopConfig.widgetPositions?.[app.id] ?? buildWidgetLayoutFallbackPosition(widgetIndex)
  const size = resolveWidgetSizeFromConfig(app, desktopConfig)
  const focusPriority = desktopConfig.widgetZIndices?.[app.id] ?? resolveWidgetDefaultZIndexFromConfig(app, desktopConfig)

  return {
    widgetId: app.id,
    enabled,
    x: Math.max(0, Math.round(position.x)),
    y: Math.max(0, Math.round(position.y)),
    width: Math.max(180, Math.round(size.width)),
    height: Math.max(140, Math.round(size.height)),
    focusPriority: Math.max(0, Math.round(Number.isFinite(focusPriority as number) ? (focusPriority as number) : 0)),
  }
}

function createWidgetLayoutFromCurrentState(
  label: string,
  widgetApps: Application[],
  desktopConfig: DesktopConfig,
  openWidgetIds: string[],
): WidgetLayoutDefinition {
  const trimmedLabel = label.trim() || 'Widget Layout'
  const slug = trimmedLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'widget-layout'

  return {
    id: `${slug}-${Date.now()}`,
    label: trimmedLabel,
    icon: '📐',
    source: 'user',
    items: widgetApps.map((app, index) => buildWidgetLayoutItem(app, index, desktopConfig, openWidgetIds.includes(app.id))),
  }
}

function normalizeWidgetLayoutsForEditor(
  widgetLayouts: WidgetLayoutDefinition[] | undefined,
  widgetApps: Application[],
  desktopConfig: DesktopConfig,
) {
  const layouts = widgetLayouts ?? []

  return layouts.map((layout) => ({
    ...layout,
    items: widgetApps.map((app, index) => {
      const source = layout.items.find((item) => item.widgetId === app.id)
      const fallback = buildWidgetLayoutItem(app, index, desktopConfig, false)

      return {
        widgetId: app.id,
        enabled: source?.enabled ?? fallback.enabled,
        x: Math.max(0, Math.round(source?.x ?? fallback.x)),
        y: Math.max(0, Math.round(source?.y ?? fallback.y)),
        width: clampWidgetDimension(source?.width ?? fallback.width, 180, 1400, fallback.width),
        height: clampWidgetDimension(source?.height ?? fallback.height, 140, 1000, fallback.height),
        focusPriority: Number.isFinite(source?.focusPriority)
          ? Math.round(source!.focusPriority)
          : fallback.focusPriority,
      }
    }),
  }))
}

type UserWidgetBaseComponent = 'camera' | 'source'

const USER_WIDGET_COMPONENT_OPTIONS: Array<{
  id: UserWidgetBaseComponent
  label: string
  icon: string
  description: string
}> = [
  {
    id: 'camera',
    label: 'Camera',
    icon: '📷',
    description: 'Opens a desktop camera window with per-widget camera defaults.',
  },
  {
    id: 'source',
    label: 'Source',
    icon: '🧩',
    description: 'Opens a desktop window bound to an existing scene source renderer.',
  },
]

function buildUserWidgetId(
  widgetComponent: UserWidgetBaseComponent,
  label: string,
  existingIds: Set<string>,
) {
  const slug = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'widget'
  const normalizedSlug = slug.replace(new RegExp(`^${widgetComponent}-`), '') || 'widget'
  const base = `${widgetComponent}-${normalizedSlug}`

  if (!existingIds.has(base)) return base

  let suffix = 2
  while (existingIds.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

function findFirstSceneSource(scenes: Record<string, Scene>) {
  for (const scene of Object.values(scenes)) {
    const firstSource = scene.sources[0]
    if (firstSource) {
      return { sceneId: scene.id, sourceId: firstSource.id }
    }
  }

  return undefined
}

function removeWidgetFromDesktopConfig(desktopConfig: DesktopConfig, widgetId: string): DesktopConfig {
  const next = withDesktopConfigDefaults(desktopConfig)
  const nextPositions = { ...(next.widgetPositions ?? {}) }
  const nextSizes = { ...(next.widgetSizes ?? {}) }
  const nextDefaultZIndices = { ...(next.widgetDefaultZIndices ?? {}) }
  const nextRuntimeZIndices = { ...(next.widgetZIndices ?? {}) }

  delete nextPositions[widgetId]
  delete nextSizes[widgetId]
  delete nextDefaultZIndices[widgetId]
  delete nextRuntimeZIndices[widgetId]

  return {
    ...next,
    widgetPositions: Object.keys(nextPositions).length ? nextPositions : undefined,
    widgetSizes: Object.keys(nextSizes).length ? nextSizes : undefined,
    widgetDefaultZIndices: Object.keys(nextDefaultZIndices).length ? nextDefaultZIndices : undefined,
    widgetZIndices: Object.keys(nextRuntimeZIndices).length ? nextRuntimeZIndices : undefined,
    widgetLayouts: (next.widgetLayouts ?? []).map((layout) => ({
      ...layout,
      items: layout.items.filter((item) => item.widgetId !== widgetId),
    })),
  }
}

function ThemeAppearanceFields({
  appearance,
  onChange,
  helperText,
}: {
  appearance: ThemeAppearance
  onChange: (updater: (draft: ThemeAppearance) => void) => void
  helperText?: string
}) {
  const activeFont = GOOGLE_FONTS.find((font) => font.css === appearance.fontFamily) ?? GOOGLE_FONTS[0]

  return (
    <div className="space-y-3">
      {helperText && <div className="text-[10px] text-zinc-500 leading-relaxed">{helperText}</div>}
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Font</div>
          <div className="text-[10px] text-zinc-600 truncate">{activeFont.name}</div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {GOOGLE_FONTS.map((font) => (
            <ConfigChoiceButton
              key={font.css}
              type="button"
              selected={appearance.fontFamily === font.css}
              onClick={() => onChange((d) => { d.fontFamily = font.css })}
              className="min-h-0 justify-start px-2.5 py-1.5 text-left normal-case"
              style={font.css !== 'default' ? { fontFamily: font.css } : undefined}
              title={font.name}
            >
              <span className="min-w-0 truncate text-[10px] font-semibold leading-none">{font.name}</span>
            </ConfigChoiceButton>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Accent</div>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {ACCENT_SWATCHES.map((color) => (
            <ConfigSwatchButton
              key={color}
              type="button"
              color={color}
              selected={appearance.accentColor === color}
              onClick={() => onChange((d) => { d.accentColor = color })}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <HexColorInput
            value={appearance.accentColor}
            onChange={(nextValue) => onChange((d) => { d.accentColor = nextValue })}
            className="gap-2"
            pickerStyle={{ width: 32, height: 28 }}
            textClassName="font-mono text-xs w-28"
          />
        </div>
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Text</div>
        <div className="flex items-center gap-2">
          <HexColorInput
            value={appearance.textColor}
            onChange={(nextValue) => onChange((d) => { d.textColor = nextValue })}
            className="gap-2"
            pickerStyle={{ width: 32, height: 28 }}
            textClassName="font-mono text-xs w-28"
          />
        </div>
      </div>
    </div>
  )
}

function LabeledHexColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      {label && <label className="text-[11px] text-zinc-400 w-16 shrink-0">{label}</label>}
      <HexColorInput
        value={value}
        onChange={onChange}
        className="flex-1 min-w-0 gap-2"
        pickerClassName="w-7 h-6 shrink-0"
        textClassName="font-mono text-xs flex-1 min-w-0"
      />
    </div>
  )
}

const TRANSITION_OPTIONS = [
  { id: 'instant',       label: 'Instant',        desc: 'Immediate cut, no animation' },
  { id: 'fade',          label: 'Fade',           desc: 'Cross-fade through black' },
  { id: 'zoom-in',       label: 'Zoom In',        desc: 'Camera rushes into CRT screen' },
  { id: 'zoom-out',      label: 'Zoom Out',       desc: 'Screen shrinks back to 3D room' },
  { id: 'win98-loading', label: 'Win98 Loading',  desc: 'Windows 98 progress dialog' },
  { id: 'crt-wipe',      label: 'CRT Wipe',       desc: 'Static fills screen then clears' },
  { id: 'channel-sweep', label: 'Channel Sweep',  desc: 'TV channel-change scan-line' },
  { id: 'boot-sequence', label: 'Boot Sequence',  desc: 'BIOS POST text and progress bar' },
  { id: 'glitch-burst',  label: 'Glitch Burst',   desc: 'Digital glitch explosion' },
  { id: 'static-burst',  label: 'Static Burst',   desc: 'TV static fill then clear' },
  { id: 'wipe-left',     label: 'Wipe Left',      desc: 'Black panel sweeps from right' },
  { id: 'wipe-right',    label: 'Wipe Right',     desc: 'Black panel sweeps from left' },
]

// ── Source catalog ────────────────────────────────────────────────
interface FieldDef {
  key: string; label: string
  type: 'text' | 'number' | 'color' | 'boolean' | 'select'
  assetKinds?: AssetKind[]
  options?: string[]; min?: number; max?: number; step?: number; placeholder?: string
}
interface CatalogEntry {
  type: string; label: string; icon: string; desc: string
  defaultConfig: Record<string, unknown>
  fields: FieldDef[]
  defaultPosition?: { x: number; y: number; width: number; height: number }
}
const SOURCE_CATALOG: CatalogEntry[] = [
  {
    type: 'image-slideshow', label: 'Game Slideshow', icon: '🎞', desc: 'Auto-cycling scraped game screenshots',
    defaultConfig: { interval: 6, shuffle: true },
    fields: [
      { key: 'interval', label: 'Interval (s)', type: 'number', min: 1, max: 60, step: 1 },
      { key: 'shuffle',  label: 'Shuffle',      type: 'boolean' },
    ],
  },
  {
    type: 'image-static', label: 'Static Image', icon: '🖼', desc: 'Single image — local path or URL',
    defaultConfig: { url: '', objectFit: 'cover', opacity: 1 },
    fields: [
      { key: 'url',       label: 'URL / Path', type: 'text', assetKinds: ['image'], placeholder: '/assets/backgrounds/name.jpg' },
      { key: 'objectFit', label: 'Fit',        type: 'select', options: ['cover', 'contain', 'fill'] },
      { key: 'opacity',   label: 'Opacity',    type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'video-loop', label: 'Video Loop', icon: '🎬', desc: 'Muted looping video — local path or URL',
    defaultConfig: { url: '', opacity: 1 },
    fields: [
      { key: 'url',     label: 'URL / Path', type: 'text', assetKinds: ['video'], placeholder: '/assets/video/name.mp4' },
      { key: 'opacity', label: 'Opacity',    type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'solid-color', label: 'Solid Color', icon: '⬛', desc: 'Flat opaque color fill',
    defaultConfig: { color: '#000000' },
    fields: [
      { key: 'color', label: 'Color', type: 'color' },
    ],
  },
  {
    type: 'color-overlay', label: 'Color Overlay', icon: '🎨', desc: 'Semi-transparent color wash',
    defaultConfig: { color: '#000000', opacity: 0.5 },
    fields: [
      { key: 'color',   label: 'Color',   type: 'color' },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'crt-effect', label: 'CRT Scanlines', icon: '📺', desc: 'Retro scanline + vignette overlay',
    defaultConfig: { scanlineIntensity: 0.25, vignetteStrength: 0.5 },
    fields: [
      { key: 'scanlineIntensity', label: 'Scanlines', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'vignetteStrength',  label: 'Vignette',  type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'vignette', label: 'Vignette', icon: '◉', desc: 'Edge-darkening radial gradient',
    defaultConfig: { color: '#000000', strength: 0.6 },
    fields: [
      { key: 'color',    label: 'Color',    type: 'color' },
      { key: 'strength', label: 'Strength', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'noise-grain', label: 'Film Grain', icon: '📽', desc: 'Animated film grain noise (overlay blend)',
    defaultConfig: { opacity: 0.08, animated: true },
    fields: [
      { key: 'opacity',  label: 'Opacity',  type: 'number', min: 0, max: 0.5, step: 0.01 },
      { key: 'animated', label: 'Animated', type: 'boolean' },
    ],
  },
  {
    type: 'text-widget', label: 'Text Label', icon: '✍', desc: 'Static or typewriter text block',
    defaultConfig: { content: 'Label', font: 'vt323', fontSize: 28, color: '#ffffff', typewriterMode: false },
    fields: [
      { key: 'content',        label: 'Content',    type: 'text' },
      { key: 'font',           label: 'Font',       type: 'select', options: ['vt323', 'press-start', 'monospace', 'serif'] },
      { key: 'fontSize',       label: 'Size',       type: 'number', min: 8, max: 200, step: 2 },
      { key: 'color',          label: 'Color',      type: 'color' },
      { key: 'typewriterMode', label: 'Typewriter', type: 'boolean' },
    ],
  },
  {
    type: 'clock-widget', label: 'Clock', icon: '🕐', desc: 'Live digital clock display',
    defaultConfig: { format: '24h', color: '#00ff41', fontSize: 36, font: 'vt323' },
    defaultPosition: { x: 1680, y: 20, width: 220, height: 60 },
    fields: [
      { key: 'format',   label: 'Format', type: 'select', options: ['24h', '12h', '24h-sec', '12h-sec'] },
      { key: 'color',    label: 'Color',  type: 'color' },
      { key: 'fontSize', label: 'Size',   type: 'number', min: 8, max: 200, step: 2 },
      { key: 'font',     label: 'Font',   type: 'select', options: ['vt323', 'press-start', 'monospace', 'serif'] },
    ],
  },
]

// ── TransitionPicker ─────────────────────────────────────────────

const TRANSITION_ICONS: Record<string, string> = {
  'instant':       '⚡',
  'fade':          '🌫',
  'zoom-in':       '🔍',
  'zoom-out':      '🔎',
  'win98-loading': '💾',
  'crt-wipe':      '📺',
  'channel-sweep': '📡',
  'boot-sequence': '🖥',
  'glitch-burst':  '⚠',
  'static-burst':  '📻',
  'wipe-left':     '◀',
  'wipe-right':    '▶',
}

const TRANSITION_TEST_BUTTON_CLASS = 'rounded border border-cyan-500/40 bg-cyan-600/25 px-3 py-1.5 text-xs text-cyan-300 transition-colors hover:bg-cyan-600/40 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-700'
const TRANSITION_DELETE_BUTTON_CLASS = 'rounded border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 transition-colors hover:bg-red-500/20'

function encodeMediaTransitionValue(entry: Pick<MediaEntry, 'type' | 'url' | 'name' | 'duration'>) {
  const trimmedName = entry.name.trim()
  const hasDur = entry.type === 'image' && entry.duration != null && entry.duration > 0
  let encoded = `media:${entry.type}:${entry.url}`
  if (trimmedName || hasDur) encoded += `||${trimmedName}`
  if (hasDur) encoded += `||dur=${entry.duration}`
  return encoded
}

function parseMediaTransitionValue(value: string) {
  const body = value.slice(6)
  const colon = body.indexOf(':')
  const type = colon >= 0 ? body.slice(0, colon) : body
  const rest = colon >= 0 ? body.slice(colon + 1) : ''
  const parts = rest.split('||')
  const url = parts[0] ?? ''
  const name = parts[1] ?? ''
  const durPart = parts.slice(2).find((part) => part.startsWith('dur='))
  const duration = durPart ? parseFloat(durPart.slice(4)) : undefined
  return {
    type: type as MediaEntry['type'],
    url,
    name,
    duration,
  }
}

function parseBuiltInTransitionValue(value: string) {
  const queryIndex = value.indexOf('?')
  const id = queryIndex >= 0 ? value.slice(0, queryIndex) : value
  const duration = queryIndex >= 0 ? new URLSearchParams(value.slice(queryIndex + 1)).get('duration') : null
  return {
    id,
    duration: duration ? parseFloat(duration) : undefined,
  }
}

function formatBuiltInTransitionValue(id: string, durationDraft: string) {
  const duration = parseFloat(durationDraft)
  return Number.isFinite(duration) && duration > 0 ? `${id}?duration=${duration}` : id
}

function getMediaTransitionLabel(entry: Pick<MediaEntry, 'name' | 'url'>) {
  return entry.name.trim() || entry.url.split('/').pop() || 'Untitled transition'
}

function TransitionPicker({
  value,
  onChange,
  placeholder = '— Default —',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const mediaLibrary = useAdminStore((s) => s.config.mediaLibrary ?? [])
  const [durationDraft, setDurationDraft] = useState('')

  const mediaParsed = value.startsWith('media:') ? parseMediaTransitionValue(value) : null
  const gsapParsed = !value.startsWith('media:') ? parseBuiltInTransitionValue(value) : null
  const selectedBuiltIn = TRANSITION_OPTIONS.find((transition) => transition.id === (gsapParsed?.id ?? ''))

  const savedCustomOptions = useMemo(() => (
    [...mediaLibrary]
      .sort((left, right) => getMediaTransitionLabel(left).localeCompare(getMediaTransitionLabel(right)))
      .map((entry) => ({
        encoded: encodeMediaTransitionValue(entry),
        entry,
      }))
  ), [mediaLibrary])

  const customOptions = useMemo(() => {
    if (!mediaParsed) return savedCustomOptions
    if (savedCustomOptions.some((option) => option.encoded === value)) return savedCustomOptions
    return [
      {
        encoded: value,
        entry: {
          id: 'current-transition',
          name: mediaParsed.name || getMediaTransitionLabel(mediaParsed),
          type: mediaParsed.type,
          url: mediaParsed.url,
          ...(mediaParsed.duration != null ? { duration: mediaParsed.duration } : {}),
        } satisfies MediaEntry,
      },
      ...savedCustomOptions,
    ]
  }, [mediaParsed, savedCustomOptions, value])

  useEffect(() => {
    setDurationDraft(gsapParsed?.duration?.toString() ?? '')
  }, [gsapParsed?.duration, gsapParsed?.id, value])

  const handleSelect = (nextValue: string) => {
    setDurationDraft('')
    onChange(nextValue)
  }

  const commitDuration = () => {
    if (!selectedBuiltIn) return
    onChange(formatBuiltInTransitionValue(selectedBuiltIn.id, durationDraft))
  }

  const previewValue = selectedBuiltIn
    ? formatBuiltInTransitionValue(selectedBuiltIn.id, durationDraft)
    : value

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-1.5">
        <select
          value={mediaParsed ? value : gsapParsed?.id ?? ''}
          onChange={(event) => handleSelect(event.target.value)}
          className="flex-1 text-xs"
        >
          <option value="">{placeholder}</option>
          <optgroup label="System transitions">
            {TRANSITION_OPTIONS.map((transition) => (
              <option key={transition.id} value={transition.id}>
                {TRANSITION_ICONS[transition.id]} {transition.label}
              </option>
            ))}
          </optgroup>
          {customOptions.length > 0 && (
            <optgroup label="User transitions">
              {customOptions.map((option) => (
                <option key={option.encoded} value={option.encoded}>
                  {option.entry.type === 'image' ? '🖼' : '🎬'} {getMediaTransitionLabel(option.entry)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          type="button"
          disabled={!previewValue}
          onClick={() => {
            if (!previewValue) return
            if (selectedBuiltIn && previewValue !== value) onChange(previewValue)
            socket.emit('transition:preview', [strToStep(previewValue)])
          }}
          className={`shrink-0 ${TRANSITION_TEST_BUTTON_CLASS}`}
          title={previewValue ? 'Test on overlay' : 'Pick a transition first'}
        >
          Test
        </button>
      </div>

      {selectedBuiltIn && (
        <div className="flex items-center gap-2 pl-1">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Duration</span>
          <input
            type="number"
            min={0.1}
            max={60}
            step={0.1}
            value={durationDraft}
            onChange={(event) => setDurationDraft(event.target.value)}
            onBlur={commitDuration}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitDuration()
                event.currentTarget.blur()
              }
            }}
            placeholder="default"
            className="w-24 text-xs font-mono"
          />
          <span className="text-[10px] text-zinc-600">sec</span>
        </div>
      )}

      {mediaParsed && (
        <div className="flex items-center gap-2 pl-1 text-[10px] text-zinc-500">
          <span className="truncate">{mediaParsed.url.split('/').pop() || mediaParsed.url}</span>
          {mediaParsed.duration != null && (
            <span className="shrink-0 font-mono text-zinc-600">{mediaParsed.duration}s</span>
          )}
        </div>
      )}
    </div>
  )
}

function SourceField({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] text-zinc-500 w-16 shrink-0">{field.label}</label>
      {field.type === 'color' && (
        <HexColorInput
          value={String(value ?? '#000000')}
          onChange={(nextValue) => onChange(nextValue)}
          className="flex-1 min-w-0 gap-1"
          pickerClassName="w-6 h-5 shrink-0"
          textClassName="flex-1 font-mono text-[10px] min-w-0"
        />
      )}
      {field.type === 'number' && (
        <input type="number" value={Number(value ?? 0)}
          min={field.min} max={field.max} step={field.step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 font-mono text-xs" />
      )}
      {field.type === 'text' && (
        field.assetKinds?.length ? (
          <div className="flex-1 min-w-0">
            <AssetSelectionInput
              value={String(value ?? '')}
              onChange={(nextValue) => onChange(nextValue)}
              kinds={field.assetKinds}
              modalTitle={field.label}
              placeholder={field.placeholder}
              buttonLabel="Browse Assets"
              previewKind={field.assetKinds[0] ?? 'auto'}
            />
          </div>
        ) : (
          <input type="text" value={String(value ?? '')} placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 text-xs" />
        )
      )}
      {field.type === 'boolean' && (
        <input type="checkbox" checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)} />
      )}
      {field.type === 'select' && (
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className="flex-1 text-xs">
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </div>
  )
}

function SourcesEditor({ sceneId }: { sceneId: string }) {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const scene      = config.scenes[sceneId] as (typeof config.scenes)[string] | undefined
  const sources    = (scene?.sources ?? []) as SourceInstance[]
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [showCatalog, setShowCatalog] = useState(false)

  const save = (next: SourceInstance[]) =>
    saveConfig({ scenes: { ...config.scenes, [sceneId]: { ...config.scenes[sceneId], sources: next } } })

  const toggle   = (id: string) => save(sources.map((s) => s.id === id ? { ...s, visible: !s.visible } : s))
  const remove   = (id: string) => { save(sources.filter((s) => s.id !== id)); if (expanded === id) setExpanded(null) }
  const setConfig = (id: string, cfg: Record<string, unknown>) => save(sources.map((s) => s.id === id ? { ...s, config: cfg } : s))
  const setPos   = (id: string, f: keyof SourceInstance['position'], v: number) =>
    save(sources.map((s) => s.id === id ? { ...s, position: { ...s.position, [f]: v } } : s))
  const moveZ    = (id: string, dir: 1 | -1) =>
    save(sources.map((s) => s.id === id ? { ...s, zIndex: s.zIndex + dir } : s))

  const addSource = (entry: CatalogEntry) => {
    const newSrc: SourceInstance = {
      id:         entry.type + '-' + Date.now(),
      pluginType: entry.type,
      config:     { ...entry.defaultConfig },
      position:   entry.defaultPosition ?? { x: 0, y: 0, width: 1920, height: 1080 },
      zIndex:     sources.length,
      visible:    true,
    }
    save([...sources, newSrc])
    setShowCatalog(false)
    setExpanded(newSrc.id)
  }

  const sorted = [...sources].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div className="space-y-2">
      {sorted.length === 0 && (
        <ConfigNotice tone="info" className="py-3 text-center">
          No sources yet. Game capture shows through until you add a source.
        </ConfigNotice>
      )}
      {sorted.map((src) => {
        const meta  = SOURCE_CATALOG.find((c) => c.type === src.pluginType)
        const isExp = expanded === src.id
        return (
          <ConfigCard key={src.id} className="overflow-hidden p-0">
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                title={src.visible ? 'Hide' : 'Show'}
                onClick={() => toggle(src.id)}
                className={'w-2 h-2 rounded-full shrink-0 transition-colors ' + (src.visible ? 'bg-emerald-400 hover:bg-emerald-600' : 'bg-zinc-600 hover:bg-zinc-400')}
              />
              <span className="text-[10px] text-zinc-500 shrink-0">{meta?.icon ?? '▣'}</span>
              <span className="text-[11px] text-zinc-200 flex-1 truncate font-mono">{src.id}</span>
              <span className="text-[9px] text-zinc-600 shrink-0">{src.pluginType}</span>
              <Btn type="button" variant={isExp ? 'active' : 'ghost'} onClick={() => setExpanded(isExp ? null : src.id)} className="px-2 py-0.5 text-[10px]">
                {isExp ? 'Collapse' : 'Edit'}
              </Btn>
              <Btn type="button" variant="danger" onClick={() => remove(src.id)} className="px-2 py-0.5 text-[10px]">
                Delete
              </Btn>
            </div>
            {isExp && (
              <div className="space-y-3 border-t border-zinc-800/80 px-3 py-3">
                {meta?.fields.map((f) => (
                  <SourceField key={f.key} field={f} value={src.config[f.key]}
                    onChange={(v) => setConfig(src.id, { ...src.config, [f.key]: v })} />
                ))}
                <div>
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">Position (px on 1920×1080)</div>
                  <div className="grid grid-cols-4 gap-1">
                    {(['x', 'y', 'width', 'height'] as const).map((f) => (
                      <div key={f}>
                        <div className="text-[8px] text-zinc-600 mb-0.5">{f}</div>
                        <input type="number" value={src.position[f]}
                          onChange={(e) => setPos(src.id, f, Number(e.target.value))}
                          className="w-full font-mono text-[10px] px-1 py-0.5" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-zinc-600 uppercase tracking-wider">Z-index</span>
                  <span className="font-mono text-[10px] text-zinc-400 w-4 text-center">{src.zIndex}</span>
                  <Btn type="button" onClick={() => moveZ(src.id,  1)} className="px-2 py-0.5 text-[10px]">Up</Btn>
                  <Btn type="button" onClick={() => moveZ(src.id, -1)} className="px-2 py-0.5 text-[10px]">Down</Btn>
                </div>
              </div>
            )}
          </ConfigCard>
        )
      })}

      {showCatalog ? (
        <ConfigCard className="mt-1">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Choose source type</span>
            <Btn type="button" variant="ghost" onClick={() => setShowCatalog(false)} className="px-2 py-0.5 text-[10px]">Close</Btn>
          </div>
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {SOURCE_CATALOG.map((entry) => (
              <button key={entry.type} type="button" onClick={() => addSource(entry)}
                className="w-full rounded-lg border border-zinc-800/80 bg-zinc-950/55 px-3 py-2 text-left transition-colors hover:border-zinc-700/80 hover:bg-zinc-900/75">
                <div className="flex items-center gap-2">
                <span className="text-base">{entry.icon}</span>
                <div className="min-w-0">
                  <div className="text-[11px] text-zinc-200 font-medium">{entry.label}</div>
                  <div className="text-[9px] text-zinc-500 truncate">{entry.desc}</div>
                </div>
                </div>
              </button>
            ))}
          </div>
        </ConfigCard>
      ) : (
        <Btn type="button" onClick={() => setShowCatalog(true)} variant="ghost"
          className="mt-1 w-full justify-center border-dashed border-zinc-700/80 py-2 text-xs text-zinc-400 hover:text-cyan-200">
          + Add Source
        </Btn>
      )}
    </div>
  )
}

const BG_TYPES: { id: BackgroundType; label: string }[] = [
  { id: 'none',      label: 'None'     },
  { id: 'gradient',  label: 'Gradient' },
  { id: 'image-url', label: 'Image'    },
  { id: 'video-url', label: 'Video'    },
  { id: 'pattern',   label: 'Pattern'  },
]

const SCREENSAVER_PRESETS: { id: DesktopConfig['screenSaver']['preset']; label: string }[] = [
  { id: 'starfield',      label: 'Starfield'      },
  { id: 'flying-windows', label: 'Flying Windows' },
  { id: 'marquee',        label: 'Marquee Text'   },
  { id: 'pipes',          label: 'Pipes 3D'       },
  { id: 'gallery-scroll', label: 'Game Gallery'   },
  { id: 'blank',          label: 'Black Screen'   },
]

const DESKTOP_THEMES: { id: DesktopConfig['theme']; label: string }[] = [
  { id: 'win98', label: 'Win98' },
  { id: 'frutiger aero', label: 'Frutiger Aero' },
  { id: 'y2k candy', label: 'Y2K Candy' },
  { id: 'midnight chrome', label: 'Midnight Chrome' },
  { id: 'sunset boulevard', label: 'Sunset Boulevard' },
  { id: 'coastal glass', label: 'Coastal Glass' },
  { id: 'amber terminal', label: 'Amber Terminal' },
  { id: 'custom', label: 'Custom' },
]

const WIDGET_SKINS: Array<{
  id: DesktopConfig['widgetTheme']['skin']
  label: string
  description: string
}> = [
  {
    id: 'metalheart',
    label: 'Metalheart',
    description: 'Brushed alloy shell with hot-pink hardware and arcade steel highlights.',
  },
  {
    id: 'genx soft club',
    label: 'GenX Soft Club',
    description: 'Pastel nightclub plastic with glossy mint and bubblegum accents.',
  },
  {
    id: 'chromecore',
    label: 'Chromecore',
    description: 'Polished silver utility chrome with cool cyan trims.',
  },
  {
    id: 'y2k futurism',
    label: 'Y2K Futurism',
    description: 'Dark glossy shell with neon cyan-magenta title lighting.',
  },
  {
    id: 'transparent',
    label: 'Transparent',
    description: 'Glass-panel widget chrome for overlays that need to stay airy.',
  },
  {
    id: 'aqua pop',
    label: 'Aqua Pop',
    description: 'Glossy candy-aqua shell with bright dashboard glass energy.',
  },
  {
    id: 'mallsoft pearl',
    label: 'Mallsoft Pearl',
    description: 'Dreamy retail-kiosk pearl plastic with soft blush bloom.',
  },
  {
    id: 'messenger glow',
    label: 'Messenger Glow',
    description: 'Buddy-list greens and silver utility plastics with lively presence.',
  },
  {
    id: 'limewire plasma',
    label: 'Limewire Plasma',
    description: 'Acid green transfer-energy skin with cyber scan movement.',
  },
  {
    id: 'cyber y2k',
    label: 'Cyber Y2K',
    description: 'Chrome-neon club futurism with magenta cyan voltage.',
  },
  {
    id: 'digital futurism',
    label: 'Digital Futurism',
    description: 'Sleek concept-device glass and luminous interface metal.',
  },
  {
    id: 'ssx rush',
    label: 'SSX Rush',
    description: 'Extreme-sports dashboard energy with hot slopes and arcade speed.',
  },
  {
    id: 'ps2 drift',
    label: 'PS2 Drift',
    description: 'Late-night menu blues and sixth-gen menu-space ambience.',
  },
  {
    id: 'xbox blade',
    label: 'Xbox Blade',
    description: 'Early-2000s techno utility green with dashboard scan grit.',
  },
  {
    id: 'cel street',
    label: 'Cel Street',
    description: 'Jet Set street graphics with graphic outlines and painted energy.',
  },
  {
    id: 'aero nova',
    label: 'Aero Nova',
    description: 'Frutiger Aero turned brighter, wetter, and more kinetic.',
  },
  {
    id: 'aero opaline',
    label: 'Aero Opaline',
    description: 'Pearlescent glass, aquatic light, and premium Aero softness.',
  },
  {
    id: 'dial-up candy',
    label: 'Dial-Up Candy',
    description: 'ISP-install-CD gloss, modem LEDs, and bright portal blues.',
  },
  {
    id: 'webcore flash',
    label: 'Webcore Flash',
    description: 'Button-heavy portal aesthetics with blinkie-banner energy.',
  },
  {
    id: 'lan party',
    label: 'LAN Party',
    description: 'CRT utility green with late-night file-share atmosphere.',
  },
]

const WIDGET_THEME_ANIMATIONS: Array<{
  id: DesktopConfig['widgetTheme']['animation']
  label: string
  description: string
}> = [
  { id: 'steady', label: 'Steady', description: 'Minimal motion, stable and polished.' },
  { id: 'pulse', label: 'Pulse', description: 'Breathing chrome and soft accent surges.' },
  { id: 'shimmer', label: 'Shimmer', description: 'Traveling specular highlights and gloss sweeps.' },
  { id: 'aurora', label: 'Aurora', description: 'Slow morphing light bands and neon drift.' },
  { id: 'broadcast', label: 'Broadcast', description: 'Scan, flicker, and transmission energy.' },
]

const WIDGET_THEME_ATMOSPHERES: Array<{
  id: DesktopConfig['widgetTheme']['atmosphere']
  label: string
}> = [
  { id: 'clean', label: 'Clean' },
  { id: 'sparkle', label: 'Sparkle' },
  { id: 'scanlines', label: 'Scanlines' },
  { id: 'grid', label: 'Grid' },
  { id: 'nebula', label: 'Nebula' },
]

const ICON_ANIMATIONS: { id: DesktopConfig['iconAnimation']; label: string }[] = [
  { id: 'none', label: 'Static' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'float', label: 'Float' },
  { id: 'jiggle', label: 'Jiggle' },
  { id: 'drift', label: 'Drift' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'breathe', label: 'Breathe' },
  { id: 'reactive', label: 'Reactive' },
]

const DESKTOP_ICON_SIZES: DesktopConfig['defaultIconSize'][] = ['small', 'normal', 'large']

function iconSizeToSliderValue(size: DesktopConfig['defaultIconSize']) {
  return DESKTOP_ICON_SIZES.indexOf(size)
}

function sliderValueToIconSize(value: number): DesktopConfig['defaultIconSize'] {
  return DESKTOP_ICON_SIZES[Math.max(0, Math.min(DESKTOP_ICON_SIZES.length - 1, Math.round(value)))]
}

function labelizeIconSize(size: DesktopConfig['defaultIconSize']) {
  return size.charAt(0).toUpperCase() + size.slice(1)
}

// ── Events def ─────────────────────────────────────────────────────

type AutoTrigger = { enabled: boolean; mode: 'interval' | 'idle'; intervalMin: number; idleMin: number }
type EventDef    = { id: string; label: string; icon: string; color: string; desc: string; builtIn?: boolean; effects: EffectConfig[]; auto: AutoTrigger; type?: 'overlay' | 'widget-automation'; widgetAutomation?: { availableWidgets?: string[]; toggleChance?: number; openBias?: number } }

const DEFAULT_EVENT_DEFS: EventDef[] = []

const LAUNCH_PIPELINE_EFFECT_TYPES: EffectType[] = [
  'static-burst', 'screen-shake', 'vignette-pulse', 'network-glitch',
  'death-overlay', 'victory-overlay', 'revive-overlay',
  'terminal-toast', 'notification-box', 'typewriter',
  'floaties', 'corruption-burst', 'image-overlay', 'video-overlay',
]

const EVENT_EFFECT_TYPES: EffectType[] = [
  'desktop-notification',
  ...LAUNCH_PIPELINE_EFFECT_TYPES,
]

const DEFAULT_DESKTOP_NOTIFICATION_EFFECT_CONFIG: DesktopNotificationEffectConfig = {
  title: 'Desktop popup',
  body: 'This is a desktop notification event.',
  icon: '📣',
  durationMs: DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS,
}

function normalizeDesktopNotificationEffectConfig(
  cfg?: Partial<DesktopNotificationEffectConfig> | null,
): DesktopNotificationEffectConfig {
  return {
    ...DEFAULT_DESKTOP_NOTIFICATION_EFFECT_CONFIG,
    ...cfg,
  }
}

function createEffectDraft(type: EffectType): EffectConfig {
  if (type === 'desktop-notification') {
    return {
      type,
      cfg: structuredClone(DEFAULT_DESKTOP_NOTIFICATION_EFFECT_CONFIG),
      delay: 0,
    }
  }

  return { type, cfg: {}, delay: 0 } as EffectConfig
}

function createEventDef(): EventDef {
  return {
    id: 'custom-' + Date.now(),
    label: 'New Event',
    icon: '⚡',
    color: 'text-cyan-400',
    desc: '',
    effects: [],
    auto: { enabled: false, mode: 'interval', intervalMin: 15, idleMin: 5 },
    type: 'overlay',
  }
}
// ── Selected item union ────────────────────────────────────────────

type SelectedItem =
  | { kind: 'env';   envState: STATE }
  | { kind: 'scene'; sceneState: string }
  | { kind: 'app';   appId: string }
  | { kind: 'widget-create' }
  | { kind: 'widget-layout'; layoutId: string }
  | { kind: 'audio' }
  | { kind: 'keybinds' }
  | { kind: 'archive' }
  | { kind: 'settings' }
  | { kind: 'ambiance' }

function itemKey(item: SelectedItem): string {
  if (item.kind === 'env')   return 'env-' + item.envState
  if (item.kind === 'scene') return 'scene-' + item.sceneState
  if (item.kind === 'app')   return 'app-' + item.appId
  if (item.kind === 'widget-create') return 'widget-create'
  if (item.kind === 'widget-layout') return 'widget-layout-' + item.layoutId
  if (item.kind === 'ambiance') return 'ambiance'
  return item.kind
}

function summarizeTransitionModel(steps?: TransitionStep[]) {
  if (!steps?.length) return 'none'
  const ids = steps.map((step) => step.id).join(' -> ')
  return `${steps.length} step${steps.length === 1 ? '' : 's'}: ${ids}`
}

function formatIconPositionModel(position?: { x: number; y: number }) {
  if (!position) return 'unset'
  return `x: ${Math.round(position.x)}, y: ${Math.round(position.y)}`
}

function ModelField({
  field,
  value,
  mono = false,
}: {
  field: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{field}</div>
      <div className={`text-[11px] text-zinc-100 break-all ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

// ── StyleEditor ────────────────────────────────────────────────────

function StyleEditor({ sceneId }: { sceneId: string }) {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const sourceStyle = structuredClone(withOverlayStyleDefaults((config.scenes[sceneId] as { style?: OverlayStyle } | undefined)?.style, config.overlayStyle))
  const [style, setStyle] = useState<OverlayStyle>(() => sourceStyle)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = !isSameDraft(style, sourceStyle)

  useEffect(() => {
    setStyle(sourceStyle)
    setSaved(false)
  }, [config.scenes, config.overlayStyle, sceneId])

  const update = useCallback((updater: (d: OverlayStyle) => void) => {
    setStyle((prev) => {
      const next = structuredClone(prev)
      updater(next)
      return next
    })
    setSaved(false)
  }, [])

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    const scene = config.scenes[sceneId]
    await saveConfig({ scenes: { ...config.scenes, [sceneId]: { ...scene, style } } })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [dirty, saveConfig, config.scenes, sceneId, style])

  const reset = useCallback(() => {
    setStyle(sourceStyle)
    setSaved(false)
  }, [sourceStyle])

  const bg = style.background
  const fx = style.effects
  const pt = style.particles

  return (
    <div className="space-y-3">
      <ConfigApplyBar label="Scene Style" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} />

      <div className="space-y-0 pt-3">
        <ConfigSectionPanel label="Background" first>
        <div className="space-y-3">
          <select value={bg.type} onChange={(e) => update((d) => { d.background.type = e.target.value as BackgroundType })}
            className="w-full text-xs">
            {BG_TYPES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>

          {sceneId === STATE.DESKTOP && (
            <div className="text-[10px] text-zinc-500 leading-relaxed">
              Desktop themes only style windows, menus, taskbars, and widgets. Leave Background on None to keep the overlay transparent; choose a background here only when you intentionally want wallpaper behind the desktop.
            </div>
          )}

          {sceneId === STATE.LOBBY && (
            <div className="text-[10px] text-zinc-500 leading-relaxed">
              In the lobby, gradient backgrounds tint the sky dome. Image, video, and pattern backgrounds stay behind the 3D scene and will not replace the sky.
            </div>
          )}

          {bg.type === 'gradient' && <div>
            <div className="grid grid-cols-3 gap-1 mb-2">
              {GRADIENT_PRESETS.map((g) => (
                <ConfigPreviewButton
                  key={g.name}
                  type="button"
                  selected={bg.gradient === g.value}
                  onClick={() => update((d) => { d.background.gradient = g.value })}
                  className="h-12"
                  style={{ background: g.value }}
                >
                  <div className="flex h-full items-end p-2">
                    <span className="rounded bg-black/35 px-1.5 py-0.5 text-[10px] text-white drop-shadow">{g.name}</span>
                  </div>
                </ConfigPreviewButton>
              ))}
            </div>
            <input type="text" value={bg.gradient}
              onChange={(e) => update((d) => { d.background.gradient = e.target.value })}
              placeholder="linear-gradient(…)" className="w-full text-xs" />
          </div>}

          {bg.type === 'image-url' && (
            <AssetSelectionInput
              value={bg.imageUrl}
              onChange={(nextValue) => update((d) => { d.background.imageUrl = nextValue })}
              kinds={['image']}
              modalTitle="Background Image"
              placeholder="/assets/backgrounds/name.jpg or https://..."
              buttonLabel="Choose Image"
              hint="Pick from the unified asset library, game-image catalog, or paste any direct image URL."
              previewKind="image"
            />
          )}

          {bg.type === 'video-url' && (
            <AssetSelectionInput
              value={bg.videoUrl}
              onChange={(nextValue) => update((d) => { d.background.videoUrl = nextValue })}
              kinds={['video']}
              modalTitle="Background Video"
              placeholder="/assets/video/name.mp4 or https://..."
              buttonLabel="Choose Video"
              hint="Use the asset library for local loops or paste any direct MP4/WebM URL."
              previewKind="video"
            />
          )}

          {bg.type === 'pattern' && <div className="grid grid-cols-3 gap-1">
            {(Object.keys(PATTERN_CSS) as PatternPreset[]).map((pat) => (
              <ConfigPreviewButton
                key={pat}
                type="button"
                selected={bg.pattern === pat}
                onClick={() => update((d) => { d.background.pattern = pat })}
                className="h-14 capitalize"
                style={pat === 'none' ? { backgroundColor: '#111' } : PATTERN_CSS[pat]}
              >
                <div className="flex h-full items-end justify-center p-2">
                  <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white drop-shadow">{pat}</span>
                </div>
              </ConfigPreviewButton>
            ))}
          </div>}

          {bg.type !== 'none' && <div className="space-y-1 pt-2 border-t border-zinc-700">
            <Slider label="Opacity" value={bg.opacity} onChange={(v) => update((d) => { d.background.opacity = v })} />
            <Slider label="Blur" value={bg.blur} min={0} max={20} step={0.5} unit="px" onChange={(v) => update((d) => { d.background.blur = v })} />
          </div>}
        </div>
        </ConfigSectionPanel>

        <ConfigSectionPanel label="Effects">
        <div className="space-y-2">
          <div>
            <Toggle checked={fx.crt} onChange={(v) => update((d) => { d.effects.crt = v })} label="CRT Scanlines" />
            {fx.crt && <div className="mt-1 pl-11"><Slider label="Intensity" value={fx.scanlineOpacity} onChange={(v) => update((d) => { d.effects.scanlineOpacity = v })} /></div>}
          </div>
          <div>
            <Toggle checked={fx.noise} onChange={(v) => update((d) => { d.effects.noise = v })} label="Film Grain" />
            {fx.noise && <div className="mt-1 pl-11"><Slider label="Grain" value={fx.noiseOpacity} onChange={(v) => update((d) => { d.effects.noiseOpacity = v })} /></div>}
          </div>
          <div>
            <Toggle checked={fx.vignette} onChange={(v) => update((d) => { d.effects.vignette = v })} label="Vignette" />
            {fx.vignette && <div className="mt-1 pl-11"><Slider label="Strength" value={fx.vignetteStrength} onChange={(v) => update((d) => { d.effects.vignetteStrength = v })} /></div>}
          </div>
          <Toggle checked={fx.flicker} onChange={(v) => update((d) => { d.effects.flicker = v })} label="Screen Flicker" />
          <Toggle checked={fx.chromatic} onChange={(v) => update((d) => { d.effects.chromatic = v })} label="Chromatic Aberration" />
        </div>
        </ConfigSectionPanel>

        <ConfigSectionPanel label="Particles">
        <div className="space-y-3">
          <select value={pt.preset}
            onChange={(e) => update((d) => { d.particles.preset = e.target.value as ParticlePreset; d.particles.enabled = e.target.value !== 'none' })}
            className="w-full text-xs">
            {PARTICLE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
          </select>
          {pt.enabled && pt.preset !== 'none' && <div className="space-y-1">
            <Slider label="Density" value={pt.density} onChange={(v) => update((d) => { d.particles.density = v })} />
            <Slider label="Speed"   value={pt.speed}   onChange={(v) => update((d) => { d.particles.speed   = v })} />
          </div>}
        </div>
        </ConfigSectionPanel>
      </div>
    </div>
  )
}

// ── TransitionList ────────────────────────────────────────────────
// Converts between the TransitionPicker string encoding and TransitionStep.
function stepToStr(step: TransitionStep): string {
  if (step.id.startsWith('media:')) return step.id
  return step.duration ? `${step.id}?duration=${step.duration}` : step.id
}
function strToStep(s: string): TransitionStep {
  if (!s || s.startsWith('media:')) return { id: s }
  const qi  = s.indexOf('?')
  const id  = qi >= 0 ? s.slice(0, qi) : s
  const dur = qi >= 0 ? new URLSearchParams(s.slice(qi + 1)).get('duration') : null
  return { id, ...(dur ? { duration: parseFloat(dur) } : {}) }
}

/** Ordered pipeline editor — each step is a full TransitionPicker row. */
function TransitionList({
  value,
  onChange,
}: {
  value: TransitionStep[]
  onChange: (steps: TransitionStep[]) => void
}) {
  const steps = value ?? []

  const updateStep = (idx: number, str: string) => {
    const next = [...steps]
    next[idx] = strToStep(str)
    onChange(next.filter((s) => s.id))
  }

  const removeStep = (idx: number) => onChange(steps.filter((_, i) => i !== idx))

  const moveUp = (idx: number) => {
    if (idx === 0) return
    const next = [...steps];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange(next)
  }

  const moveDown = (idx: number) => {
    if (idx === steps.length - 1) return
    const next = [...steps];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {steps.map((step, idx) => (
        <div key={idx} className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <TransitionPicker
              value={stepToStr(step)}
              onChange={(str) => updateStep(idx, str)}
              placeholder="— Pick transition —"
            />
          </div>
          <div className="flex flex-col gap-1 shrink-0 pt-0.5">
            <Btn
              type="button"
              variant="ghost"
              onClick={() => moveUp(idx)} disabled={idx === 0}
              className="px-2 py-1 text-[10px]"
            >
              Up
            </Btn>
            <Btn
              type="button"
              variant="ghost"
              onClick={() => moveDown(idx)} disabled={idx === steps.length - 1}
              className="px-2 py-1 text-[10px]"
            >
              Down
            </Btn>
          </div>
          <Btn
            type="button"
            variant="danger"
            onClick={() => removeStep(idx)}
            className="mt-0.5 px-2 py-1 text-[10px]"
          >
            Delete
          </Btn>
        </div>
      ))}
      <Btn
        type="button"
        variant="ghost"
        onClick={() => onChange([...steps, { id: '' }])}
        className="mt-1 w-full justify-center border-dashed border-zinc-700/80 py-2 text-xs text-zinc-400 hover:text-cyan-200"
      >
        + Add Step
      </Btn>
    </div>
  )
}

// ── LobbyConfigEditor ──────────────────────────────────────────────

function LobbyConfigEditor() {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const lobbyScene = config.scenes[STATE.LOBBY] as { lobbyConfig?: LobbyConfig; introTransitions?: TransitionStep[]; exitTransitions?: TransitionStep[] } | undefined
  const sourceForm = withLobbyConfigDefaults(lobbyScene?.lobbyConfig)
  const sourceIntroTransitions = structuredClone(lobbyScene?.introTransitions)
  const sourceExitTransitions = structuredClone(lobbyScene?.exitTransitions)
  const [form, setForm] = useState<LobbyConfig>(() => sourceForm)
  const [introTransitions, setIntroTransitions] = useState<TransitionStep[]>(sourceIntroTransitions || [])
  const [exitTransitions, setExitTransitions] = useState<TransitionStep[]>(sourceExitTransitions || [])
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = !isSameDraft(form, sourceForm)
    || !isSameDraft(introTransitions, sourceIntroTransitions)
    || !isSameDraft(exitTransitions, sourceExitTransitions)

  useEffect(() => {
    setForm(sourceForm)
    setIntroTransitions(sourceIntroTransitions || [])
    setExitTransitions(sourceExitTransitions || [])
    setSaved(false)
  }, [config.scenes])

  const update = useCallback((updater: (d: LobbyConfig) => void) => {
    setForm((prev) => {
      const next = structuredClone(prev)
      updater(next)
      return next
    })
    setSaved(false)
  }, [])

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    await saveConfig({
      scenes: {
        ...config.scenes,
        [STATE.LOBBY]: {
          ...config.scenes[STATE.LOBBY],
          lobbyConfig: form,
          introTransitions: introTransitions.length ? introTransitions : undefined,
          exitTransitions: exitTransitions.length ? exitTransitions : undefined,
        },
      },
    })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [dirty, saveConfig, config.scenes, form, introTransitions, exitTransitions])

  const reset = useCallback(() => {
    setForm(sourceForm)
    setIntroTransitions(sourceIntroTransitions || [])
    setExitTransitions(sourceExitTransitions || [])
    setSaved(false)
  }, [sourceForm, sourceIntroTransitions, sourceExitTransitions])

  return (
    <div className="space-y-3">
      <ConfigApplyBar label="Lobby Configuration" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} />
      <div className="space-y-0 pt-3">
      <ConfigSectionPanel label="Transitions" first>
        <div className="space-y-3">
          {([
            { field: 'introTransitions' as const, label: 'Intro (entering)' },
            { field: 'exitTransitions' as const, label: 'Exit (leaving)' },
          ]).map(({ field, label }) => (
            <div key={field}>
              <div className="text-[10px] text-zinc-500 mb-1">{label}</div>
              <TransitionList
                value={field === 'introTransitions' ? introTransitions : exitTransitions}
                onChange={(steps) => {
                  if (field === 'introTransitions') setIntroTransitions(steps)
                  else setExitTransitions(steps)
                  setSaved(false)
                }}
              />
            </div>
          ))}
        </div>
      </ConfigSectionPanel>
      <ConfigSectionPanel label="Ambient Light">
        <LabeledHexColorRow label="" value={form.ambientColor} onChange={(v) => update((d) => { d.ambientColor = v })} />
        <Slider label="Intensity" value={form.ambientIntensity} min={0} max={2} step={0.01} onChange={(v) => update((d) => { d.ambientIntensity = v })} />
      </ConfigSectionPanel>
      <ConfigSectionPanel label="Fog">
        <LabeledHexColorRow label="" value={form.fogColor} onChange={(v) => update((d) => { d.fogColor = v })} />
        <Slider label="Near" value={form.fogNear} min={1} max={20} step={0.5} onChange={(v) => update((d) => { d.fogNear = v })} />
        <Slider label="Far"  value={form.fogFar}  min={5} max={60} step={1}   onChange={(v) => update((d) => { d.fogFar  = v })} />
      </ConfigSectionPanel>
      <ConfigSectionPanel label="World">
        <LabeledHexColorRow label="Sky Top" value={form.skyTopColor} onChange={(v) => update((d) => { d.skyTopColor = v })} />
        <LabeledHexColorRow label="Horizon" value={form.skyHorizonColor} onChange={(v) => update((d) => { d.skyHorizonColor = v })} />
        <LabeledHexColorRow label="Floor" value={form.floorColor} onChange={(v) => update((d) => { d.floorColor = v })} />
        <Slider label="Reflectivity" value={form.floorReflectivity} min={0} max={1} step={0.05} onChange={(v) => update((d) => { d.floorReflectivity = v })} />
      </ConfigSectionPanel>
      <ConfigSectionPanel label="CRT Glow">
        <LabeledHexColorRow label="" value={form.crtGlowColor} onChange={(v) => update((d) => { d.crtGlowColor = v })} />
      </ConfigSectionPanel>
      <ConfigSectionPanel label="Atmosphere">
        <Toggle checked={form.dustMotes} onChange={(v) => update((d) => { d.dustMotes = v })} label="Dust motes" />
        <div className="mt-2 space-y-1">
          <Slider label="Camera FOV" value={form.cameraFov} min={30} max={120} step={1} onChange={(v) => update((d) => { d.cameraFov = v })} />
          <Slider label="Stars"      value={form.starsCount} min={0} max={2000} step={50} onChange={(v) => update((d) => { d.starsCount = v })} />
        </div>
      </ConfigSectionPanel>
      <ConfigSectionPanel label="Room Life">
        <div className="space-y-3">
          <div>
            <Toggle checked={form.virtualPet.enabled} onChange={(v) => update((d) => { d.virtualPet.enabled = v })} label="Virtual pet" />
            {form.virtualPet.enabled && (
              <div className="mt-2 space-y-1">
                <LabeledHexColorRow label="Body" value={form.virtualPet.color} onChange={(v) => update((d) => { d.virtualPet.color = v })} />
                <LabeledHexColorRow label="Charm" value={form.virtualPet.accessoryColor} onChange={(v) => update((d) => { d.virtualPet.accessoryColor = v })} />
              </div>
            )}
          </div>
          <div>
            <Toggle checked={form.lavaLamp.enabled} onChange={(v) => update((d) => { d.lavaLamp.enabled = v })} label="Lava lamp" />
            {form.lavaLamp.enabled && (
              <div className="mt-2 space-y-1">
                <LabeledHexColorRow label="Glass" value={form.lavaLamp.glassColor} onChange={(v) => update((d) => { d.lavaLamp.glassColor = v })} />
                <LabeledHexColorRow label="Wax" value={form.lavaLamp.liquidColor} onChange={(v) => update((d) => { d.lavaLamp.liquidColor = v })} />
                <LabeledHexColorRow label="Glow" value={form.lavaLamp.glowColor} onChange={(v) => update((d) => { d.lavaLamp.glowColor = v })} />
              </div>
            )}
          </div>
          <div>
            <Toggle checked={form.fishTank.enabled} onChange={(v) => update((d) => { d.fishTank.enabled = v })} label="Fish tank" />
            {form.fishTank.enabled && (
              <div className="mt-2 space-y-1">
                <LabeledHexColorRow label="Glass" value={form.fishTank.glassColor} onChange={(v) => update((d) => { d.fishTank.glassColor = v })} />
                <LabeledHexColorRow label="Water" value={form.fishTank.waterColor} onChange={(v) => update((d) => { d.fishTank.waterColor = v })} />
                <LabeledHexColorRow label="Fish" value={form.fishTank.fishColor} onChange={(v) => update((d) => { d.fishTank.fishColor = v })} />
                <Slider label="Count" value={form.fishTank.fishCount} min={1} max={8} step={1} onChange={(v) => update((d) => { d.fishTank.fishCount = v })} />
              </div>
            )}
          </div>
        </div>
      </ConfigSectionPanel>
      </div>
    </div>
  )
}

// ── DesktopConfigEditor ────────────────────────────────────────────

function DesktopConfigEditor() {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const desktopScene = config.scenes[STATE.DESKTOP]
  const sourceForm = withDesktopConfigDefaults(config.desktopConfig)
  const sourceStyle = structuredClone(withOverlayStyleDefaults((desktopScene as { style?: OverlayStyle } | undefined)?.style, config.overlayStyle))
  const sourceAppearance: ThemeAppearance = {
    fontFamily: sourceStyle.fontFamily,
    accentColor: sourceStyle.accentColor,
    textColor: sourceStyle.textColor,
  }
  const sourceIntroTransitions = structuredClone(desktopScene?.introTransitions)
  const sourceExitTransitions = structuredClone(desktopScene?.exitTransitions)
  const [form, setForm] = useState<DesktopConfig>(() => sourceForm)
  const [appearance, setAppearance] = useState<ThemeAppearance>(() => sourceAppearance)
  const [introTransitions, setIntroTransitions] = useState<TransitionStep[]>(sourceIntroTransitions || [])
  const [exitTransitions, setExitTransitions] = useState<TransitionStep[]>(sourceExitTransitions || [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = !isSameDraft(form, sourceForm)
    || !isSameDraft(appearance, sourceAppearance)
    || !isSameDraft(introTransitions, sourceIntroTransitions)
    || !isSameDraft(exitTransitions, sourceExitTransitions)

  useEffect(() => {
    setForm(sourceForm)
    setAppearance(sourceAppearance)
    setIntroTransitions(sourceIntroTransitions || [])
    setExitTransitions(sourceExitTransitions || [])
    setSaved(false)
  }, [config.desktopConfig, config.scenes])

  const update = useCallback((updater: (d: DesktopConfig) => void) => {
    setForm((prev) => {
      const next = structuredClone(prev)
      updater(next)
      return next
    })
    setSaved(false)
  }, [])

  const updateAppearance = useCallback((updater: (d: ThemeAppearance) => void) => {
    setAppearance((prev) => {
      const next = structuredClone(prev)
      updater(next)
      return next
    })
    setSaved(false)
  }, [])

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    const nextDesktopStyle = structuredClone(sourceStyle)
    nextDesktopStyle.fontFamily = appearance.fontFamily
    nextDesktopStyle.accentColor = appearance.accentColor
    nextDesktopStyle.textColor = appearance.textColor
    await saveConfig({
      desktopConfig: form,
      scenes: {
        ...config.scenes,
        [STATE.DESKTOP]: {
          ...config.scenes[STATE.DESKTOP],
          style: nextDesktopStyle,
          introTransitions: introTransitions.length ? introTransitions : undefined,
          exitTransitions: exitTransitions.length ? exitTransitions : undefined,
        },
      },
    })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [dirty, saveConfig, sourceStyle, appearance, config.scenes, form, introTransitions, exitTransitions])

  const reset = useCallback(() => {
    setForm(sourceForm)
    setAppearance(sourceAppearance)
    setIntroTransitions(sourceIntroTransitions || [])
    setExitTransitions(sourceExitTransitions || [])
    setSaved(false)
  }, [sourceForm, sourceAppearance, sourceIntroTransitions, sourceExitTransitions])

  return (
    <div className="space-y-3">
      <ConfigApplyBar label="Desktop Configuration" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} />
      <div className="space-y-0 pt-3">
      <ConfigSectionPanel label="Transitions" first>
        <div className="space-y-3">
          {([
            { field: 'introTransitions' as const, label: 'Intro (entering)' },
            { field: 'exitTransitions'  as const, label: 'Exit (leaving)' },
          ]).map(({ field, label }) => (
            <div key={field}>
              <div className="text-[10px] text-zinc-500 mb-1">{label}</div>
              <TransitionList
                value={field === 'introTransitions' ? introTransitions : exitTransitions}
                onChange={(steps) => {
                  if (field === 'introTransitions') setIntroTransitions(steps)
                  else setExitTransitions(steps)
                  setSaved(false)
                }}
              />
            </div>
          ))}
        </div>
      </ConfigSectionPanel>
      <ConfigSectionPanel label="Theme">
        <div className="space-y-4">
          <div className="text-[10px] text-zinc-500 leading-relaxed">
            Theme presets style desktop chrome only. The overlay stays transparent until the desktop Background panel is explicitly set to show wallpaper, gradients, patterns, or video.
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {DESKTOP_THEMES.map((theme) => (
              <ConfigChoiceButton key={theme.id} type="button" selected={form.theme === theme.id} onClick={() => update((d) => { d.theme = theme.id })}
                className="py-2 text-[11px]">
                {theme.label}
              </ConfigChoiceButton>
            ))}
          </div>
          <div className="border-t border-zinc-800 pt-3">
            <ThemeAppearanceFields
              appearance={appearance}
              onChange={updateAppearance}
              helperText="Font, accent, and text color ride on top of the preset so they are visible without turning the desktop background opaque."
            />
          </div>
          <div className="border-t border-zinc-800 pt-3 space-y-3">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Icons</div>
              <div className="text-[10px] text-zinc-500 leading-relaxed">
                Turn off auto-arrange to drag icons directly on the desktop. Manual dragging saves each application icon position for you.
              </div>
            </div>
            <Slider
              label="Size"
              value={iconSizeToSliderValue(form.defaultIconSize)}
              min={0}
              max={2}
              step={1}
              onChange={(value) => update((d) => { d.defaultIconSize = sliderValueToIconSize(value) })}
            />
            <div className="text-[10px] text-zinc-500 -mt-1 pl-[7rem]">Current default: {labelizeIconSize(form.defaultIconSize)}</div>
            <Toggle checked={form.autoArrangeIcons} onChange={(v) => update((d) => { d.autoArrangeIcons = v })} label="Auto-arrange icons" />
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Ambient motion</div>
              <select
                value={form.iconAnimation}
                onChange={(e) => update((d) => { d.iconAnimation = e.target.value as DesktopConfig['iconAnimation'] })}
                className="w-full text-xs"
              >
                {ICON_ANIMATIONS.map((mode) => (
                  <option key={mode.id} value={mode.id}>{mode.label}</option>
                ))}
              </select>
            </div>
            <Slider
              label="Motion"
              value={Math.round(form.iconMotion * 100)}
              min={0}
              max={300}
              step={5}
              unit="%"
              onChange={(value) => update((d) => { d.iconMotion = value / 100 })}
            />
          </div>
        </div>
      </ConfigSectionPanel>
      <ConfigSectionPanel label="Widget Theme">
        <div className="space-y-4">
          <div className="text-[10px] text-zinc-500 leading-relaxed">
            Widget themes behave like classic application skins. The selected skin restyles shared widget chrome, controls, and window furniture across every widget, and can stay in motion the whole time the desktop is live.
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {WIDGET_SKINS.map((skin) => (
              <ConfigChoiceButton
                key={skin.id}
                type="button"
                selected={form.widgetTheme.skin === skin.id}
                onClick={() => update((d) => { d.widgetTheme = { ...DEFAULT_WIDGET_THEME_PRESETS[skin.id] } })}
                className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case"
                title={skin.description}
              >
                <span className="text-[11px] font-semibold leading-none">{skin.label}</span>
                <span className="text-[10px] leading-relaxed text-zinc-500">{skin.description}</span>
              </ConfigChoiceButton>
            ))}
          </div>
          <div className="border-t border-zinc-800 pt-3">
            <ThemeAppearanceFields
              appearance={form.widgetTheme}
              onChange={(updater) => update((d) => { updater(d.widgetTheme) })}
              helperText="Each skin ships with its own baseline palette and font. Use these overrides when you want to tint the skin without switching presets."
            />
          </div>
          <div className="border-t border-zinc-800 pt-3 space-y-3">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Live Motion</div>
              <div className="text-[10px] text-zinc-500 leading-relaxed">
                Animation changes how light, gloss, and ornament move across the widget shell. Atmosphere adds an always-on texture layer so the desktop feels alive even when viewers stare at it for a long time.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {WIDGET_THEME_ANIMATIONS.map((animation) => (
                <ConfigChoiceButton
                  key={animation.id}
                  type="button"
                  selected={form.widgetTheme.animation === animation.id}
                  onClick={() => update((d) => { d.widgetTheme.animation = animation.id })}
                  className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case"
                  title={animation.description}
                >
                  <span className="text-[11px] font-semibold leading-none">{animation.label}</span>
                  <span className="text-[10px] leading-relaxed text-zinc-500">{animation.description}</span>
                </ConfigChoiceButton>
              ))}
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Atmosphere</div>
              <div className="grid grid-cols-3 gap-1.5">
                {WIDGET_THEME_ATMOSPHERES.map((atmosphere) => (
                  <ConfigChoiceButton
                    key={atmosphere.id}
                    type="button"
                    selected={form.widgetTheme.atmosphere === atmosphere.id}
                    onClick={() => update((d) => { d.widgetTheme.atmosphere = atmosphere.id })}
                    className="py-2 text-[11px]"
                  >
                    {atmosphere.label}
                  </ConfigChoiceButton>
                ))}
              </div>
            </div>
            <Slider
              label="Motion"
              value={Math.round(form.widgetTheme.motionIntensity * 100)}
              min={0}
              max={300}
              step={5}
              unit="%"
              onChange={(value) => update((d) => { d.widgetTheme.motionIntensity = value / 100 })}
            />
            <Slider
              label="Glow"
              value={Math.round(form.widgetTheme.glowIntensity * 100)}
              min={0}
              max={300}
              step={5}
              unit="%"
              onChange={(value) => update((d) => { d.widgetTheme.glowIntensity = value / 100 })}
            />
          </div>
        </div>
      </ConfigSectionPanel>
      <ConfigSectionPanel label="Screen Saver">
        <Toggle checked={form.screenSaver.enabled} onChange={(v) => update((d) => { d.screenSaver.enabled = v })} label="Enable" />
        {form.screenSaver.enabled && <>
          <div className="mt-2 grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end">
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Idle timeout (min)</div>
              <input type="number" min={1} max={60} value={form.screenSaver.timeoutMinutes}
                onChange={(e) => update((d) => { d.screenSaver.timeoutMinutes = Number(e.target.value) })}
                className="w-20 font-mono text-xs" />
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Preset</div>
              <select
                value={form.screenSaver.preset}
                onChange={(e) => update((d) => { d.screenSaver.preset = e.target.value as DesktopConfig['screenSaver']['preset'] })}
                className="w-full text-xs"
              >
                {SCREENSAVER_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
            </div>
            <Btn className="sm:self-end" onClick={() => socket.emit('desktop:screen-saver:test', { preset: form.screenSaver.preset })}>
              Test
            </Btn>
          </div>
        </>}
      </ConfigSectionPanel>
      <ConfigSectionPanel label="System Sounds">
        <div className="text-[10px] text-zinc-500 mb-2">Relative to <span className="font-mono text-zinc-400">assets/sfx/system/</span></div>
        {(['startup', 'error', 'notify', 'click', 'close'] as const).map((key) => (
          <div key={key} className="flex items-center gap-2 mb-1.5">
            <label className="text-[11px] text-zinc-400 w-12 shrink-0 capitalize">{key}</label>
            <input type="text" value={form.systemSounds[key]}
              onChange={(e) => update((d) => { d.systemSounds[key] = e.target.value })}
              placeholder={key + '.wav'} className="flex-1 font-mono text-[11px]" />
          </div>
        ))}
      </ConfigSectionPanel>
      </div>
    </div>
  )
}

function StickyNotesConfigSection({
  value,
  onChange,
}: {
  value: StickyNotesSettings
  onChange: (updater: (draft: StickyNotesSettings) => void) => void
}) {
  return (
    <ConfigSectionPanel label="Sticky Notes">
      <div className="text-[10px] text-zinc-500 mb-1">Default note text</div>
      <textarea
        value={value.text}
        onChange={(e) => onChange((draft) => { draft.text = e.target.value })}
        className="w-full min-h-[110px] text-xs font-mono"
      />
      <div className="mt-3 text-[10px] text-zinc-500 mb-1">Note color</div>
      <HexColorInput
        value={value.color}
        onChange={(nextValue) => onChange((draft) => { draft.color = nextValue })}
        className="max-w-sm gap-2"
        pickerClassName="w-20 h-9 p-1 shrink-0"
        textClassName="font-mono text-xs flex-1 min-w-0"
      />
    </ConfigSectionPanel>
  )
}

function RecycleBinConfigSection({
  settings,
  fullOnStart,
  onSettingsChange,
  onFullOnStartChange,
}: {
  settings: RecycleBinSettings
  fullOnStart: boolean
  onSettingsChange: (updater: (draft: RecycleBinSettings) => void) => void
  onFullOnStartChange: (nextValue: boolean) => void
}) {
  return (
    <ConfigSectionPanel label="Recycle Bin">
      <Toggle checked={fullOnStart} onChange={onFullOnStartChange} label="Starts full" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">Empty icon</div>
          <AssetSelectionInput
            value={settings.emptyIcon}
            onChange={(nextValue) => onSettingsChange((draft) => { draft.emptyIcon = nextValue })}
            kinds={['image']}
            modalTitle="Recycle Bin Empty Icon"
            placeholder="Emoji or /assets/icons/recycle-empty.png"
            buttonLabel="Choose Image"
            previewKind="image"
          />
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">Full icon</div>
          <AssetSelectionInput
            value={settings.fullIcon}
            onChange={(nextValue) => onSettingsChange((draft) => { draft.fullIcon = nextValue })}
            kinds={['image']}
            modalTitle="Recycle Bin Full Icon"
            placeholder="Emoji or /assets/icons/recycle-full.png"
            buttonLabel="Choose Image"
            previewKind="image"
          />
        </div>
      </div>
    </ConfigSectionPanel>
  )
}

// ── AppForm ────────────────────────────────────────────────────────

function AppForm({ app, onDelete }: { app: Application; onDelete: () => void }) {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const desktopConfig = withDesktopConfigDefaults(config.desktopConfig)
  const initialWidgetSize = resolveWidgetSizeFromConfig(app, desktopConfig)
  const [form, setForm] = useState<Application>(app)
  const [widgetSize, setWidgetSize] = useState(initialWidgetSize)
  const [widgetDefaultZIndex, setWidgetDefaultZIndex] = useState<number>(
    () => resolveWidgetDefaultZIndexFromConfig(app, desktopConfig),
  )
  const [recycleBinFullOnStart, setRecycleBinFullOnStart] = useState(() => desktopConfig.recycleBin.fullOnStart)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [detectedCameras, setDetectedCameras] = useState<{ deviceId: string; label: string }[]>([])
  const [detectingCameras, setDetectingCameras] = useState(false)
  const [cameraLabelsGranted, setCameraLabelsGranted] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const enumerateCameras = useCallback(async (requestPermission = false) => {
    setDetectingCameras(true)
    try {
      if (requestPermission) {
        const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        probe.getTracks().forEach((t) => t.stop())
        setCameraLabelsGranted(true)
      }
      const all = await navigator.mediaDevices.enumerateDevices()
      const cams = all
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Cámara ${i + 1}` }))
      setDetectedCameras(cams)
      if (cams.some((c) => !c.label.startsWith('Cámara '))) setCameraLabelsGranted(true)
    } catch {
      // permission denied or unavailable — keep whatever we have
    } finally {
      setDetectingCameras(false)
    }
  }, [])

  const widgetComponent = form.appType === 'widget' ? resolveAppWidgetComponent(form) : undefined
  const widgetSource = form.appType === 'widget' ? getWidgetSource(form) : undefined
  const isProtectedSystemWidget = form.appType === 'widget' && isSystemWidget(form)
  const isStickyNotesWidget = form.appType === 'widget' && form.id === 'sticky-notes'
  const isRecycleBinDecoration = form.appType === 'decoration' && form.id === 'recycle-bin'
  const stickyNotesConfig = form.stickyNotesSettings ?? DEFAULT_STICKY_NOTES_SETTINGS
  const recycleBinConfig = form.recycleBinSettings ?? DEFAULT_RECYCLE_BIN_SETTINGS
  const selectedSourceSceneId = form.sourceWidgetSettings?.sceneId ?? ''
  const selectedSourceScene = selectedSourceSceneId ? config.scenes[selectedSourceSceneId] : undefined
  const availableSourceScenes = useMemo(
    () => Object.values(config.scenes).filter((scene) => scene.sources.length > 0 || scene.id === selectedSourceSceneId),
    [config.scenes, selectedSourceSceneId],
  )
  const availableSources = selectedSourceScene?.sources ?? []
  const selectedSource = availableSources.find((source) => source.id === form.sourceWidgetSettings?.sourceId)

  // Auto-enumerate video devices when this is a camera widget
  useEffect(() => {
    if (widgetComponent !== 'camera') return
    void enumerateCameras(false)
  }, [widgetComponent, enumerateCameras])
  const appDirty = !isSameDraft(form, app)
  const sourceWidgetSize = resolveWidgetSizeFromConfig(app, desktopConfig)
  const sourceWidgetDefaultZIndex = resolveWidgetDefaultZIndexFromConfig(app, desktopConfig)
  const widgetSizeDirty = form.appType === 'widget' && (
    widgetSize.width !== sourceWidgetSize.width
    || widgetSize.height !== sourceWidgetSize.height
  )
  const widgetDefaultZIndexDirty = form.appType === 'widget' && widgetDefaultZIndex !== sourceWidgetDefaultZIndex
  const recycleBinFullOnStartDirty = isRecycleBinDecoration && recycleBinFullOnStart !== desktopConfig.recycleBin.fullOnStart
  const dirty = appDirty || widgetSizeDirty || widgetDefaultZIndexDirty || recycleBinFullOnStartDirty

  useEffect(() => {
    setForm(app)
    setWidgetSize(resolveWidgetSizeFromConfig(app, withDesktopConfigDefaults(config.desktopConfig)))
    setWidgetDefaultZIndex(resolveWidgetDefaultZIndexFromConfig(app, withDesktopConfigDefaults(config.desktopConfig)))
    setRecycleBinFullOnStart(withDesktopConfigDefaults(config.desktopConfig).recycleBin.fullOnStart)
    setSaved(false)
  }, [app, config.desktopConfig])

  const update = (updater: (d: Application) => void) => {
    const next = { ...form }
    updater(next)
    setForm(next)
    setSaved(false)
  }

  const updateStickyNotesConfig = (updater: (draft: StickyNotesSettings) => void) => {
    update((draft) => {
      const next = structuredClone(draft.stickyNotesSettings ?? DEFAULT_STICKY_NOTES_SETTINGS)
      updater(next)
      draft.stickyNotesSettings = next
    })
  }

  const updateRecycleBinConfig = (updater: (draft: RecycleBinSettings) => void) => {
    update((draft) => {
      const next = structuredClone(draft.recycleBinSettings ?? DEFAULT_RECYCLE_BIN_SETTINGS)
      updater(next)
      draft.recycleBinSettings = next
    })
  }

  const apply = async () => {
    if (!dirty) return
    setSaving(true)
    const apps = [...config.applications]
    const idx  = apps.findIndex((entry) => entry.id === form.id)
    if (idx !== -1) apps[idx] = form
    else apps.push(form)

    const scene = config.scenes[form.targetSceneId]
    const updates: Partial<typeof config> = { applications: apps }
    let nextDesktopConfig: DesktopConfig | null = null
    const ensureNextDesktopConfig = () => {
      if (!nextDesktopConfig) nextDesktopConfig = structuredClone(withDesktopConfigDefaults(config.desktopConfig))
      return nextDesktopConfig
    }

    if (scene) {
      const updatedScene = { ...scene, label: form.label }
      updates.scenes = { ...config.scenes, [form.targetSceneId]: updatedScene }
    }

    if (form.appType === 'widget') {
      const nextDesktop = ensureNextDesktopConfig()
      const normalizedWidth = clampWidgetDimension(widgetSize.width, 180, 1400, sourceWidgetSize.width)
      const normalizedHeight = clampWidgetDimension(widgetSize.height, 140, 1000, sourceWidgetSize.height)
      const defaults = getDefaultWidgetSize(form)
      const nextWidgetSizes = { ...(nextDesktop.widgetSizes ?? {}) }
      const nextWidgetDefaultZIndices = { ...(nextDesktop.widgetDefaultZIndices ?? {}) }

      if (normalizedWidth === defaults.width && normalizedHeight === defaults.height) {
        delete nextWidgetSizes[form.id]
      } else {
        nextWidgetSizes[form.id] = { width: normalizedWidth, height: normalizedHeight }
      }

      nextWidgetDefaultZIndices[form.id] = Math.max(0, Math.round(widgetDefaultZIndex))

      nextDesktop.widgetSizes = Object.keys(nextWidgetSizes).length ? nextWidgetSizes : undefined
      nextDesktop.widgetDefaultZIndices = Object.keys(nextWidgetDefaultZIndices).length ? nextWidgetDefaultZIndices : undefined
    }

    if (isRecycleBinDecoration && recycleBinFullOnStart !== desktopConfig.recycleBin.fullOnStart) {
      ensureNextDesktopConfig().recycleBin = {
        ...ensureNextDesktopConfig().recycleBin,
        fullOnStart: recycleBinFullOnStart,
      }
    }

    if (nextDesktopConfig) {
      updates.desktopConfig = nextDesktopConfig
    }

    await saveConfig(updates)

    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }

  const reset = () => {
    setForm(app)
    setWidgetSize(resolveWidgetSizeFromConfig(app, withDesktopConfigDefaults(config.desktopConfig)))
    setWidgetDefaultZIndex(resolveWidgetDefaultZIndexFromConfig(app, withDesktopConfigDefaults(config.desktopConfig)))
    setRecycleBinFullOnStart(withDesktopConfigDefaults(config.desktopConfig).recycleBin.fullOnStart)
    setSaved(false)
  }

  const defaultWidgetSize = getDefaultWidgetSize(form)
  const hasWidgetSizeOverride = !!desktopConfig.widgetSizes?.[form.id]
  const supportsSceneTransitions = form.appType === 'scene'

  return (
    <div className="space-y-3">
      <ConfigApplyBar label="Application Configuration" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} />
      <div className="space-y-0 pt-3">
        <ConfigSectionPanel label="Identity" first>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">Label</div>
                <input type="text" value={form.label} onChange={(e) => update((d) => { d.label = e.target.value })} className="w-full text-xs" />
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">Icon</div>
                <div className="flex gap-2 items-center">
                  <div className="w-11 h-11 flex items-center justify-center bg-zinc-800 rounded border border-zinc-700 overflow-hidden shrink-0">
                    <IconGlyph icon={form.icon} label={form.label} size={32} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <AssetSelectionInput
                      value={form.icon}
                      onChange={(nextValue) => update((d) => { d.icon = nextValue })}
                      kinds={['image']}
                      modalTitle="Application Icon"
                      placeholder="Emoji or /assets/icons/custom.png"
                      buttonLabel="Choose Image"
                      hint="Leave an emoji in the field, or use the asset library to assign a custom image icon."
                      inputClassName="font-mono"
                      previewKind="image"
                      showPreview={false}
                    />
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">Size</div>
                <div className="flex gap-1">
                  {(['small', 'normal', 'large'] as const).map((s) => (
                    <ConfigChoiceButton key={s} type="button" selected={(form.iconSize ?? 'normal') === s} onClick={() => update((d) => { d.iconSize = s })}
                      className="flex-1 text-[11px]">
                      {s}
                    </ConfigChoiceButton>
                  ))}
                </div>
              </div>
            </div>
        </ConfigSectionPanel>

        {supportsSceneTransitions && (
          <ConfigSectionPanel label="Transitions">
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] text-zinc-500 mb-1">Intro</div>
                  <TransitionList
                    value={form.introTransitions ?? []}
                    onChange={(steps) => update((d) => { d.introTransitions = steps.length ? steps : undefined })}
                  />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 mb-1">Exit</div>
                  <TransitionList
                    value={form.exitTransitions ?? []}
                    onChange={(steps) => update((d) => { d.exitTransitions = steps.length ? steps : undefined })}
                  />
                </div>
              </div>
          </ConfigSectionPanel>
        )}

        <ConfigSectionPanel label="Position">
            <div className="text-[10px] text-zinc-600 mb-2">1920×1080 canvas, pixels from top-left.</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">X</div>
                <input type="number" min={0} max={1850} value={form.iconPosition?.x ?? 16}
                  onChange={(e) => update((d) => { d.iconPosition = { x: Number(e.target.value), y: d.iconPosition?.y ?? 16 } })}
                  className="w-full font-mono text-xs" />
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">Y</div>
                <input type="number" min={0} max={990} value={form.iconPosition?.y ?? 16}
                  onChange={(e) => update((d) => { d.iconPosition = { x: d.iconPosition?.x ?? 16, y: Number(e.target.value) } })}
                  className="w-full font-mono text-xs" />
              </div>
            </div>
            <div className="text-[10px] text-zinc-600 mt-1.5">Tip: X=16, Y increments of 94</div>
            <div className="text-[10px] text-zinc-600 mt-1">Desktop icons can also be dragged live when auto-arrange is off.</div>
        </ConfigSectionPanel>

        {form.appType === 'widget' && (
          <ConfigSectionPanel label="Widget Window Defaults">
              <div className="text-[10px] text-zinc-600 mb-2">Configure default window size for this widget.</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] text-zinc-500 mb-1">Width</div>
                  <input
                    type="number"
                    min={180}
                    max={1400}
                    value={widgetSize.width}
                    onChange={(e) => setWidgetSize((prev) => ({ ...prev, width: Number(e.target.value) }))}
                    className="w-full font-mono text-xs"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 mb-1">Height</div>
                  <input
                    type="number"
                    min={140}
                    max={1000}
                    value={widgetSize.height}
                    onChange={(e) => setWidgetSize((prev) => ({ ...prev, height: Number(e.target.value) }))}
                    className="w-full font-mono text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="text-[10px] text-zinc-600">
                  Default: {defaultWidgetSize.width}x{defaultWidgetSize.height}px
                  {hasWidgetSizeOverride ? ' (override active)' : ''}
                </div>
                <Btn
                  type="button"
                  onClick={() => setWidgetSize(defaultWidgetSize)}
                  className="px-2 py-1 text-[10px]"
                >
                  Reset to Default
                </Btn>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-700/50">
                <div className="text-[10px] text-zinc-500 mb-1">
                  Default Z-Index
                  <span className="text-zinc-600 ml-1">(base order — higher starts nearer the front before manual focus changes)</span>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={widgetDefaultZIndex}
                    onChange={(e) => {
                      setWidgetDefaultZIndex(Math.max(0, Math.min(999, Math.round(Number(e.target.value) || 0))))
                    }}
                    className="w-24 font-mono text-xs"
                  />
                  <Btn
                    type="button"
                    onClick={() => setWidgetDefaultZIndex(getDefaultWidgetZIndex(form.id, widgetComponent))}
                    className="px-2 py-1 text-[10px]"
                  >
                    Reset
                  </Btn>
                </div>
                <div className="text-[10px] text-zinc-600 mt-1">
                  This is the widget's baseline stack order. Saved layouts can temporarily bias focus priority on top of this, and manual clicking or taskbar focus can still move a window to the front at runtime.
                </div>
              </div>
          </ConfigSectionPanel>
        )}

        {isStickyNotesWidget && (
          <StickyNotesConfigSection value={stickyNotesConfig} onChange={updateStickyNotesConfig} />
        )}

        {isRecycleBinDecoration && (
          <RecycleBinConfigSection
            settings={recycleBinConfig}
            fullOnStart={recycleBinFullOnStart}
            onSettingsChange={updateRecycleBinConfig}
            onFullOnStartChange={(nextValue) => {
              setRecycleBinFullOnStart(nextValue)
              setSaved(false)
            }}
          />
        )}

        {form.appType === 'widget' && widgetComponent === 'camera' && (
          <ConfigSectionPanel label="Camera Defaults">
          <div className="space-y-3">
            <div className="text-[10px] text-zinc-400">
              Configura la cámara para este widget. El widget solo muestra el video — sin controles. Abre OBS con <span className="font-mono text-zinc-300">?obs=1</span> en la URL del browser source.
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] text-zinc-500">Dispositivo de cámara</div>
                {!cameraLabelsGranted && (
                  <Btn
                    type="button"
                    disabled={detectingCameras}
                    onClick={() => void enumerateCameras(true)}
                    className="px-2 py-0.5 text-[10px]"
                  >
                    {detectingCameras ? 'Detectando...' : '🔓 Obtener nombres reales'}
                  </Btn>
                )}
              </div>
              {detectingCameras && detectedCameras.length === 0 ? (
                <div className="text-[10px] text-zinc-500 italic">Detectando dispositivos...</div>
              ) : (
                <select
                  value={form.cameraSettings?.preferredDeviceLabel ?? ''}
                  onChange={(e) => update((d) => {
                    d.cameraSettings = { ...(d.cameraSettings ?? {}), preferredDeviceLabel: e.target.value }
                  })}
                  className="w-full text-xs"
                >
                  <option value="">— Sin preferencia (primer dispositivo) —</option>
                  {detectedCameras.map((cam) => (
                    <option key={cam.deviceId} value={cam.label}>{cam.label}</option>
                  ))}
                  {/* Keep saved label as option even if not in current list */}
                  {form.cameraSettings?.preferredDeviceLabel &&
                    !detectedCameras.some((c) => c.label === form.cameraSettings?.preferredDeviceLabel) && (
                    <option value={form.cameraSettings.preferredDeviceLabel}>
                      {form.cameraSettings.preferredDeviceLabel} (guardado)
                    </option>
                  )}
                </select>
              )}
              <div className="text-[10px] text-zinc-600 mt-1">
                {!cameraLabelsGranted && detectedCameras.length > 0
                  ? 'Nombres genéricos — pulsa "Obtener nombres reales" para ver los labels reales del sistema.'
                  : 'El label se guarda en el servidor. OBS lo usa para encontrar la misma cámara automáticamente.'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id={`cam-mirror-${form.id}`}
                type="checkbox"
                checked={form.cameraSettings?.mirror ?? false}
                onChange={(e) => update((d) => {
                  d.cameraSettings = {
                    ...(d.cameraSettings ?? {}),
                    mirror: e.target.checked,
                  }
                })}
              />
              <label htmlFor={`cam-mirror-${form.id}`} className="text-[11px] text-zinc-300 cursor-pointer">
                Espejo (voltear horizontalmente)
              </label>
            </div>
          </div>
          </ConfigSectionPanel>
        )}

        {form.appType === 'widget' && widgetComponent === 'source' && (
          <ConfigSectionPanel label="Source Binding">
          <div className="space-y-3">
            <div className="text-[10px] text-zinc-400">
              Source widgets render one scene source inside a desktop window. Bind this widget to any configured source and change it later without recreating the widget.
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Scene</div>
              <select
                value={selectedSourceSceneId}
                onChange={(e) => update((d) => {
                  const nextSceneId = e.target.value
                  const nextScene = config.scenes[nextSceneId]
                  const currentSourceId = d.sourceWidgetSettings?.sourceId
                  const nextSourceId = nextScene?.sources.some((source) => source.id === currentSourceId)
                    ? currentSourceId
                    : (nextScene?.sources[0]?.id ?? '')

                  d.sourceWidgetSettings = nextSceneId
                    ? {
                        sceneId: nextSceneId,
                        sourceId: nextSourceId,
                      }
                    : undefined
                })}
                className="w-full text-xs"
              >
                <option value="">— Select scene —</option>
                {availableSourceScenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>{scene.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Source</div>
              <select
                value={form.sourceWidgetSettings?.sourceId ?? ''}
                onChange={(e) => update((d) => {
                  d.sourceWidgetSettings = {
                    sceneId: d.sourceWidgetSettings?.sceneId ?? '',
                    sourceId: e.target.value,
                  }
                })}
                disabled={!selectedSourceSceneId || availableSources.length === 0}
                className="w-full text-xs"
              >
                <option value="">
                  {selectedSourceSceneId ? '— Select source —' : '— Choose a scene first —'}
                </option>
                {availableSources.map((source) => (
                  <option key={source.id} value={source.id}>{source.id} · {source.pluginType}</option>
                ))}
              </select>
            </div>
            {availableSourceScenes.length === 0 && (
              <div className="text-[10px] text-amber-300 leading-relaxed">
                No scene sources are configured yet. Add a source to any scene, then bind this widget to it.
              </div>
            )}
            {selectedSourceSceneId && availableSources.length === 0 && (
              <div className="text-[10px] text-zinc-600">This scene currently has no sources to bind.</div>
            )}
            {selectedSource && selectedSourceScene && (
              <div className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2 space-y-1">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Current Binding</div>
                <div className="text-[11px] text-zinc-200">{selectedSourceScene.label}</div>
                <div className="text-[10px] text-zinc-400 font-mono">{selectedSource.id} · {selectedSource.pluginType}</div>
              </div>
            )}
          </div>
          </ConfigSectionPanel>
        )}

        {supportsSceneTransitions && (
          <ConfigSectionPanel label="Launch Pipeline">
          <div className="text-[10px] text-zinc-500 mb-2">Effects fired before the scene change. Fires in order, each with its own delay.</div>
          <Toggle
            checked={!!form.launchPipeline}
            label="Enable"
            onChange={(v) => update((d) => {
              d.launchPipeline = v ? { effects: [], delayMs: 0 } : undefined
            })}
          />
          {form.launchPipeline && (
            <div className="mt-3 space-y-3">
              <Slider
                label="Scene change delay (ms)"
                value={form.launchPipeline.delayMs}
                min={0} max={5000} step={100}
                onChange={(v) => update((d) => { if (d.launchPipeline) d.launchPipeline.delayMs = v })}
              />
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">Effects</div>
                {form.launchPipeline.effects.length === 0 && (
                  <div className="text-[10px] text-zinc-600 italic">No effects added.</div>
                )}
                {form.launchPipeline.effects.map((eff, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 border-b border-zinc-700/40">
                    <span className="flex-1 text-[11px] font-mono text-zinc-300">{eff.type}</span>
                    <input
                      type="number" min={0} max={10} step={0.1}
                      value={eff.delay ?? 0}
                      onChange={(e) => update((d) => {
                        if (!d.launchPipeline) return
                        d.launchPipeline.effects[i] = { ...d.launchPipeline.effects[i], delay: Number(e.target.value) }
                      })}
                      className="w-16 font-mono text-xs"
                      title="Delay (s)"
                    />
                    <span className="text-[9px] text-zinc-600">s</span>
                    <button
                      onClick={() => update((d) => {
                        if (!d.launchPipeline) return
                        d.launchPipeline.effects.splice(i, 1)
                      })}
                      className="text-[10px] text-red-500 hover:text-red-300 px-1">✕</button>
                  </div>
                ))}
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const type = e.target.value as EffectType
                    if (!type) return
                    e.target.value = ''
                    update((d) => {
                      if (!d.launchPipeline) return
                      d.launchPipeline.effects.push(createEffectDraft(type))
                    })
                  }}
                  className="w-full text-xs mt-2">
                  <option value="">+ Add effect…</option>
                  {LAUNCH_PIPELINE_EFFECT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          </ConfigSectionPanel>
        )}

        {form.appType === 'widget' && form.id === 'gallery' && (
          <ConfigSectionPanel label="Gallery Settings">
          <div className="space-y-3">
            <Toggle
              checked={form.gallerySettings?.randomOrder ?? true}
              label="Random order"
              onChange={(v) => update((d) => {
                d.gallerySettings = {
                  randomOrder: v,
                  autoPlay: d.gallerySettings?.autoPlay ?? false,
                  intervalSec: d.gallerySettings?.intervalSec ?? 8,
                }
              })}
            />
            <Toggle
              checked={form.gallerySettings?.autoPlay ?? false}
              label="Auto play"
              onChange={(v) => update((d) => {
                d.gallerySettings = {
                  randomOrder: d.gallerySettings?.randomOrder ?? true,
                  autoPlay: v,
                  intervalSec: d.gallerySettings?.intervalSec ?? 8,
                }
              })}
            />
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Auto interval (seconds)</div>
              <input
                type="number"
                min={2}
                max={120}
                value={form.gallerySettings?.intervalSec ?? 8}
                onChange={(e) => update((d) => {
                  d.gallerySettings = {
                    randomOrder: d.gallerySettings?.randomOrder ?? true,
                    autoPlay: d.gallerySettings?.autoPlay ?? false,
                    intervalSec: Math.max(2, Math.min(120, Number(e.target.value) || 8)),
                  }
                })}
                className="w-24 font-mono text-xs"
              />
              <div className="text-[10px] text-zinc-600 mt-1">Playback controls in overlay use Previous / Play / Next.</div>
            </div>
          </div>
          </ConfigSectionPanel>
        )}

        <ConfigSectionPanel label="Application Model">
            <div className="space-y-3">
              <div className="grid gap-2 md:grid-cols-2">
                <ModelField field="id" value={form.id} mono />
                <ModelField field="appType" value={form.appType} mono />
                <ModelField field="label" value={form.label || 'untitled'} />
                <ModelField field="icon" value={form.icon || 'unset'} mono />
                <ModelField field="iconSize" value={form.iconSize ?? 'normal'} mono />
                {form.appType === 'scene' && (
                  <ModelField field="targetSceneId" value={form.targetSceneId || 'none'} mono />
                )}
                {form.appType === 'widget' && widgetSource && (
                  <ModelField field="widgetSource" value={widgetSource} mono />
                )}
                {form.appType === 'widget' && widgetComponent && (
                  <ModelField field="widgetComponent" value={widgetComponent} mono />
                )}
                <ModelField field="iconPosition" value={formatIconPositionModel(form.iconPosition)} mono />
                {supportsSceneTransitions && (
                  <>
                    <ModelField field="introTransitions" value={summarizeTransitionModel(form.introTransitions)} />
                    <ModelField field="exitTransitions" value={summarizeTransitionModel(form.exitTransitions)} />
                  </>
                )}
              </div>
              {isProtectedSystemWidget && (
                <div className="rounded border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-[10px] text-amber-100/90 leading-relaxed">
                  System widgets are part of the persisted baseline model. They remain present in config and cannot be removed from the dashboard.
                </div>
              )}
            </div>
        </ConfigSectionPanel>

      </div>

      <button onClick={onDelete}
        disabled={isProtectedSystemWidget}
        className={'text-xs px-2 py-1 rounded border transition-colors ' + (
          isProtectedSystemWidget
            ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
            : 'text-red-400 hover:text-red-300 border-red-900/50 hover:border-red-700'
        )}>
        {isProtectedSystemWidget ? 'Protected' : 'Remove'}
      </button>
    </div>
  )
}

function NewWidgetForm({ onCreated }: { onCreated: (appId: string) => void }) {
  const config = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const applications = config.applications

  const [widgetComponent, setWidgetComponent] = useState<UserWidgetBaseComponent>('camera')
  const [label, setLabel] = useState('')
  const [icon, setIcon] = useState(USER_WIDGET_COMPONENT_OPTIONS[0].icon)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const componentMeta = USER_WIDGET_COMPONENT_OPTIONS.find((option) => option.id === widgetComponent) ?? USER_WIDGET_COMPONENT_OPTIONS[0]
  const existingIds = useMemo(() => new Set(applications.map((app) => app.id)), [applications])
  const defaultLabel = widgetComponent === 'camera' ? 'Camera Widget' : 'Source Widget'
  const nextLabel = label.trim() || defaultLabel
  const previewId = buildUserWidgetId(widgetComponent, nextLabel, existingIds)
  const firstSourceReference = useMemo(() => findFirstSceneSource(config.scenes), [config.scenes])

  const handleCreate = async () => {
    setCreating(true)
    setError('')

    try {
      const nextDesktop = withDesktopConfigDefaults(config.desktopConfig)
      const nextDefaultZIndex = Math.max(-1, ...Object.values(nextDesktop.widgetDefaultZIndices ?? {})) + 1

      const nextWidget: Application = {
        id: previewId,
        label: nextLabel,
        icon: icon.trim() || componentMeta.icon,
        appType: 'widget',
        targetSceneId: STATE.DESKTOP,
        widgetSource: 'user',
        widgetComponent,
        transitionType: 'instant',
        iconSize: 'normal',
        ...(widgetComponent === 'camera'
          ? { cameraSettings: { mirror: false } }
          : {}),
        ...(widgetComponent === 'source' && firstSourceReference
          ? { sourceWidgetSettings: firstSourceReference }
          : {}),
      }

      await saveConfig({
        applications: [...applications, nextWidget],
        desktopConfig: {
          ...nextDesktop,
          widgetDefaultZIndices: {
            ...(nextDesktop.widgetDefaultZIndices ?? {}),
            [previewId]: nextDefaultZIndex,
          },
        },
      })

      onCreated(previewId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create widget.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-0 pt-1">
      <ConfigSectionPanel label="Create Widget" first>
        <div className="space-y-3">
          <div className="text-[10px] text-zinc-400 leading-relaxed">
            New widgets are stored as user widget records. Choose the base component first, then create the widget and continue configuring it from the standard widget editor.
          </div>

          <div>
            <div className="text-[10px] text-zinc-500 mb-1.5">Base Component</div>
            <div className="grid grid-cols-2 gap-2">
              {USER_WIDGET_COMPONENT_OPTIONS.map((option) => {
                const active = option.id === widgetComponent
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      const currentMeta = USER_WIDGET_COMPONENT_OPTIONS.find((entry) => entry.id === widgetComponent)
                      setWidgetComponent(option.id)
                      if (!icon.trim() || icon === currentMeta?.icon) {
                        setIcon(option.icon)
                      }
                    }}
                    className={'rounded border px-3 py-3 text-left transition-colors ' + (
                      active
                        ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                        : 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/60'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{option.icon}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{option.label}</span>
                    </div>
                    <div className="text-[10px] leading-relaxed text-zinc-500">{option.description}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Label</div>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={defaultLabel}
              className="w-full text-xs"
            />
          </div>

          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Generated ID</div>
            <input
              type="text"
              value={previewId}
              readOnly
              className="w-full text-xs font-mono text-zinc-500 cursor-default select-all"
            />
          </div>

          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Icon</div>
            <div className="flex gap-2 items-center">
              <div className="w-11 h-11 flex items-center justify-center bg-zinc-800 rounded border border-zinc-700 overflow-hidden shrink-0">
                <IconGlyph icon={icon || componentMeta.icon} label={nextLabel} size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <AssetSelectionInput
                  value={icon}
                  onChange={setIcon}
                  kinds={['image']}
                  modalTitle="Widget Icon"
                  placeholder="Emoji or /assets/icons/custom.png"
                  buttonLabel="Choose Image"
                  hint="Leave an emoji in the field, or use the asset library to assign a custom image icon."
                  inputClassName="font-mono"
                  previewKind="image"
                  showPreview={false}
                />
              </div>
            </div>
          </div>

          {widgetComponent === 'source' && (
            <div className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[10px] leading-relaxed text-zinc-400">
              {firstSourceReference
                ? `Initial binding will use ${firstSourceReference.sceneId} / ${firstSourceReference.sourceId}. You can change this immediately after creation.`
                : 'No scene sources are available yet. The widget will still be created, but you will need to bind it to a source from the widget editor later.'}
            </div>
          )}

          {error && (
            <div className="rounded border border-red-900/60 bg-red-950/30 px-3 py-2 text-[10px] text-red-300">{error}</div>
          )}

          <div className="flex justify-end">
            <Btn variant="primary" onClick={() => { void handleCreate() }} disabled={creating}>
              {creating ? 'Creating...' : 'Create Widget'}
            </Btn>
          </div>
        </div>
      </ConfigSectionPanel>
    </div>
  )
}

function WidgetLayoutPanel({ layoutId, onDeleted }: { layoutId: string; onDeleted: () => void }) {
  const config = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const openWidgetIds = useAdminStore((s) => s.openWidgetIds)
  const desktopConfig = useMemo(() => withDesktopConfigDefaults(config.desktopConfig), [config.desktopConfig])
  const widgetApps = useMemo(
    () => config.applications.filter((app) => app.appType === 'widget'),
    [config.applications],
  )
  const sourceLayouts = useMemo(
    () => normalizeWidgetLayoutsForEditor(desktopConfig.widgetLayouts, widgetApps, desktopConfig),
    [desktopConfig.widgetLayouts, widgetApps, desktopConfig],
  )
  const sourceLayout = useMemo(
    () => sourceLayouts.find((layout) => layout.id === layoutId) ?? null,
    [layoutId, sourceLayouts],
  )

  const [layout, setLayout] = useState<WidgetLayoutDefinition | null>(sourceLayout)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLayout(sourceLayout ? structuredClone(sourceLayout) : null)
    setSaved(false)
  }, [sourceLayout])

  if (!sourceLayout || !layout) {
    return <div className="text-zinc-600 text-xs italic p-4">Layout not found.</div>
  }

  const dirty = !isSameDraft(layout, sourceLayout)

  const persistDraft = async () => {
    if (!dirty) return
    setSaving(true)
    await saveConfig({
      desktopConfig: {
        ...desktopConfig,
        widgetLayouts: sourceLayouts.map((entry) => entry.id === layoutId ? layout : entry),
      },
    })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }

  const reset = () => {
    setLayout(structuredClone(sourceLayout))
    setSaved(false)
  }

  const updateLayout = (updater: (draft: WidgetLayoutDefinition) => void) => {
    setLayout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      updater(next)
      return next
    })
    setSaved(false)
  }

  const captureCurrentIntoLayout = () => {
    const nextLayout = createWidgetLayoutFromCurrentState('current', widgetApps, desktopConfig, openWidgetIds)
    updateLayout((draft) => {
      draft.items = nextLayout.items.map((item) => ({
        ...item,
      }))
    })
  }

  const deleteLayout = async () => {
    if (layout.source === 'system') return
    setSaving(true)
    await saveConfig({
      desktopConfig: {
        ...desktopConfig,
        widgetLayouts: sourceLayouts.filter((entry) => entry.id !== layoutId),
      },
    })
    setSaving(false)
    onDeleted()
  }

  const applyLayout = async () => {
    if (dirty) {
      await persistDraft()
    }
    socket.emit('widget:layout:apply', layoutId)
  }

  return (
    <div className="space-y-3">
      <ConfigApplyBar
        label={layout.label}
        dirty={dirty}
        saving={saving}
        saved={saved}
        onApply={persistDraft}
        onReset={reset}
      />

      <div className="space-y-0 pt-3">
      <ConfigSectionPanel label="Layout Configuration" first>
        <div className="space-y-2.5">
          <div className="text-[10px] text-zinc-600">Built-in taskbar presets or captured user layouts. Edit rows directly.</div>

          <div className="flex gap-2 items-start">
            <input
              type="text"
              value={layout.icon}
              onChange={(e) => updateLayout((draft) => { draft.icon = e.target.value || '📐' })}
              className="w-10 text-center font-mono text-xs"
            />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={layout.label}
                  onChange={(e) => updateLayout((draft) => { draft.label = e.target.value })}
                  className="flex-1 text-xs"
                  placeholder="Layout label"
                />
                <span className={'text-[9px] font-bold uppercase tracking-[0.16em] px-2 py-0.5 rounded-full border shrink-0 ' + (
                  layout.source === 'system'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                    : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
                )}>
                  {layout.source}
                </span>
              </div>
              <input
                type="text"
                value={layout.description ?? ''}
                onChange={(e) => updateLayout((draft) => { draft.description = e.target.value })}
                className="w-full text-[11px]"
                placeholder="Optional description"
              />
            </div>
          </div>

          {layout.source === 'system' && (
            <div className="text-[10px] text-zinc-500">Built-in taskbar layout. Persistent, not removable.</div>
          )}

          <div className="flex gap-2">
            <Btn
              type="button"
              variant="primary"
              onClick={() => { void applyLayout() }}
              className="flex-1 px-2.5 py-1 text-[10px]"
            >
              Apply
            </Btn>
            <Btn
              type="button"
              onClick={() => captureCurrentIntoLayout()}
              className="px-2.5 py-1 text-[10px]"
            >
              Use Current
            </Btn>
            <Btn
              type="button"
              variant={layout.source === 'system' ? 'ghost' : 'danger'}
              onClick={() => { void deleteLayout() }}
              disabled={layout.source === 'system'}
              className="px-2.5 py-1 text-[10px]"
            >
              {layout.source === 'system' ? 'Protected' : 'Delete'}
            </Btn>
          </div>

          <div className="space-y-1.5">
            {layout.items.map((item) => {
              const app = widgetApps.find((entry) => entry.id === item.widgetId)
              if (!app) return null
              return (
                <div key={item.widgetId} className="rounded border border-zinc-800/80 bg-zinc-950/40 px-2 py-1.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => updateLayout((draft) => {
                        const row = draft.items.find((entry) => entry.widgetId === item.widgetId)
                        if (row) row.enabled = e.target.checked
                      })}
                    />
                    <div className="w-5 h-5 rounded border border-zinc-700 bg-zinc-900 flex items-center justify-center shrink-0">
                      <IconGlyph icon={app.icon} label={app.label} size={14} />
                    </div>
                    <div className="flex-1 min-w-0 text-[11px] text-zinc-200 truncate">{app.label}</div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] uppercase tracking-wider text-zinc-500">Focus</span>
                      <input
                        type="number"
                        min={-999}
                        max={999}
                        value={item.focusPriority}
                        onChange={(e) => updateLayout((draft) => {
                          const row = draft.items.find((entry) => entry.widgetId === item.widgetId)
                          if (row) row.focusPriority = Math.max(-999, Math.min(999, Math.round(Number(e.target.value) || 0)))
                        })}
                        className="w-14 font-mono text-[11px]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <div>
                      <div className="text-[9px] text-zinc-500 mb-0.5 uppercase tracking-wider">X</div>
                      <input
                        type="number"
                        min={0}
                        value={item.x}
                        onChange={(e) => updateLayout((draft) => {
                          const row = draft.items.find((entry) => entry.widgetId === item.widgetId)
                          if (row) row.x = Math.max(0, Math.round(Number(e.target.value) || 0))
                        })}
                        className="w-full font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <div className="text-[9px] text-zinc-500 mb-0.5 uppercase tracking-wider">Y</div>
                      <input
                        type="number"
                        min={0}
                        value={item.y}
                        onChange={(e) => updateLayout((draft) => {
                          const row = draft.items.find((entry) => entry.widgetId === item.widgetId)
                          if (row) row.y = Math.max(0, Math.round(Number(e.target.value) || 0))
                        })}
                        className="w-full font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <div className="text-[9px] text-zinc-500 mb-0.5 uppercase tracking-wider">W</div>
                      <input
                        type="number"
                        min={180}
                        max={1400}
                        value={item.width}
                        onChange={(e) => updateLayout((draft) => {
                          const row = draft.items.find((entry) => entry.widgetId === item.widgetId)
                          if (row) row.width = clampWidgetDimension(Number(e.target.value), 180, 1400, row.width)
                        })}
                        className="w-full font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <div className="text-[9px] text-zinc-500 mb-0.5 uppercase tracking-wider">H</div>
                      <input
                        type="number"
                        min={140}
                        max={1000}
                        value={item.height}
                        onChange={(e) => updateLayout((draft) => {
                          const row = draft.items.find((entry) => entry.widgetId === item.widgetId)
                          if (row) row.height = clampWidgetDimension(Number(e.target.value), 140, 1000, row.height)
                        })}
                        className="w-full font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </ConfigSectionPanel>
      </div>
    </div>
  )
}

// ── EventForm ──────────────────────────────────────────────────────

function EventForm({ def, onUpdate, onDelete }: {
  def: EventDef
  onUpdate: (d: EventDef) => void
  onDelete?: () => void
}) {
  const update = (fn: (d: EventDef) => void) => {
    const next: EventDef = {
      ...def,
      auto: { ...def.auto },
      effects: def.effects.map((effect) => structuredClone(effect)),
    }
    fn(next)
    onUpdate(next)
  }

  const updateDesktopNotificationEffect = (index: number, updater: (cfg: DesktopNotificationEffectConfig) => void) => {
    update((d) => {
      const effect = d.effects[index]
      if (!effect || effect.type !== 'desktop-notification') return
      const nextCfg = normalizeDesktopNotificationEffectConfig(effect.cfg)
      updater(nextCfg)
      d.effects[index] = { ...effect, cfg: nextCfg }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/60">
        <span className="text-3xl">{def.icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-zinc-100">{def.label}</div>
          <div className="text-[11px] text-zinc-500 font-mono">{def.id}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">{def.desc}</div>
        </div>
      </div>

      <div className="space-y-0 pt-2">
      {!def.builtIn && (
        <ConfigSectionPanel label="Edit" first>
          <div className="space-y-2">
            <div>
              <div className="text-[10px] text-zinc-400 mb-1">Label</div>
              <input type="text" value={def.label} onChange={(e) => update((d) => { d.label = e.target.value })} className="w-full" />
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 mb-1">Icon</div>
              <input type="text" value={def.icon} onChange={(e) => update((d) => { d.icon = e.target.value })} className="w-full" placeholder="⚡" />
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 mb-1">Description</div>
              <input type="text" value={def.desc} onChange={(e) => update((d) => { d.desc = e.target.value })} className="w-full" />
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 mb-1">Type</div>
              <select value={def.type ?? 'overlay'} onChange={(e) => update((d) => { d.type = e.target.value as 'overlay' | 'widget-automation' })} className="w-full">
                <option value="overlay">Overlay</option>
                <option value="widget-automation">Widget Automation</option>
              </select>
            </div>
          </div>
        </ConfigSectionPanel>

      )}

      <ConfigSectionPanel label="Auto-Trigger" first={def.builtIn}>
        <Toggle checked={def.auto.enabled} onChange={(v) => update((d) => { d.auto.enabled = v })} label="Enable auto-trigger" />
        {def.auto.enabled && (
          <div className="mt-3 space-y-2">
            <div>
              <div className="text-[10px] text-zinc-400 mb-1">Mode</div>
              <div className="flex gap-1">
                {(['interval', 'idle'] as const).map((m) => (
                  <ConfigChoiceButton key={m} type="button" selected={def.auto.mode === m} onClick={() => update((d) => { d.auto.mode = m })}
                    className="flex-1 text-xs">
                    {m}
                  </ConfigChoiceButton>
                ))}
              </div>
            </div>
            {def.auto.mode === 'interval' && (
              <Slider label="Avg every" value={def.auto.intervalMin} min={1} max={60} step={1} unit="min"
                onChange={(v) => update((d) => { d.auto.intervalMin = v })} />
            )}
            {def.auto.mode === 'idle' && (
              <Slider label="After idle" value={def.auto.idleMin} min={1} max={30} step={1} unit="min"
                onChange={(v) => update((d) => { d.auto.idleMin = v })} />
            )}
          </div>
        )}
      </ConfigSectionPanel>

      {def.type === 'widget-automation' && (
        <ConfigSectionPanel label="Widget Automation Settings">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-zinc-400 mb-1">Available Widgets</div>
              <div className="text-[10px] text-zinc-500 mb-2">Leave empty to include all widgets</div>
              <div className="flex flex-wrap gap-1">
                {['music', 'chat', 'archive', 'sticky-notes', 'gallery'].map((widgetId) => (
                  <ConfigChoiceButton key={widgetId}
                    type="button"
                    selected={(def.widgetAutomation?.availableWidgets ?? []).includes(widgetId)}
                    onClick={() => update((d) => {
                      if (!d.widgetAutomation) d.widgetAutomation = { availableWidgets: [], toggleChance: 0.8, openBias: 0.6 }
                      const widgets = d.widgetAutomation.availableWidgets ?? []
                      const idx = widgets.indexOf(widgetId)
                      if (idx >= 0) widgets.splice(idx, 1)
                      else widgets.push(widgetId)
                      d.widgetAutomation.availableWidgets = widgets
                    })}
                    className="text-[10px]">
                    {widgetId}
                  </ConfigChoiceButton>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-zinc-400 mb-1">Toggle Chance (0-1)</div>
                <input type="number" min={0} max={1} step={0.1} 
                  value={def.widgetAutomation?.toggleChance ?? 0.8}
                  onChange={(e) => update((d) => {
                    if (!d.widgetAutomation) d.widgetAutomation = { availableWidgets: [], toggleChance: 0.8, openBias: 0.6 }
                    d.widgetAutomation.toggleChance = Number(e.target.value)
                  })}
                  className="w-full font-mono text-xs" />
                <div className="text-[9px] text-zinc-500 mt-0.5">Probability of toggling when triggered</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-400 mb-1">Open Bias (0-1)</div>
                <input type="number" min={0} max={1} step={0.1} 
                  value={def.widgetAutomation?.openBias ?? 0.6}
                  onChange={(e) => update((d) => {
                    if (!d.widgetAutomation) d.widgetAutomation = { availableWidgets: [], toggleChance: 0.8, openBias: 0.6 }
                    d.widgetAutomation.openBias = Number(e.target.value)
                  })}
                  className="w-full font-mono text-xs" />
                <div className="text-[9px] text-zinc-500 mt-0.5">Bias toward opening (0.5 = equal)</div>
              </div>
            </div>
          </div>
        </ConfigSectionPanel>
      )}

      <ConfigSectionPanel label="Effects">
        <div className="space-y-2">
          {def.effects.length === 0 && (
            <div className="text-[10px] text-zinc-600 italic">No effects configured.</div>
          )}
          {def.effects.map((eff, index) => (
            <div key={`${def.id}-effect-${index}`} className="space-y-2 py-1.5 border-b border-zinc-700/40 last:border-b-0">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[11px] font-mono text-zinc-300">{eff.type}</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={eff.delay ?? 0}
                  onChange={(e) => update((d) => {
                    d.effects[index] = { ...d.effects[index], delay: Number(e.target.value) }
                  })}
                  className="w-16 font-mono text-xs"
                  title="Delay (s)"
                />
                <span className="text-[9px] text-zinc-600">s</span>
                <button
                  onClick={() => update((d) => { d.effects.splice(index, 1) })}
                  className="text-[10px] text-red-500 hover:text-red-300 px-1"
                >✕</button>
              </div>
              {eff.type === 'desktop-notification' && (() => {
                const cfg = normalizeDesktopNotificationEffectConfig(eff.cfg)
                return (
                  <div className="grid grid-cols-2 gap-2 pl-1">
                    <div className="col-span-2">
                      <div className="text-[10px] text-zinc-500 mb-1">Title</div>
                      <input
                        type="text"
                        value={cfg.title}
                        onChange={(e) => updateDesktopNotificationEffect(index, (draft) => { draft.title = e.target.value })}
                        className="w-full text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="text-[10px] text-zinc-500 mb-1">Body</div>
                      <textarea
                        value={cfg.body}
                        onChange={(e) => updateDesktopNotificationEffect(index, (draft) => { draft.body = e.target.value })}
                        className="w-full min-h-[72px] text-xs"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500 mb-1">Icon</div>
                      <input
                        type="text"
                        value={cfg.icon ?? ''}
                        onChange={(e) => updateDesktopNotificationEffect(index, (draft) => { draft.icon = e.target.value || undefined })}
                        className="w-full text-xs font-mono"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500 mb-1">Duration (ms)</div>
                      <input
                        type="number"
                        min={0}
                        step={250}
                        value={cfg.durationMs ?? DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS}
                        onChange={(e) => updateDesktopNotificationEffect(index, (draft) => { draft.durationMs = Number(e.target.value) || 0 })}
                        className="w-full font-mono text-xs"
                      />
                    </div>
                  </div>
                )
              })()}
            </div>
          ))}
          <select
            defaultValue=""
            onChange={(e) => {
              const type = e.target.value as EffectType
              if (!type) return
              e.target.value = ''
              update((d) => {
                d.effects.push(createEffectDraft(type))
              })
            }}
            className="w-full text-xs"
          >
            <option value="">+ Add effect…</option>
            {EVENT_EFFECT_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </ConfigSectionPanel>
      </div>

      {!def.builtIn && onDelete && (
        <div className="pt-1">
          <Btn variant="danger" onClick={onDelete} className="w-full text-xs">Delete Event</Btn>
        </div>
      )}
    </div>
  )
}

// ── SceneConfig ────────────────────────────────────────────────────

function SceneConfig({ sceneId }: { sceneId: string }) {
  const config      = useAdminStore((s) => s.config)
  const saveConfig  = useAdminStore((s) => s.saveConfig)
  const linkedApp   = config.applications.find((a) => a.targetSceneId === sceneId)

  const updateAppTransitions = (key: 'introTransitions' | 'exitTransitions', steps: TransitionStep[]) => {
    if (!linkedApp) return
    const apps = config.applications.map((a) =>
      a.id === linkedApp.id ? { ...a, [key]: steps.length ? steps : undefined } : a
    )
    saveConfig({ applications: apps })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-0 pt-1">
      <ConfigSectionPanel label="Sources" first>
        <SourcesEditor sceneId={sceneId} />
      </ConfigSectionPanel>
      {linkedApp && (
      <ConfigSectionPanel label="Transitions">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Intro (entering)</div>
              <TransitionList
                value={linkedApp.introTransitions ?? []}
                onChange={(steps) => updateAppTransitions('introTransitions', steps)}
              />
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Exit (leaving)</div>
              <TransitionList
                value={linkedApp.exitTransitions ?? []}
                onChange={(steps) => updateAppTransitions('exitTransitions', steps)}
              />
            </div>
          </div>
        </ConfigSectionPanel>
      )}
      </div>
      <StyleEditor sceneId={sceneId} />

      <div className="space-y-0">
      <ConfigSectionPanel label="Background Music">
        <div className="text-[10px] text-zinc-500 mb-2">Loop a music track while this scene is active. Leave blank for silence.</div>
        <input
          type="text"
          placeholder="/assets/audio/music/ambient/track.mp3"
          value={config.scenes[sceneId]?.musicTrack ?? ''}
          onChange={(e) => {
            const val = e.target.value.trim() || undefined
            saveConfig({ scenes: { ...config.scenes, [sceneId]: { ...config.scenes[sceneId], musicTrack: val } } })
          }}
          className="w-full font-mono text-xs"
        />
        <div className="text-[10px] text-zinc-600 mt-1">Crossfade: 1.5 s</div>
      </ConfigSectionPanel>
      </div>
    </div>
  )
}

// ── AssetLibraryPanel ──────────────────────────────────────────────

function AssetLibraryPanel({ onClose }: { onClose: () => void }) {
  const mediaLibrary = useAdminStore((s) => s.config.mediaLibrary ?? [])
  const eventDefs = useAdminStore((s) => (s.config.events ?? DEFAULT_EVENT_DEFS) as EventDef[])
  const saveConfig   = useAdminStore((s) => s.saveConfig)

  const [tab, setTab] = useState<'catalog' | 'events' | 'transitions'>('catalog')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [durStr, setDurStr] = useState('')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(eventDefs[0]?.id ?? null)

  const resetForm = () => { setName(''); setUrl(''); setDurStr('') }
  const selectedEvent = eventDefs.find((def) => def.id === selectedEventId) ?? null
  const sortedTransitionLibrary = useMemo(() => (
    [...mediaLibrary].sort((left, right) => getMediaTransitionLabel(left).localeCompare(getMediaTransitionLabel(right)))
  ), [mediaLibrary])
  const pendingTransitionKind = useMemo(() => {
    const inferred = inferAssetKindFromUrl(url, 'image')
    return inferred === 'video' ? 'video' : 'image'
  }, [url])

  useEffect(() => {
    if (eventDefs.length === 0) {
      if (selectedEventId !== null) setSelectedEventId(null)
      return
    }
    if (!selectedEventId || !eventDefs.some((def) => def.id === selectedEventId)) {
      setSelectedEventId(eventDefs[0].id)
    }
  }, [eventDefs, selectedEventId])

  const handleSave = async () => {
    if (!url) return
    const durVal = parseFloat(durStr)
    const type = pendingTransitionKind
    const hasDur = type === 'image' && !isNaN(durVal) && durVal > 0
    const entry: MediaEntry = {
      id: 'media-' + Date.now(),
      name: name.trim() || url.split('/').pop() || 'Unnamed',
      type,
      url,
      ...(hasDur ? { duration: durVal } : {}),
    }
    await saveConfig({ mediaLibrary: [...mediaLibrary, entry] })
    resetForm()
  }

  const handleDeleteMediaEntry = async (id: string) => {
    await saveConfig({ mediaLibrary: mediaLibrary.filter((entry) => entry.id !== id) })
  }

  const handleAddEvent = async () => {
    const def = createEventDef()
    setTab('events')
    await saveConfig({ events: [...eventDefs, def] })
    setSelectedEventId(def.id)
  }

  const handleUpdateEvent = (updated: EventDef) => {
    void saveConfig({ events: eventDefs.map((entry) => entry.id === updated.id ? updated : entry) })
  }

  const handleDeleteEvent = (id: string) => {
    const nextEvents = eventDefs.filter((entry) => entry.id !== id)
    if (selectedEventId === id) {
      setSelectedEventId(nextEvents[0]?.id ?? null)
    }
    void saveConfig({ events: nextEvents })
  }

  const handleTriggerEvent = (def: EventDef) => {
    socket.emit('overlay:trigger', { id: def.id, effects: def.effects })
  }

  return (
    <FloatingWindowShell frameClassName="h-[85vh] max-h-[780px]" layerClassName="z-[60]">

        <FloatingWindowHeader icon="🗂" title="Asset Library" onClose={onClose} />

        {/* Modal body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">

      {/* Tabs */}
      <div className="flex gap-1.5 rounded-xl border border-zinc-800/80 bg-zinc-950/55 p-1.5">
        {(['catalog', 'events', 'transitions'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={'flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ' +
              (tab === t
                ? 'border-cyan-400/35 bg-cyan-500/14 text-cyan-100'
                : 'border-transparent text-zinc-500 hover:border-zinc-700/70 hover:bg-zinc-900/75 hover:text-zinc-200')}
          >
            {t === 'catalog' ? '🗂 Catalog' : t === 'events' ? '⚡ Events' : '✨ Transitions'}
          </button>
        ))}
      </div>

      {tab === 'catalog' && (
        <div className="space-y-3">
          <ConfigNotice>
            The catalog indexes the full assets folder, the scraped game-image feed, and your saved media presets in one place.
          </ConfigNotice>

          <AssetCatalogPanel
            kinds={['image', 'video', 'audio']}
            onDeleteSavedEntry={(asset) => { void handleDeleteMediaEntry(asset.id) }}
          />
        </div>
      )}

      {tab === 'events' && (
        <div className="space-y-3">
          <ConfigNotice>
            Overlay triggers and widget automation rules now live here instead of the left sidebar.
          </ConfigNotice>

          <div className="flex flex-wrap gap-2">
            {eventDefs.map((def) => {
              const active = def.id === selectedEventId
              return (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => setSelectedEventId(def.id)}
                  className={'flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ' + (
                    active
                      ? 'border-cyan-400/35 bg-cyan-500/14 text-zinc-100'
                      : 'border-zinc-800/80 bg-zinc-950/55 text-zinc-400 hover:border-zinc-700/80 hover:text-zinc-200'
                  )}
                >
                  <span className="text-sm leading-none">{def.icon}</span>
                  <span className="max-w-[12rem] truncate text-[11px] font-medium">{def.label}</span>
                  {def.auto.enabled && <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-300">Auto</span>}
                </button>
              )
            })}
            <Btn
              type="button"
              variant="ghost"
              onClick={() => { void handleAddEvent() }}
              className="border-dashed border-zinc-700/80 px-3 py-2 text-[11px] text-zinc-400 hover:text-cyan-200"
            >
              ＋ New Event
            </Btn>
          </div>

          {selectedEvent ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <div className="text-[10px] text-zinc-500">Editing {selectedEvent.label}</div>
                <Btn type="button" variant="primary" onClick={() => handleTriggerEvent(selectedEvent)} className="px-3 py-1 text-[10px]">
                  Fire Now
                </Btn>
              </div>
              <EventForm
                def={selectedEvent}
                onUpdate={handleUpdateEvent}
                onDelete={selectedEvent.builtIn ? undefined : () => handleDeleteEvent(selectedEvent.id)}
              />
            </div>
          ) : (
            <ConfigNotice tone="info" className="py-6 text-center">
              No events configured yet. Create one to add overlay triggers or widget automation rules.
            </ConfigNotice>
          )}
        </div>
      )}

      {/* ── Transitions tab ── */}
      {tab === 'transitions' && (
        <div className="space-y-0 pt-2">
          <ConfigSectionPanel label="System Transitions" first>
            <div className="space-y-2">
              <ConfigNotice>
                System transitions are always available in every transition combo box.
              </ConfigNotice>
              {TRANSITION_OPTIONS.map((transition) => (
                <ConfigCard key={transition.id} className="flex items-center gap-2.5">
                  <span className="text-base w-5 text-center shrink-0">{TRANSITION_ICONS[transition.id]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-zinc-200">{transition.label}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">{transition.id}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => socket.emit('transition:preview', [{ id: transition.id }])}
                    className={`shrink-0 ${TRANSITION_TEST_BUTTON_CLASS}`}
                    title="Test"
                  >
                    Test
                  </button>
                </ConfigCard>
              ))}
            </div>
          </ConfigSectionPanel>

          <ConfigSectionPanel label="User Transitions">
            <div className="space-y-3">
              <ConfigNotice>
                User transitions saved here become reusable options in every transition combo box.
              </ConfigNotice>

              {sortedTransitionLibrary.length === 0 ? (
                <ConfigNotice tone="info" className="py-4">
                  No user transitions saved yet.
                </ConfigNotice>
              ) : (
                <div className="space-y-1.5">
                  {sortedTransitionLibrary.map((entry) => (
                    <ConfigCard key={entry.id} className="flex items-center gap-2.5">
                      <span className="text-base w-5 text-center shrink-0">{entry.type === 'image' ? '🖼' : '🎬'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-zinc-200 truncate">{getMediaTransitionLabel(entry)}</div>
                        <div className="text-[10px] text-zinc-500 font-mono truncate">{entry.url}</div>
                      </div>
                      {entry.type === 'image' && entry.duration != null && (
                        <span className="shrink-0 text-[10px] font-mono text-zinc-600">{entry.duration}s</span>
                      )}
                      <button
                        type="button"
                        onClick={() => socket.emit('transition:preview', [strToStep(encodeMediaTransitionValue(entry))])}
                        className={`shrink-0 ${TRANSITION_TEST_BUTTON_CLASS}`}
                        title="Test"
                      >
                        Test
                      </button>
                      <button
                        type="button"
                        onClick={() => { void handleDeleteMediaEntry(entry.id) }}
                        className={`shrink-0 ${TRANSITION_DELETE_BUTTON_CLASS}`}
                        title="Delete"
                      >
                        Delete
                      </button>
                    </ConfigCard>
                  ))}
                </div>
              )}
            </div>
          </ConfigSectionPanel>

          <ConfigSectionPanel label="Create User Transition">
            <div className="space-y-3">
              <ConfigNotice>
                Save an image or video as a reusable user transition.
              </ConfigNotice>

              <ConfigCard className="space-y-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name (optional)"
                  className="w-full text-xs"
                />

                <AssetSelectionInput
                  value={url}
                  onChange={setUrl}
                  kinds={['image', 'video']}
                  modalTitle="User Transition Asset"
                  placeholder="/assets/images/transition.png or /assets/video/transition.mp4"
                  buttonLabel="Choose Asset"
                  previewKind="auto"
                  showPreview={false}
                />

                {url && pendingTransitionKind === 'image' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0.1}
                      max={120}
                      step={0.5}
                      value={durStr}
                      onChange={(e) => setDurStr(e.target.value)}
                      placeholder="4.0"
                      className="w-24 text-xs font-mono"
                    />
                    <span className="text-[10px] text-zinc-600">sec display duration</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Btn
                    type="button"
                    variant="primary"
                    onClick={() => void handleSave()}
                    disabled={!url}
                    className="flex-1 text-xs"
                  >
                    Save
                  </Btn>
                  {(name || url || durStr) && (
                    <Btn
                      type="button"
                      onClick={resetForm}
                      className="px-3 text-xs"
                    >
                      Reset
                    </Btn>
                  )}
                </div>
              </ConfigCard>
            </div>
          </ConfigSectionPanel>
        </div>
      )}

        </div>
    </FloatingWindowShell>
  )
}

// ── LivePreview ────────────────────────────────────────────────────

function LivePreview() {
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef     = useRef<HTMLIFrameElement>(null)
  const previewTarget = useAdminStore((s) => s.previewTarget)
  const previewUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:${previewTarget === 'runtime' ? 3000 : 3001}`
    : 'http://localhost:3000'
  const previewLabel = previewTarget === 'runtime' ? 'Runtime 3000' : 'Direct Dev 3001'
  const previewBackdropStyle: React.CSSProperties = {
    backgroundColor: '#111827',
    backgroundImage: [
      'linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.05) 75%, rgba(255,255,255,0.05))',
      'linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.05) 75%, rgba(255,255,255,0.05))',
    ].join(', '),
    backgroundPosition: '0 0, 16px 16px',
    backgroundSize: '32px 32px',
  }

  useEffect(() => {
    const scale = () => {
      const c = containerRef.current
      const f = frameRef.current
      if (!c || !f) return
      const s = Math.min(c.clientWidth / 1920, c.clientHeight / 1080)
      f.style.transform       = 'scale(' + s + ')'
      f.style.transformOrigin = 'top left'
      f.style.marginLeft      = ((c.clientWidth  - 1920 * s) / 2) + 'px'
      f.style.marginTop       = ((c.clientHeight - 1080 * s) / 2) + 'px'
    }
    scale()
    const ro = new ResizeObserver(scale)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden min-w-0" style={previewBackdropStyle}>
      <div className="absolute left-3 top-3 z-10 pointer-events-none">
        <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] shadow-lg shadow-black/20 backdrop-blur ${previewTarget === 'runtime'
          ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-100'
          : 'border-amber-400/35 bg-amber-500/12 text-amber-100'}`}>
          <span className={`h-2 w-2 rounded-full ${previewTarget === 'runtime' ? 'bg-emerald-300' : 'bg-amber-300'}`} />
          <span>{previewLabel}</span>
        </div>
      </div>
      <div className="absolute right-3 bottom-3 z-10 pointer-events-none rounded-xl border border-zinc-800/80 bg-zinc-950/75 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-400 shadow-lg shadow-black/20 backdrop-blur">
        Transparent background preview
      </div>
      <iframe
        ref={frameRef}
        src={previewUrl}
        width={1920}
        height={1080}
        allow="camera; microphone"
        className="absolute block border-0"
        title="Overlay Preview"
      />
    </div>
  )
}

// ── RightPane ──────────────────────────────────────────────────────

function EnvironmentLiveNotice({ targetState, label }: { targetState: STATE; label: string }) {
  const currentState = useAdminStore((s) => s.currentState)
  const setLastError = useAdminStore((s) => s.setLastError)

  if (currentState === targetState) return null

  return (
    <ConfigNotice tone="warning" className="space-y-2 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold text-amber-200">{label} preview is not live</div>
          <div className="text-[10px] text-amber-100/80 leading-relaxed">
            Current state is <span className="font-mono">{currentState}</span>. Switch the runtime to <span className="font-mono">{targetState}</span> to see this editor reflected in the preview.
          </div>
        </div>
        <Btn
          type="button"
          variant="warning"
          onClick={() => {
            setLastError(null)
            socket.emit('scene:change', targetState, (err: string | null) => { if (err) setLastError(err) })
          }}
          className="shrink-0 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em]"
        >
          Show {label}
        </Btn>
      </div>
    </ConfigNotice>
  )
}

function DashboardLegendCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <ConfigCard className="text-left">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base">{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-200">{title}</span>
      </div>
      <div className="text-[10px] text-zinc-500 leading-relaxed">{description}</div>
    </ConfigCard>
  )
}

function RightPaneContent({ selected, onDeleted, onSelectItem }: {
  selected: SelectedItem; onDeleted: () => void; onSelectItem: (item: SelectedItem) => void
}) {
  const saveConfig   = useAdminStore((s) => s.saveConfig)
  const applications = useAdminStore((s) => s.config.applications)
  const desktopConfig = withDesktopConfigDefaults(useAdminStore((s) => s.config.desktopConfig))

  if (selected.kind === 'env') {
    if (selected.envState === STATE.LOBBY) return (
      <div className="space-y-5">
        <EnvironmentLiveNotice targetState={STATE.LOBBY} label="Lobby" />
        <LobbyConfigEditor />
        <StyleEditor sceneId={STATE.LOBBY} />
      </div>
    )
    return (
      <div className="space-y-5">
        <EnvironmentLiveNotice targetState={STATE.DESKTOP} label="Desktop" />
        <DesktopConfigEditor />
        <StyleEditor sceneId={STATE.DESKTOP} />
      </div>
    )
  }

  if (selected.kind === 'scene') return <SceneConfig sceneId={selected.sceneState as STATE} />

  if (selected.kind === 'app') {
    const app = applications.find((a) => a.id === selected.appId)
    if (!app) return <div className="text-zinc-600 text-xs italic p-4">App not found.</div>
    return (
      <AppForm app={app} onDelete={() => {
        if (app.appType === 'widget' && isSystemWidget(app)) return

        saveConfig({
          applications: applications.filter((a) => a.id !== selected.appId),
          ...(app.appType === 'widget'
            ? { desktopConfig: removeWidgetFromDesktopConfig(desktopConfig, app.id) }
            : {}),
        })
        onDeleted()
      }} />
    )
  }

  if (selected.kind === 'widget-create') {
    return <NewWidgetForm onCreated={(appId) => onSelectItem({ kind: 'app', appId })} />
  }

  if (selected.kind === 'widget-layout') {
    return <WidgetLayoutPanel layoutId={selected.layoutId} onDeleted={onDeleted} />
  }

  if (selected.kind === 'audio')       return <AudioPanel />
  if (selected.kind === 'keybinds')    return <KeybindEditor />
  if (selected.kind === 'archive')     return <ArchivePanel />
  if (selected.kind === 'settings')    return <SettingsPage />
  if (selected.kind === 'ambiance')    return <AmbiancePanel />

  return null
}

function RightPane({ selected, onClose, onSelectItem }: {
  selected: SelectedItem | null; onClose: () => void; onSelectItem: (item: SelectedItem) => void
}) {
  const currentState = useAdminStore((s) => s.currentState)
  const setLastError = useAdminStore((s) => s.setLastError)
  const applications = useAdminStore((s) => s.config.applications)
  const desktopConfig = withDesktopConfigDefaults(useAdminStore((s) => s.config.desktopConfig))

  const triggerScene = (state: string) => {
    setLastError(null)
    socket.emit('scene:change', state, (err: string | null) => { if (err) setLastError(err) })
  }

  if (!selected) {
    return (
      <div className="w-80 shrink-0 overflow-y-auto border-l border-zinc-800 bg-zinc-950/95">
        <div className="space-y-3 p-4 select-none">
          <ConfigCard>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-200">Dashboard Map</div>
            <div className="mt-1 text-[10px] leading-relaxed text-zinc-500">
              The left sidebar mixes scenes, applications, desktop widgets, and decorative icons. Use this legend to read the taxonomy quickly.
            </div>
          </ConfigCard>
          <DashboardLegendCard icon="🎬" title="Scenes" description="Lobby, Desktop, and application-backed scene states. Edit sources, style, transitions, and music here." />
          <DashboardLegendCard icon="🎮" title="Applications" description="Desktop icons that emit scene changes and point at the scenes above." />
          <DashboardLegendCard icon="🪟" title="Widgets" description="Desktop windows that open on DESKTOP without changing machine state. Widgets can be system or user, and can use camera, source, or built-in runtimes." />
          <DashboardLegendCard icon="🖼" title="Decorations" description="Desktop-only icons for ambience. They render on the Desktop and do not open anything." />
          <ConfigCard className="text-left">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Quick Read</div>
            <div className="text-[10px] text-zinc-400 leading-relaxed">
              Scene = runtime state. Application = transition signal. Widget = open desktop thing. Decoration = render-only desktop thing.
            </div>
          </ConfigCard>
        </div>
      </div>
    )
  }

  // Build header info
  let headerIcon: React.ReactNode = ''
  let headerLabel = ''
  let headerMeta = ''
  let actionLabel = ''
  let actionFn: (() => void) | null = null
  let isLive = false

  if (selected.kind === 'env') {
    headerIcon  = selected.envState === STATE.LOBBY ? '🖥' : '💾'
    headerLabel = selected.envState === STATE.LOBBY ? 'Lobby' : 'Desktop'
    headerMeta = 'Scene'
    isLive      = currentState === selected.envState
    actionLabel = isLive ? '● Live' : '▶ Go Live'
    actionFn    = () => triggerScene(selected.envState)
  } else if (selected.kind === 'scene') {
    const parts = selected.sceneState.split(' ')
    headerIcon  = parts[0]
    headerLabel = parts.slice(1).join(' ') || selected.sceneState
    headerMeta = 'Scene'
    isLive      = currentState === selected.sceneState
    actionLabel = isLive ? '● Live' : '▶ Go Live'
    actionFn    = () => triggerScene(selected.sceneState)
  } else if (selected.kind === 'app') {
    const app   = applications.find((a) => a.id === selected.appId)
    headerIcon  = app ? <IconGlyph icon={app.icon} label={app.label} /> : '🎮'
    headerLabel = app?.label ?? 'Application'
    headerMeta = app ? 'Application Record' : 'Application'
    isLive      = app ? currentState === app.targetSceneId : false
    actionLabel = app?.appType === 'widget' ? '▶ Open' : app?.appType === 'scene' ? '▶ Launch' : 'Decoration'
    // Widgets do not transition — they are floating windows. Only scene apps emit scene:change.
    actionFn    = (app && app.appType === 'scene') ? () => { socket.emit('scene:change', app.targetSceneId); setLastError(null) } : null
  } else if (selected.kind === 'widget-create') {
    headerIcon = '+'
    headerLabel = 'New Widget'
    headerMeta = 'User Widget Creator'
  } else if (selected.kind === 'widget-layout') {
    const layout = (desktopConfig.widgetLayouts ?? []).find((entry) => entry.id === selected.layoutId)
    headerIcon = layout?.icon ?? '📐'
    headerLabel = layout?.label ?? 'Widget Layout'
    headerMeta = layout?.source === 'system' ? 'System Layout' : 'User Layout'
  } else if (selected.kind === 'audio')       { headerIcon = '🔊'; headerLabel = 'Audio'; headerMeta = 'Utility' }
  else if (selected.kind === 'keybinds')    { headerIcon = '⌨';  headerLabel = 'Keybinds'; headerMeta = 'Utility' }
  else if (selected.kind === 'archive')     { headerIcon = '📁'; headerLabel = 'Archive'; headerMeta = 'Utility' }
  else if (selected.kind === 'settings')    { headerIcon = '⚙';  headerLabel = 'Settings'; headerMeta = 'Utility' }

  return (
    <div className="flex w-80 shrink-0 flex-col overflow-hidden border-l border-zinc-800 bg-zinc-950/95">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800/80 bg-zinc-950/70 px-3 py-2.5 backdrop-blur-sm">
        <span className="text-sm shrink-0">{headerIcon}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-zinc-200 truncate">{headerLabel}</span>
          {headerMeta && <span className="block text-[10px] text-zinc-500 truncate mt-0.5">{headerMeta}</span>}
        </span>
        {actionFn && (
          <Btn onClick={actionFn} variant={isLive ? 'active' : 'default'} className="px-2.5 py-1 text-xs">
            {actionLabel}
          </Btn>
        )}
        <button onClick={onClose}
          className="ml-0.5 rounded-md border border-zinc-800/80 bg-zinc-950/60 px-2 py-0.5 text-sm leading-none text-zinc-500 transition-colors hover:border-zinc-700/80 hover:text-zinc-100">
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto bg-zinc-950/55 p-3">
        <RightPaneContent selected={selected} onDeleted={onClose} onSelectItem={onSelectItem} />
      </div>
    </div>
  )
}

// ── SocketLogConsole ────────────────────────────────────────────────

const MAX_LOG_ENTRIES = 300

type LogEntry = { id: number; time: string; dir: '←' | '→'; event: string; details: string }
const logListeners: ((e: LogEntry) => void)[] = []
let logSeq = 0
let logHistory: LogEntry[] = []

function stringifyLogValue(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  if (value instanceof Error) {
    return [value.name ? `${value.name}: ${value.message}` : value.message, value.stack]
      .filter(Boolean)
      .join('\n')
  }

  try {
    const seen = new WeakSet<object>()
    const serialized = JSON.stringify(value, (_key, currentValue) => {
      if (typeof currentValue === 'bigint') return `${currentValue.toString()}n`
      if (currentValue instanceof Error) {
        return {
          name: currentValue.name,
          message: currentValue.message,
          stack: currentValue.stack,
        }
      }
      if (typeof currentValue === 'object' && currentValue !== null) {
        if (seen.has(currentValue)) return '[Circular]'
        seen.add(currentValue)
      }
      return currentValue
    }, 2)

    return serialized ?? String(value)
  } catch {
    return String(value)
  }
}

function formatLogData(args: unknown[]): string {
  if (args.length === 0) return ''

  return args
    .map((arg, index) => {
      const rendered = stringifyLogValue(arg)
      return args.length > 1 ? `[${index}] ${rendered}` : rendered
    })
    .join('\n')
}

function summarizeLogDetails(details: string) {
  const firstLine = details.split('\n').find((line) => line.trim().length > 0) ?? ''
  if (!firstLine) return ''
  return firstLine.length > 120 ? `${firstLine.slice(0, 120)}...` : firstLine
}

function pushLog(dir: '←' | '→', event: string, args: unknown[]) {
  const now = new Date()
  const time = now.toTimeString().slice(0, 8)
  const entry: LogEntry = { id: ++logSeq, time, dir, event, details: formatLogData(args) }
  logHistory = [...logHistory.slice(-(MAX_LOG_ENTRIES - 1)), entry]
  logListeners.forEach((fn) => fn(entry))
}

// Wire up socket event capture at module level
const LOG_SKIP = new Set(['obs:status'])
socket.onAny((event, ...args) => { if (!LOG_SKIP.has(event)) pushLog('←', event, args as unknown[]) })
socket.onAnyOutgoing((event, ...args) => pushLog('→', event, args as unknown[]))

function SocketLogConsole({ variant = 'sidebar' }: { variant?: 'sidebar' | 'settings' }) {
  const [entries, setEntries] = useState<LogEntry[]>(() => logHistory)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [expandedEntryIds, setExpandedEntryIds] = useState<number[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const isSettingsVariant = variant === 'settings'

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!entries.length) return

    const text = entries
      .map((entry) => [`${entry.time} ${entry.dir} ${entry.event}`, entry.details].filter(Boolean).join('\n'))
      .join('\n\n')

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 1500)
    } catch {
      setCopyState('error')
      setTimeout(() => setCopyState('idle'), 1800)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    logHistory = []
    setEntries([])
    setExpandedEntryIds([])
    setCopyState('idle')
  }

  const toggleEntry = (entryId: number) => {
    setExpandedEntryIds((prev) => (
      prev.includes(entryId)
        ? prev.filter((id) => id !== entryId)
        : [...prev, entryId]
    ))
  }

  useEffect(() => {
    const handler = (e: LogEntry) =>
      setEntries((prev) => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), e])
    logListeners.push(handler)
    return () => { const i = logListeners.indexOf(handler); if (i >= 0) logListeners.splice(i, 1) }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  return (
    <div className={isSettingsVariant ? 'rounded-xl border border-zinc-800/80 bg-zinc-950/70' : 'shrink-0 border-t border-zinc-800/80 bg-zinc-950/65'}>
      <ConfigToolbar className={isSettingsVariant ? 'rounded-none border-0 border-b border-zinc-800/80 bg-zinc-950/40 px-3 py-2' : 'rounded-none border-0 border-b border-zinc-800/80 bg-zinc-950/35 px-2.5 py-1.5'}>
        <span className={isSettingsVariant ? 'flex-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400' : 'flex-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600'}>
          {isSettingsVariant ? 'Socket Console' : 'Console'}
        </span>
        <span className={isSettingsVariant ? 'rounded-full border border-zinc-800 bg-zinc-950/70 px-2 py-1 text-[10px] font-mono text-zinc-500' : 'text-[10px] font-mono text-zinc-600'}>
          {entries.length} event{entries.length === 1 ? '' : 's'}
        </span>
        <Btn
          type="button"
          variant="default"
          onClick={handleCopy}
          disabled={!entries.length}
          title="Copy the full socket log to the clipboard"
          className={isSettingsVariant ? 'px-2 py-1 text-[10px] font-medium' : 'px-1.5 py-0.5 text-[10px]'}
        >
          {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy all'}
        </Btn>
        <Btn
          type="button"
          variant="danger"
          onClick={handleClear}
          disabled={!entries.length}
          title="Clear the socket log"
          className={isSettingsVariant ? 'px-2 py-1 text-[10px] font-medium' : 'px-1.5 py-0.5 text-[10px]'}
        >
          Clear
        </Btn>
      </ConfigToolbar>
      <div className={isSettingsVariant ? 'max-h-[26rem] overflow-y-auto bg-zinc-950/60 px-3 py-2 space-y-2' : 'h-[150px] overflow-y-auto bg-zinc-950/60 px-2 py-1 space-y-1'}>
        {entries.length === 0 && (
          <ConfigNotice tone="info" className={isSettingsVariant ? 'pt-3 text-center' : 'py-2 text-center text-[10px]'}>No events yet.</ConfigNotice>
        )}
        {entries.map((e) => (
          <ConfigCard key={e.id} className={isSettingsVariant ? 'font-mono' : 'font-mono px-2 py-1.5'}>
            <div className="flex min-w-0 items-start gap-2">
              <span className={isSettingsVariant ? 'text-[10px] text-zinc-600 shrink-0' : 'text-[9px] text-zinc-700 shrink-0'}>{e.time}</span>
              <span className={(isSettingsVariant ? 'text-[11px] shrink-0 ' : 'text-[10px] shrink-0 ') + (e.dir === '→' ? 'text-cyan-500' : 'text-emerald-500')}>{e.dir}</span>
              <span className={isSettingsVariant ? 'min-w-0 break-all text-[11px] text-zinc-200' : 'min-w-0 break-all text-[10px] text-zinc-300'}>{e.event}</span>
            </div>
            {e.details && (() => {
              const expanded = expandedEntryIds.includes(e.id)
              const summary = summarizeLogDetails(e.details)

              return (
                <div className="mt-2">
                  <Btn
                    type="button"
                    variant="ghost"
                    onClick={() => toggleEntry(e.id)}
                    className={isSettingsVariant
                      ? 'flex w-full items-center justify-start gap-2 px-2 py-1.5 text-left text-[10px] text-zinc-400'
                      : 'flex w-full items-center justify-start gap-1.5 px-1.5 py-1 text-left text-[10px] text-zinc-500'}
                    title={expanded ? 'Collapse' : 'Expand'}
                  >
                    <span className="shrink-0">{expanded ? '▾' : '▸'}</span>
                    <span className="shrink-0 font-medium normal-case tracking-normal">
                      {expanded ? 'Collapse' : 'Expand'}
                    </span>
                    {summary && <span className="min-w-0 flex-1 truncate normal-case tracking-normal">{summary}</span>}
                  </Btn>
                  {expanded && (
                    <pre className={isSettingsVariant ? 'mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded border border-zinc-900 bg-zinc-900/70 px-2 py-1.5 text-[10px] leading-relaxed text-zinc-400' : 'mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded border border-zinc-900/80 bg-zinc-950/60 px-1.5 py-1 text-[10px] leading-relaxed text-zinc-500'}>{e.details}</pre>
                  )}
                </div>
              )
            })()}
          </ConfigCard>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ── LeftSidebar ────────────────────────────────────────────────────

function SidebarBtn({ icon, label, live, statusLabel, statusClassName, active, onClick, onDoubleClick }: {
  icon: React.ReactNode; label: string; live?: boolean; statusLabel?: string; statusClassName?: string; active: boolean
  onClick: () => void; onDoubleClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={onDoubleClick ? 'Click to configure · Double-click to activate' : undefined}
      className={'mb-0.5 flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ' +
        (active
          ? 'border-cyan-400/30 bg-cyan-500/12 text-zinc-100'
          : 'border-zinc-900/60 bg-transparent text-zinc-500 hover:border-zinc-800/80 hover:bg-zinc-900/60 hover:text-zinc-100')}>
      <span className="text-sm w-4 h-4 flex items-center justify-center shrink-0 leading-none overflow-hidden">{icon}</span>
      <span className="flex-1 truncate font-medium">{label}</span>
      {live && <span className="text-[9px] font-bold text-emerald-400 tracking-widest shrink-0">LIVE</span>}
      {!live && statusLabel && <span className={`text-[9px] font-bold tracking-widest shrink-0 ${statusClassName ?? 'text-zinc-500'}`}>{statusLabel}</span>}
    </button>
  )
}

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="mb-0.5 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-zinc-800/80 px-2.5 py-1.5 text-[11px] text-zinc-500 transition-colors hover:border-cyan-500/35 hover:bg-cyan-500/8 hover:text-cyan-200">
      <span className="text-sm w-4 text-center shrink-0">+</span>
      <span>{label}</span>
    </button>
  )
}

function SectionLabel({ children, hint: _hint, first = false }: { children: string; hint?: string; first?: boolean }) {
  return (
    <div className={first ? 'px-2.5 pt-2 mb-3' : 'mt-7 mb-3 px-2.5 pt-3 border-t-2 border-cyan-500/25'}>
      <span className="inline-flex rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-cyan-200">
        {children}
      </span>
    </div>
  )
}

function SidebarAppIcon({ app }: { app: Application }) {
  return <IconGlyph icon={app.icon} label={app.label} size={14} />
}

function LeftSidebar({ selected, onSelect, onActivate, libraryOpen, onLibrary, settingsOpen, onSettings }: {
  selected: SelectedItem | null; onSelect: (item: SelectedItem) => void; onActivate: (item: SelectedItem) => void
  libraryOpen: boolean
  onLibrary: () => void
  settingsOpen: boolean
  onSettings: () => void
}) {
  const currentState = useAdminStore((s) => s.currentState)
  const saveConfig   = useAdminStore((s) => s.saveConfig)
  const applications = useAdminStore((s) => s.config.applications)
  const scenes       = useAdminStore((s) => s.config.scenes)
  const overlayStyle = useAdminStore((s) => s.config.overlayStyle)
  const desktopConfig = withDesktopConfigDefaults(useAdminStore((s) => s.config.desktopConfig))
  const openWidgetIds = useAdminStore((s) => s.openWidgetIds)

  const sceneApps      = applications.filter((a) => (a.appType ?? 'scene') === 'scene')
  const widgetApps     = applications.filter((a) => a.appType === 'widget')
  const systemWidgetApps = widgetApps.filter((app) => getWidgetSource(app) === 'system')
  const userWidgetApps = widgetApps.filter((app) => getWidgetSource(app) === 'user')
  const decorationApps = applications.filter((a) => a.appType === 'decoration')
  const persistedWidgetLayouts = desktopConfig.widgetLayouts ?? []
  const systemWidgetLayouts = persistedWidgetLayouts.filter((layout) => layout.source === 'system')
  const userWidgetLayouts = persistedWidgetLayouts.filter((layout) => layout.source === 'user')
  const orderedWidgetLayouts = [...systemWidgetLayouts, ...userWidgetLayouts]
  const sceneEntries: Array<{ app: Application; scene: Scene }> = []
  const seenSceneIds = new Set<string>()

  sceneApps.forEach((app) => {
    const scene = scenes[app.targetSceneId]
    if (!scene || scene.id === STATE.LOBBY || scene.id === STATE.DESKTOP || seenSceneIds.has(scene.id)) return
    seenSceneIds.add(scene.id)
    sceneEntries.push({ app, scene })
  })

  const captureCurrentLayout = async () => {
    if (widgetApps.length === 0) return
    const nextUserLayoutNumber = userWidgetLayouts.length + 1
    const nextLayout = createWidgetLayoutFromCurrentState(`Layout ${nextUserLayoutNumber}`, widgetApps, desktopConfig, openWidgetIds)
    await saveConfig({
      desktopConfig: {
        ...desktopConfig,
        widgetLayouts: [...persistedWidgetLayouts, nextLayout],
      },
    })
    onSelect({ kind: 'widget-layout', layoutId: nextLayout.id })
  }

  const isActive = (item: SelectedItem) => selected ? itemKey(item) === itemKey(selected) : false

  return (
    <div className="flex w-52 shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950/95">
      {/* Scrollable nav area */}
      <div className="flex-1 overflow-y-auto pb-1">

      <SectionLabel hint="Lobby, Desktop, and application-backed runtime scenes." first>Scenes</SectionLabel>
      <SidebarBtn icon="🖥" label="Lobby" live={currentState === STATE.LOBBY} active={isActive({ kind: 'env', envState: STATE.LOBBY })} onClick={() => onSelect({ kind: 'env', envState: STATE.LOBBY })} onDoubleClick={() => onActivate({ kind: 'env', envState: STATE.LOBBY })} />
      <SidebarBtn icon="💾" label="Desktop" live={currentState === STATE.DESKTOP} active={isActive({ kind: 'env', envState: STATE.DESKTOP })} onClick={() => onSelect({ kind: 'env', envState: STATE.DESKTOP })} onDoubleClick={() => onActivate({ kind: 'env', envState: STATE.DESKTOP })} />

      {sceneEntries.map(({ app, scene }) => {
        return (
          <SidebarBtn key={scene.id} icon={<SidebarAppIcon app={app} />} label={scene.label}
            live={currentState === scene.id}
            active={isActive({ kind: 'scene', sceneState: scene.id })}
            onClick={() => onSelect({ kind: 'scene', sceneState: scene.id })}
            onDoubleClick={() => onActivate({ kind: 'scene', sceneState: scene.id })} />
        )
      })}

      <SectionLabel hint="Desktop icons that launch scene transitions.">Applications</SectionLabel>
      {sceneApps.map((app) => (
        <SidebarBtn key={app.id} icon={<SidebarAppIcon app={app} />} label={app.label}
          live={currentState === app.targetSceneId}
          active={isActive({ kind: 'app', appId: app.id })}
          onClick={() => onSelect({ kind: 'app', appId: app.id })}
          onDoubleClick={() => onActivate({ kind: 'app', appId: app.id })} />
      ))}
      <AddBtn label="New Application" onClick={() => {
        const sceneId = 'SCENE_' + Date.now()
        const a: Application = { id: 'app-' + Date.now(), label: 'New App', icon: '🎮', appType: 'scene', targetSceneId: sceneId, transitionType: 'desktop-to-gameplay', introTransition: 'desktop-to-gameplay', exitTransition: 'gameplay-to-desktop' }
        const newScene: Scene = {
          id: sceneId,
          label: 'New App',
          backgroundOpaque: false,
          sources: [],
          style: {
            ...overlayStyle,
            background: {
              ...overlayStyle.background,
              type: 'none',
              opacity: 0,
            },
          },
        }
        saveConfig({ applications: [...applications, a], scenes: { ...scenes, [sceneId]: newScene } })
        onSelect({ kind: 'app', appId: a.id })
      }} />

      <SectionLabel hint="Desktop windows. Widgets do not change machine state.">Widgets</SectionLabel>
      {systemWidgetApps.map((app) => (
        <SidebarBtn key={app.id} icon={<SidebarAppIcon app={app} />} label={app.label}
          statusLabel={openWidgetIds.includes(app.id) ? 'OPEN' : 'CLOSED'}
          statusClassName={openWidgetIds.includes(app.id) ? 'text-cyan-300' : 'text-zinc-600'}
          active={isActive({ kind: 'app', appId: app.id })}
          onClick={() => onSelect({ kind: 'app', appId: app.id })}
          onDoubleClick={() => onActivate({ kind: 'app', appId: app.id })} />
      ))}
      {userWidgetApps.length > 0 && (
        <div className="px-2.5 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-700">
          User Widgets
        </div>
      )}
      {userWidgetApps.map((app) => (
        <SidebarBtn key={app.id} icon={<SidebarAppIcon app={app} />} label={app.label}
          statusLabel={openWidgetIds.includes(app.id) ? 'OPEN' : 'CLOSED'}
          statusClassName={openWidgetIds.includes(app.id) ? 'text-cyan-300' : 'text-zinc-600'}
          active={isActive({ kind: 'app', appId: app.id })}
          onClick={() => onSelect({ kind: 'app', appId: app.id })}
          onDoubleClick={() => onActivate({ kind: 'app', appId: app.id })} />
      ))}
      <AddBtn label="New Widget" onClick={() => onSelect({ kind: 'widget-create' })} />

      <SectionLabel hint="Desktop-only icons for environmental dressing.">Decorations</SectionLabel>
      {decorationApps.map((app) => (
        <SidebarBtn key={app.id} icon={<SidebarAppIcon app={app} />} label={app.label}
          live={false}
          active={isActive({ kind: 'app', appId: app.id })}
          onClick={() => onSelect({ kind: 'app', appId: app.id })}
          onDoubleClick={() => onActivate({ kind: 'app', appId: app.id })} />
      ))}
      <AddBtn label="New Decoration" onClick={() => {
        const a: Application = { id: 'decor-' + Date.now(), label: 'New Decoration', icon: '🖼', appType: 'decoration', targetSceneId: STATE.DESKTOP, transitionType: 'instant' }
        saveConfig({ applications: [...applications, a] })
        onSelect({ kind: 'app', appId: a.id })
      }} />

      <SectionLabel hint="Saved desktop window presets and focus ordering.">Widget Layouts</SectionLabel>
      {orderedWidgetLayouts.map((layout) => (
        <SidebarBtn
          key={layout.id}
          icon={layout.icon || '📐'}
          label={layout.label}
          active={isActive({ kind: 'widget-layout', layoutId: layout.id })}
          onClick={() => onSelect({ kind: 'widget-layout', layoutId: layout.id })}
          onDoubleClick={() => onActivate({ kind: 'widget-layout', layoutId: layout.id })}
        />
      ))}
      <AddBtn label="Capture Current Layout" onClick={() => { void captureCurrentLayout() }} />

      <div className="flex-1" />

      <SectionLabel hint="Auxiliary panels that are not runtime applications.">Utilities</SectionLabel>
      <SidebarBtn icon="📁" label="Archive" active={isActive({ kind: 'archive' })} onClick={() => onSelect({ kind: 'archive' })} />
      <SidebarBtn icon="🌌" label="Ambiance" active={isActive({ kind: 'ambiance' })} onClick={() => onSelect({ kind: 'ambiance' })} />
      <SidebarBtn icon="🗂" label="Asset Library" active={libraryOpen} onClick={onLibrary} />
      <SidebarBtn icon="⚙" label="Settings" active={settingsOpen} onClick={onSettings} />
      </div>{/* end scrollable nav */}
    </div>
  )
}

// ── TopBar ─────────────────────────────────────────────────────────

function TopBar() {
  const obsConnected = useAdminStore((s) => s.obsConnected)
  const currentState = useAdminStore((s) => s.currentState)
  const clientCount  = useAdminStore((s) => s.clientCount)
  const lastError    = useAdminStore((s) => s.lastError)

  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-b border-zinc-800/80 bg-zinc-950/85 px-3 backdrop-blur-sm">
      <span className="text-cyan-400 font-bold font-mono text-sm tracking-widest">IEOM</span>
      <div className="w-px h-4 bg-zinc-700" />
      <span className={'text-xs font-mono ' + (obsConnected ? 'text-emerald-400' : 'text-zinc-600')}>
        {obsConnected ? '● OBS' : '○ OBS'}
      </span>
      {clientCount > 0 && (
        <span className="text-[10px] text-zinc-600 font-mono">{clientCount}c</span>
      )}
      <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-mono text-cyan-300">{currentState}</span>
      {lastError && (
        <span className="max-w-[220px] truncate rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-mono text-red-300" title={lastError}>{lastError}</span>
      )}
      <div className="flex-1" />
    </div>
  )
}

type SettingsTab = 'general' | 'audio' | 'keybinds' | 'about'

function SettingsModal({ tab, onTabChange, onClose }: {
  tab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
  onClose: () => void
}) {
  return (
    <FloatingWindowShell frameClassName="h-[min(760px,calc(100vh-48px))]" layerClassName="z-[55]">
        <FloatingWindowHeader icon="⚙" title="Settings" onClose={onClose} />

        <div className="flex flex-1 min-h-0 flex-col p-4 space-y-3">
          <div className="flex gap-1.5 rounded-xl border border-zinc-800/80 bg-zinc-950/55 p-1.5">
            {([
              ['general', 'General'],
              ['audio', 'Audio'],
              ['keybinds', 'Keybinds'],
              ['about', 'About'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className={'flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ' + (
                  tab === id
                    ? 'border-cyan-400/35 bg-cyan-500/14 text-cyan-100'
                    : 'border-transparent text-zinc-500 hover:border-zinc-700/70 hover:bg-zinc-900/75 hover:text-zinc-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {tab === 'about' && <SettingsPage mode="about" />}
            {tab === 'general' && <SettingsPage consolePanel={<SocketLogConsole variant="settings" />} />}
            {tab === 'audio' && <AudioPanel />}
            {tab === 'keybinds' && <KeybindEditor />}
          </div>
        </div>
    </FloatingWindowShell>
  )
}

// ── Dashboard ──────────────────────────────────────────────────────

export function Dashboard() {
  const [selected,     setSelected]     = useState<SelectedItem | null>(null)
  const [libraryOpen,  setLibraryOpen]  = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab,  setSettingsTab]  = useState<SettingsTab>('general')
  const applications = useAdminStore((s) => s.config.applications)
  const desktopConfig = withDesktopConfigDefaults(useAdminStore((s) => s.config.desktopConfig))
  const saveConfig = useAdminStore((s) => s.saveConfig)

  const handleSettingsToggle = () => {
    if (settingsOpen) {
      setSettingsOpen(false)
      setSettingsTab('general')
      return
    }

    setSettingsTab('general')
    setSettingsOpen(true)
  }

  const handleSettingsClose = () => {
    setSettingsOpen(false)
    setSettingsTab('general')
  }

  // Clear selection when selected app is removed
  useEffect(() => {
    if (selected?.kind === 'app' && !applications.find((a) => a.id === selected.appId)) {
      setSelected(null)
    }
  }, [applications, selected])

  useEffect(() => {
    if (selected?.kind === 'widget-layout' && !(desktopConfig.widgetLayouts ?? []).some((layout) => layout.id === selected.layoutId)) {
      setSelected(null)
    }
  }, [desktopConfig.widgetLayouts, selected])

  const handleSelect = (item: SelectedItem) => {
    if (selected && itemKey(item) === itemKey(selected)) {
      setSelected(null)
    } else {
      setSelected(item)
    }
  }

  const handleActivate = (item: SelectedItem) => {
    // Ensure item is selected first
    setSelected(item)
    if (item.kind === 'env') {
      socket.emit('scene:change', item.envState)
    } else if (item.kind === 'scene') {
      socket.emit('scene:change', item.sceneState)
    } else if (item.kind === 'app') {
      const app = applications.find((a) => a.id === item.appId)
      if (!app) return
      if (app.appType === 'widget') {
        // Widgets are floating windows — tell the overlay to toggle them, no scene change.
        socket.emit('widget:toggle', app.id)
      } else if (app.appType === 'scene') {
        socket.emit('scene:change', app.targetSceneId)
      }
    } else if (item.kind === 'widget-create') {
      return
    } else if (item.kind === 'widget-layout') {
      socket.emit('widget:layout:apply', item.layoutId)
    }
  }

  return (
    <div className="relative flex flex-col h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar
          selected={selected}
          onSelect={handleSelect}
          onActivate={handleActivate}
          libraryOpen={libraryOpen}
          onLibrary={() => setLibraryOpen((open) => !open)}
          settingsOpen={settingsOpen}
          onSettings={handleSettingsToggle}
        />
        <LivePreview />
        <RightPane selected={selected} onClose={() => setSelected(null)} onSelectItem={setSelected} />
      </div>
      {libraryOpen && <AssetLibraryPanel onClose={() => setLibraryOpen(false)} />}
      {settingsOpen && (
        <SettingsModal
          tab={settingsTab}
          onTabChange={setSettingsTab}
          onClose={handleSettingsClose}
        />
      )}
    </div>
  )
}
