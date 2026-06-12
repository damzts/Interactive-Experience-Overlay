import { STATE, resolveWindowInstance, withOverlayStyleDefaults } from '@ieomlabs/shared'
import type { AppConfig, OverlayStyle, Scene, WindowInstance } from '@ieomlabs/shared'

export interface ResolvedScene {
  scene: Scene | undefined
  visibleWindows: WindowInstance[]
  overlayStyle: OverlayStyle
  /** Whether the Win98 desktop layer should be visible */
  showDesktop: boolean
}

export function resolveScene(config: AppConfig, visualState: string): ResolvedScene {
  const scene = (config.scenes[visualState] ?? config.scenes[STATE.DESKTOP]) as Scene | undefined
  const overlayStyle = withOverlayStyleDefaults(scene?.style)

  const visibleWindows: WindowInstance[] = (scene?.windows ?? [])
    .filter((w) => w.visible)
    .flatMap((w) => {
      const resolved = resolveWindowInstance(w, config.sourcePresets)
      return resolved ? [resolved as WindowInstance] : []
    })

  const showDesktop = scene?.showDesktop ?? false

  return { scene, visibleWindows, overlayStyle, showDesktop }
}

export function resolveSceneStyle(config: AppConfig, visualState: string): OverlayStyle {
  const scene = config.scenes[visualState] as Scene | undefined
  return withOverlayStyleDefaults(scene?.style)
}
