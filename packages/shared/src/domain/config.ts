import type { Application } from './application.js'
import type { DesktopAmbianceConfig } from './ambiance.js'
import type { DesktopConfig } from './desktop.js'
import type { EventConfig } from './event.js'
import type { MediaEntry, OverlayStyle } from './overlay.js'
import type { Scene, SourcePreset } from './scene.js'

/** Root application config — stored in server memory */
export interface AppConfig {
  scenes: Record<string, Scene>
  applications: Application[]
  keybinds: {
    obs: Record<string, string>
    admin: Record<string, string>
  }
  obs: {
    url: string
    password: string
  }
  audio: {
    masterVolume: number
    sfxVolume: number
    musicVolume: number
  }
  overlayStyle: OverlayStyle
  desktopConfig?: DesktopConfig
  desktopAmbiance?: DesktopAmbianceConfig
  /** Saved event definitions. Falls back to DEFAULT_CONFIG.events if absent. */
  events?: EventConfig[]
  /** Centralised media asset library (images / videos) used by TransitionPicker. */
  mediaLibrary?: MediaEntry[]
  /** Reusable source presets referenced by scenes and source widgets. */
  sourcePresets?: SourcePreset[]
}
