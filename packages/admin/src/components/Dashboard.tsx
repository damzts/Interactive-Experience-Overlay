import { Component, useEffect, useRef, useState, useCallback, useMemo, type ReactNode } from 'react'
import {
  DEFAULT_CONFIG,
  DEFAULT_DESKTOP_CONFIG,
  DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS,
  DEFAULT_RECYCLE_BIN_SETTINGS,
  DEFAULT_SYSTEM_WIDGET_LAYOUTS,
  DEFAULT_STICKY_NOTES_SETTINGS,
  DEFAULT_WIDGET_THEME_PRESETS,
  getDefaultWidgetWindowSize,
  getDefaultWidgetZIndex,
  getWidgetComponent,
  getWidgetSource,
  isSystemWidget,
  resolveSourceInstance,
  STATE,
  OVERLAY_EVENT,
  withDesktopConfigDefaults,
  withLobbyConfigDefaults,
  withOverlayStyleDefaults,
} from '@ieom/shared'
import type {
  OverlayStyle, BackgroundType, PatternPreset, ParticlePreset,
  Application, LobbyConfig, DesktopConfig, ApplicationType, Scene, SourceInstance, SourcePreset, AppConfig,
  DesktopNotificationEffectConfig, EffectType, EventAction, MediaEntry, TransitionStep, WidgetLayoutDefinition, WidgetLayoutItem,
  WidgetLayoutSnapshot,
  RecycleBinSettings, StickyNotesSettings, WidgetComponentType, WidgetThemeConfig, ApplicationDefaultSnapshot, SceneDefaultSnapshot,
} from '@ieom/shared'
import { socket } from '../socket/client'
import { useAdminStore } from '../store/useAdminStore'
import { deleteAssetFile, inferAssetKindFromUrl, mediaEntryToAsset, useAssetCatalog, type AssetKind, type AssetRecord } from '../assets/catalog'
import { AssetSelectionInput } from './AssetLibrary'
import { AssetLibraryModal } from './AssetLibraryModal'
import { AssetLibraryPanel as ExtractedAssetLibraryPanel } from './AssetLibraryPanel'
import {
  DESKTOP_THEMES,
  GOOGLE_FONTS,
  ICON_ANIMATIONS,
  SCREENSAVER_PRESETS,
  WIDGET_SKINS,
  WIDGET_THEME_ANIMATIONS,
  WIDGET_THEME_ATMOSPHERES,
  iconSizeToSliderValue,
  labelizeIconSize,
  sliderValueToIconSize,
} from './adminDesktopOptions'
import {
  DEFAULT_EVENT_DEFS,
  EVENT_PRESET_OPTIONS,
  LAUNCH_PIPELINE_EFFECT_TYPES,
  createEffectDraft,
  createEventActionDraft,
  createEventPreset,
  describeEventSetup,
  EVENT_EFFECT_TYPES,
  COMMON_EVENT_ACTION_KINDS,
  COMMON_EVENT_EFFECT_TYPES,
  getEventActionLabel,
  normalizeDesktopNotificationEffectConfig,
  type EventDef,
  type EventPresetId,
} from './asset-library/eventPresets'
import { SourceField, SourcePresetPreview } from './asset-library/SourcesTab'
import { getSafeSceneSources, SOURCE_CATALOG, type CatalogEntry } from './sourceCatalog'
import {
  TRANSITION_ICONS,
  TRANSITION_OPTIONS,
  TRANSITION_TEST_BUTTON_CLASS,
  encodeMediaTransitionValue,
  formatBuiltInTransitionValue,
  getMediaTransitionLabel,
  parseBuiltInTransitionValue,
  parseMediaTransitionValue,
  stepToStr,
  strToStep,
} from './transitionLibrary'
import { Panel, Toggle, Slider, Btn, HexColorInput, isSameDraft, IconGlyph, ConfigApplyBar, ConfigSectionPanel, FloatingWindowShell, FloatingWindowHeader, ConfigCard, ConfigNotice, ConfigChoiceButton, ConfigPreviewButton, ConfigSwatchButton, ConfigToolbar } from './ui'
import { SettingsPage } from '../pages/SettingsPage'
import { ArchivePanel } from '../pages/ArchivePanel'
import { KeybindEditor } from '../pages/KeybindEditor'
import { AudioPanel }   from '../pages/AudioPanel'
import { AmbiancePanel } from '../pages/AmbiancePanel'

class RightPaneErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string | null }
> {
  state = { hasError: false, message: null }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unknown dashboard error',
    }
  }

  componentDidCatch(error: unknown) {
    console.error('[admin] right pane render failed', error)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <ConfigNotice tone="warning" className="space-y-2 px-3 py-3">
        <div className="text-[11px] font-semibold text-amber-200">This item could not be rendered safely.</div>
        <div className="text-[10px] leading-relaxed text-amber-100/80">
          The dashboard stayed up, but this editor hit a render error. Check the browser console for the stack trace, then reselect the item after fixing the bad config record.
        </div>
        {this.state.message && (
          <div className="rounded border border-amber-500/25 bg-zinc-950/70 px-2 py-1.5 font-mono text-[10px] text-amber-100/90">
            {this.state.message}
          </div>
        )}
      </ConfigNotice>
    )
  }
}

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

const ACCENT_SWATCHES = ['#00ff41', '#06b6d4', '#a855f7', '#f97316', '#ec4899', '#eab308', '#ef4444', '#ffffff']
const DASHBOARD_SAVE_BUTTON_CLASS = 'px-4 py-2 text-sm'


type ThemeAppearance = Pick<OverlayStyle, 'fontFamily' | 'accentColor' | 'textColor'>

function clone<T>(value: T): T {
  return structuredClone(value)
}

const CONFIG_PREVIEW_MESSAGE_TYPE = 'ieom:config-preview'

function postPreviewConfigPatch(patch: Partial<AppConfig> | null) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const previewFrame = document.querySelector('iframe[title="Overlay Preview"]') as HTMLIFrameElement | null
  if (!previewFrame?.contentWindow) return

  previewFrame.contentWindow.postMessage(
    patch
      ? { type: CONFIG_PREVIEW_MESSAGE_TYPE, patch }
      : { type: CONFIG_PREVIEW_MESSAGE_TYPE, clear: true },
    '*',
  )
}

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

function resolveWidgetPositionFromConfig(app: Pick<Application, 'id'>, desktopConfig: DesktopConfig) {
  const raw = desktopConfig.widgetPositions?.[app.id]
  return {
    x: Math.max(0, Math.round(raw?.x ?? 0)),
    y: Math.max(0, Math.round(raw?.y ?? 0)),
  }
}

function resolveWidgetDefaultZIndexFromConfig(app: Pick<Application, 'id' | 'appType' | 'widgetComponent'>, desktopConfig: DesktopConfig) {
  const value = desktopConfig.widgetDefaultZIndices?.[app.id]
  return Number.isFinite(value)
    ? Math.max(0, Math.round(value as number))
    : getDefaultWidgetZIndex(app.id, resolveAppWidgetComponent(app))
}

function resolveWidgetRuntimeZIndex(app: Pick<Application, 'id' | 'appType' | 'widgetComponent'>, desktopConfig: DesktopConfig) {
  const value = desktopConfig.widgetZIndices?.[app.id]
  return Number.isFinite(value)
    ? Math.max(0, Math.round(value as number))
    : resolveWidgetDefaultZIndexFromConfig(app, desktopConfig)
}

function resolveWidgetThemeOverrideFromConfig(app: Pick<Application, 'id'>, desktopConfig: DesktopConfig): WidgetThemeConfig | null {
  const override = desktopConfig.widgetThemeOverrides?.[app.id]
  return override ? structuredClone(override) : null
}

function createApplicationSnapshot(source: Application, desktopConfig: DesktopConfig): ApplicationDefaultSnapshot {
  return {
    id: source.id,
    label: source.label,
    icon: source.icon,
    appType: source.appType,
    targetSceneId: source.targetSceneId,
    widgetSource: source.widgetSource,
    widgetComponent: source.widgetComponent,
    transitionType: source.transitionType,
    introTransition: source.introTransition,
    exitTransition: source.exitTransition,
    introTransitions: source.introTransitions ? clone(source.introTransitions) : undefined,
    exitTransitions: source.exitTransitions ? clone(source.exitTransitions) : undefined,
    iconPosition: source.iconPosition ? clone(source.iconPosition) : undefined,
    iconSize: source.iconSize,
    launchPipeline: source.launchPipeline ? clone(source.launchPipeline) : undefined,
    gallerySettings: source.gallerySettings ? clone(source.gallerySettings) : undefined,
    cameraSettings: source.cameraSettings ? clone(source.cameraSettings) : undefined,
    sourceWidgetSettings: source.sourceWidgetSettings ? clone(source.sourceWidgetSettings) : undefined,
    stickyNotesSettings: source.stickyNotesSettings ? clone(source.stickyNotesSettings) : undefined,
    recycleBinSettings: source.recycleBinSettings ? clone(source.recycleBinSettings) : undefined,
    widgetDefaults: source.appType === 'widget'
      ? {
          windowPosition: desktopConfig.widgetPositions?.[source.id] ? clone(desktopConfig.widgetPositions[source.id]) : undefined,
          windowSize: desktopConfig.widgetSizes?.[source.id] ? clone(desktopConfig.widgetSizes[source.id]) : undefined,
          defaultZIndex: desktopConfig.widgetDefaultZIndices?.[source.id],
          themeOverride: desktopConfig.widgetThemeOverrides?.[source.id] ? clone(desktopConfig.widgetThemeOverrides[source.id]) : undefined,
        }
      : undefined,
  }
}

function buildApplicationDefaultSnapshot(app: Application, desktopConfig: DesktopConfig): ApplicationDefaultSnapshot {
  const source = DEFAULT_CONFIG.applications.find((entry) => entry.id === app.id) ?? app
  return createApplicationSnapshot(source, desktopConfig)
}

function resolveApplicationDefaultSnapshot(app: Application): ApplicationDefaultSnapshot {
  const sourceDesktopConfig = withDesktopConfigDefaults(DEFAULT_CONFIG.desktopConfig)
  return app.defaultConfig ? clone(app.defaultConfig) : buildApplicationDefaultSnapshot(app, sourceDesktopConfig)
}

function createSceneSnapshot(scene: Scene): SceneDefaultSnapshot {
  return {
    label: scene.label,
    backgroundOpaque: scene.backgroundOpaque,
    sources: clone(scene.sources ?? []),
    style: scene.style ? clone(scene.style) : undefined,
    lobbyConfig: scene.lobbyConfig ? clone(scene.lobbyConfig) : undefined,
    introTransitions: scene.introTransitions ? clone(scene.introTransitions) : undefined,
    exitTransitions: scene.exitTransitions ? clone(scene.exitTransitions) : undefined,
    musicTrack: scene.musicTrack,
  }
}

function buildSceneDefaultSnapshot(sceneId: string, scene: Scene): SceneDefaultSnapshot {
  const source = DEFAULT_CONFIG.scenes[sceneId] ?? scene
  return createSceneSnapshot(source)
}

function resolveSceneDefaultSnapshot(sceneId: string, scene: Scene): SceneDefaultSnapshot {
  return scene.defaultConfig ? clone(scene.defaultConfig) : buildSceneDefaultSnapshot(sceneId, scene)
}

