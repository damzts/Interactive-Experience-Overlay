import { STATE, resolveSourceInstance, withOverlayStyleDefaults } from '@ieom/shared'
import type { AppConfig, OverlayEffects, OverlayStyle, Scene, SourceInstance } from '@ieom/shared'

export interface ResolvedScene {
  scene: Scene | undefined
  visibleSources: SourceInstance[]
  /** Effective style: uses scene-level style, falls back to built-in defaults */
  overlayStyle: OverlayStyle
  effectiveEffects: OverlayEffects
}

const SUPPRESSED_DESKTOP_EFFECTS: Partial<OverlayEffects> = {
  crt: false,
  noise: false,
  vignette: false,
  flicker: false,
  chromatic: false,
  scanlineOpacity: 0,
  noiseOpacity: 0,
  vignetteStrength: 0,
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

  const suppressEffects =
    visualState === STATE.DESKTOP && overlayStyle.background.type === 'none'

  const effectiveEffects: OverlayEffects = suppressEffects
    ? { ...overlayStyle.effects, ...SUPPRESSED_DESKTOP_EFFECTS }
    : overlayStyle.effects

  return { scene, visibleSources, overlayStyle, effectiveEffects }
}

export function resolveSceneStyle(config: AppConfig, visualState: string): OverlayStyle {
  const scene = config.scenes[visualState] as Scene | undefined
  return withOverlayStyleDefaults(scene?.style)
}
