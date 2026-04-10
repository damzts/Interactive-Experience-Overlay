import {
  DEFAULT_CONFIG,
  getDefaultWidgetWindowSize,
  getDefaultWidgetZIndex,
  getWidgetComponent,
  withDesktopConfigDefaults,
} from '@ieom/shared'
import type {
  Application,
  ApplicationDefaultSnapshot,
  DesktopConfig,
  Scene,
  SceneDefaultSnapshot,
  WidgetComponentType,
  WidgetLayoutDefinition,
  WidgetLayoutItem,
  WidgetLayoutSnapshot,
} from '@ieom/shared'
import { WIDGET_WIDTH_MIN, WIDGET_WIDTH_MAX, WIDGET_HEIGHT_MIN, WIDGET_HEIGHT_MAX } from './constants'

export function clone<T>(value: T): T {
  return structuredClone(value)
}

export function clampWidgetDimension(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function resolveAppWidgetComponent(app: Pick<Application, 'id' | 'appType' | 'widgetComponent'>): WidgetComponentType {
  return getWidgetComponent(app) ?? 'generic'
}

export function getDefaultWidgetSize(app: Pick<Application, 'id' | 'appType' | 'widgetComponent'>) {
  return getDefaultWidgetWindowSize(app.id, resolveAppWidgetComponent(app))
}

export function resolveWidgetSizeFromConfig(app: Pick<Application, 'id' | 'appType' | 'widgetComponent'>, desktopConfig: DesktopConfig) {
  const defaults = getDefaultWidgetSize(app)
  const raw = desktopConfig.widgetSizes?.[app.id]
  return {
    width:  clampWidgetDimension(raw?.width  ?? defaults.width,  WIDGET_WIDTH_MIN,  WIDGET_WIDTH_MAX,  defaults.width),
    height: clampWidgetDimension(raw?.height ?? defaults.height, WIDGET_HEIGHT_MIN, WIDGET_HEIGHT_MAX, defaults.height),
  }
}

export function resolveWidgetPositionFromConfig(app: Pick<Application, 'id'>, desktopConfig: DesktopConfig) {
  const raw = desktopConfig.widgetPositions?.[app.id]
  return {
    x: Math.max(0, Math.round(raw?.x ?? 0)),
    y: Math.max(0, Math.round(raw?.y ?? 0)),
  }
}

export function resolveWidgetDefaultZIndexFromConfig(app: Pick<Application, 'id' | 'appType' | 'widgetComponent'>, desktopConfig: DesktopConfig) {
  const value = desktopConfig.widgetDefaultZIndices?.[app.id]
  return Number.isFinite(value)
    ? Math.max(0, Math.round(value as number))
    : getDefaultWidgetZIndex(app.id, resolveAppWidgetComponent(app))
}

export function resolveWidgetRuntimeZIndex(app: Pick<Application, 'id' | 'appType' | 'widgetComponent'>, desktopConfig: DesktopConfig) {
  const value = desktopConfig.widgetZIndices?.[app.id]
  return Number.isFinite(value)
    ? Math.max(0, Math.round(value as number))
    : resolveWidgetDefaultZIndexFromConfig(app, desktopConfig)
}

export function resolveWidgetThemeOverrideFromConfig(app: Pick<Application, 'themeOverride'>) {
  return app.themeOverride ?? null
}

// ── Snapshot helpers ──────────────────────────────────────────────────

export function createApplicationSnapshot(source: Application, desktopConfig: DesktopConfig): ApplicationDefaultSnapshot {
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
          themeOverride: source.themeOverride ? clone(source.themeOverride) : undefined,
        }
      : undefined,
  }
}

export function buildApplicationDefaultSnapshot(app: Application, desktopConfig: DesktopConfig): ApplicationDefaultSnapshot {
  const source = DEFAULT_CONFIG.applications.find((entry) => entry.id === app.id) ?? app
  return createApplicationSnapshot(source, desktopConfig)
}

export function resolveApplicationDefaultSnapshot(app: Application): ApplicationDefaultSnapshot {
  const sourceDesktopConfig = withDesktopConfigDefaults(DEFAULT_CONFIG.desktopConfig)
  return app.defaultConfig ? clone(app.defaultConfig) : buildApplicationDefaultSnapshot(app, sourceDesktopConfig)
}

