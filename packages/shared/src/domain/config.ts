import type { Application, TransitionDefinition, WidgetLayoutDefinition } from './application.js'
import type { DesktopAmbianceConfig } from './ambiance.js'
import type { DesktopConfig } from './desktop.js'
import type { EventConfig } from './event.js'
import type { MediaEntry, Scene, SourcePreset } from './scene.js'

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
  desktopConfig?: DesktopConfig
  desktopAmbiance?: DesktopAmbianceConfig
  /** Named widget layout presets (owned by WidgetLayoutPanel → widget_layouts table) */
  widgetLayouts?: WidgetLayoutDefinition[]
  /** Source events (Asset Library Events tab → source_events table) */
  sourceEvents?: EventConfig[]
  /** Centralised media asset library (Asset Library Catalog tab → source_media table) */
  sourceMedia?: MediaEntry[]
  /** Reusable source presets (Asset Library Sources tab → source_presets table) */
  sourcePresets?: SourcePreset[]
  /** Named transition definitions (Asset Library Transitions tab → source_transitions table) */
  sourceTransitions?: TransitionDefinition[]
}