function applyWidgetDefaultSnapshotToDesktopConfig(
  desktopConfig: DesktopConfig,
  app: Pick<Application, 'id' | 'appType' | 'widgetComponent'>,
  snapshot: ApplicationDefaultSnapshot,
) {
  if (app.appType !== 'widget') return desktopConfig

  const nextDesktop = clone(withDesktopConfigDefaults(desktopConfig))
  const defaultSize = getDefaultWidgetSize(app)
  const nextWidgetPositions = { ...(nextDesktop.widgetPositions ?? {}) }
  const nextWidgetSizes = { ...(nextDesktop.widgetSizes ?? {}) }
  const nextWidgetDefaultZIndices = { ...(nextDesktop.widgetDefaultZIndices ?? {}) }
  const nextThemeOverrides = { ...(nextDesktop.widgetThemeOverrides ?? {}) }

  const snapshotPosition = snapshot.widgetDefaults?.windowPosition
  if (snapshotPosition) {
    nextWidgetPositions[app.id] = {
      x: Math.max(0, Math.round(snapshotPosition.x)),
      y: Math.max(0, Math.round(snapshotPosition.y)),
    }
  } else {
    delete nextWidgetPositions[app.id]
  }

  const snapshotSize = snapshot.widgetDefaults?.windowSize
  if (snapshotSize?.width !== undefined || snapshotSize?.height !== undefined) {
    const width = clampWidgetDimension(snapshotSize.width ?? defaultSize.width, 180, 1400, defaultSize.width)
    const height = clampWidgetDimension(snapshotSize.height ?? defaultSize.height, 140, 1000, defaultSize.height)
    if (width === defaultSize.width && height === defaultSize.height) {
      delete nextWidgetSizes[app.id]
    } else {
      nextWidgetSizes[app.id] = { width, height }
    }
  } else {
    delete nextWidgetSizes[app.id]
  }

  const baseZIndex = getDefaultWidgetZIndex(app.id, resolveAppWidgetComponent(app))
  const snapshotZIndex = snapshot.widgetDefaults?.defaultZIndex
  if (Number.isFinite(snapshotZIndex) && Math.round(snapshotZIndex as number) !== baseZIndex) {
    nextWidgetDefaultZIndices[app.id] = Math.max(0, Math.round(snapshotZIndex as number))
  } else {
    delete nextWidgetDefaultZIndices[app.id]
  }

  if (snapshot.widgetDefaults?.themeOverride) {
    nextThemeOverrides[app.id] = clone(snapshot.widgetDefaults.themeOverride)
  } else {
    delete nextThemeOverrides[app.id]
  }

  nextDesktop.widgetPositions = Object.keys(nextWidgetPositions).length ? nextWidgetPositions : undefined
  nextDesktop.widgetSizes = Object.keys(nextWidgetSizes).length ? nextWidgetSizes : undefined
  nextDesktop.widgetDefaultZIndices = Object.keys(nextWidgetDefaultZIndices).length ? nextWidgetDefaultZIndices : undefined
  nextDesktop.widgetThemeOverrides = Object.keys(nextThemeOverrides).length ? nextThemeOverrides : undefined

  return nextDesktop
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

function createWidgetLayoutSnapshot(layout: Pick<WidgetLayoutDefinition, 'label' | 'icon' | 'description' | 'items'>): WidgetLayoutSnapshot {
  return {
    label: layout.label,
    icon: layout.icon,
    description: layout.description,
    items: layout.items.map((item) => ({ ...item })),
  }
}

function normalizeWidgetLayoutSnapshotForEditor(
  snapshot: WidgetLayoutSnapshot | undefined,
  widgetApps: Application[],
  desktopConfig: DesktopConfig,
): WidgetLayoutSnapshot | undefined {
  if (!snapshot) return undefined

  return {
    label: snapshot.label,
    icon: snapshot.icon,
    description: snapshot.description,
    items: widgetApps.map((app, index) => {
      const source = snapshot.items.find((item) => item.widgetId === app.id)
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
    defaultConfig: normalizeWidgetLayoutSnapshotForEditor(layout.defaultConfig, widgetApps, desktopConfig),
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
    const firstSource = getSafeSceneSources(scene)[0]
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
  const nextThemeOverrides = { ...(next.widgetThemeOverrides ?? {}) }

  delete nextPositions[widgetId]
  delete nextSizes[widgetId]
  delete nextDefaultZIndices[widgetId]
  delete nextRuntimeZIndices[widgetId]
  delete nextThemeOverrides[widgetId]

  return {
    ...next,
    widgetPositions: Object.keys(nextPositions).length ? nextPositions : undefined,
    widgetSizes: Object.keys(nextSizes).length ? nextSizes : undefined,
    widgetDefaultZIndices: Object.keys(nextDefaultZIndices).length ? nextDefaultZIndices : undefined,
    widgetZIndices: Object.keys(nextRuntimeZIndices).length ? nextRuntimeZIndices : undefined,
    widgetThemeOverrides: Object.keys(nextThemeOverrides).length ? nextThemeOverrides : undefined,
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

// ── TransitionPicker ─────────────────────────────────────────────

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

function SourcesEditor({ sceneId }: { sceneId: string }) {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const scene      = config.scenes[sceneId] as (typeof config.scenes)[string] | undefined
  const sources    = (scene?.sources ?? []) as SourceInstance[]
  const sourcePresets = config.sourcePresets ?? []

  const save = (next: SourceInstance[]) =>
    saveConfig({ scenes: { [sceneId]: { ...config.scenes[sceneId], sources: next } } })

  const toggle   = (id: string) => save(sources.map((s) => s.id === id ? { ...s, visible: !s.visible } : s))
  const remove   = (id: string) => { save(sources.filter((s) => s.id !== id)) }

  const updateSourcePreset = (id: string, presetId: string) => {
    save(sources.map((source) => source.id === id ? { ...source, sourcePresetId: presetId || undefined } : source))
  }

  const normalizeSourceOrder = useCallback((ordered: SourceInstance[]) => (
    ordered.map((source, index) => ({ ...source, zIndex: index }))
  ), [])

  const moveUp = (id: string) => {
    const ordered = [...sources].sort((a, b) => a.zIndex - b.zIndex)
    const index = ordered.findIndex((source) => source.id === id)
    if (index <= 0) return
    ;[ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]]
    save(normalizeSourceOrder(ordered))
  }

  const moveDown = (id: string) => {
    const ordered = [...sources].sort((a, b) => a.zIndex - b.zIndex)
    const index = ordered.findIndex((source) => source.id === id)
    if (index < 0 || index === ordered.length - 1) return
    ;[ordered[index], ordered[index + 1]] = [ordered[index + 1], ordered[index]]
    save(normalizeSourceOrder(ordered))
  }

  const addSource = (preset?: SourcePreset) => {
    const newSrc: SourceInstance = {
      id:         `scene-source-${Date.now()}`,
      sourcePresetId: preset?.id,
      position:   preset?.defaultPosition ?? { x: 0, y: 0, width: 1920, height: 1080 },
      zIndex:     sources.length,
      visible:    true,
    }
    save([...sources, newSrc])
  }

  const sorted = [...sources].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div className="space-y-2">
      {sorted.map((src) => {
        const resolved = resolveSourceInstance(src, sourcePresets)
        const meta  = SOURCE_CATALOG.find((c) => c.type === resolved?.pluginType)
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
              <div className="min-w-0 flex-1">
                <select
                  value={src.sourcePresetId ?? ''}
                  onChange={(event) => updateSourcePreset(src.id, event.target.value)}
                  className="w-full text-xs"
                >
                  <option value="">-- Pick source preset --</option>
                  {sourcePresets.map((preset) => {
                    const sourceMeta = SOURCE_CATALOG.find((entry) => entry.type === preset.pluginType)
                    return <option key={preset.id} value={preset.id}>{preset.label} · {sourceMeta?.label ?? preset.pluginType}</option>
                  })}
                </select>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Btn
                  type="button"
                  variant="ghost"
                  onClick={() => moveUp(src.id)}
                  disabled={sorted[0]?.id === src.id}
                  className="px-2 py-1 text-[10px]"
                >
                  Up
                </Btn>
                <Btn
                  type="button"
                  variant="ghost"
                  onClick={() => moveDown(src.id)}
                  disabled={sorted[sorted.length - 1]?.id === src.id}
                  className="px-2 py-1 text-[10px]"
                >
                  Down
                </Btn>
              </div>
              <Btn type="button" variant="danger" onClick={() => remove(src.id)} className="px-2 py-0.5 text-[10px]">
                Delete
              </Btn>
            </div>
          </ConfigCard>
        )
      })}

      {sourcePresets.length ? (
        <Btn
          type="button"
          onClick={() => addSource()}
          variant="ghost"
          className="mt-1 w-full justify-center border-dashed border-zinc-700/80 py-2 text-xs text-zinc-400 hover:text-cyan-200"
        >
          Add
        </Btn>
      ) : (
        <ConfigNotice tone="info">No source presets yet. Create them from the Asset Library Sources tab first.</ConfigNotice>
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

// ── Selected item union ────────────────────────────────────────────

type SelectedItem =
  | { kind: 'env';   envState: STATE }
  | { kind: 'scene'; sceneState: string }
  | { kind: 'app';   appId: string }
  | { kind: 'widget-create' }
  | { kind: 'widget-layout'; layoutId: string }
  | { kind: 'default-styling' }
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

function compactTransitionSteps(steps: TransitionStep[]) {
  return steps.filter((step) => step.id)
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
    await saveConfig({ scenes: { [sceneId]: { ...scene, style } } })
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

/** Ordered pipeline editor — each step is a full TransitionPicker row. */
function TransitionList({
  value,
  onChange,
}: {
  value: TransitionStep[]
  onChange: (steps: TransitionStep[]) => void
}) {
  const mediaLibrary = useAdminStore((s) => s.config.mediaLibrary ?? [])
  const steps = value ?? []

  const userTransitions = useMemo(
    () => [...mediaLibrary].sort((left, right) => getMediaTransitionLabel(left).localeCompare(getMediaTransitionLabel(right))),
    [mediaLibrary],
  )

  const addStep = (step: TransitionStep) => {
    onChange([...steps, step])
  }

  const updateStep = (idx: number, str: string) => {
    const next = [...steps]
    next[idx] = strToStep(str)
    onChange(next)
  }

  const moveUp = (idx: number) => {
    if (idx === 0) return
    const next = [...steps]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange(next)
  }

  const moveDown = (idx: number) => {
    if (idx === steps.length - 1) return
    const next = [...steps]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onChange(next)
  }

  const transitionOptions = useMemo(() => ([
    ...TRANSITION_OPTIONS.map((transition) => ({
      value: transition.id,
      label: `${transition.label} · ${transition.id}`,
      group: 'system' as const,
    })),
    ...userTransitions.map((entry) => ({
      value: encodeMediaTransitionValue(entry),
      label: getMediaTransitionLabel(entry),
      group: 'user' as const,
      subtitle: entry.url,
    })),
  ]), [userTransitions])

  const removeStep = (idx: number) => onChange(steps.filter((_, i) => i !== idx))

  return (
    <div className="space-y-2">
      {steps.map((step, idx) => (
        <div key={`${step.id}-${idx}`} className="flex items-start gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2">
          <div className="min-w-0 flex-1">
            <select
              value={stepToStr(step)}
              onChange={(event) => updateStep(idx, event.target.value)}
              className="w-full text-xs"
            >
              <option value="">-- Pick transition --</option>
              <optgroup label="System transitions">
                {transitionOptions.filter((option) => option.group === 'system').map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </optgroup>
              {transitionOptions.some((option) => option.group === 'user') && (
                <optgroup label="User transitions">
                  {transitionOptions.filter((option) => option.group === 'user').map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <Btn
              type="button"
              variant="ghost"
              onClick={() => moveUp(idx)}
              disabled={idx === 0}
              className="px-2 py-1 text-[10px]"
            >
              Up
            </Btn>
            <Btn
              type="button"
              variant="ghost"
              onClick={() => moveDown(idx)}
              disabled={idx === steps.length - 1}
              className="px-2 py-1 text-[10px]"
            >
              Down
            </Btn>
          </div>
          <Btn
            type="button"
            variant="danger"
            onClick={() => removeStep(idx)}
            className="px-2 py-1 text-[10px]"
          >
            Delete
          </Btn>
        </div>
      ))}
      {transitionOptions.length ? (
        <Btn
          type="button"
          onClick={() => addStep({ id: '' })}
          variant="ghost"
          className="mt-1 w-full justify-center border-dashed border-zinc-700/80 py-2 text-xs text-zinc-400 hover:text-cyan-200"
        >
          Add
        </Btn>
      ) : (
        <ConfigNotice tone="info">No transitions available yet. Create user transitions in the Asset Library Transitions tab first.</ConfigNotice>
      )}
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
        [STATE.LOBBY]: {
          ...config.scenes[STATE.LOBBY],
          lobbyConfig: form,
          introTransitions: compactTransitionSteps(introTransitions).length ? compactTransitionSteps(introTransitions) : undefined,
          exitTransitions: compactTransitionSteps(exitTransitions).length ? compactTransitionSteps(exitTransitions) : undefined,
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
      <ConfigApplyBar label="Lobby Configuration" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
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
  const sourceIntroTransitions = structuredClone(desktopScene?.introTransitions)
  const sourceExitTransitions = structuredClone(desktopScene?.exitTransitions)
  const [form, setForm] = useState<DesktopConfig>(() => sourceForm)
  const [introTransitions, setIntroTransitions] = useState<TransitionStep[]>(sourceIntroTransitions || [])
  const [exitTransitions, setExitTransitions] = useState<TransitionStep[]>(sourceExitTransitions || [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = !isSameDraft(form, sourceForm)
    || !isSameDraft(introTransitions, sourceIntroTransitions)
    || !isSameDraft(exitTransitions, sourceExitTransitions)

  useEffect(() => {
    setForm(sourceForm)
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

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    await saveConfig({
      desktopConfig: form,
      scenes: {
        [STATE.DESKTOP]: {
          ...config.scenes[STATE.DESKTOP],
          introTransitions: compactTransitionSteps(introTransitions).length ? compactTransitionSteps(introTransitions) : undefined,
          exitTransitions: compactTransitionSteps(exitTransitions).length ? compactTransitionSteps(exitTransitions) : undefined,
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
      <ConfigApplyBar label="Desktop Configuration" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
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
      <ConfigSectionPanel label="Desktop Icons">
        <div className="space-y-3">
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

function DefaultStylingEditor() {
  type GlobalThemeConfirmAction = 'factory-reset' | 'restore-global-theme' | 'save-global-theme'

  const config = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const setRuntimeConfigOverride = useAdminStore((s) => s.setRuntimeConfigOverride)
  const desktopScene = config.scenes[STATE.DESKTOP]
  const sourceDesktopConfig = useMemo(
    () => withDesktopConfigDefaults(config.desktopConfig),
    [config.desktopConfig],
  )
  const sourceStyle = useMemo(
    () => structuredClone(withOverlayStyleDefaults((desktopScene as { style?: OverlayStyle } | undefined)?.style, config.overlayStyle)),
    [desktopScene, config.overlayStyle],
  )
  const sourceAppearance = useMemo<ThemeAppearance>(() => ({
    fontFamily: sourceStyle.fontFamily,
    accentColor: sourceStyle.accentColor,
    textColor: sourceStyle.textColor,
  }), [sourceStyle])
  const sourceThemeDefault = sourceDesktopConfig.globalThemeDefault
  const randomDesktopThemes = useMemo(() => DESKTOP_THEMES.filter((entry) => entry.id !== 'custom'), [])
  const factoryDesktopConfig = useMemo(() => structuredClone(withDesktopConfigDefaults(DEFAULT_CONFIG.desktopConfig)), [])
  const factoryDesktopStyle = useMemo(
    () => structuredClone(withOverlayStyleDefaults((DEFAULT_CONFIG.scenes[STATE.DESKTOP] as { style?: OverlayStyle } | undefined)?.style, DEFAULT_CONFIG.overlayStyle)),
    [],
  )
  const factorySystemWidgets = useMemo(
    () => DEFAULT_CONFIG.applications
      .filter((entry): entry is Application => entry.appType === 'widget' && entry.widgetSource === 'system')
      .map((entry) => structuredClone(entry)),
    [],
  )
  const factorySystemWidgetById = useMemo(
    () => new Map(factorySystemWidgets.map((entry) => [entry.id, entry] as const)),
    [factorySystemWidgets],
  )
  const factoryAppearance = useMemo<ThemeAppearance>(() => ({
    fontFamily: factoryDesktopStyle.fontFamily,
    accentColor: factoryDesktopStyle.accentColor,
    textColor: factoryDesktopStyle.textColor,
  }), [factoryDesktopStyle])
  const [theme, setTheme] = useState<DesktopConfig['theme']>(() => sourceDesktopConfig.theme)
  const [appearance, setAppearance] = useState<ThemeAppearance>(() => sourceAppearance)
  const [widgetTheme, setWidgetTheme] = useState<DesktopConfig['widgetTheme']>(() => structuredClone(sourceDesktopConfig.widgetTheme))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pendingConfirmAction, setPendingConfirmAction] = useState<GlobalThemeConfirmAction | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const confirmActionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = theme !== sourceDesktopConfig.theme
    || !isSameDraft(appearance, sourceAppearance)
    || !isSameDraft(widgetTheme, sourceDesktopConfig.widgetTheme)
  const previewPatch = useMemo(() => {
    const nextDesktopStyle = structuredClone(sourceStyle)
    nextDesktopStyle.fontFamily = appearance.fontFamily
    nextDesktopStyle.accentColor = appearance.accentColor
    nextDesktopStyle.textColor = appearance.textColor

    return {
      desktopConfig: {
        theme,
        widgetTheme,
      },
      scenes: {
        [STATE.DESKTOP]: {
          ...config.scenes[STATE.DESKTOP],
          style: nextDesktopStyle,
        },
      },
    } as unknown as Partial<AppConfig>
  }, [appearance, config.scenes, sourceStyle, theme, widgetTheme])

  useEffect(() => {
    setTheme(sourceDesktopConfig.theme)
    setAppearance(sourceAppearance)
    setWidgetTheme(structuredClone(sourceDesktopConfig.widgetTheme))
    setPendingConfirmAction(null)
    setSaved(false)
  }, [config.desktopConfig, config.overlayStyle, desktopScene])

  const armConfirmation = useCallback((action: GlobalThemeConfirmAction) => {
    setPendingConfirmAction(action)
    if (confirmActionTimer.current) clearTimeout(confirmActionTimer.current)
    confirmActionTimer.current = setTimeout(() => setPendingConfirmAction(null), 3500)
    return false
  }, [])

  const consumeConfirmation = useCallback((action: GlobalThemeConfirmAction) => {
    if (pendingConfirmAction !== action) {
      return armConfirmation(action)
    }
    if (confirmActionTimer.current) clearTimeout(confirmActionTimer.current)
    setPendingConfirmAction(null)
    return true
  }, [armConfirmation, pendingConfirmAction])

  const pickRandomEntry = useCallback(<T extends { id: string }>(entries: T[], currentId: string) => {
    if (entries.length === 0) return null
    if (entries.length === 1) return entries[0]
    const candidates = entries.filter((entry) => entry.id !== currentId)
    const pool = candidates.length > 0 ? candidates : entries
    return pool[Math.floor(Math.random() * pool.length)] ?? pool[0]
  }, [])

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    const nextDesktopStyle = structuredClone(sourceStyle)
    nextDesktopStyle.fontFamily = appearance.fontFamily
    nextDesktopStyle.accentColor = appearance.accentColor
    nextDesktopStyle.textColor = appearance.textColor

    await saveConfig({
      desktopConfig: {
        theme,
        widgetTheme,
      },
      scenes: {
        [STATE.DESKTOP]: {
          ...config.scenes[STATE.DESKTOP],
          style: nextDesktopStyle,
        },
      },
    } as unknown as Partial<AppConfig>)
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [appearance, config.scenes, dirty, saveConfig, sourceDesktopConfig, sourceStyle, theme, widgetTheme])

  const reset = useCallback(() => {
    setTheme(sourceDesktopConfig.theme)
    setAppearance(sourceAppearance)
    setWidgetTheme(structuredClone(sourceDesktopConfig.widgetTheme))
    setPendingConfirmAction(null)
    setSaved(false)
  }, [sourceAppearance, sourceDesktopConfig.theme, sourceDesktopConfig.widgetTheme])

  const restoreSavedGlobalTheme = useCallback(async () => {
    if (!consumeConfirmation('restore-global-theme')) return
    setSaving(true)
    const nextDesktopStyle = structuredClone(sourceStyle)
    nextDesktopStyle.fontFamily = sourceThemeDefault.appearance.fontFamily
    nextDesktopStyle.accentColor = sourceThemeDefault.appearance.accentColor
    nextDesktopStyle.textColor = sourceThemeDefault.appearance.textColor

    await saveConfig({
      desktopConfig: {
        theme: sourceThemeDefault.theme,
        widgetTheme: structuredClone(sourceThemeDefault.widgetTheme),
      },
      scenes: {
        [STATE.DESKTOP]: {
          ...config.scenes[STATE.DESKTOP],
          style: nextDesktopStyle,
        },
      },
    } as unknown as Partial<AppConfig>)

    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [config.scenes, consumeConfirmation, saveConfig, sourceDesktopConfig, sourceStyle, sourceThemeDefault])

  const performFactoryReset = useCallback(async () => {
    if (!consumeConfirmation('factory-reset')) return
    setSaving(true)
    const nextDesktopStyle = structuredClone(factoryDesktopStyle)
    const currentFactoryWidgetIds = new Set(
      config.applications
        .filter((entry) => factorySystemWidgetById.has(entry.id))
        .map((entry) => entry.id),
    )
    const nextApplications = [
      ...config.applications.map((entry) => {
        const factoryWidget = factorySystemWidgetById.get(entry.id)
        return factoryWidget ? structuredClone(factoryWidget) : entry
      }),
      ...factorySystemWidgets
        .filter((entry) => !currentFactoryWidgetIds.has(entry.id))
        .map((entry) => structuredClone(entry)),
    ]

    await saveConfig({
      applications: nextApplications,
      desktopConfig: {
        ...factoryDesktopConfig,
        theme: DEFAULT_DESKTOP_CONFIG.theme,
        widgetTheme: structuredClone(DEFAULT_DESKTOP_CONFIG.widgetTheme),
        widgetPositions: undefined,
        widgetSizes: undefined,
        widgetThemeOverrides: undefined,
        widgetLayouts: structuredClone(DEFAULT_SYSTEM_WIDGET_LAYOUTS),
      },
      scenes: {
        [STATE.DESKTOP]: {
          ...config.scenes[STATE.DESKTOP],
          style: nextDesktopStyle,
        },
      },
    } as unknown as Partial<AppConfig>)

    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [config.applications, config.scenes, consumeConfirmation, factoryDesktopConfig, factoryDesktopStyle, factorySystemWidgetById, factorySystemWidgets, saveConfig])

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
    if (confirmActionTimer.current) clearTimeout(confirmActionTimer.current)
    postPreviewConfigPatch(null)
  }, [])

  useEffect(() => {
    postPreviewConfigPatch(dirty ? previewPatch : null)
  }, [dirty, previewPatch])

  const saveGlobalTheme = useCallback(async () => {
    if (!consumeConfirmation('save-global-theme')) return

    setSaving(true)
    const nextDesktopStyle = structuredClone(sourceStyle)
    nextDesktopStyle.fontFamily = appearance.fontFamily
    nextDesktopStyle.accentColor = appearance.accentColor
    nextDesktopStyle.textColor = appearance.textColor

    await saveConfig({
      desktopConfig: {
        globalThemeDefault: {
          theme,
          widgetTheme: structuredClone(widgetTheme),
          appearance: structuredClone(appearance),
        },
      },
      scenes: {
        [STATE.DESKTOP]: {
          ...config.scenes[STATE.DESKTOP],
          style: nextDesktopStyle,
        },
      },
    } as unknown as Partial<AppConfig>)

    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [appearance, config.scenes, consumeConfirmation, saveConfig, sourceDesktopConfig, sourceStyle, theme, widgetTheme])

  const clearAllRuntime = useCallback(() => {
    postPreviewConfigPatch(null)
    setRuntimeConfigOverride({})
    const handleRuntimeOverrideClear: (err: string | null) => void = (err) => {
      if (err) {
        console.error('[admin] failed to clear runtime overrides', err)
      }
    }
    socket.emit('runtime:config:override:clear', handleRuntimeOverrideClear)
  }, [setRuntimeConfigOverride])

  const randomizeDesktopTheme = useCallback(() => {
    const nextTheme = pickRandomEntry(randomDesktopThemes, theme)
    if (!nextTheme) return
    setTheme(nextTheme.id)
    setSaved(false)
  }, [pickRandomEntry, randomDesktopThemes, theme])

  const randomizeWidgetTheme = useCallback(() => {
    const nextSkin = pickRandomEntry(WIDGET_SKINS, widgetTheme.skin)
    if (!nextSkin) return
    setWidgetTheme(structuredClone(DEFAULT_WIDGET_THEME_PRESETS[nextSkin.id]))
    setSaved(false)
  }, [pickRandomEntry, widgetTheme.skin])

  return (
    <div className="space-y-3">
      <ConfigApplyBar label="Global Theme" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} />
      <div className="grid gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-4 lg:grid-cols-2">
        <Btn
          type="button"
          variant="danger"
          onClick={() => { void performFactoryReset() }}
          className="justify-center px-3 py-2 text-[11px] uppercase tracking-[0.16em]"
        >
          {pendingConfirmAction === 'factory-reset' ? 'Confirm Factory Reset' : 'Perform Factory Reset'}
        </Btn>
        <Btn
          type="button"
          variant={pendingConfirmAction === 'restore-global-theme' ? 'warning' : 'default'}
          onClick={() => { void restoreSavedGlobalTheme() }}
          className="justify-center px-3 py-2 text-[11px] uppercase tracking-[0.16em]"
        >
          {pendingConfirmAction === 'restore-global-theme' ? 'Confirm Restore Global Theme' : 'Restore Global Theme'}
        </Btn>
        <Btn
          type="button"
          variant={pendingConfirmAction === 'save-global-theme' ? 'warning' : 'default'}
          onClick={() => { void saveGlobalTheme() }}
          className={`justify-center ${DASHBOARD_SAVE_BUTTON_CLASS}`}
        >
          {pendingConfirmAction === 'save-global-theme' ? 'Confirm Save Global Theme' : 'Save Global Theme'}
        </Btn>
        <Btn type="button" variant="ghost" onClick={clearAllRuntime} className="justify-center px-3 py-2 text-[11px] uppercase tracking-[0.16em]">
          Clear All Runtime
        </Btn>
      </div>
      <div className="space-y-0 pt-3">
        <ConfigSectionPanel label="Desktop Theme" first>
          <div className="space-y-4">
            <div className="text-[10px] text-zinc-500 leading-relaxed">
              Theme presets style desktop chrome only. The overlay stays transparent until the desktop Background panel is explicitly set to show wallpaper, gradients, patterns, or video.
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {DESKTOP_THEMES.map((entry) => (
                <ConfigChoiceButton
                  key={entry.id}
                  type="button"
                  selected={theme === entry.id}
                  onClick={() => { setTheme(entry.id); setSaved(false) }}
                  className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case"
                >
                  <span className="text-[11px] font-semibold leading-none">{entry.label}</span>
                  <span className="text-[10px] leading-relaxed text-zinc-500">{entry.description}</span>
                </ConfigChoiceButton>
              ))}
              <ConfigChoiceButton
                type="button"
                selected={false}
                onClick={randomizeDesktopTheme}
                className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case"
              >
                <span className="text-[11px] font-semibold leading-none">Random</span>
                <span className="text-[10px] leading-relaxed text-zinc-500">Pick a desktop theme preset at random, excluding Custom and usually excluding the current pick.</span>
              </ConfigChoiceButton>
            </div>
            <div className="border-t border-zinc-800 pt-3">
              <ThemeAppearanceFields
                appearance={appearance}
                onChange={(updater) => {
                  setAppearance((prev) => {
                    const next = structuredClone(prev)
                    updater(next)
                    return next
                  })
                  setSaved(false)
                }}
                helperText="Font, accent, and text color ride on top of the preset so they are visible without turning the desktop background opaque."
              />
            </div>
          </div>
        </ConfigSectionPanel>
        <ConfigSectionPanel label="Widget Theme">
          <div className="space-y-4">
            <div className="text-[10px] text-zinc-500 leading-relaxed">
              This is the global widget theme applied to all widgets unless a widget-specific override is enabled in that widget's own configuration panel.
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {WIDGET_SKINS.map((skin) => (
                <ConfigChoiceButton
                  key={skin.id}
                  type="button"
                  selected={widgetTheme.skin === skin.id}
                  onClick={() => { setWidgetTheme(structuredClone(DEFAULT_WIDGET_THEME_PRESETS[skin.id])); setSaved(false) }}
                  className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case"
                  title={skin.description}
                >
                  <span className="text-[11px] font-semibold leading-none">{skin.label}</span>
                  <span className="text-[10px] leading-relaxed text-zinc-500">{skin.description}</span>
                </ConfigChoiceButton>
              ))}
              <ConfigChoiceButton
                type="button"
                selected={false}
                onClick={randomizeWidgetTheme}
                className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case"
              >
                <span className="text-[11px] font-semibold leading-none">Random</span>
                <span className="text-[10px] leading-relaxed text-zinc-500">Pick a widget skin preset at random and load its baseline palette, motion, and atmosphere profile.</span>
              </ConfigChoiceButton>
            </div>
            <div className="border-t border-zinc-800 pt-3">
              <ThemeAppearanceFields
                appearance={widgetTheme}
                onChange={(updater) => {
                  setWidgetTheme((prev) => {
                    const next = structuredClone(prev)
                    updater(next)
                    return next
                  })
                  setSaved(false)
                }}
                helperText="Each skin ships with its own baseline palette and font. Use these overrides when you want to tint the skin without switching presets."
              />
            </div>
          </div>
        </ConfigSectionPanel>
        <ConfigSectionPanel label="Widget Motion">
          <div className="space-y-4">
            <div className="text-[10px] text-zinc-500 leading-relaxed">
              Animation changes how light, gloss, and ornament move across the widget shell. Atmosphere adds an always-on texture layer so the desktop feels alive even when viewers stare at it for a long time.
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {WIDGET_THEME_ANIMATIONS.map((animation) => (
                <ConfigChoiceButton
                  key={animation.id}
                  type="button"
                  selected={widgetTheme.animation === animation.id}
                  onClick={() => { setWidgetTheme((prev) => ({ ...prev, animation: animation.id })); setSaved(false) }}
                  className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case"
                  title={animation.description}
                >
                  <span className="text-[11px] font-semibold leading-none">{animation.label}</span>
                  <span className="text-[10px] leading-relaxed text-zinc-500">{animation.description}</span>
                </ConfigChoiceButton>
              ))}
            </div>
            <div className="border-t border-zinc-800 pt-3 space-y-3">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Atmosphere</div>
              <div className="grid grid-cols-3 gap-1.5">
                {WIDGET_THEME_ATMOSPHERES.map((atmosphere) => (
                  <ConfigChoiceButton
                    key={atmosphere.id}
                    type="button"
                    selected={widgetTheme.atmosphere === atmosphere.id}
                    onClick={() => { setWidgetTheme((prev) => ({ ...prev, atmosphere: atmosphere.id })); setSaved(false) }}
                    className="py-2 text-[11px]"
                  >
                    {atmosphere.label}
                  </ConfigChoiceButton>
                ))}
              </div>
              <Slider
                label="Motion"
                value={Math.round(widgetTheme.motionIntensity * 100)}
                min={0}
                max={300}
                step={5}
                unit="%"
                onChange={(value) => {
                  setWidgetTheme((prev) => ({ ...prev, motionIntensity: value / 100 }))
                  setSaved(false)
                }}
              />
              <Slider
                label="Glow"
                value={Math.round(widgetTheme.glowIntensity * 100)}
                min={0}
                max={300}
                step={5}
                unit="%"
                onChange={(value) => {
                  setWidgetTheme((prev) => ({ ...prev, glowIntensity: value / 100 }))
                  setSaved(false)
                }}
              />
            </div>
          </div>
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
  const persistedConfig = useAdminStore((s) => s.persistedConfig)
  const runtimeConfigOverride = useAdminStore((s) => s.runtimeConfigOverride)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const desktopConfig = useMemo(() => withDesktopConfigDefaults(config.desktopConfig), [config.desktopConfig])
  const persistedDesktopConfig = useMemo(() => withDesktopConfigDefaults(persistedConfig.desktopConfig), [persistedConfig.desktopConfig])
  const persistedApp = useMemo(
    () => persistedConfig.applications.find((entry) => entry.id === app.id) ?? app,
    [app, persistedConfig.applications],
  )
  const initialWidgetSize = resolveWidgetSizeFromConfig(persistedApp, persistedDesktopConfig)
  const runtimeWidgetThemeOverride = runtimeConfigOverride.desktopConfig?.widgetThemeOverrides?.[app.id]
  const sourceWidgetThemeOverride = resolveWidgetThemeOverrideFromConfig(persistedApp, persistedDesktopConfig)
  const effectiveWidgetThemeOverride = runtimeWidgetThemeOverride ? structuredClone(runtimeWidgetThemeOverride) : sourceWidgetThemeOverride
  const [form, setForm] = useState<Application>(app)
  const [widgetSize, setWidgetSize] = useState(initialWidgetSize)
  const [widgetPosition, setWidgetPosition] = useState(() => resolveWidgetPositionFromConfig(persistedApp, persistedDesktopConfig))
  const [widgetDefaultZIndex, setWidgetDefaultZIndex] = useState<number>(
    () => resolveWidgetDefaultZIndexFromConfig(persistedApp, persistedDesktopConfig),
  )
  const [widgetThemeOverrideEnabled, setWidgetThemeOverrideEnabled] = useState(() => !!effectiveWidgetThemeOverride)
  const [widgetThemeOverride, setWidgetThemeOverride] = useState<WidgetThemeConfig>(() => structuredClone(effectiveWidgetThemeOverride ?? persistedDesktopConfig.widgetTheme))
  const [recycleBinFullOnStart, setRecycleBinFullOnStart] = useState(() => persistedDesktopConfig.recycleBin.fullOnStart)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [clearingOverride, setClearingOverride] = useState(false)
  const [clearOverrideError, setClearOverrideError] = useState<string | null>(null)
  const [saveDefaultArmed, setSaveDefaultArmed] = useState(false)
  const [detectedCameras, setDetectedCameras] = useState<{ deviceId: string; label: string }[]>([])
  const [detectingCameras, setDetectingCameras] = useState(false)
  const [cameraLabelsGranted, setCameraLabelsGranted] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveDefaultTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const defaultSnapshot = useMemo(() => resolveApplicationDefaultSnapshot(app), [app])

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
  const sourcePresets = config.sourcePresets ?? []
  const selectedSourceSceneId = form.sourceWidgetSettings?.sceneId ?? ''
  const selectedSourceScene = selectedSourceSceneId ? config.scenes[selectedSourceSceneId] : undefined
  const selectedSourceSceneSources = getSafeSceneSources(selectedSourceScene)
  const availableSourceScenes = useMemo(
    () => Object.values(config.scenes).filter((scene) => {
      const sources = getSafeSceneSources(scene)
      return sources.length > 0 || scene.id === selectedSourceSceneId
    }),
    [config.scenes, selectedSourceSceneId],
  )
  const availableSources = selectedSourceSceneSources
  const selectedSource = availableSources.find((source) => source.id === form.sourceWidgetSettings?.sourceId)
  const selectedSourceResolved = selectedSource ? resolveSourceInstance(selectedSource, sourcePresets) : null

  // Auto-enumerate video devices when this is a camera widget
  useEffect(() => {
    if (widgetComponent !== 'camera') return
    void enumerateCameras(false)
  }, [widgetComponent, enumerateCameras])
  const appDirty = !isSameDraft(form, persistedApp)
  const sourceWidgetPosition = resolveWidgetPositionFromConfig(persistedApp, persistedDesktopConfig)
  const sourceWidgetSize = resolveWidgetSizeFromConfig(persistedApp, persistedDesktopConfig)
  const sourceWidgetDefaultZIndex = resolveWidgetDefaultZIndexFromConfig(persistedApp, persistedDesktopConfig)
  const liveWidgetPosition = resolveWidgetPositionFromConfig(app, desktopConfig)
  const liveWidgetSize = resolveWidgetSizeFromConfig(app, desktopConfig)
  const liveWidgetRuntimeZIndex = resolveWidgetRuntimeZIndex(app, desktopConfig)
  const runtimeWidgetOverride = runtimeConfigOverride.desktopConfig
  const runtimeWidgetPositionOverride = runtimeWidgetOverride?.widgetPositions?.[app.id]
  const runtimeWidgetSizeOverride = runtimeWidgetOverride?.widgetSizes?.[app.id]
  const runtimeWidgetZIndexOverride = runtimeWidgetOverride?.widgetZIndices?.[app.id]
  const hasRuntimeWidgetThemeOverride = form.appType === 'widget' && !!runtimeWidgetThemeOverride
  const runtimeOverrideEntries = form.appType === 'widget'
    ? [
        {
          key: 'Window Position',
          value: runtimeWidgetPositionOverride
            ? `${liveWidgetPosition.x}, ${liveWidgetPosition.y}`
            : `${sourceWidgetPosition.x}, ${sourceWidgetPosition.y}`,
          active: !!runtimeWidgetPositionOverride,
        },
        {
          key: 'Window Size',
          value: runtimeWidgetSizeOverride
            ? `${liveWidgetSize.width}x${liveWidgetSize.height}px`
            : `${sourceWidgetSize.width}x${sourceWidgetSize.height}px`,
          active: !!runtimeWidgetSizeOverride,
        },
        {
          key: 'Stack Order',
          value: runtimeWidgetZIndexOverride !== undefined
            ? String(liveWidgetRuntimeZIndex)
            : String(sourceWidgetDefaultZIndex),
          active: runtimeWidgetZIndexOverride !== undefined,
        },
        {
          key: 'Theme Override',
          value: runtimeWidgetThemeOverride
            ? [runtimeWidgetThemeOverride.skin, runtimeWidgetThemeOverride.animation, runtimeWidgetThemeOverride.atmosphere]
                .filter(Boolean)
                .join(' / ')
            : (sourceWidgetThemeOverride
                ? [sourceWidgetThemeOverride.skin, sourceWidgetThemeOverride.animation, sourceWidgetThemeOverride.atmosphere]
                    .filter(Boolean)
                    .join(' / ')
                : 'Inherited'),
          active: !!runtimeWidgetThemeOverride,
        },
      ]
    : []
  const hasRuntimeOverride = runtimeOverrideEntries.some((entry) => entry.active)
  const widgetPositionDirty = form.appType === 'widget' && (
    widgetPosition.x !== sourceWidgetPosition.x || widgetPosition.y !== sourceWidgetPosition.y
  )
  const widgetSizeDirty = form.appType === 'widget' && (
    widgetSize.width !== sourceWidgetSize.width
    || widgetSize.height !== sourceWidgetSize.height
  )
  const widgetDefaultZIndexDirty = form.appType === 'widget' && widgetDefaultZIndex !== sourceWidgetDefaultZIndex
  const widgetThemeOverrideDirty = form.appType === 'widget' && (
    widgetThemeOverrideEnabled !== !!effectiveWidgetThemeOverride
    || (widgetThemeOverrideEnabled && !isSameDraft(widgetThemeOverride, effectiveWidgetThemeOverride ?? persistedDesktopConfig.widgetTheme))
  )
  const recycleBinFullOnStartDirty = isRecycleBinDecoration && recycleBinFullOnStart !== persistedDesktopConfig.recycleBin.fullOnStart
  const dirty = appDirty || widgetPositionDirty || widgetSizeDirty || widgetDefaultZIndexDirty || widgetThemeOverrideDirty || recycleBinFullOnStartDirty
  const themeOnlyDirty = form.appType === 'widget'
    && widgetThemeOverrideDirty
    && !appDirty
    && !widgetPositionDirty
    && !widgetSizeDirty
    && !widgetDefaultZIndexDirty
    && !recycleBinFullOnStartDirty
  const widgetThemePreviewPatch = useMemo(() => {
    if (form.appType !== 'widget') return null

    const nextOverrides = { ...(persistedDesktopConfig.widgetThemeOverrides ?? {}) }
    if (widgetThemeOverrideEnabled) {
      nextOverrides[form.id] = structuredClone(widgetThemeOverride)
    } else {
      delete nextOverrides[form.id]
    }

    return {
      desktopConfig: {
        widgetThemeOverrides: Object.keys(nextOverrides).length ? nextOverrides : undefined,
      },
    } as Partial<AppConfig>
  }, [form, persistedDesktopConfig.widgetThemeOverrides, widgetThemeOverride, widgetThemeOverrideEnabled])

  useEffect(() => {
    setForm(persistedApp)
    setWidgetPosition(resolveWidgetPositionFromConfig(persistedApp, persistedDesktopConfig))
    setWidgetSize(resolveWidgetSizeFromConfig(persistedApp, persistedDesktopConfig))
    setWidgetDefaultZIndex(resolveWidgetDefaultZIndexFromConfig(persistedApp, persistedDesktopConfig))
    setRecycleBinFullOnStart(persistedDesktopConfig.recycleBin.fullOnStart)
    setSaveDefaultArmed(false)
    setSaved(false)
  }, [persistedApp, persistedDesktopConfig])

  useEffect(() => {
    if (persistedApp.appType !== 'widget') return
    setWidgetThemeOverrideEnabled(!!effectiveWidgetThemeOverride)
    setWidgetThemeOverride(structuredClone(effectiveWidgetThemeOverride ?? persistedDesktopConfig.widgetTheme))
  }, [effectiveWidgetThemeOverride, persistedApp.appType, persistedDesktopConfig.widgetTheme])

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
    if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
    postPreviewConfigPatch(null)
  }, [])

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

  const buildDraftPersistence = useCallback((includeDefaultSnapshot: boolean) => {
    const draftApp: Application = clone(form)
    const scene = persistedConfig.scenes[draftApp.targetSceneId]
    const updates: Partial<typeof config> = { applications: [] }
    let nextDesktopConfig: DesktopConfig | null = null
    const ensureNextDesktopConfig = () => {
      if (!nextDesktopConfig) nextDesktopConfig = structuredClone(persistedDesktopConfig)
      return nextDesktopConfig
    }

    if (draftApp.appType === 'widget') {
      const nextDesktop = ensureNextDesktopConfig()
      const normalizedWidth = clampWidgetDimension(widgetSize.width, 180, 1400, sourceWidgetSize.width)
      const normalizedHeight = clampWidgetDimension(widgetSize.height, 140, 1000, sourceWidgetSize.height)
      const defaults = getDefaultWidgetSize(draftApp)
      const nextWidgetPositions = { ...(nextDesktop.widgetPositions ?? {}) }
      const nextWidgetSizes = { ...(nextDesktop.widgetSizes ?? {}) }
      const nextWidgetDefaultZIndices = { ...(nextDesktop.widgetDefaultZIndices ?? {}) }
      const nextWidgetThemeOverrides = { ...(nextDesktop.widgetThemeOverrides ?? {}) }

      nextWidgetPositions[draftApp.id] = {
        x: Math.max(0, Math.round(widgetPosition.x)),
        y: Math.max(0, Math.round(widgetPosition.y)),
      }

      if (normalizedWidth === defaults.width && normalizedHeight === defaults.height) {
        delete nextWidgetSizes[draftApp.id]
      } else {
        nextWidgetSizes[draftApp.id] = { width: normalizedWidth, height: normalizedHeight }
      }

      nextWidgetDefaultZIndices[draftApp.id] = Math.max(0, Math.round(widgetDefaultZIndex))

      if (widgetThemeOverrideEnabled) {
        nextWidgetThemeOverrides[draftApp.id] = structuredClone(widgetThemeOverride)
      } else {
        delete nextWidgetThemeOverrides[draftApp.id]
      }

  nextDesktop.widgetPositions = Object.keys(nextWidgetPositions).length ? nextWidgetPositions : undefined
      nextDesktop.widgetSizes = Object.keys(nextWidgetSizes).length ? nextWidgetSizes : undefined
      nextDesktop.widgetDefaultZIndices = Object.keys(nextWidgetDefaultZIndices).length ? nextWidgetDefaultZIndices : undefined
      nextDesktop.widgetThemeOverrides = Object.keys(nextWidgetThemeOverrides).length ? nextWidgetThemeOverrides : undefined
    }

    if (isRecycleBinDecoration && recycleBinFullOnStart !== persistedDesktopConfig.recycleBin.fullOnStart) {
      ensureNextDesktopConfig().recycleBin = {
        ...ensureNextDesktopConfig().recycleBin,
        fullOnStart: recycleBinFullOnStart,
      }
    }

    if (includeDefaultSnapshot) {
      draftApp.defaultConfig = createApplicationSnapshot(
        draftApp,
        nextDesktopConfig ?? persistedDesktopConfig,
      )
    }

    const apps = [...persistedConfig.applications]
    const idx = apps.findIndex((entry) => entry.id === draftApp.id)
    if (idx !== -1) apps[idx] = draftApp
    else apps.push(draftApp)
    updates.applications = apps

    if (scene) {
      updates.scenes = {
        [draftApp.targetSceneId]: {
          ...scene,
          label: draftApp.label,
        },
      }
    }

    if (nextDesktopConfig) updates.desktopConfig = nextDesktopConfig

    return updates
  }, [config, form, isRecycleBinDecoration, persistedConfig.applications, persistedConfig.scenes, persistedDesktopConfig, recycleBinFullOnStart, sourceWidgetSize.height, sourceWidgetSize.width, widgetDefaultZIndex, widgetPosition.x, widgetPosition.y, widgetSize.height, widgetSize.width, widgetThemeOverride, widgetThemeOverrideEnabled])

  const apply = async () => {
    setSaving(true)
    const updates = buildDraftPersistence(false)

    if (themeOnlyDirty && updates.desktopConfig) {
      updates.applications = undefined
      updates.scenes = undefined
      updates.desktopConfig = { widgetThemeOverrides: updates.desktopConfig.widgetThemeOverrides } as DesktopConfig
    }

    await saveConfig(updates)

    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }

  const reset = () => {
    setForm(persistedApp)
    setWidgetPosition(resolveWidgetPositionFromConfig(persistedApp, persistedDesktopConfig))
    setWidgetSize(resolveWidgetSizeFromConfig(persistedApp, persistedDesktopConfig))
    setWidgetDefaultZIndex(resolveWidgetDefaultZIndexFromConfig(persistedApp, persistedDesktopConfig))
    setWidgetThemeOverrideEnabled(!!effectiveWidgetThemeOverride)
    setWidgetThemeOverride(structuredClone(effectiveWidgetThemeOverride ?? persistedDesktopConfig.widgetTheme))
    setRecycleBinFullOnStart(persistedDesktopConfig.recycleBin.fullOnStart)
    setSaveDefaultArmed(false)
    setSaved(false)
  }

  useEffect(() => {
    postPreviewConfigPatch(widgetThemeOverrideDirty ? widgetThemePreviewPatch : null)
  }, [widgetThemeOverrideDirty, widgetThemePreviewPatch])

  const restoreDefaults = async () => {
    const snapshot = clone(defaultSnapshot)
    const { widgetDefaults: _widgetDefaults, ...appDefaults } = snapshot
    const restoredApp: Application = {
      ...app,
      ...appDefaults,
      defaultConfig: app.defaultConfig ?? snapshot,
    }

    const apps = config.applications.map((entry) => (entry.id === app.id ? restoredApp : entry))
    const updates: Partial<typeof config> = { applications: apps }

    if (restoredApp.appType === 'widget') {
      updates.desktopConfig = applyWidgetDefaultSnapshotToDesktopConfig(persistedDesktopConfig, restoredApp, snapshot)
    }

    setSaving(true)
    await saveConfig(updates)
    setSaving(false)
    setSaveDefaultArmed(false)
    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }

  const saveCurrentAsDefault = useCallback(async () => {
    if (!saveDefaultArmed) {
      setSaveDefaultArmed(true)
      if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
      saveDefaultTimer.current = setTimeout(() => setSaveDefaultArmed(false), 3500)
      return
    }

    setSaving(true)
    if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
    await saveConfig(buildDraftPersistence(true))
    setSaveDefaultArmed(false)
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [buildDraftPersistence, saveConfig, saveDefaultArmed])

  const useCurrentWidgetValues = () => {
    if (form.appType !== 'widget') return
    setWidgetPosition(liveWidgetPosition)
    setWidgetSize(liveWidgetSize)
    setSaved(false)
  }

  const clearWidgetRuntimeOverride = () => {
    if (form.appType !== 'widget' || !hasRuntimeOverride || clearingOverride) return

    setClearingOverride(true)
    setClearOverrideError(null)

    const handleOverrideCleared: (err: string | null) => void = (err) => {
      setClearingOverride(false)
      if (err) {
        setClearOverrideError(err)
        return
      }
      setClearOverrideError(null)
    }

    socket.emit('runtime:config:override:widget:clear', form.id, handleOverrideCleared)
  }

  const supportsSceneTransitions = form.appType === 'scene'

  return (
    <div className="space-y-3">
      <ConfigApplyBar label="Application Configuration" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
      <div className="space-y-0 pt-3">
        {form.appType === 'widget' && (
          <ConfigSectionPanel label="Runtime Override" first>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={hasRuntimeOverride ? 'text-[11px] font-medium text-red-100' : 'text-[11px] font-medium text-zinc-400'}>
                  {hasRuntimeOverride ? 'Runtime override active' : 'No runtime override active'}
                </div>
                <span className="flex-1" />
                <span
                  className={[
                    'inline-block h-2.5 w-2.5 rounded-full transition-all',
                    hasRuntimeOverride
                      ? 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.95),0_0_20px_rgba(239,68,68,0.55)]'
                      : 'bg-zinc-700 shadow-[0_0_0_rgba(0,0,0,0)]',
                  ].join(' ')}
                />
              </div>
              <div className="space-y-1.5 rounded border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
                {runtimeOverrideEntries.map((entry) => (
                  <div key={entry.key} className="flex items-start justify-between gap-3 text-[10px]">
                    <div className="uppercase tracking-[0.14em] text-zinc-500">{entry.key}</div>
                    <div className={entry.active ? 'text-right font-mono text-zinc-200' : 'text-right font-mono text-zinc-500'}>
                      {entry.value}
                    </div>
                  </div>
                ))}
              </div>
              {clearOverrideError && <ConfigNotice tone="danger">{clearOverrideError}</ConfigNotice>}
              <div className="flex justify-end">
                <Btn
                  type="button"
                  onClick={clearWidgetRuntimeOverride}
                  disabled={!hasRuntimeOverride || clearingOverride}
                  className="px-2.5 py-1 text-[10px]"
                >
                  {clearingOverride ? 'Clearing Override...' : 'Clear Override'}
                </Btn>
              </div>
            </div>
          </ConfigSectionPanel>
        )}

        <ConfigSectionPanel label="Identity" first={form.appType !== 'widget'}>
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

        {form.appType !== 'widget' && (
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
        )}

        {form.appType === 'widget' && (
          <ConfigSectionPanel label="Widget Window Defaults">
              <div className="flex justify-end mb-3">
                <Btn
                  type="button"
                  onClick={useCurrentWidgetValues}
                  className="px-2.5 py-1 text-[10px]"
                >
                  Use Current
                </Btn>
              </div>
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
              <div className="mt-3 pt-3 border-t border-zinc-700/50">
                <div className="text-[10px] text-zinc-500 mb-2">Position</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-zinc-500 mb-1">X</div>
                    <input
                      type="number"
                      min={0}
                      max={1850}
                      value={widgetPosition.x}
                      onChange={(e) => setWidgetPosition((prev) => ({ ...prev, x: Number(e.target.value) }))}
                      className="w-full font-mono text-xs"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500 mb-1">Y</div>
                    <input
                      type="number"
                      min={0}
                      max={990}
                      value={widgetPosition.y}
                      onChange={(e) => setWidgetPosition((prev) => ({ ...prev, y: Number(e.target.value) }))}
                      className="w-full font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-zinc-600">Saved desktop position for this widget window.</div>
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
                </div>
                <div className="text-[10px] text-zinc-600 mt-1">
                  This is the widget's baseline stack order. Saved layouts can temporarily bias focus priority on top of this, and manual clicking or taskbar focus can still move a window to the front at runtime.
                </div>
              </div>
          </ConfigSectionPanel>
        )}

        {form.appType === 'widget' && (
          <ConfigSectionPanel label="Widget Theme Override">
            <div className="space-y-4">
              <div className="text-[10px] text-zinc-500 leading-relaxed">
                Keep widgets self-sufficient by giving each one its own skin, theming, motion, and atmosphere profile. Leave this off to inherit the shared desktop widget theme.
              </div>
              {hasRuntimeWidgetThemeOverride && (
                <ConfigNotice className="px-3 py-2 text-[10px]" tone="info">
                  Runtime override active. The values below reflect the live override currently applied to this widget.
                </ConfigNotice>
              )}
              <Toggle
                checked={widgetThemeOverrideEnabled}
                onChange={(value) => {
                  setWidgetThemeOverrideEnabled(value)
                  if (value && !sourceWidgetThemeOverride) {
                    setWidgetThemeOverride(structuredClone(desktopConfig.widgetTheme))
                  }
                  setSaved(false)
                }}
                label="Use widget-specific appearance"
              />
              {widgetThemeOverrideEnabled ? (
                <>
                  <div className="grid grid-cols-2 gap-1.5 border-t border-zinc-800 pt-3">
                    {WIDGET_SKINS.map((skin) => (
                      <ConfigChoiceButton
                        key={skin.id}
                        type="button"
                        selected={widgetThemeOverride.skin === skin.id}
                        onClick={() => {
                          setWidgetThemeOverride(structuredClone(DEFAULT_WIDGET_THEME_PRESETS[skin.id]))
                          setSaved(false)
                        }}
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
                      appearance={widgetThemeOverride}
                      onChange={(updater) => {
                        setWidgetThemeOverride((prev) => {
                          const next = structuredClone(prev)
                          updater(next)
                          return next
                        })
                        setSaved(false)
                      }}
                      helperText="Use a different font, accent, and text color when this widget should feel like its own application instead of just another window using the global chrome." 
                    />
                  </div>
                  <div className="border-t border-zinc-800 pt-3 space-y-3">
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Motion</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {WIDGET_THEME_ANIMATIONS.map((animation) => (
                          <ConfigChoiceButton
                            key={animation.id}
                            type="button"
                            selected={widgetThemeOverride.animation === animation.id}
                            onClick={() => {
                              setWidgetThemeOverride((prev) => ({ ...prev, animation: animation.id }))
                              setSaved(false)
                            }}
                            className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case"
                            title={animation.description}
                          >
                            <span className="text-[11px] font-semibold leading-none">{animation.label}</span>
                            <span className="text-[10px] leading-relaxed text-zinc-500">{animation.description}</span>
                          </ConfigChoiceButton>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Atmosphere</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {WIDGET_THEME_ATMOSPHERES.map((atmosphere) => (
                          <ConfigChoiceButton
                            key={atmosphere.id}
                            type="button"
                            selected={widgetThemeOverride.atmosphere === atmosphere.id}
                            onClick={() => {
                              setWidgetThemeOverride((prev) => ({ ...prev, atmosphere: atmosphere.id }))
                              setSaved(false)
                            }}
                            className="py-2 text-[11px]"
                          >
                            {atmosphere.label}
                          </ConfigChoiceButton>
                        ))}
                      </div>
                    </div>
                    <Slider
                      label="Motion"
                      value={Math.round(widgetThemeOverride.motionIntensity * 100)}
                      min={0}
                      max={300}
                      step={5}
                      unit="%"
                      onChange={(value) => {
                        setWidgetThemeOverride((prev) => ({ ...prev, motionIntensity: value / 100 }))
                        setSaved(false)
                      }}
                    />
                    <Slider
                      label="Glow"
                      value={Math.round(widgetThemeOverride.glowIntensity * 100)}
                      min={0}
                      max={300}
                      step={5}
                      unit="%"
                      onChange={(value) => {
                        setWidgetThemeOverride((prev) => ({ ...prev, glowIntensity: value / 100 }))
                        setSaved(false)
                      }}
                    />
                    <div className="flex justify-end">
                      <Btn
                        type="button"
                        onClick={() => {
                          setWidgetThemeOverride(structuredClone(desktopConfig.widgetTheme))
                          setSaved(false)
                        }}
                        className="px-2 py-1 text-[10px]"
                      >
                        Copy Desktop Theme
                      </Btn>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[10px] leading-relaxed text-zinc-500">
                  This widget currently inherits the shared desktop widget theme from the Desktop environment editor.
                </div>
              )}
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
                  const nextSceneSources = getSafeSceneSources(nextScene)
                  const currentSourceId = d.sourceWidgetSettings?.sourceId
                  const nextSourceId = nextSceneSources.some((source) => source.id === currentSourceId)
                    ? currentSourceId
                    : (nextSceneSources[0]?.id ?? '')

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
                  <option key={source.id} value={source.id}>{source.id} · {resolveSourceInstance(source, sourcePresets)?.pluginType ?? 'unbound'}</option>
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
                <div className="text-[10px] text-zinc-400 font-mono">{selectedSource.id} · {selectedSourceResolved?.pluginType ?? 'unbound'}</div>
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
  const runtimeConfigOverride = useAdminStore((s) => s.runtimeConfigOverride)
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
  const [saveDefaultArmed, setSaveDefaultArmed] = useState(false)
  const [factoryResetArmed, setFactoryResetArmed] = useState(false)
  const [clearingOverride, setClearingOverride] = useState(false)
  const [clearOverrideError, setClearOverrideError] = useState<string | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveDefaultTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const factoryResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLayout(sourceLayout ? structuredClone(sourceLayout) : null)
    setClearingOverride(false)
    setClearOverrideError(null)
    setFactoryResetArmed(false)
    setSaved(false)
  }, [sourceLayout])

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
    if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
    if (factoryResetTimer.current) clearTimeout(factoryResetTimer.current)
  }, [])

  if (!sourceLayout || !layout) {
    return <div className="text-zinc-600 text-xs italic p-4">Layout not found.</div>
  }

  const dirty = !isSameDraft(layout, sourceLayout)
  const layoutWidgetIds = layout.items.map((item) => item.widgetId)
  const runtimeWidgetPositions = runtimeConfigOverride.desktopConfig?.widgetPositions ?? {}
  const runtimeWidgetSizes = runtimeConfigOverride.desktopConfig?.widgetSizes ?? {}
  const runtimeWidgetZIndices = runtimeConfigOverride.desktopConfig?.widgetZIndices ?? {}
  const hasRuntimeOverride = layoutWidgetIds.some((widgetId) => (
    widgetId in runtimeWidgetPositions
    || widgetId in runtimeWidgetSizes
    || widgetId in runtimeWidgetZIndices
  ))
  const activeRuntimeOverrideCount = layoutWidgetIds.filter((widgetId) => (
    widgetId in runtimeWidgetPositions
    || widgetId in runtimeWidgetSizes
    || widgetId in runtimeWidgetZIndices
  )).length
  const defaultSnapshot = sourceLayout.defaultConfig ? structuredClone(sourceLayout.defaultConfig) : createWidgetLayoutSnapshot(sourceLayout)
  const factorySystemLayout = sourceLayout.source === 'system'
    ? DEFAULT_SYSTEM_WIDGET_LAYOUTS.find((entry) => entry.id === sourceLayout.id)
    : undefined

  const applySnapshotToLayout = (target: WidgetLayoutDefinition, snapshot: WidgetLayoutSnapshot): WidgetLayoutDefinition => ({
    ...target,
    label: snapshot.label,
    icon: snapshot.icon,
    description: snapshot.description,
    items: structuredClone(snapshot.items),
  })

  const persistLayout = async (nextLayout: WidgetLayoutDefinition) => {
    setSaving(true)
    await saveConfig({
      desktopConfig: {
        ...desktopConfig,
        widgetLayouts: sourceLayouts.map((entry) => entry.id === layoutId ? nextLayout : entry),
      },
    })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }

  const persistDraft = async () => {
    await persistLayout(layout)
  }

  const reset = () => {
    setLayout(structuredClone(sourceLayout))
    setSaveDefaultArmed(false)
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

  const restoreDefaults = async () => {
    await persistLayout({
      ...applySnapshotToLayout(layout, defaultSnapshot),
      defaultConfig: structuredClone(sourceLayout.defaultConfig ?? defaultSnapshot),
    })
    setSaveDefaultArmed(false)
  }

  const buildFactoryResetLayout = (): WidgetLayoutDefinition => {
    if (factorySystemLayout) {
      const [normalizedFactoryLayout] = normalizeWidgetLayoutsForEditor([factorySystemLayout], widgetApps, desktopConfig)
      if (normalizedFactoryLayout) {
        return {
          ...normalizedFactoryLayout,
          defaultConfig: structuredClone(sourceLayout.defaultConfig ?? normalizedFactoryLayout.defaultConfig),
        }
      }
    }

    return {
      ...layout,
      items: widgetApps.map((app, index) => buildWidgetLayoutItem(app, index, desktopConfig, false)),
      defaultConfig: structuredClone(sourceLayout.defaultConfig ?? defaultSnapshot),
    }
  }

  const performFactoryReset = async () => {
    if (!factoryResetArmed) {
      setFactoryResetArmed(true)
      if (factoryResetTimer.current) clearTimeout(factoryResetTimer.current)
      factoryResetTimer.current = setTimeout(() => setFactoryResetArmed(false), 3500)
      return
    }

    if (factoryResetTimer.current) clearTimeout(factoryResetTimer.current)
    await persistLayout(buildFactoryResetLayout())
    setFactoryResetArmed(false)
  }

  const saveCurrentAsDefault = async () => {
    if (!saveDefaultArmed) {
      setSaveDefaultArmed(true)
      if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
      saveDefaultTimer.current = setTimeout(() => setSaveDefaultArmed(false), 3500)
      return
    }

    if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
    const currentSnapshot = createWidgetLayoutSnapshot(layout)
    await persistLayout({
      ...layout,
      defaultConfig: currentSnapshot,
    })
    setSaveDefaultArmed(false)
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
    await persistDraft()
    socket.emit('widget:layout:apply', layoutId)
  }

  const clearLayoutOverride = () => {
    if (!hasRuntimeOverride || clearingOverride) return

    setClearingOverride(true)
    setClearOverrideError(null)

    const handleOverrideCleared: (err: string | null) => void = (err) => {
      setClearingOverride(false)
      if (err) {
        setClearOverrideError(err)
        return
      }
      setClearOverrideError(null)
    }

    socket.emit('runtime:config:override:widget-layout:clear', layoutWidgetIds, handleOverrideCleared)
  }

  return (
    <div className="space-y-3">
      <ConfigApplyBar
        label={layout.label}
        dirty={dirty}
        saving={saving}
        saved={saved}
        onApply={() => { void persistDraft() }}
        onReset={() => { void restoreDefaults() }}
        alwaysShow
      />

      <div className="space-y-0 pt-3">
      <ConfigSectionPanel label="Runtime Override" first>
        <div className="space-y-2.5">
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

          <ConfigCard className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="mt-1 text-[11px] text-zinc-200">
                  {hasRuntimeOverride
                    ? `Active for ${activeRuntimeOverrideCount} ${activeRuntimeOverrideCount === 1 ? 'widget' : 'widgets'}`
                    : 'No active override'}
                </div>
              </div>
            </div>
            <div className="text-[10px] leading-relaxed text-zinc-500">
              Removes live runtime position, size, and stack-order overrides for every widget included in this layout without changing the saved layout definition.
            </div>
          </ConfigCard>
          {clearOverrideError && <ConfigNotice tone="danger">{clearOverrideError}</ConfigNotice>}

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
              onClick={clearLayoutOverride}
              disabled={!hasRuntimeOverride || clearingOverride}
              className="px-2.5 py-1 text-[10px]"
            >
              {clearingOverride ? 'Clearing Override...' : 'Clear Override'}
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
        </div>
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Layout Configuration">
        <div className="space-y-2.5">
          {layout.source === 'system' && (
            <div className="text-[10px] text-zinc-500">Built-in taskbar layout. Persistent, not removable.</div>
          )}

          <div className="flex justify-end">
            <div className="flex flex-wrap justify-end gap-2">
              <Btn
                type="button"
                variant={factoryResetArmed ? 'danger' : 'ghost'}
                onClick={() => { void performFactoryReset() }}
                className="px-2.5 py-1 text-[10px]"
              >
                {factoryResetArmed ? 'Confirm Factory Reset' : 'Perform Factory Reset'}
              </Btn>
              <Btn
                type="button"
                onClick={() => captureCurrentIntoLayout()}
                className="px-2.5 py-1 text-[10px]"
              >
                Use Current
              </Btn>
            </div>
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

function EventForm({
  def,
  onUpdate,
  onDelete,
  showOverview = true,
  showDeleteButton = true,
}: {
  def: EventDef
  onUpdate: (d: EventDef) => void
  onDelete?: () => void
  showOverview?: boolean
  showDeleteButton?: boolean
}) {
  const config = useAdminStore((s) => s.config)
  const desktopConfig = withDesktopConfigDefaults(config.desktopConfig)
  const widgetApps = useMemo(() => config.applications.filter((app) => app.appType === 'widget'), [config.applications])
  const widgetLayouts = desktopConfig.widgetLayouts ?? []

  const update = (fn: (d: EventDef) => void) => {
    const next: EventDef = {
      ...def,
      auto: { ...def.auto },
      effects: def.effects.map((effect) => structuredClone(effect)),
      actions: structuredClone(def.actions ?? []),
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

  const updateAction = (index: number, updater: (action: EventAction) => void) => {
    update((d) => {
      const action = d.actions?.[index]
      if (!action) return
      updater(action)
    })
  }

  const addAction = (kind: EventAction['kind']) => {
    update((d) => {
      d.actions = [...(d.actions ?? []), createEventActionDraft(kind)]
    })
  }

  const addEffect = (type: EffectType) => {
    update((d) => {
      d.effects.push(createEffectDraft(type))
    })
  }

  const renderThemeFields = (theme: WidgetThemeConfig, onChange: (updater: (draft: WidgetThemeConfig) => void) => void) => (
    <div className="grid grid-cols-2 gap-2 pl-1">
      <div>
        <div className="text-[10px] text-zinc-500 mb-1">Skin</div>
        <select
          value={theme.skin}
          onChange={(e) => onChange((draft) => Object.assign(draft, structuredClone(DEFAULT_WIDGET_THEME_PRESETS[e.target.value as keyof typeof DEFAULT_WIDGET_THEME_PRESETS]))) }
          className="w-full text-xs"
        >
          {WIDGET_SKINS.map((skin) => (
            <option key={skin.id} value={skin.id}>{skin.label}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 mb-1">Font</div>
        <select
          value={theme.fontFamily}
          onChange={(e) => onChange((draft) => { draft.fontFamily = e.target.value })}
          className="w-full text-xs"
        >
          {GOOGLE_FONTS.map((font) => (
            <option key={font.css} value={font.css}>{font.name}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 mb-1">Accent</div>
        <HexColorInput value={theme.accentColor} onChange={(value) => onChange((draft) => { draft.accentColor = value })} />
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 mb-1">Text</div>
        <HexColorInput value={theme.textColor} onChange={(value) => onChange((draft) => { draft.textColor = value })} />
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 mb-1">Animation</div>
        <select
          value={theme.animation}
          onChange={(e) => onChange((draft) => { draft.animation = e.target.value as WidgetThemeConfig['animation'] })}
          className="w-full text-xs"
        >
          {WIDGET_THEME_ANIMATIONS.map((animation) => (
            <option key={animation.id} value={animation.id}>{animation.label}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 mb-1">Atmosphere</div>
        <select
          value={theme.atmosphere}
          onChange={(e) => onChange((draft) => { draft.atmosphere = e.target.value as WidgetThemeConfig['atmosphere'] })}
          className="w-full text-xs"
        >
          {WIDGET_THEME_ATMOSPHERES.map((atmosphere) => (
            <option key={atmosphere.id} value={atmosphere.id}>{atmosphere.label}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 mb-1">Motion</div>
        <input
          type="number"
          min={0}
          max={3}
          step={0.05}
          value={theme.motionIntensity}
          onChange={(e) => onChange((draft) => { draft.motionIntensity = Number(e.target.value) })}
          className="w-full font-mono text-xs"
        />
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 mb-1">Glow</div>
        <input
          type="number"
          min={0}
          max={3}
          step={0.05}
          value={theme.glowIntensity}
          onChange={(e) => onChange((draft) => { draft.glowIntensity = Number(e.target.value) })}
          className="w-full font-mono text-xs"
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {showOverview && (
        <>
          <div className="flex items-center gap-4 rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-4 py-4">
            <span className="text-3xl">{def.icon}</span>
            <div className="min-w-0">
              <div className="text-base font-bold text-zinc-100">{def.label}</div>
              <div className="text-xs text-zinc-500 font-mono">{def.id}</div>
              <div className="mt-1 text-xs text-zinc-400">{def.desc}</div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <ConfigCard className="text-left">
              <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Setup</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">{describeEventSetup(def)}</div>
            </ConfigCard>
            <ConfigCard className="text-left">
              <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Runtime Actions</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">{def.actions?.length ?? 0}</div>
            </ConfigCard>
            <ConfigCard className="text-left">
              <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Overlay Effects</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">{def.effects.length}</div>
            </ConfigCard>
          </div>
        </>
      )}

      <div className="grid gap-4 grid-cols-[280px_minmax(0,1fr)] items-start">
        <div className="space-y-0 sticky top-0">
          {!def.builtIn && (
            <ConfigSectionPanel label="Identity" first>
              <div className="space-y-3">
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
                  <textarea value={def.desc} onChange={(e) => update((d) => { d.desc = e.target.value })} className="min-h-[88px] w-full text-sm" />
                </div>
              </div>
            </ConfigSectionPanel>
          )}

          <ConfigSectionPanel label="Trigger" first={def.builtIn}>
            <Toggle checked={def.auto.enabled} onChange={(v) => update((d) => { d.auto.enabled = v })} label="Enable auto-trigger" />
            {def.auto.enabled && (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="text-[10px] text-zinc-400 mb-1">Mode</div>
                  <div className="flex gap-2">
                    {(['interval', 'idle'] as const).map((m) => (
                      <ConfigChoiceButton key={m} type="button" selected={def.auto.mode === m} onClick={() => update((d) => { d.auto.mode = m })} className="flex-1 py-2 text-sm">
                        {m}
                      </ConfigChoiceButton>
                    ))}
                  </div>
                </div>
                {def.auto.mode === 'interval' && (
                  <Slider label="Avg every" value={def.auto.intervalMin} min={1} max={60} step={1} unit="min" onChange={(v) => update((d) => { d.auto.intervalMin = v })} />
                )}
                {def.auto.mode === 'idle' && (
                  <Slider label="After idle" value={def.auto.idleMin} min={1} max={30} step={1} unit="min" onChange={(v) => update((d) => { d.auto.idleMin = v })} />
                )}
                <Slider label="Chance" value={Math.round(def.auto.chance * 100)} min={0} max={100} step={5} unit="%" onChange={(v) => update((d) => { d.auto.chance = v / 100 })} />
                <Slider label="Cooldown" value={def.auto.cooldownMin} min={0} max={120} step={1} unit="min" onChange={(v) => update((d) => { d.auto.cooldownMin = v })} />
                <div>
                  <div className="text-[10px] text-zinc-400 mb-1">Allowed states</div>
                  <div className="flex gap-2">
                    {[STATE.DESKTOP, STATE.LOBBY].map((stateId) => {
                      const selected = (def.auto.allowedStates ?? []).includes(stateId)
                      return (
                        <ConfigChoiceButton
                          key={stateId}
                          type="button"
                          selected={selected}
                          onClick={() => update((d) => {
                            const next = new Set(d.auto.allowedStates ?? [])
                            if (next.has(stateId)) next.delete(stateId)
                            else next.add(stateId)
                            d.auto.allowedStates = next.size ? [...next] : undefined
                          })}
                          className="flex-1 py-2 text-sm"
                        >
                          {stateId}
                        </ConfigChoiceButton>
                      )
                    })}
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500">Leave both off to allow any runtime state.</div>
                </div>
              </div>
            )}
          </ConfigSectionPanel>

          {!def.builtIn && showDeleteButton && onDelete && (
            <div className="pt-3">
              <Btn variant="danger" onClick={onDelete} className="w-full py-2.5 text-sm">Delete Event</Btn>
            </div>
          )}
        </div>

        <div className="space-y-0">
          <ConfigSectionPanel label="Runtime Actions" first>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {COMMON_EVENT_ACTION_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => addAction(kind)}
                    className="rounded-full border border-zinc-700/70 bg-zinc-950/60 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-cyan-400/35 hover:text-cyan-200"
                  >
                    + {getEventActionLabel(kind)}
                  </button>
                ))}
              </div>
              {(def.actions ?? []).length === 0 && <div className="text-[10px] text-zinc-600 italic">No runtime actions configured.</div>}
              {(def.actions ?? []).map((action, index) => (
                <div key={`${def.id}-action-${index}`} className="space-y-3 rounded-xl border border-zinc-800/70 bg-zinc-950/45 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-xs font-mono text-zinc-300">{action.kind}</span>
                    <button
                      type="button"
                      onClick={() => update((d) => { d.actions?.splice(index, 1) })}
                      className="rounded-md px-2 py-1 text-[11px] text-red-400 transition hover:bg-red-500/10 hover:text-red-200"
                    >
                      Remove
                    </button>
                  </div>

                  {action.kind === 'desktop-config' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 pl-1">
                        <div>
                          <div className="text-[10px] text-zinc-500 mb-1">Desktop theme</div>
                          <select value={action.patch.theme ?? 'win98'} onChange={(e) => updateAction(index, (draft) => {
                            if (draft.kind !== 'desktop-config') return
                            draft.patch.theme = e.target.value as DesktopConfig['theme']
                          })} className="w-full text-xs">
                            {DESKTOP_THEMES.map((theme) => <option key={theme.id} value={theme.id}>{theme.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-500 mb-1">Icon motion</div>
                          <select value={action.patch.iconAnimation ?? 'none'} onChange={(e) => updateAction(index, (draft) => {
                            if (draft.kind !== 'desktop-config') return
                            draft.patch.iconAnimation = e.target.value as DesktopConfig['iconAnimation']
                          })} className="w-full text-xs">
                            {ICON_ANIMATIONS.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-500 mb-1">Icon intensity</div>
                          <input type="number" min={0} max={3} step={0.05} value={action.patch.iconMotion ?? 1} onChange={(e) => updateAction(index, (draft) => {
                            if (draft.kind !== 'desktop-config') return
                            draft.patch.iconMotion = Number(e.target.value)
                          })} className="w-full font-mono text-xs" />
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-500 mb-1">Screen saver</div>
                          <select value={action.patch.screenSaver?.preset ?? desktopConfig.screenSaver.preset} onChange={(e) => updateAction(index, (draft) => {
                            if (draft.kind !== 'desktop-config') return
                            draft.patch.screenSaver = {
                              enabled: draft.patch.screenSaver?.enabled ?? desktopConfig.screenSaver.enabled,
                              timeoutMinutes: draft.patch.screenSaver?.timeoutMinutes ?? desktopConfig.screenSaver.timeoutMinutes,
                              preset: e.target.value as DesktopConfig['screenSaver']['preset'],
                            }
                          })} className="w-full text-xs">
                            {SCREENSAVER_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="rounded border border-zinc-800/70 bg-zinc-900/45 py-2">
                        <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-zinc-500">Global Widget Theme</div>
                        {renderThemeFields({ ...DEFAULT_WIDGET_THEME_PRESETS.metalheart, ...(action.patch.widgetTheme ?? {}) }, (updater) => updateAction(index, (draft) => {
                          if (draft.kind !== 'desktop-config') return
                          const nextTheme: WidgetThemeConfig = { ...DEFAULT_WIDGET_THEME_PRESETS.metalheart, ...(draft.patch.widgetTheme ?? {}) }
                          updater(nextTheme)
                          draft.patch.widgetTheme = nextTheme
                        }))}
                      </div>
                    </div>
                  )}

                  {action.kind === 'widget-theme-overrides' && (
                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1">Target widgets</div>
                        <div className="flex flex-wrap gap-1">
                          {widgetApps.map((app) => {
                            const selected = action.widgetIds.includes(app.id)
                            return (
                              <ConfigChoiceButton key={app.id} type="button" selected={selected} onClick={() => updateAction(index, (draft) => {
                                if (draft.kind !== 'widget-theme-overrides') return
                                const next = new Set(draft.widgetIds)
                                if (next.has(app.id)) next.delete(app.id)
                                else next.add(app.id)
                                draft.widgetIds = [...next]
                              })} className="text-[10px]">
                                {app.label}
                              </ConfigChoiceButton>
                            )
                          })}
                        </div>
                      </div>
                      <Toggle checked={action.clearExisting ?? false} onChange={(value) => updateAction(index, (draft) => {
                        if (draft.kind !== 'widget-theme-overrides') return
                        draft.clearExisting = value
                      })} label="Reset existing overrides first" />
                      <div className="rounded border border-zinc-800/70 bg-zinc-900/45 py-2">
                        <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-zinc-500">Override Theme</div>
                        {renderThemeFields(action.theme as WidgetThemeConfig, (updater) => updateAction(index, (draft) => {
                          if (draft.kind !== 'widget-theme-overrides') return
                          const nextTheme = structuredClone(draft.theme as WidgetThemeConfig)
                          updater(nextTheme)
                          draft.theme = nextTheme
                        }))}
                      </div>
                    </div>
                  )}

                  {action.kind === 'widget-layout' && (
                    <div className="space-y-2">
                      <div className="rounded border border-zinc-800/70 bg-zinc-900/45 px-3 py-2">
                        <Slider label="Revert after" value={action.timeoutSeconds ?? 30} min={5} max={600} step={5} unit="s" onChange={(value) => updateAction(index, (draft) => {
                          if (draft.kind !== 'widget-layout') return
                          draft.timeoutSeconds = value
                        })} />
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1">Layout</div>
                        <select value={action.layoutId} onChange={(e) => updateAction(index, (draft) => {
                          if (draft.kind !== 'widget-layout') return
                          draft.layoutId = e.target.value
                        })} className="w-full text-xs">
                          <option value="">Select a layout</option>
                          {widgetLayouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.label}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {action.kind === 'widget-command' && (
                    <div className="grid grid-cols-2 gap-2 pl-1">
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1">Widget</div>
                        <select value={action.widgetId} onChange={(e) => updateAction(index, (draft) => {
                          if (draft.kind !== 'widget-command') return
                          draft.widgetId = e.target.value
                        })} className="w-full text-xs">
                          {widgetApps.map((app) => <option key={app.id} value={app.id}>{app.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1">Action</div>
                        <select value={action.action} onChange={(e) => updateAction(index, (draft) => {
                          if (draft.kind !== 'widget-command') return
                          draft.action = e.target.value as 'open' | 'close' | 'toggle'
                        })} className="w-full text-xs">
                          <option value="toggle">Toggle</option>
                          <option value="open">Open</option>
                          <option value="close">Close</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {action.kind === 'ambiance-patch' && (
                    <div className="grid grid-cols-2 gap-2 pl-1">
                      <div className="col-span-2">
                        <Toggle checked={action.patch.enabled ?? false} onChange={(value) => updateAction(index, (draft) => {
                          if (draft.kind !== 'ambiance-patch') return
                          draft.patch.enabled = value
                        })} label="Ambiance enabled" />
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1">Interval (s)</div>
                        <input type="number" min={1} step={1} value={action.patch.intervalSeconds ?? 30} onChange={(e) => updateAction(index, (draft) => {
                          if (draft.kind !== 'ambiance-patch') return
                          draft.patch.intervalSeconds = Number(e.target.value)
                        })} className="w-full font-mono text-xs" />
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1">Max open widgets</div>
                        <input type="number" min={1} step={1} value={action.patch.maxOpenWidgets ?? 2} onChange={(e) => updateAction(index, (draft) => {
                          if (draft.kind !== 'ambiance-patch') return
                          draft.patch.maxOpenWidgets = Number(e.target.value)
                        })} className="w-full font-mono text-xs" />
                      </div>
                      <div className="col-span-2">
                        <div className="text-[10px] text-zinc-500 mb-1">Open while one open chance</div>
                        <input type="number" min={0} max={1} step={0.05} value={action.patch.openWhileOneOpenChance ?? 0.35} onChange={(e) => updateAction(index, (draft) => {
                          if (draft.kind !== 'ambiance-patch') return
                          draft.patch.openWhileOneOpenChance = Number(e.target.value)
                        })} className="w-full font-mono text-xs" />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <select defaultValue="" onChange={(e) => {
                const kind = e.target.value as EventAction['kind']
                if (!kind) return
                e.target.value = ''
                addAction(kind)
              }} className="w-full text-sm">
                <option value="">More action types…</option>
                <option value="desktop-config">Desktop config</option>
                <option value="widget-theme-overrides">Widget theme overrides</option>
                <option value="widget-layout">Apply widget layout</option>
                <option value="widget-command">Widget command</option>
                <option value="ambiance-patch">Ambiance patch</option>
              </select>
            </div>
          </ConfigSectionPanel>

          <ConfigSectionPanel label="Effects">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {COMMON_EVENT_EFFECT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addEffect(type)}
                    className="rounded-full border border-zinc-700/70 bg-zinc-950/60 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-cyan-400/35 hover:text-cyan-200"
                  >
                    + {type}
                  </button>
                ))}
              </div>
              {def.effects.length === 0 && <div className="text-[10px] text-zinc-600 italic">No effects configured.</div>}
              {def.effects.map((eff, index) => (
                <div key={`${def.id}-effect-${index}`} className="space-y-3 border-b border-zinc-700/40 py-3 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-xs font-mono text-zinc-300">{eff.type}</span>
                    <input type="number" min={0} max={10} step={0.1} value={eff.delay ?? 0} onChange={(e) => update((d) => {
                      d.effects[index] = { ...d.effects[index], delay: Number(e.target.value) }
                    })} className="w-20 font-mono text-xs" title="Delay (s)" />
                    <span className="text-[10px] text-zinc-600">s</span>
                    <button onClick={() => update((d) => { d.effects.splice(index, 1) })} className="rounded-md px-2 py-1 text-[11px] text-red-400 transition hover:bg-red-500/10 hover:text-red-200">Remove</button>
                  </div>
                  {eff.type === 'desktop-notification' && (() => {
                    const cfg = normalizeDesktopNotificationEffectConfig(eff.cfg)
                    return (
                      <div className="grid grid-cols-2 gap-2 pl-1">
                        <div className="col-span-2">
                          <div className="text-[10px] text-zinc-500 mb-1">Title</div>
                          <input type="text" value={cfg.title} onChange={(e) => updateDesktopNotificationEffect(index, (draft) => { draft.title = e.target.value })} className="w-full text-xs" />
                        </div>
                        <div className="col-span-2">
                          <div className="text-[10px] text-zinc-500 mb-1">Body</div>
                          <textarea value={cfg.body} onChange={(e) => updateDesktopNotificationEffect(index, (draft) => { draft.body = e.target.value })} className="w-full min-h-[72px] text-xs" />
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-500 mb-1">Icon</div>
                          <input type="text" value={cfg.icon ?? ''} onChange={(e) => updateDesktopNotificationEffect(index, (draft) => { draft.icon = e.target.value || undefined })} className="w-full text-xs font-mono" />
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-500 mb-1">Duration (ms)</div>
                          <input type="number" min={0} step={250} value={cfg.durationMs ?? DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS} onChange={(e) => updateDesktopNotificationEffect(index, (draft) => { draft.durationMs = Number(e.target.value) || 0 })} className="w-full font-mono text-xs" />
                        </div>
                      </div>
                    )
                  })()}
                </div>
              ))}
              <select defaultValue="" onChange={(e) => {
                const type = e.target.value as EffectType
                if (!type) return
                e.target.value = ''
                addEffect(type)
              }} className="w-full text-sm">
                <option value="">More effects…</option>
                {EVENT_EFFECT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
          </ConfigSectionPanel>
        </div>
      </div>
    </div>
  )
}

// ── SceneConfig ────────────────────────────────────────────────────

function SceneConfig({ sceneId }: { sceneId: string }) {
  const config      = useAdminStore((s) => s.config)
  const saveConfig  = useAdminStore((s) => s.saveConfig)
  const linkedApp   = config.applications.find((a) => a.targetSceneId === sceneId)
  const scene = config.scenes[sceneId]
  const defaultSnapshot = useMemo(() => resolveSceneDefaultSnapshot(sceneId, scene), [scene, sceneId])
  const [saving, setSaving] = useState(false)
  const [saveDefaultArmed, setSaveDefaultArmed] = useState(false)
  const saveDefaultTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSaveDefaultArmed(false)
  }, [sceneId, scene, linkedApp])

  useEffect(() => () => {
    if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
  }, [])

  const updateAppTransitions = (key: 'introTransitions' | 'exitTransitions', steps: TransitionStep[]) => {
    if (!linkedApp) return
    const apps = config.applications.map((a) =>
      a.id === linkedApp.id ? { ...a, [key]: steps.length ? steps : undefined } : a
    )
    saveConfig({ applications: apps })
  }

  const restoreDefaults = async () => {
    const snapshot = clone(defaultSnapshot)
    const nextScene: Scene = {
      ...scene,
      label: snapshot.label,
      backgroundOpaque: snapshot.backgroundOpaque,
      sources: clone(snapshot.sources),
      style: snapshot.style ? clone(snapshot.style) : undefined,
      lobbyConfig: snapshot.lobbyConfig ? clone(snapshot.lobbyConfig) : undefined,
      introTransitions: snapshot.introTransitions ? clone(snapshot.introTransitions) : undefined,
      exitTransitions: snapshot.exitTransitions ? clone(snapshot.exitTransitions) : undefined,
      musicTrack: snapshot.musicTrack,
      defaultConfig: scene.defaultConfig ?? snapshot,
    }

    let applications = config.applications
    if (linkedApp) {
      const appDefaults = resolveApplicationDefaultSnapshot(linkedApp)
      const { widgetDefaults: _widgetDefaults, ...linkedAppDefaults } = appDefaults
      applications = config.applications.map((entry) => (
        entry.id === linkedApp.id
          ? { ...entry, ...linkedAppDefaults, defaultConfig: entry.defaultConfig ?? appDefaults }
          : entry
      ))
    }

    setSaving(true)
    await saveConfig({
      scenes: {
        [sceneId]: nextScene,
      },
      applications,
    })
    setSaving(false)
    setSaveDefaultArmed(false)
  }

  const saveCurrentAsDefault = async () => {
    if (!saveDefaultArmed) {
      setSaveDefaultArmed(true)
      if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
      saveDefaultTimer.current = setTimeout(() => setSaveDefaultArmed(false), 3500)
      return
    }

    setSaving(true)
    if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)

    let applications = config.applications
    if (linkedApp) {
      const appSnapshot = createApplicationSnapshot(linkedApp, withDesktopConfigDefaults(config.desktopConfig))
      applications = config.applications.map((entry) => (
        entry.id === linkedApp.id
          ? { ...entry, defaultConfig: appSnapshot }
          : entry
      ))
    }

    await saveConfig({
      scenes: {
        [sceneId]: {
          ...scene,
          defaultConfig: createSceneSnapshot(scene),
        },
      },
      applications,
    })

    setSaving(false)
    setSaveDefaultArmed(false)
  }

  return (
    <div className="space-y-3">
      <div className="ml-auto flex w-fit flex-wrap gap-2">
        <Btn
          type="button"
          variant={saveDefaultArmed ? 'warning' : 'default'}
          onClick={() => { void saveCurrentAsDefault() }}
          className={DASHBOARD_SAVE_BUTTON_CLASS}
          disabled={saving}
        >
          {saveDefaultArmed ? 'Click Again to Confirm' : 'Save Current as Default'}
        </Btn>
        <Btn
          type="button"
          variant="ghost"
          onClick={() => { void restoreDefaults() }}
          className={DASHBOARD_SAVE_BUTTON_CLASS}
          disabled={saving}
        >
          Restore Defaults
        </Btn>
      </div>
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
            saveConfig({ scenes: { [sceneId]: { ...config.scenes[sceneId], musicTrack: val } } })
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
  const config = useAdminStore((s) => s.config)
  const mediaLibrary = useAdminStore((s) => s.config.mediaLibrary ?? [])
  const eventDefs = useAdminStore((s) => (s.config.events ?? DEFAULT_EVENT_DEFS) as EventDef[])
  const widgetIds = useAdminStore((s) => s.config.applications.filter((app) => app.appType === 'widget').map((app) => app.id))
  const widgetLayouts = useAdminStore((s) => withDesktopConfigDefaults(s.config.desktopConfig).widgetLayouts ?? [])
  const saveConfig   = useAdminStore((s) => s.saveConfig)
  const { assets: catalogAssets, loading: catalogLoading, error: catalogError, refresh: refreshCatalog } = useAssetCatalog()

  const [tab, setTab] = useState<'catalog' | 'events' | 'sources' | 'transitions'>('catalog')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [durStr, setDurStr] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogKindFilter, setCatalogKindFilter] = useState<'all' | AssetKind>('all')
  const [selectedCatalogAssetId, setSelectedCatalogAssetId] = useState<string | null>(null)
  const [eventSearch, setEventSearch] = useState('')
  const [eventDraft, setEventDraft] = useState<{
    event: EventDef
    originalId: string | null
  } | null>(null)
  const [sourceSearch, setSourceSearch] = useState('')
  const [selectedSourcePresetId, setSelectedSourcePresetId] = useState<string | null>((useAdminStore.getState().config.sourcePresets ?? [])[0]?.id ?? null)
  const [sourcePresetDraft, setSourcePresetDraft] = useState<{
    preset: SourcePreset
    originalId: string | null
    originalLabel: string | null
  } | null>(null)
  const [transitionSearch, setTransitionSearch] = useState('')
  const [selectedTransitionKey, setSelectedTransitionKey] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const resetForm = () => { setName(''); setUrl(''); setDurStr('') }
  const editingEvent = eventDraft?.event ?? null
  const editingEventCreatesNew = !!eventDraft && !eventDraft.originalId
  const sourcePresets = config.sourcePresets ?? []
  const filteredEventDefs = useMemo(() => {
    const query = eventSearch.trim().toLowerCase()
    if (!query) return eventDefs
    return eventDefs.filter((def) => [def.label, def.desc, def.id].some((value) => value.toLowerCase().includes(query)))
  }, [eventDefs, eventSearch])
  const filteredEventPresets = useMemo(() => {
    const query = eventSearch.trim().toLowerCase()
    return EVENT_PRESET_OPTIONS.filter((preset) => preset.id !== 'blank' && (!query || [preset.label, preset.description, preset.id].some((value) => value.toLowerCase().includes(query))))
  }, [eventSearch])
  const catalogSavedAssets = useMemo(() => mediaLibrary.map(mediaEntryToAsset), [mediaLibrary])
  const filteredCatalogAssets = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase()
    const matchesQuery = (asset: AssetRecord) => {
      if (catalogKindFilter !== 'all' && asset.kind !== catalogKindFilter) return false
      if (!query) return true
      return [asset.name, asset.url, asset.folder, asset.relativePath, asset.game ?? ''].some((value) => value.toLowerCase().includes(query))
    }

    return [...catalogSavedAssets, ...catalogAssets].filter(matchesQuery)
  }, [catalogAssets, catalogKindFilter, catalogSavedAssets, catalogSearch])
  const catalogFolderGroups = useMemo(() => {
    const groups = new Map<string, AssetRecord[]>()
    for (const asset of filteredCatalogAssets) {
      const prefix = asset.source === 'saved' ? 'Saved Media' : asset.source === 'games' ? `Game Images${asset.game ? ` / ${asset.game}` : ''}` : `Project Assets / ${asset.folder}`
      const list = groups.get(prefix)
      if (list) list.push(asset)
      else groups.set(prefix, [asset])
    }
    return Array.from(groups.entries())
      .map(([folder, items]) => ({ folder, items: [...items].sort((left, right) => left.name.localeCompare(right.name)) }))
      .sort((left, right) => left.folder.localeCompare(right.folder))
  }, [filteredCatalogAssets])
  const sortedTransitionLibrary = useMemo(() => (
    [...mediaLibrary].sort((left, right) => getMediaTransitionLabel(left).localeCompare(getMediaTransitionLabel(right)))
  ), [mediaLibrary])
  const filteredSystemTransitions = useMemo(() => {
    const query = transitionSearch.trim().toLowerCase()
    if (!query) return TRANSITION_OPTIONS
    return TRANSITION_OPTIONS.filter((transition) => [transition.id, transition.label].some((value) => value.toLowerCase().includes(query)))
  }, [transitionSearch])
  const filteredTransitionLibrary = useMemo(() => {
    const query = transitionSearch.trim().toLowerCase()
    if (!query) return sortedTransitionLibrary
    return sortedTransitionLibrary.filter((entry) => [entry.name, entry.url, entry.id, getMediaTransitionLabel(entry)].some((value) => value.toLowerCase().includes(query)))
  }, [sortedTransitionLibrary, transitionSearch])
  const selectedCatalogAsset = useMemo(() => (
    filteredCatalogAssets.find((asset) => asset.id === selectedCatalogAssetId)
    ?? filteredCatalogAssets[0]
    ?? null
  ), [filteredCatalogAssets, selectedCatalogAssetId])
  const selectedTransition = useMemo(() => {
    if (!selectedTransitionKey) return filteredSystemTransitions[0] ? { kind: 'system' as const, entry: filteredSystemTransitions[0] } : filteredTransitionLibrary[0] ? { kind: 'user' as const, entry: filteredTransitionLibrary[0] } : null
    if (selectedTransitionKey.startsWith('system:')) {
      const id = selectedTransitionKey.slice('system:'.length)
      const entry = filteredSystemTransitions.find((transition) => transition.id === id)
      return entry ? { kind: 'system' as const, entry } : null
    }
    if (selectedTransitionKey.startsWith('user:')) {
      const id = selectedTransitionKey.slice('user:'.length)
      const entry = filteredTransitionLibrary.find((transition) => transition.id === id)
      return entry ? { kind: 'user' as const, entry } : null
    }
    return null
  }, [filteredSystemTransitions, filteredTransitionLibrary, selectedTransitionKey])
  const filteredSourcePresets = useMemo(() => {
    const query = sourceSearch.trim().toLowerCase()
    if (!query) return sourcePresets
    return sourcePresets.filter((preset) => [preset.label, preset.id, preset.pluginType].some((value) => value.toLowerCase().includes(query)))
  }, [sourcePresets, sourceSearch])
  const selectedSourcePreset = useMemo(() => (
    selectedSourcePresetId
      ? sourcePresets.find((preset) => preset.id === selectedSourcePresetId) ?? null
      : null
  ), [selectedSourcePresetId, sourcePresets])
  const editingSourcePreset = sourcePresetDraft?.preset ?? selectedSourcePreset
  const selectedSourceMeta = editingSourcePreset ? SOURCE_CATALOG.find((entry) => entry.type === editingSourcePreset.pluginType) : undefined
  const sourceDraftCreatesNewPreset = !!sourcePresetDraft && (!sourcePresetDraft.originalId || sourcePresetDraft.originalLabel?.trim() !== sourcePresetDraft.preset.label.trim())
  const selectedSourceUsageCount = selectedSourcePreset
    ? Object.values(config.scenes).reduce((count, scene) => count + getSafeSceneSources(scene).filter((source) => source.sourcePresetId === selectedSourcePreset.id).length, 0)
    : 0
  const canDeleteSourcePreset = !!sourcePresetDraft
  const pendingTransitionKind = useMemo(() => {
    const inferred = inferAssetKindFromUrl(url, 'image')
    return inferred === 'video' ? 'video' : 'image'
  }, [url])

  useEffect(() => {
    if (eventDefs.length === 0) {
      if (selectedEventId !== null) setSelectedEventId(null)
      if (eventDraft !== null) setEventDraft(null)
      return
    }
    if (selectedEventId && !eventDefs.some((def) => def.id === selectedEventId)) {
      setSelectedEventId(null)
      if (eventDraft?.originalId === selectedEventId) {
        setEventDraft(null)
      }
    }
  }, [eventDefs, eventDraft, selectedEventId])

  useEffect(() => {
    if (filteredSourcePresets.length === 0) {
      if (selectedSourcePresetId !== null) setSelectedSourcePresetId(null)
      return
    }
    if (sourcePresetDraft && !sourcePresetDraft.originalId) return
    if (!selectedSourcePresetId || !filteredSourcePresets.some((preset) => preset.id === selectedSourcePresetId)) {
      setSelectedSourcePresetId(filteredSourcePresets[0].id)
    }
  }, [filteredSourcePresets, selectedSourcePresetId, sourcePresetDraft])

  useEffect(() => {
    if (!selectedSourcePresetId) return
    const preset = sourcePresets.find((entry) => entry.id === selectedSourcePresetId)
    if (!preset) return
    if (sourcePresetDraft?.originalId === preset.id) return
    setSourcePresetDraft({
      preset: {
        ...preset,
        config: { ...preset.config },
        defaultPosition: preset.defaultPosition ? { ...preset.defaultPosition } : undefined,
      },
      originalId: preset.id,
      originalLabel: preset.label,
    })
  }, [selectedSourcePresetId, sourcePresets, sourcePresetDraft?.originalId])

  useEffect(() => {
    if (filteredCatalogAssets.length === 0) {
      if (selectedCatalogAssetId !== null) setSelectedCatalogAssetId(null)
      return
    }
    if (!selectedCatalogAssetId || !filteredCatalogAssets.some((asset) => asset.id === selectedCatalogAssetId)) {
      setSelectedCatalogAssetId(filteredCatalogAssets[0].id)
    }
  }, [filteredCatalogAssets, selectedCatalogAssetId])

  useEffect(() => {
    const options = [
      ...filteredSystemTransitions.map((transition) => `system:${transition.id}`),
      ...filteredTransitionLibrary.map((transition) => `user:${transition.id}`),
    ]
    if (options.length === 0) {
      if (selectedTransitionKey !== null) setSelectedTransitionKey(null)
      return
    }
    if (!selectedTransitionKey || !options.includes(selectedTransitionKey)) {
      setSelectedTransitionKey(options[0])
    }
  }, [filteredSystemTransitions, filteredTransitionLibrary, selectedTransitionKey])

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

  const saveSourcePresets = (nextSourcePresets: SourcePreset[], nextScenes = config.scenes) => {
    void saveConfig({ sourcePresets: nextSourcePresets, scenes: nextScenes })
  }

  const removeSourcePreset = (presetId: string) => {
    const nextSourcePresets = sourcePresets.filter((preset) => preset.id !== presetId)
    const nextScenes = Object.fromEntries(Object.entries(config.scenes).map(([sceneId, scene]) => [
      sceneId,
      {
        ...scene,
        sources: getSafeSceneSources(scene).filter((source) => source.sourcePresetId !== presetId),
      },
    ])) as typeof config.scenes
    saveSourcePresets(nextSourcePresets, nextScenes)
    if (selectedSourcePresetId === presetId) setSelectedSourcePresetId(nextSourcePresets[0]?.id ?? null)
  }

  const createSourcePresetDraft = (entry: CatalogEntry) => {
    const defaultPosition: { x: number; y: number; width: number; height: number } = entry.defaultPosition ?? { x: 0, y: 0, width: 1920, height: 1080 }
    const newPreset: SourcePreset = {
      id: `${entry.type}-${Date.now()}`,
      label: entry.label,
      pluginType: entry.type,
      config: { ...entry.defaultConfig },
      defaultPosition: {
        x: defaultPosition.x,
        y: defaultPosition.y,
        width: defaultPosition.width,
        height: defaultPosition.height,
      },
    }
    setSourcePresetDraft({
      preset: newPreset,
      originalId: null,
      originalLabel: null,
    })
    setSelectedSourcePresetId(null)
    setTab('sources')
  }

  const patchSourcePresetDraft = (updates: Partial<SourcePreset>) => {
    setSourcePresetDraft((current) => {
      if (!current) return current
      return {
        ...current,
        preset: {
          ...current.preset,
          ...updates,
        },
      }
    })
  }

  const selectSourcePreset = (presetId: string) => {
    setSelectedSourcePresetId(presetId)
  }

  const saveSourcePresetDraft = () => {
    if (!sourcePresetDraft) return
    const label = sourcePresetDraft.preset.label.trim() || SOURCE_CATALOG.find((entry) => entry.type === sourcePresetDraft.preset.pluginType)?.label || 'Untitled preset'
    const normalizedPreset: SourcePreset = {
      ...sourcePresetDraft.preset,
      label,
      config: { ...sourcePresetDraft.preset.config },
      defaultPosition: {
        x: sourcePresetDraft.preset.defaultPosition?.x ?? 0,
        y: sourcePresetDraft.preset.defaultPosition?.y ?? 0,
        width: sourcePresetDraft.preset.defaultPosition?.width ?? 1920,
        height: sourcePresetDraft.preset.defaultPosition?.height ?? 1080,
      },
    }

    if (sourcePresetDraft.originalId && sourcePresetDraft.originalLabel?.trim() === label) {
      const nextSourcePresets = sourcePresets.map((preset) => preset.id === sourcePresetDraft.originalId ? { ...normalizedPreset, id: sourcePresetDraft.originalId } : preset)
      saveSourcePresets(nextSourcePresets)
      setSelectedSourcePresetId(sourcePresetDraft.originalId)
      setSourcePresetDraft({
        preset: { ...normalizedPreset, id: sourcePresetDraft.originalId },
        originalId: sourcePresetDraft.originalId,
        originalLabel: label,
      })
      return
    }

    const savedPreset = {
      ...normalizedPreset,
      id: `${normalizedPreset.pluginType}-${Date.now()}`,
    }
    saveSourcePresets([...sourcePresets, savedPreset])
    setSelectedSourcePresetId(savedPreset.id)
    setSourcePresetDraft({
      preset: savedPreset,
      originalId: savedPreset.id,
      originalLabel: savedPreset.label,
    })
  }

  const deleteSourcePresetDraft = () => {
    if (!sourcePresetDraft) return
    if (!sourcePresetDraft.originalId) {
      setSourcePresetDraft(null)
      return
    }
    removeSourcePreset(sourcePresetDraft.originalId)
    setSourcePresetDraft(null)
  }

  const handleDeleteCatalogAsset = async (asset: AssetRecord) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${asset.name}?`)) return
    if (asset.source === 'saved') {
      await handleDeleteMediaEntry(asset.id)
      return
    }
    if (asset.source === 'filesystem') {
      await deleteAssetFile(asset.url)
      await refreshCatalog()
    }
  }

  const createEventDraft = (presetId: EventPresetId = 'blank') => {
    const def = createEventPreset(presetId, {
      widgetIds,
      layoutId: widgetLayouts[0]?.id,
    })
    setTab('events')
    setEventDraft({
      event: def,
      originalId: null,
    })
    setSelectedEventId(null)
  }

  const patchEventDraft = (updated: EventDef) => {
    setEventDraft((current) => current ? { ...current, event: updated } : current)
  }

  const saveEventDraft = () => {
    if (!eventDraft) return
    const normalizedEvent: EventDef = {
      ...eventDraft.event,
      label: eventDraft.event.label.trim() || 'New Event',
      icon: eventDraft.event.icon || '⚡',
      desc: eventDraft.event.desc ?? '',
      actions: structuredClone(eventDraft.event.actions ?? []),
      effects: structuredClone(eventDraft.event.effects ?? []),
      auto: { ...eventDraft.event.auto },
    }

    if (eventDraft.originalId) {
      const nextEvents = eventDefs.map((entry) => entry.id === eventDraft.originalId ? { ...normalizedEvent, id: eventDraft.originalId } : entry)
      void saveConfig({ events: nextEvents })
      setSelectedEventId(eventDraft.originalId)
      setEventDraft({ event: { ...normalizedEvent, id: eventDraft.originalId }, originalId: eventDraft.originalId })
      return
    }

    void saveConfig({ events: [...eventDefs, normalizedEvent] })
    setSelectedEventId(normalizedEvent.id)
    setEventDraft({ event: normalizedEvent, originalId: normalizedEvent.id })
  }

  const deleteEventDraft = () => {
    if (!eventDraft) return
    if (!eventDraft.originalId) {
      setEventDraft(null)
      return
    }
    const id = eventDraft.originalId
    const nextEvents = eventDefs.filter((entry) => entry.id !== id)
    if (selectedEventId === id) {
      setSelectedEventId(null)
    }
    void saveConfig({ events: nextEvents })
    setEventDraft(null)
  }

  const selectEvent = (eventId: string) => {
    const eventDef = eventDefs.find((entry) => entry.id === eventId)
    if (!eventDef) return
    setEventDraft({
      event: structuredClone(eventDef),
      originalId: eventDef.id,
    })
    setSelectedEventId(eventId)
  }

  const handleTriggerEvent = (def: EventDef) => {
    socket.emit('event:preview', def)
  }

  const assetLibraryTabs = [
    { id: 'catalog', label: 'Catalog', icon: '🗂', meta: 'Assets and saved media' },
    { id: 'events', label: 'Events', icon: '⚡', meta: `${eventDefs.length} configured` },
    { id: 'sources', label: 'Sources', icon: '📺', meta: `${sourcePresets.length} configured` },
    { id: 'transitions', label: 'Transitions', icon: '✨', meta: `${sortedTransitionLibrary.length} saved` },
  ] as const

  return (
    <AssetLibraryModal
      isOpen={true}
      onClose={onClose}
      tabs={assetLibraryTabs}
      activeTab={tab}
      onTabChange={(nextTab) => setTab(nextTab as typeof tab)}
      sidebarChildren={(
        <>

              {tab === 'catalog' && (
                <>
                  <div className="space-y-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Search</div>
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(event) => setCatalogSearch(event.target.value)}
                      placeholder="Search assets, folders, or game names"
                      className="w-full text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Type Filter</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(['all', 'image', 'video', 'audio'] as const).map((kind) => (
                        <Btn
                          key={kind}
                          type="button"
                          variant={catalogKindFilter === kind ? 'active' : 'default'}
                          onClick={() => setCatalogKindFilter(kind)}
                          className="px-2.5 py-1 text-[10px] uppercase tracking-wide"
                        >
                          {kind}
                        </Btn>
                      ))}
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                    {catalogError && <ConfigNotice tone="danger">{catalogError}</ConfigNotice>}
                    {catalogLoading && <ConfigNotice tone="info">Loading asset catalog...</ConfigNotice>}
                    {!catalogLoading && catalogFolderGroups.length === 0 && (
                      <ConfigNotice tone="info">No assets match this filter.</ConfigNotice>
                    )}
                    {catalogFolderGroups.map((group) => (
                      <div key={group.folder} className="space-y-1.5">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{group.folder}</div>
                        <div className="space-y-1">
                          {group.items.map((asset) => {
                            const active = selectedCatalogAsset?.id === asset.id
                            return (
                              <button
                                key={asset.id}
                                type="button"
                                onClick={() => setSelectedCatalogAssetId(asset.id)}
                                className={
                                  'w-full rounded-lg border px-3 py-2 text-left transition-colors ' +
                                  (active
                                    ? 'border-cyan-400/35 bg-cyan-500/12 text-zinc-100'
                                    : 'border-zinc-800/80 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700/80 hover:text-zinc-200')
                                }
                              >
                                <div className="truncate text-[12px] font-medium">{asset.name}</div>
                                <div className="truncate text-[10px] text-zinc-500">{asset.relativePath || asset.url}</div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {tab === 'events' && (
                <>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Search</div>
                    <div className="mt-1 text-xs text-zinc-500">Find events by label, description, or id.</div>
                  </div>
                  <input
                    type="text"
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    placeholder="Search events"
                    className="w-full text-sm"
                  />
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {filteredEventDefs.length ? filteredEventDefs.map((def) => {
                      const active = def.id === selectedEventId
                      return (
                        <button
                          key={def.id}
                          type="button"
                          onClick={() => selectEvent(def.id)}
                          className={'w-full rounded-xl border px-3 py-3 text-left transition-colors ' + (
                            active
                              ? 'border-cyan-400/35 bg-cyan-500/12 text-zinc-100'
                              : 'border-zinc-800/80 bg-zinc-950/55 text-zinc-400 hover:border-zinc-700/80 hover:text-zinc-200'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm leading-none">{def.icon}</span>
                            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{def.label}</span>
                            {def.auto.enabled && <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-300">Auto</span>}
                          </div>
                          <div className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-zinc-500">{def.desc || describeEventSetup(def)}</div>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] uppercase tracking-[0.12em] text-zinc-500">
                            <span>{def.actions?.length ?? 0} actions</span>
                            <span>{def.effects.length} fx</span>
                          </div>
                        </button>
                      )
                    }) : (
                      <ConfigNotice tone="info">No events match this filter.</ConfigNotice>
                    )}
                  </div>
                </>
              )}

              {tab === 'sources' && (
                <>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Source Presets</div>
                    <div className="mt-1 text-xs text-zinc-500">Create reusable source configurations here, then attach them from each scene.</div>
                  </div>
                  <input
                    type="text"
                    value={sourceSearch}
                    onChange={(event) => setSourceSearch(event.target.value)}
                    placeholder="Search source presets"
                    className="w-full text-sm"
                  />
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {filteredSourcePresets.length ? filteredSourcePresets.map((preset) => {
                      const active = preset.id === selectedSourcePresetId
                      const meta = SOURCE_CATALOG.find((entry) => entry.type === preset.pluginType)
                      const usageCount = Object.values(config.scenes).reduce((count, scene) => count + getSafeSceneSources(scene).filter((source) => source.sourcePresetId === preset.id).length, 0)
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => selectSourcePreset(preset.id)}
                          className={
                            'w-full rounded-lg border px-3 py-2 text-left transition-colors ' +
                            (active
                              ? 'border-cyan-400/35 bg-cyan-500/12 text-zinc-100'
                              : 'border-zinc-800/80 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700/80 hover:text-zinc-200')
                          }
                        >
                          <div className="flex items-center gap-2">
                            <span>{meta?.icon ?? '▣'}</span>
                            <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{preset.label}</span>
                          </div>
                          <div className="mt-1 truncate text-[10px] text-zinc-500">{meta?.label ?? preset.pluginType}</div>
                          <div className="mt-1 truncate text-[10px] text-zinc-600">{usageCount} scene attachment{usageCount === 1 ? '' : 's'}</div>
                        </button>
                      )
                    }) : (
                      <ConfigNotice tone="info">No source presets match this filter.</ConfigNotice>
                    )}
                  </div>
                </>
              )}

              {tab === 'transitions' && (
                <>
                  <div className="space-y-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Search</div>
                    <input
                      type="text"
                      value={transitionSearch}
                      onChange={(event) => setTransitionSearch(event.target.value)}
                      placeholder="Search transitions by name or id"
                      className="w-full text-sm"
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <ConfigCard className="text-left p-3">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">System</div>
                      <div className="mt-1 text-lg font-semibold text-zinc-100">{filteredSystemTransitions.length}</div>
                    </ConfigCard>
                    <ConfigCard className="text-left p-3">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Saved</div>
                      <div className="mt-1 text-lg font-semibold text-zinc-100">{filteredTransitionLibrary.length}</div>
                    </ConfigCard>
                  </div>

                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">System Transitions</div>
                      {filteredSystemTransitions.length ? filteredSystemTransitions.map((transition) => {
                        const active = selectedTransition?.kind === 'system' && selectedTransition.entry.id === transition.id
                        return (
                          <button
                            key={transition.id}
                            type="button"
                            onClick={() => setSelectedTransitionKey(`system:${transition.id}`)}
                            className={
                              'w-full rounded-lg border px-3 py-2 text-left transition-colors ' +
                              (active
                                ? 'border-cyan-400/35 bg-cyan-500/12 text-zinc-100'
                                : 'border-zinc-800/80 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700/80 hover:text-zinc-200')
                            }
                          >
                            <div className="flex items-center gap-2">
                              <span>{TRANSITION_ICONS[transition.id]}</span>
                              <span className="truncate text-[12px] font-medium">{transition.label}</span>
                            </div>
                            <div className="truncate text-[10px] text-zinc-500">{transition.id}</div>
                          </button>
                        )
                      }) : <ConfigNotice tone="info">No system transitions match this filter.</ConfigNotice>}
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">User Transitions</div>
                      {filteredTransitionLibrary.length ? filteredTransitionLibrary.map((entry) => {
                        const active = selectedTransition?.kind === 'user' && selectedTransition.entry.id === entry.id
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => setSelectedTransitionKey(`user:${entry.id}`)}
                            className={
                              'w-full rounded-lg border px-3 py-2 text-left transition-colors ' +
                              (active
                                ? 'border-cyan-400/35 bg-cyan-500/12 text-zinc-100'
                                : 'border-zinc-800/80 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700/80 hover:text-zinc-200')
                            }
                          >
                            <div className="truncate text-[12px] font-medium">{getMediaTransitionLabel(entry)}</div>
                            <div className="truncate text-[10px] text-zinc-500">{entry.url}</div>
                          </button>
                        )
                      }) : <ConfigNotice tone="info">No user transitions match this filter.</ConfigNotice>}
                    </div>
                  </div>
                </>
              )}
        </>
      )}
      contentChildren={(
        <>
            {tab === 'catalog' && (
              <div className="space-y-4">
                {selectedCatalogAsset ? (
                  <>
                    <ConfigCard className="space-y-4 p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="text-lg font-semibold text-zinc-100">{selectedCatalogAsset.name}</div>
                          <div className="mt-1 text-xs font-mono text-zinc-500">{selectedCatalogAsset.relativePath || selectedCatalogAsset.url}</div>
                        </div>
                        <div className="flex gap-2">
                          <Btn type="button" onClick={() => void refreshCatalog()} className="px-3 py-1.5 text-xs">Refresh</Btn>
                          {(selectedCatalogAsset.source === 'saved' || selectedCatalogAsset.source === 'filesystem') && (
                            <Btn type="button" variant="danger" onClick={() => { void handleDeleteCatalogAsset(selectedCatalogAsset) }} className="px-3 py-1.5 text-xs">
                              Delete
                            </Btn>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_320px]">
                        <div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-4">
                          {selectedCatalogAsset.kind === 'image' && (
                            <img src={selectedCatalogAsset.url} alt={selectedCatalogAsset.name} className="max-h-[70vh] w-full object-contain" />
                          )}
                          {selectedCatalogAsset.kind === 'video' && (
                            <video src={selectedCatalogAsset.url} className="max-h-[70vh] w-full rounded-xl bg-black object-contain" controls muted playsInline preload="metadata" />
                          )}
                          {selectedCatalogAsset.kind === 'audio' && (
                            <div className="w-full max-w-xl space-y-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-6 text-center">
                              <div className="text-5xl">🎵</div>
                              <div className="text-sm text-zinc-400">Audio preview</div>
                              <audio src={selectedCatalogAsset.url} controls className="w-full" preload="metadata" />
                            </div>
                          )}
                        </div>
                        <ConfigCard className="space-y-3 p-4">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Folder</div>
                            <div className="mt-1 text-sm text-zinc-100">{selectedCatalogAsset.folder}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Source</div>
                            <div className="mt-1 text-sm text-zinc-100">{selectedCatalogAsset.source}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Kind</div>
                            <div className="mt-1 text-sm text-zinc-100">{selectedCatalogAsset.kind}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">URL</div>
                            <div className="mt-1 break-all text-xs font-mono text-zinc-400">{selectedCatalogAsset.url}</div>
                          </div>
                        </ConfigCard>
                      </div>
                    </ConfigCard>
                  </>
                ) : (
                  <ConfigNotice tone="info" className="py-8 text-center">Select an asset from the left column to preview it.</ConfigNotice>
                )}
              </div>
            )}

            {tab === 'events' && (
              <div className="flex min-h-0 flex-col gap-4">
                <ConfigCard className="space-y-4 p-5 sm:p-6">
                  <div className="space-y-3 rounded-2xl border border-dashed border-cyan-500/25 bg-cyan-500/5 px-4 py-4">
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">Add Event Type</div>
                      <div className="text-xs text-zinc-500">Pick an event type to open a new event draft below.</div>
                    </div>
                    <Btn type="button" variant="ghost" onClick={() => createEventDraft('blank')} className="w-full justify-center border-zinc-700/80 py-2 text-sm">
                      Blank Event
                    </Btn>
                    <div className="grid gap-2 lg:grid-cols-2">
                      {filteredEventPresets.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => createEventDraft(preset.id)}
                          className="w-full rounded-lg border border-zinc-800/80 bg-zinc-950/55 px-3 py-3 text-left transition-colors hover:border-zinc-700/80 hover:bg-zinc-900/75"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{preset.icon}</span>
                            <span className="text-[12px] font-medium text-zinc-100">{preset.label}</span>
                          </div>
                          <div className="mt-1 text-[10px] leading-relaxed text-zinc-500">{preset.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </ConfigCard>

                {editingEvent ? (
                  <ConfigCard className="space-y-4 p-5 sm:p-6">
                    <div className="space-y-3 border-b border-zinc-800/80 pb-5">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Event Summary</div>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <ConfigCard className="text-left p-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Event Id</div>
                          <div className="mt-1 text-sm font-semibold text-zinc-100">{eventDraft?.originalId ?? 'Draft until saved'}</div>
                        </ConfigCard>
                        <ConfigCard className="text-left p-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Setup</div>
                          <div className="mt-1 text-sm font-semibold text-zinc-100">{describeEventSetup(editingEvent)}</div>
                        </ConfigCard>
                        <ConfigCard className="text-left p-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Runtime Actions</div>
                          <div className="mt-1 text-sm font-semibold text-zinc-100">{editingEvent.actions?.length ?? 0}</div>
                        </ConfigCard>
                        <ConfigCard className="text-left p-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Overlay Effects</div>
                          <div className="mt-1 text-sm font-semibold text-zinc-100">{editingEvent.effects.length}</div>
                        </ConfigCard>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">Event Details</div>
                      <div className="text-sm text-zinc-400">Adjust the selected draft or saved event below, then save when ready.</div>
                    </div>

                    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/45 px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Configure Event</div>
                      <div className="mt-1 text-sm text-zinc-400">Create or refine event identity, trigger rules, runtime actions, and overlay effects.</div>
                    </div>

                    <div className="flex items-center justify-between gap-3 px-0.5">
                      <div className="text-sm text-zinc-500">{editingEventCreatesNew ? 'Editing new event draft' : `Editing ${editingEvent.label}`}</div>
                      <div className="flex flex-wrap gap-2">
                        <Btn type="button" variant="primary" onClick={saveEventDraft} className={DASHBOARD_SAVE_BUTTON_CLASS}>
                          {editingEventCreatesNew ? 'Save Event' : 'Update Event'}
                        </Btn>
                        {!editingEventCreatesNew && (
                          <Btn type="button" variant="primary" onClick={() => handleTriggerEvent(editingEvent)} className="px-4 py-2 text-sm">
                            Test Draft
                          </Btn>
                        )}
                        <Btn type="button" variant="danger" onClick={deleteEventDraft} className="px-4 py-2 text-sm">
                          {editingEventCreatesNew ? 'Delete Draft' : 'Delete Event'}
                        </Btn>
                      </div>
                    </div>

                    <EventForm
                      def={editingEvent}
                      onUpdate={patchEventDraft}
                      showOverview={false}
                      showDeleteButton={false}
                    />
                  </ConfigCard>
                ) : (
                  <ConfigNotice tone="info" className="py-8 text-center">
                    Select an event from the left column or choose an event type above to start a new draft.
                  </ConfigNotice>
                )}
              </div>
            )}

            {tab === 'sources' && (
              <div className="flex min-h-0 flex-col gap-4 pt-0.5">
                {editingSourcePreset && selectedSourceMeta ? (
                  <>
                    <ConfigCard className="space-y-4 p-5 sm:p-6">
                      <div className="space-y-3 rounded-2xl border border-dashed border-cyan-500/25 bg-cyan-500/5 px-4 py-4">
                        <div className="space-y-1">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">Add Source Type</div>
                          <div className="text-xs text-zinc-500">Pick a source type to open a new preset draft below.</div>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {SOURCE_CATALOG.map((entry) => (
                            <button
                              key={entry.type}
                              type="button"
                              onClick={() => createSourcePresetDraft(entry)}
                              className="w-full rounded-lg border border-zinc-800/80 bg-zinc-950/55 px-3 py-3 text-left transition-colors hover:border-zinc-700/80 hover:bg-zinc-900/75"
                            >
                              <div className="flex items-center gap-2">
                                <span>{entry.icon}</span>
                                <span className="text-[12px] font-medium text-zinc-100">{entry.label}</span>
                              </div>
                              <div className="mt-1 text-[10px] text-zinc-500">{entry.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </ConfigCard>

                    <ConfigCard className="space-y-4 p-5 sm:p-6">
                      <div className="space-y-3 border-b border-zinc-800/80 pb-5">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Preset Summary</div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <ConfigCard className="text-left p-3">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Preset Id</div>
                            <div className="mt-1 text-sm font-semibold text-zinc-100">{sourcePresetDraft?.originalId ?? 'Draft until saved'}</div>
                          </ConfigCard>
                          <ConfigCard className="text-left p-3">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Type</div>
                            <div className="mt-1 text-sm font-semibold text-zinc-100">{selectedSourceMeta.label}</div>
                          </ConfigCard>
                          <ConfigCard className="text-left p-3">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Used In Scenes</div>
                            <div className="mt-1 text-sm font-semibold text-zinc-100">{selectedSourceUsageCount}</div>
                          </ConfigCard>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">Preset Details</div>
                        <div className="text-sm text-zinc-400">Review the selected draft details and configure the preset below.</div>
                      </div>

                      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/45 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Configure Preset</div>
                        <div className="mt-1 text-sm text-zinc-400">Adjust the selected draft or saved preset below, then save when ready.</div>
                      </div>

                      <div className="grid gap-4 grid-cols-[280px_minmax(0,1fr)] items-start">
                      <div className="space-y-0 sticky top-0">
                        <ConfigSectionPanel label="Identity" first>
                          <div className="space-y-3">
                            <div>
                              <div className="mb-1 text-[10px] text-zinc-500">Label</div>
                              <input
                                type="text"
                                value={editingSourcePreset.label}
                                onChange={(event) => patchSourcePresetDraft({ label: event.target.value })}
                                className="w-full text-sm"
                              />
                            </div>
                            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-3 py-2 text-[11px] leading-relaxed text-zinc-500">
                              {sourceDraftCreatesNewPreset
                                ? 'Saving will create a new preset because this label differs from the saved source.'
                                : 'Saving will update the currently selected preset.'}
                            </div>
                          </div>
                        </ConfigSectionPanel>
                        <ConfigSectionPanel label="Source Settings">
                          <div className="space-y-3">
                            {selectedSourceMeta.fields.map((field) => (
                              <SourceField
                                key={field.key}
                                field={field}
                                value={editingSourcePreset.config[field.key]}
                                onChange={(value) => patchSourcePresetDraft({
                                  config: { ...editingSourcePreset.config, [field.key]: value },
                                })}
                              />
                            ))}
                          </div>
                        </ConfigSectionPanel>
                      </div>

                      <div className="space-y-0">
                        <ConfigSectionPanel label="Default Position" first>
                          <div className="grid grid-cols-4 gap-2">
                            {(['x', 'y', 'width', 'height'] as const).map((field) => (
                              <div key={field}>
                                <div className="mb-1 text-[10px] text-zinc-500 uppercase tracking-[0.14em]">{field}</div>
                                <input
                                  type="number"
                                  value={editingSourcePreset.defaultPosition?.[field] ?? (field === 'width' ? 1920 : field === 'height' ? 1080 : 0)}
                                  onChange={(event) => patchSourcePresetDraft({
                                    defaultPosition: {
                                      ...(editingSourcePreset.defaultPosition ?? { x: 0, y: 0, width: 1920, height: 1080 }),
                                      [field]: Number(event.target.value),
                                    },
                                  })}
                                  className="w-full font-mono text-xs"
                                />
                              </div>
                            ))}
                          </div>
                        </ConfigSectionPanel>

                        <ConfigSectionPanel label="Actions">
                          <div className="flex flex-wrap gap-2">
                            <Btn type="button" variant="primary" onClick={saveSourcePresetDraft} className={DASHBOARD_SAVE_BUTTON_CLASS}>
                              {sourceDraftCreatesNewPreset ? 'Save as New Preset' : 'Save Preset'}
                            </Btn>
                            {canDeleteSourcePreset && (
                              <Btn type="button" variant="danger" onClick={deleteSourcePresetDraft} className="px-4 py-2 text-sm">
                                {sourcePresetDraft?.originalId ? 'Delete Preset' : 'Delete Draft'}
                              </Btn>
                            )}
                          </div>
                        </ConfigSectionPanel>

                        <ConfigSectionPanel label="Scene Usage">
                          <div className="space-y-2 text-sm text-zinc-400">
                            <div>This preset can now be attached from each scene's Sources section.</div>
                            <div>Scenes only control visibility, stacking, and position. Plugin configuration lives here.</div>
                          </div>
                        </ConfigSectionPanel>

                        <ConfigSectionPanel label="Preview">
                          <SourcePresetPreview
                            preset={editingSourcePreset}
                            meta={selectedSourceMeta}
                            onPositionChange={({ x, y }) => patchSourcePresetDraft({
                              defaultPosition: {
                                ...(editingSourcePreset.defaultPosition ?? { x: 0, y: 0, width: 1920, height: 1080 }),
                                x,
                                y,
                              },
                            })}
                          />
                        </ConfigSectionPanel>
                      </div>
                    </div>
                    </ConfigCard>
                  </>
                ) : (
                  <div className="space-y-4">
                    <ConfigCard className="space-y-4 p-5 sm:p-6">
                      <div className="space-y-3 rounded-2xl border border-dashed border-cyan-500/25 bg-cyan-500/5 px-4 py-4">
                        <div className="space-y-1">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">Add Source Type</div>
                          <div className="text-xs text-zinc-500">Choose a source type to start a new preset draft.</div>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {SOURCE_CATALOG.map((entry) => (
                            <button
                              key={entry.type}
                              type="button"
                              onClick={() => createSourcePresetDraft(entry)}
                              className="w-full rounded-lg border border-zinc-800/80 bg-zinc-950/55 px-3 py-3 text-left transition-colors hover:border-zinc-700/80 hover:bg-zinc-900/75"
                            >
                              <div className="flex items-center gap-2">
                                <span>{entry.icon}</span>
                                <span className="text-[12px] font-medium text-zinc-100">{entry.label}</span>
                              </div>
                              <div className="mt-1 text-[10px] text-zinc-500">{entry.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </ConfigCard>
                    <ConfigNotice tone="info" className="py-8 text-center">Select a source preset from the left column to configure it.</ConfigNotice>
                  </div>
                )}
              </div>
            )}

            {tab === 'transitions' && (
              <div className="space-y-4 pt-0.5">
                {selectedTransition ? (
                  <ConfigCard className="space-y-4 p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-lg font-semibold text-zinc-100">
                          {selectedTransition.kind === 'system' ? selectedTransition.entry.label : getMediaTransitionLabel(selectedTransition.entry)}
                        </div>
                        <div className="mt-1 text-xs font-mono text-zinc-500">
                          {selectedTransition.kind === 'system' ? selectedTransition.entry.id : selectedTransition.entry.url}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Btn
                          type="button"
                          onClick={() => selectedTransition.kind === 'system'
                            ? socket.emit('transition:preview', [{ id: selectedTransition.entry.id }])
                            : socket.emit('transition:preview', [strToStep(encodeMediaTransitionValue(selectedTransition.entry))])}
                          className="px-4 py-2 text-sm"
                        >
                          Test Transition
                        </Btn>
                        {selectedTransition.kind === 'user' && (
                          <Btn
                            type="button"
                            variant="danger"
                            onClick={() => { void handleDeleteMediaEntry(selectedTransition.entry.id) }}
                            className="px-4 py-2 text-sm"
                          >
                            Delete
                          </Btn>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <ConfigCard className="text-left p-3">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Type</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-100">{selectedTransition.kind === 'system' ? 'System' : selectedTransition.entry.type}</div>
                      </ConfigCard>
                      <ConfigCard className="text-left p-3">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Origin</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-100">{selectedTransition.kind === 'system' ? 'Built-in transition' : 'Saved media entry'}</div>
                      </ConfigCard>
                      <ConfigCard className="text-left p-3">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Duration</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-100">{selectedTransition.kind === 'user' && selectedTransition.entry.duration != null ? `${selectedTransition.entry.duration}s` : 'Default'}</div>
                      </ConfigCard>
                    </div>
                  </ConfigCard>
                ) : (
                  <ConfigNotice tone="info" className="py-6 text-center">Select a transition from the left column.</ConfigNotice>
                )}

                <ConfigSectionPanel label="Create User Transition">
                  <div className="space-y-3">
                    <ConfigNotice>
                      Save an image or video as a reusable user transition.
                    </ConfigNotice>

                    <ConfigCard className="space-y-3 p-4">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Name (optional)"
                        className="w-full text-sm"
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
                            className="w-28 text-sm font-mono"
                          />
                          <span className="text-xs text-zinc-600">sec display duration</span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Btn
                          type="button"
                          variant="primary"
                          onClick={() => void handleSave()}
                          disabled={!url}
                          className={`flex-1 ${DASHBOARD_SAVE_BUTTON_CLASS}`}
                        >
                          Save Transition
                        </Btn>
                        {(name || url || durStr) && (
                          <Btn
                            type="button"
                            onClick={resetForm}
                            className="px-4 text-sm"
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
        </>
      )}
    />
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

  if (selected.kind === 'default-styling') {
    return (
      <div className="space-y-5">
        <EnvironmentLiveNotice targetState={STATE.DESKTOP} label="Global Theme" />
        <DefaultStylingEditor />
      </div>
    )
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
  } else if (selected.kind === 'default-styling') {
    headerIcon = '🎨'
    headerLabel = 'Global Theme'
    headerMeta = 'Utility'
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
        <RightPaneErrorBoundary>
          <RightPaneContent selected={selected} onDeleted={onClose} onSelectItem={onSelectItem} />
        </RightPaneErrorBoundary>
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
      <SidebarBtn icon="🎨" label="Global Theme" active={isActive({ kind: 'default-styling' })} onClick={() => onSelect({ kind: 'default-styling' })} />
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
  const clientCount  = useAdminStore((s) => s.clientCount)
  const lastError    = useAdminStore((s) => s.lastError)
  const ambiance = useAdminStore((s) => s.runtimeDiagnostics.ambiance)
  const overlayClientBadges = useMemo(() => {
    return ambiance.overlayClients.map((client) => ({
      key: client.socketId,
      shortId: client.socketId.slice(0, 8),
      text: `${client.port ?? '???'} ${client.kind === 'embedded-preview' ? 'preview' : client.kind === 'runtime' ? 'obs' : client.kind}`,
      title: `${client.label} · ${client.socketId}`,
    }))
  }, [ambiance.overlayClients])

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
      {overlayClientBadges.length === 0 ? (
        <span className="rounded-full border border-zinc-700/80 bg-zinc-900/80 px-2.5 py-0.5 text-[10px] font-mono text-zinc-500">
          No overlay clients
        </span>
      ) : overlayClientBadges.map((client) => (
        <span key={client.key} className="rounded-full border border-zinc-700/80 bg-zinc-900/80 px-2.5 py-0.5 text-[10px] font-mono text-zinc-300" title={client.title}>
          {client.text} {client.shortId}
        </span>
      ))}
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
  const [libraryMounted, setLibraryMounted] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab,  setSettingsTab]  = useState<SettingsTab>('general')
  const libraryRestoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  const clearLibraryRestoreTimeout = () => {
    if (libraryRestoreTimeoutRef.current) {
      clearTimeout(libraryRestoreTimeoutRef.current)
      libraryRestoreTimeoutRef.current = null
    }
  }

  const handleLibraryToggle = () => {
    clearLibraryRestoreTimeout()

    if (libraryOpen) {
      setLibraryOpen(false)
      setLibraryMounted(false)
      return
    }

    setLibraryMounted(true)
    setLibraryOpen(true)
  }

  const handleLibraryHide = () => {
    clearLibraryRestoreTimeout()
    setLibraryOpen(false)
    libraryRestoreTimeoutRef.current = setTimeout(() => {
      setLibraryMounted(true)
      setLibraryOpen(true)
      libraryRestoreTimeoutRef.current = null
    }, 3000)
  }

  const handleLibraryClose = () => {
    clearLibraryRestoreTimeout()
    setLibraryOpen(false)
    setLibraryMounted(false)
  }

  useEffect(() => () => {
    clearLibraryRestoreTimeout()
  }, [])

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
          onLibrary={handleLibraryToggle}
          settingsOpen={settingsOpen}
          onSettings={handleSettingsToggle}
        />
        <LivePreview />
        <RightPane selected={selected} onClose={() => setSelected(null)} onSelectItem={setSelected} />
      </div>
      {libraryMounted && <ExtractedAssetLibraryPanel isOpen={libraryOpen} onHide={handleLibraryHide} onClose={handleLibraryClose} />}
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



