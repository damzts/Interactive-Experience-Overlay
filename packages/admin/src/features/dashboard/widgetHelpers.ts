import {
  getDefaultWidgetWindowSize,
  getDefaultWidgetZIndex,
  getWidgetComponent,
} from '@ieomlabs/shared'
import type {
  Application,
  Scene,
  WidgetComponentType,
  WidgetLayoutDefinition,
  WidgetLayoutItem,
  WidgetLayoutSnapshot,
} from '@ieomlabs/shared'
import { WIDGET_WIDTH_MIN, WIDGET_WIDTH_MAX, WIDGET_HEIGHT_MIN, WIDGET_HEIGHT_MAX } from './constants'

export function clone<T>(value: T): T {
  return structuredClone(value)
}

export function clampWidgetDimension(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function resolveAppWidgetComponent(app: Pick<Application, 'id' | 'widgetComponent'>): WidgetComponentType {
  return getWidgetComponent(app) ?? 'generic'
}

export function getDefaultWidgetSize(app: Pick<Application, 'id' | 'widgetComponent'>) {
  return getDefaultWidgetWindowSize(app.id, resolveAppWidgetComponent(app))
}

export function resolveWidgetSizeFromConfig(app: Pick<Application, 'id' | 'widgetComponent' | 'windowSize'>, _desktopConfig?: unknown) {
  const defaults = getDefaultWidgetSize(app)
  const raw = app.windowSize
  return {
    width:  clampWidgetDimension(raw?.width  ?? defaults.width,  WIDGET_WIDTH_MIN,  WIDGET_WIDTH_MAX,  defaults.width),
    height: clampWidgetDimension(raw?.height ?? defaults.height, WIDGET_HEIGHT_MIN, WIDGET_HEIGHT_MAX, defaults.height),
  }
}

export function resolveWidgetPositionFromConfig(app: Pick<Application, 'id' | 'windowPosition'>, _desktopConfig?: unknown) {
  const raw = app.windowPosition
  return {
    x: Math.max(0, Math.round(raw?.x ?? 0)),
    y: Math.max(0, Math.round(raw?.y ?? 0)),
  }
}

export function resolveWidgetDefaultZIndexFromConfig(app: Pick<Application, 'id' | 'widgetComponent' | 'zIndexDefault'>, _desktopConfig?: unknown) {
  const value = app.zIndexDefault
  return Number.isFinite(value)
    ? Math.max(0, Math.round(value as number))
    : getDefaultWidgetZIndex(app.id, resolveAppWidgetComponent(app))
}

export function resolveWidgetRuntimeZIndex(app: Pick<Application, 'id' | 'widgetComponent' | 'zIndexDefault' | 'zIndexCurrent'>, _desktopConfig?: unknown) {
  const value = app.zIndexCurrent
  return Number.isFinite(value)
    ? Math.max(0, Math.round(value as number))
    : resolveWidgetDefaultZIndexFromConfig(app)
}

export function resolveWidgetThemeOverrideFromConfig(app: Pick<Application, 'themeOverride'>) {
  return app.themeOverride ?? null
}

// ── Snapshot helpers ──────────────────────────────────────────────────

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
  _desktopConfig: unknown,
  enabled: boolean,
): WidgetLayoutItem {
  const position = resolveWidgetPositionFromConfig(app)
  const size = resolveWidgetSizeFromConfig(app)
  const fallbackPos = buildWidgetLayoutFallbackPosition(widgetIndex)
  const focusPriority = resolveWidgetDefaultZIndexFromConfig(app)

  return {
    widgetId: app.id,
    enabled,
    x: Math.max(0, Math.round(position.x || fallbackPos.x)),
    y: Math.max(0, Math.round(position.y || fallbackPos.y)),
    width:  Math.max(WIDGET_WIDTH_MIN,  Math.round(size.width)),
    height: Math.max(WIDGET_HEIGHT_MIN, Math.round(size.height)),
    focusPriority: Math.max(0, Math.round(focusPriority)),
  }
}

export function createWidgetLayoutFromCurrentState(
  label: string,
  widgetApps: Application[],
  _desktopConfig: unknown,
  openWidgetIds: string[],
): WidgetLayoutDefinition {
  const trimmedLabel = label.trim() || 'Widget Layout'
  const slug = trimmedLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'widget-layout'

  return {
    id: `${slug}-${Date.now()}`,
    label: trimmedLabel,
    icon: '📐',
    source: 'user',
    items: widgetApps.map((app, index) => buildWidgetLayoutItem(app, index, _desktopConfig, openWidgetIds.includes(app.id))),
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

export function normalizeWidgetLayoutsForEditor(
  widgetLayouts: WidgetLayoutDefinition[] | undefined,
  widgetApps: Application[],
  _desktopConfig: unknown,
) {
  const layouts = widgetLayouts ?? []
  return layouts.map((layout) => ({
    ...layout,
    items: widgetApps.map((app, index) => {
      const source = layout.items.find((item) => item.widgetId === app.id)
      const size = resolveWidgetSizeFromConfig(app)
      const pos  = resolveWidgetPositionFromConfig(app)
      const fallbackX = 80 + (index % 2) * 48
      const fallbackY = 72 + index * 28
      return {
        widgetId: app.id,
        enabled: source?.enabled ?? false,
        x: Math.max(0, Math.round(source?.x ?? pos.x ?? fallbackX)),
        y: Math.max(0, Math.round(source?.y ?? pos.y ?? fallbackY)),
        width:  clampWidgetDimension(source?.width  ?? size.width,  WIDGET_WIDTH_MIN,  WIDGET_WIDTH_MAX,  size.width),
        height: clampWidgetDimension(source?.height ?? size.height, WIDGET_HEIGHT_MIN, WIDGET_HEIGHT_MAX, size.height),
        focusPriority: Number.isFinite(source?.focusPriority) ? Math.round(source!.focusPriority) : resolveWidgetDefaultZIndexFromConfig(app),
      }
    }),
  }))
}

/** Geometry is now on the application row itself — deletion removes it. This helper is a no-op kept for call-site compatibility. */
export function removeWidgetFromDesktopConfig(desktopConfig: import('@ieomlabs/shared').DesktopConfig, _widgetId: string) {
  return desktopConfig
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
    const windows = scene.windows ?? []
    const firstWindow = windows[0]
    if (firstWindow) {
      return { sceneId: scene.id, sourceId: firstWindow.id }
    }
  }
  return undefined
}
