import type { ComponentType } from 'react'
import type { Application, WidgetComponentType } from '@ieomlabs/shared'

export interface DesktopWidgetProps {
  appId: string
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

type WidgetManifestEntry = {
  load: () => Promise<DesktopWidgetRenderer>
  defaultPosition: { x: number; y: number }
  defaultSize: { width: number; height?: number }
}

/** Lazy import manifest — each entry dynamically imports the module and carries the widget's default position and size. */
const widgetManifest: Record<RegisteredWidgetComponentType, WidgetManifestEntry> = {
  'broadcast-scheduler': { load: () => import('./BroadcastSchedulerWidget').then((m) => m.BroadcastSchedulerWidget), defaultPosition: { x: 314,  y: 124 }, defaultSize: { width: 430              } },
  'cd-ripper':           { load: () => import('./CDRipperWidget').then((m) => m.CDRipperWidget),                     defaultPosition: { x: 230,  y: 118 }, defaultSize: { width: 420              } },
  'camera':              { load: () => import('./CameraWidget').then((m) => m.CameraWidget),                         defaultPosition: { x: 260,  y: 80  }, defaultSize: { width: 400, height: 300 } },
  'chat':                { load: () => import('./ChatWidget').then((m) => m.ChatWidget),                             defaultPosition: { x: 1580, y: 60  }, defaultSize: { width: 280              } },
  'city-navigator':      { load: () => import('./CityNavigatorWidget').then((m) => m.CityNavigatorWidget),           defaultPosition: { x: 474,  y: 176 }, defaultSize: { width: 450              } },
  'clock-tower':         { load: () => import('./ClockTowerWidget').then((m) => m.ClockTowerWidget),                 defaultPosition: { x: 392,  y: 168 }, defaultSize: { width: 500              } },
  'equalizer-rack':      { load: () => import('./EqualizerRackWidget').then((m) => m.EqualizerRackWidget),           defaultPosition: { x: 210,  y: 150 }, defaultSize: { width: 320              } },
  'gallery':             { load: () => import('./GalleryWidget').then((m) => m.GalleryWidget),                       defaultPosition: { x: 220,  y: 90  }, defaultSize: { width: 430              } },
  'lcd-dolphins':        { load: () => import('./LCDDolphinsWidget').then((m) => m.LCDDolphinsWidget),               defaultPosition: { x: 540,  y: 220 }, defaultSize: { width: 320, height: 240 } },
  'music':               { load: () => import('./MusicWidget').then((m) => m.MusicWidget),                           defaultPosition: { x: 60,   y: 120 }, defaultSize: { width: 300, height: 320 } },
  'net-meter':           { load: () => import('./NetMeterWidget').then((m) => m.NetMeterWidget),                     defaultPosition: { x: 320,  y: 270 }, defaultSize: { width: 280              } },
  'newswire-desk':       { load: () => import('./NewswireDeskWidget').then((m) => m.NewswireDeskWidget),             defaultPosition: { x: 428,  y: 152 }, defaultSize: { width: 430              } },
  'playlist-deck':       { load: () => import('./PlaylistDeckWidget').then((m) => m.PlaylistDeckWidget),             defaultPosition: { x: 284,  y: 232 }, defaultSize: { width: 300              } },
  'signal-lab':          { load: () => import('./SignalLabWidget').then((m) => m.SignalLabWidget),                   defaultPosition: { x: 270,  y: 152 }, defaultSize: { width: 410              } },
  'window':              { load: () => import('./WindowWidget').then((m) => m.WindowWidget),                         defaultPosition: { x: 320,  y: 96  }, defaultSize: { width: 420, height: 320 } },
  'spectrum-analyzer':   { load: () => import('./SpectrumAnalyzerWidget').then((m) => m.SpectrumAnalyzerWidget),     defaultPosition: { x: 176,  y: 108 }, defaultSize: { width: 300              } },
  'sticky-notes':        { load: () => import('./StickyNotesWidget').then((m) => m.StickyNotesWidget),               defaultPosition: { x: 280,  y: 110 }, defaultSize: { width: 260              } },
  'wave-scope':          { load: () => import('./WaveScopeWidget').then((m) => m.WaveScopeWidget),                   defaultPosition: { x: 248,  y: 192 }, defaultSize: { width: 320              } },
  'weather-console':     { load: () => import('./WeatherConsoleWidget').then((m) => m.WeatherConsoleWidget),         defaultPosition: { x: 346,  y: 140 }, defaultSize: { width: 500              } },
  'winamp-window':       { load: () => import('./WinampWindowWidget').then((m) => m.WinampWindowWidget),              defaultPosition: { x: 220,  y: 90  }, defaultSize: { width: 275, height: 116 } },
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

  const entry = widgetManifest[type]
  if (!entry) return null

  const component = await entry.load()
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

/** Returns true if the widget type is in the manifest (may still be loading). */
export function isWidgetRegistered(componentType: WidgetComponentType): boolean {
  if (!componentType || componentType === 'generic') return false
  return componentType in widgetManifest
}

/** Returns the design-time default position for a widget type, used to align the loading placeholder. */
export function getWidgetDefaultPosition(componentType: WidgetComponentType): { x: number; y: number } {
  if (!componentType || componentType === 'generic') return { x: 80, y: 120 }
  return widgetManifest[componentType as RegisteredWidgetComponentType]?.defaultPosition ?? { x: 80, y: 120 }
}

/** Returns the design-time default size for a widget type, used to size the loading placeholder. */
export function getWidgetDefaultSize(componentType: WidgetComponentType): { width: number; height?: number } {
  if (!componentType || componentType === 'generic') return { width: 260 }
  return widgetManifest[componentType as RegisteredWidgetComponentType]?.defaultSize ?? { width: 260 }
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
    if (type !== 'generic' && type in widgetManifest && !resolvedCache.has(type as RegisteredWidgetComponentType)) {
      void loadDesktopWidget(type)
    }
  }
}

