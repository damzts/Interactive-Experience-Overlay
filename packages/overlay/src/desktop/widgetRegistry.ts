import type { ComponentType } from 'react'
import type { Application, WidgetComponentType } from '@ieom/shared'

export interface DesktopWidgetProps {
  appId?: string
  defaultCameraLabel?: string
  defaultMirror?: boolean
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

type RegisteredWidgetComponentType = Exclude<WidgetComponentType, 'generic'>
type DesktopWidgetRenderer = ComponentType<DesktopWidgetProps>

/** Lazy import manifest — each entry dynamically imports the module and extracts the named export. */
const widgetManifest: Record<RegisteredWidgetComponentType, () => Promise<DesktopWidgetRenderer>> = {
  'archive':             () => import('./ArchiveWidget').then((m) => m.ArchiveWidget),
  'broadcast-scheduler': () => import('./BroadcastSchedulerWidget').then((m) => m.BroadcastSchedulerWidget),
  'cd-ripper':           () => import('./CDRipperWidget').then((m) => m.CDRipperWidget),
  'camera':              () => import('./CameraWidget').then((m) => m.CameraWidget),
  'online-stream':       () => import('./OnlineStreamWidget').then((m) => m.OnlineStreamWidget),
  'chat':                () => import('./ChatWidget').then((m) => m.ChatWidget),
  'city-navigator':      () => import('./CityNavigatorWidget').then((m) => m.CityNavigatorWidget),
  'clock-tower':         () => import('./ClockTowerWidget').then((m) => m.ClockTowerWidget),
  'equalizer-rack':      () => import('./EqualizerRackWidget').then((m) => m.EqualizerRackWidget),
  'gallery':             () => import('./GalleryWidget').then((m) => m.GalleryWidget),
  'lcd-dolphins':        () => import('./LCDDolphinsWidget').then((m) => m.LCDDolphinsWidget),
  'media-deck':          () => import('./MediaDeckWidget').then((m) => m.MediaDeckWidget),
  'music':               () => import('./MusicWidget').then((m) => m.MusicWidget),
  'net-meter':           () => import('./NetMeterWidget').then((m) => m.NetMeterWidget),
  'newswire-desk':       () => import('./NewswireDeskWidget').then((m) => m.NewswireDeskWidget),
  'playlist-deck':       () => import('./PlaylistDeckWidget').then((m) => m.PlaylistDeckWidget),
  'signal-lab':          () => import('./SignalLabWidget').then((m) => m.SignalLabWidget),
  'source':              () => import('./SourceWidget').then((m) => m.SourceWidget),
  'spectrum-analyzer':   () => import('./SpectrumAnalyzerWidget').then((m) => m.SpectrumAnalyzerWidget),
  'sticky-notes':        () => import('./StickyNotesWidget').then((m) => m.StickyNotesWidget),
  'wave-scope':          () => import('./WaveScopeWidget').then((m) => m.WaveScopeWidget),
  'weather-console':     () => import('./WeatherConsoleWidget').then((m) => m.WeatherConsoleWidget),
}

/** Cache of resolved components, populated on first use. */
const resolvedCache = new Map<RegisteredWidgetComponentType, DesktopWidgetRenderer>()
const missingWidgetWarnings = new Set<string>()

/** Load and cache a widget component. Returns null for unknown/generic types. */
export async function loadDesktopWidget(componentType: WidgetComponentType): Promise<DesktopWidgetRenderer | null> {
  if (!componentType || componentType === 'generic') return null
  const type = componentType as RegisteredWidgetComponentType

  const cached = resolvedCache.get(type)
  if (cached) return cached

  const factory = widgetManifest[type]
  if (!factory) return null

  const component = await factory()
  resolvedCache.set(type, component)
  return component
}

/**
 * Synchronous lookup for already-loaded widgets.
 * Returns null if the widget hasn't been loaded yet — use loadDesktopWidget() to trigger the load.
 */
export function getDesktopWidgetRenderer(componentType?: WidgetComponentType | null): DesktopWidgetRenderer | null {
  if (!componentType || componentType === 'generic') return null
  return resolvedCache.get(componentType as RegisteredWidgetComponentType) ?? null
}

export function warnMissingDesktopWidgetRegistration(
  app: Pick<Application, 'id' | 'label' | 'widgetComponent'>,
  componentType?: WidgetComponentType | null,
): boolean {
  if (!componentType || componentType === 'generic') return false
  const key = `${app.id}:${componentType}`
  if (missingWidgetWarnings.has(key)) return false
  missingWidgetWarnings.add(key)
  console.warn(`[desktop] Missing widget renderer for "${app.id}" (${app.label}) — "${componentType}" not yet loaded.`)
  return true
}

/** Pre-warm the registry for a set of widget types. Call this after config loads. */
export function preloadWidgets(componentTypes: WidgetComponentType[]): void {
  for (const type of componentTypes) {
    if (type !== 'generic' && widgetManifest[type as RegisteredWidgetComponentType] && !resolvedCache.has(type as RegisteredWidgetComponentType)) {
      void loadDesktopWidget(type)
    }
  }
}
