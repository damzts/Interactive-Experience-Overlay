/** A single source instance within a scene */
export interface SourceInstance {
  id: string
  pluginType: string
  config: Record<string, unknown>
  position: { x: number; y: number; width: number; height: number }
  zIndex: number
  visible: boolean
}

/** A desktop application icon that launches a scene */
export interface Application {
  id: string
  label: string
  icon: string
  targetSceneId: string
  transitionType: string
}

/** A scene is an ordered list of source instances */
export interface Scene {
  id: string
  label: string
  backgroundOpaque: boolean
  sources: SourceInstance[]
}

/** Root application config — stored in server memory (v1) */
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
}
