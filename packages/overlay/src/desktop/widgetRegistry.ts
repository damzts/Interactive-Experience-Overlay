import type { ComponentType } from 'react'
import type { Application, WidgetComponentType } from '@ieom/shared'
import { ArchiveWidget } from './ArchiveWidget'
import { BroadcastSchedulerWidget } from './BroadcastSchedulerWidget'
import { CDRipperWidget } from './CDRipperWidget'
import { CameraWidget } from './CameraWidget'
import { OnlineStreamWidget } from './OnlineStreamWidget'
import { ChatWidget } from './ChatWidget'
import { CityNavigatorWidget } from './CityNavigatorWidget'
import { ClockTowerWidget } from './ClockTowerWidget'
import { EqualizerRackWidget } from './EqualizerRackWidget'
import { GalleryWidget } from './GalleryWidget'
import { LCDDolphinsWidget } from './LCDDolphinsWidget'
import { MediaDeckWidget } from './MediaDeckWidget'
import { MusicWidget } from './MusicWidget'
import { NetMeterWidget } from './NetMeterWidget'
import { NewswireDeskWidget } from './NewswireDeskWidget'
import { PlaylistDeckWidget } from './PlaylistDeckWidget'
import { SignalLabWidget } from './SignalLabWidget'
import { SourceWidget } from './SourceWidget'
import { SpectrumAnalyzerWidget } from './SpectrumAnalyzerWidget'
import { StickyNotesWidget } from './StickyNotesWidget'
import { WaveScopeWidget } from './WaveScopeWidget'
import { WeatherConsoleWidget } from './WeatherConsoleWidget'

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

const desktopWidgetRegistry = new Map<RegisteredWidgetComponentType, DesktopWidgetRenderer>()
const missingWidgetWarnings = new Set<string>()

export function registerDesktopWidget(componentType: RegisteredWidgetComponentType, component: DesktopWidgetRenderer) {
  desktopWidgetRegistry.set(componentType, component)
}

export function getDesktopWidgetRenderer(componentType?: WidgetComponentType | null) {
  if (!componentType || componentType === 'generic') return null
  return desktopWidgetRegistry.get(componentType) ?? null
}

export function warnMissingDesktopWidgetRegistration(app: Pick<Application, 'id' | 'label' | 'appType' | 'widgetComponent'>, componentType?: WidgetComponentType | null) {
  if (app.appType !== 'widget' || !componentType || componentType === 'generic') return false

  const warningKey = `${app.id}:${componentType}`
  if (missingWidgetWarnings.has(warningKey)) return false

  missingWidgetWarnings.add(warningKey)
  console.warn(`[desktop] Missing widget registration for "${app.id}" (${app.label}) using component "${componentType}".`)
  return true
}

registerDesktopWidget('archive', ArchiveWidget)
registerDesktopWidget('broadcast-scheduler', BroadcastSchedulerWidget)
registerDesktopWidget('cd-ripper', CDRipperWidget)
registerDesktopWidget('camera', CameraWidget)
registerDesktopWidget('online-stream', OnlineStreamWidget)
registerDesktopWidget('chat', ChatWidget)
registerDesktopWidget('city-navigator', CityNavigatorWidget)
registerDesktopWidget('clock-tower', ClockTowerWidget)
registerDesktopWidget('equalizer-rack', EqualizerRackWidget)
registerDesktopWidget('gallery', GalleryWidget)
registerDesktopWidget('lcd-dolphins', LCDDolphinsWidget)
registerDesktopWidget('media-deck', MediaDeckWidget)
registerDesktopWidget('music', MusicWidget)
registerDesktopWidget('net-meter', NetMeterWidget)
registerDesktopWidget('newswire-desk', NewswireDeskWidget)
registerDesktopWidget('playlist-deck', PlaylistDeckWidget)
registerDesktopWidget('signal-lab', SignalLabWidget)
registerDesktopWidget('source', SourceWidget)
registerDesktopWidget('spectrum-analyzer', SpectrumAnalyzerWidget)
registerDesktopWidget('sticky-notes', StickyNotesWidget)
registerDesktopWidget('wave-scope', WaveScopeWidget)
registerDesktopWidget('weather-console', WeatherConsoleWidget)