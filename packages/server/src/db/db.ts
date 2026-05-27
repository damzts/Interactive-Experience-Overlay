import type {
  AppConfig,
  Application,
  DesktopAmbianceConfig,
  DesktopConfig,
  EventConfig,
  MediaEntry,
  OverlayStyle,
  Scene,
  SourcePreset,
} from '@ieom/shared'
import {
  ambianceRepo,
  applicationRepo,
  audioConfigRepo,
  desktopRepo,
  eventRepo,
  keybindRepo,
  mediaRepo,
  obsConfigRepo,
  overlayStyleRepo,
  sceneRepo,
  sourcePresetRepo,
} from './repositories/index.js'

export { db } from './connection.js'
export { hasPersistedConfig } from './migrations.js'

export function loadScenes(): Record<string, Scene> {
  return sceneRepo.findAll()
}

export function saveScene(_id: string, scene: Scene): void {
  sceneRepo.save(scene)
}

export function saveScenes(scenes: Record<string, Scene>): void {
  sceneRepo.saveAll(scenes)
}

export function loadApplications(): Application[] {
  return applicationRepo.findAll()
}

export function saveApplication(_id: string, app: Application): void {
  applicationRepo.save(app)
}

export function saveApplications(apps: Application[]): void {
  applicationRepo.saveAll(apps)
}

export function loadDesktopConfig(): DesktopConfig | undefined {
  return desktopRepo.find()
}

export function saveDesktopConfig(cfg: DesktopConfig): void {
  desktopRepo.save(cfg)
}

export function loadEvents(): EventConfig[] {
  return eventRepo.findAll()
}

export function saveEvent(_id: string, event: EventConfig): void {
  eventRepo.save(event)
}

export function saveEvents(events: EventConfig[]): void {
  eventRepo.saveAll(events)
}

export function loadKeybinds(): AppConfig['keybinds'] {
  return keybindRepo.find()
}

export function saveKeybinds(keybinds: AppConfig['keybinds']): void {
  keybindRepo.save(keybinds)
}

export function loadObsConfig(): AppConfig['obs'] {
  return obsConfigRepo.find()
}

export function saveObsConfig(cfg: AppConfig['obs']): void {
  obsConfigRepo.save(cfg)
}

export function loadAudioConfig(): AppConfig['audio'] {
  return audioConfigRepo.find()
}

export function saveAudioConfig(cfg: AppConfig['audio']): void {
  audioConfigRepo.save(cfg)
}

export function loadOverlayStyle(): OverlayStyle {
  return overlayStyleRepo.find()
}

export function saveOverlayStyle(style: OverlayStyle): void {
  overlayStyleRepo.save(style)
}

export function loadDesktopAmbiance(): DesktopAmbianceConfig | undefined {
  return ambianceRepo.find()
}

export function saveDesktopAmbiance(cfg: DesktopAmbianceConfig): void {
  ambianceRepo.save(cfg)
}

export function loadSourcePresets(): SourcePreset[] {
  return sourcePresetRepo.findAll()
}

export function saveSourcePreset(_id: string, preset: SourcePreset): void {
  sourcePresetRepo.save(preset)
}

export function saveSourcePresets(presets: SourcePreset[]): void {
  sourcePresetRepo.saveAll(presets)
}

export function loadMediaLibrary(): MediaEntry[] {
  return mediaRepo.findAll()
}

export function saveMediaEntry(_id: string, entry: MediaEntry): void {
  mediaRepo.save(entry)
}

export function saveMediaLibrary(entries: MediaEntry[]): void {
  mediaRepo.saveAll(entries)
}

export function loadAllConfig(): AppConfig {
  return {
    scenes: loadScenes(),
    applications: loadApplications(),
    keybinds: loadKeybinds(),
    obs: loadObsConfig(),
    audio: loadAudioConfig(),
    overlayStyle: loadOverlayStyle(),
    desktopConfig: loadDesktopConfig(),
    desktopAmbiance: loadDesktopAmbiance(),
    events: loadEvents(),
    mediaLibrary: loadMediaLibrary(),
    sourcePresets: loadSourcePresets(),
  }
}