export function createSceneSnapshot(scene: Scene): SceneDefaultSnapshot {
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

export function buildSceneDefaultSnapshot(sceneId: string, scene: Scene): SceneDefaultSnapshot {
  const source = DEFAULT_CONFIG.scenes[sceneId] ?? scene
  return createSceneSnapshot(source)
}

export function resolveSceneDefaultSnapshot(sceneId: string, scene: Scene): SceneDefaultSnapshot {
  return scene.defaultConfig ? clone(scene.defaultConfig) : buildSceneDefaultSnapshot(sceneId, scene)
}

export function applyWidgetDefaultSnapshotToDesktopConfig(
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
    const width  = clampWidgetDimension(snapshotSize.width  ?? defaultSize.width,  WIDGET_WIDTH_MIN,  WIDGET_WIDTH_MAX,  defaultSize.width)
    const height = clampWidgetDimension(snapshotSize.height ?? defaultSize.height, WIDGET_HEIGHT_MIN, WIDGET_HEIGHT_MAX, defaultSize.height)
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

  nextDesktop.widgetPositions        = Object.keys(nextWidgetPositions).length        ? nextWidgetPositions        : undefined
  nextDesktop.widgetSizes            = Object.keys(nextWidgetSizes).length            ? nextWidgetSizes            : undefined
  nextDesktop.widgetDefaultZIndices  = Object.keys(nextWidgetDefaultZIndices).length  ? nextWidgetDefaultZIndices  : undefined

  return nextDesktop
}

// ── Widget layout helpers ─────────────────────────────────────────────

export function buildWidgetLayoutFallbackPosition(widgetIndex: number) {
  return {
    x: 80 + (widgetIndex % 2) * 48,
    y: 72 + widgetIndex * 28,
  }
}

export function buildWidgetLayoutItem(
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
    width:  Math.max(WIDGET_WIDTH_MIN,  Math.round(size.width)),
    height: Math.max(WIDGET_HEIGHT_MIN, Math.round(size.height)),
    focusPriority: Math.max(0, Math.round(Number.isFinite(focusPriority as number) ? (focusPriority as number) : 0)),
  }
}

export function createWidgetLayoutFromCurrentState(
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

export function createWidgetLayoutSnapshot(layout: Pick<WidgetLayoutDefinition, 'label' | 'icon' | 'description' | 'items'>): WidgetLayoutSnapshot {
  return {
    label: layout.label,
    icon: layout.icon,
    description: layout.description,
    items: layout.items.map((item) => ({ ...item })),
  }
}

export function normalizeWidgetLayoutSnapshotForEditor(
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
        width:  clampWidgetDimension(source?.width  ?? fallback.width,  WIDGET_WIDTH_MIN,  WIDGET_WIDTH_MAX,  fallback.width),
        height: clampWidgetDimension(source?.height ?? fallback.height, WIDGET_HEIGHT_MIN, WIDGET_HEIGHT_MAX, fallback.height),
        focusPriority: Number.isFinite(source?.focusPriority)
          ? Math.round(source!.focusPriority)
          : fallback.focusPriority,
      }
    }),
  }
}

export function normalizeWidgetLayoutsForEditor(
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
        width:  clampWidgetDimension(source?.width  ?? fallback.width,  WIDGET_WIDTH_MIN,  WIDGET_WIDTH_MAX,  fallback.width),
        height: clampWidgetDimension(source?.height ?? fallback.height, WIDGET_HEIGHT_MIN, WIDGET_HEIGHT_MAX, fallback.height),
        focusPriority: Number.isFinite(source?.focusPriority)
          ? Math.round(source!.focusPriority)
          : fallback.focusPriority,
      }
    }),
  }))
}

export function removeWidgetFromDesktopConfig(desktopConfig: DesktopConfig, widgetId: string): DesktopConfig {
  const next = withDesktopConfigDefaults(desktopConfig)
  const nextPositions        = { ...(next.widgetPositions ?? {}) }
  const nextSizes            = { ...(next.widgetSizes ?? {}) }
  const nextDefaultZIndices  = { ...(next.widgetDefaultZIndices ?? {}) }
  const nextRuntimeZIndices  = { ...(next.widgetZIndices ?? {}) }

  delete nextPositions[widgetId]
  delete nextSizes[widgetId]
  delete nextDefaultZIndices[widgetId]
  delete nextRuntimeZIndices[widgetId]

  return {
    ...next,
    widgetPositions:       Object.keys(nextPositions).length       ? nextPositions       : undefined,
    widgetSizes:           Object.keys(nextSizes).length           ? nextSizes           : undefined,
    widgetDefaultZIndices: Object.keys(nextDefaultZIndices).length ? nextDefaultZIndices : undefined,
    widgetZIndices:        Object.keys(nextRuntimeZIndices).length ? nextRuntimeZIndices : undefined,
    widgetLayouts: (next.widgetLayouts ?? []).map((layout) => ({
      ...layout,
      items: layout.items.filter((item) => item.widgetId !== widgetId),
    })),
  }
}

// ── User widget creation helpers ──────────────────────────────────────

export type UserWidgetBaseComponent = 'camera' | 'source'

export function buildUserWidgetId(
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

export function findFirstSceneSource(scenes: Record<string, Scene>) {
  for (const scene of Object.values(scenes)) {
    const sources = scene.sources ?? []
    const firstSource = sources[0]
    if (firstSource) {
      return { sceneId: scene.id, sourceId: firstSource.id }
    }
  }
  return undefined
}
