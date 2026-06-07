import { STATE, resolveSourceInstance, withOverlayStyleDefaults } from '@ieom/shared'
import type { AppConfig, OverlayStyle, Scene, SourceInstance } from '@ieom/shared'

export interface ResolvedScene {
  scene: Scene | undefined
  visibleSources: SourceInstance[]
  overlayStyle: OverlayStyle
  /** Whether the Win98 desktop layer should be visible */
  showDesktop: boolean
}

export function resolveScene(config: AppConfig, visualState: string): ResolvedScene {
  const scene = (config.scenes[visualState] ?? config.scenes[STATE.DESKTOP]) as Scene | undefined
  const overlayStyle = withOverlayStyleDefaults(scene?.style)

  const visibleSources: SourceInstance[] = (scene?.sources ?? [])
    .filter((s) => s.visible)
    .flatMap((s) => {
      const resolved = resolveSourceInstance(s, config.sourcePresets)
      return resolved ? [resolved as SourceInstance] : []
    })

  const showDesktop = scene?.showDesktop ?? false

  return { scene, visibleSources, overlayStyle, showDesktop }
}

export function resolveSceneStyle(config: AppConfig, visualState: string): OverlayStyle {
  const scene = config.scenes[visualState] as Scene | undefined
  return withOverlayStyleDefaults(scene?.style)
}
