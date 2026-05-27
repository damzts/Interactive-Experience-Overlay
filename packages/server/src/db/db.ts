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

function loadScenes(): Record<string, Scene> {
  return sceneRepo.findAll()
}

export function saveScenes(scenes: Record<string, Scene>): void {
  sceneRepo.saveAll(scenes)
}

function loadApplications(): Application[] {
  return applicationRepo.findAll()
}

export function saveApplications(apps: Application[]): void {
  applicationRepo.saveAll(apps)
}

function loadDesktopConfig(): DesktopConfig | undefined {
  return desktopRepo.find()
}

export function saveDesktopConfig(cfg: DesktopConfig): void {
  desktopRepo.save(cfg)
}

function loadEvents(): EventConfig[] {
  return eventRepo.findAll()
}

export function saveEvents(events: EventConfig[]): void {
  eventRepo.saveAll(events)
}

function loadKeybinds(): AppConfig['keybinds'] {
  return keybindRepo.find()
}

export function saveKeybinds(keybinds: AppConfig['keybinds']): void {
  keybindRepo.save(keybinds)
}

function loadObsConfig(): AppConfig['obs'] {
  return obsConfigRepo.find()
}

export function saveObsConfig(cfg: AppConfig['obs']): void {
  obsConfigRepo.save(cfg)
}

function loadAudioConfig(): AppConfig['audio'] {
  return audioConfigRepo.find()
}

export function saveAudioConfig(cfg: AppConfig['audio']): void {
  audioConfigRepo.save(cfg)
}

function loadOverlayStyle(): OverlayStyle {
  return overlayStyleRepo.find()
}

export function saveOverlayStyle(style: OverlayStyle): void {
  overlayStyleRepo.save(style)
}

function loadDesktopAmbiance(): DesktopAmbianceConfig | undefined {
  return ambianceRepo.find()
}

export function saveDesktopAmbiance(cfg: DesktopAmbianceConfig): void {
  ambianceRepo.save(cfg)
}

function loadSourcePresets(): SourcePreset[] {
  return sourcePresetRepo.findAll()
}

export function saveSourcePresets(presets: SourcePreset[]): void {
  sourcePresetRepo.saveAll(presets)
}

function loadMediaLibrary(): MediaEntry[] {
  return mediaRepo.findAll()
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

