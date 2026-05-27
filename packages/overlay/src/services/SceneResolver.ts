import { STATE, resolveSourceInstance } from '@ieom/shared'
import type { AppConfig, OverlayEffects, OverlayStyle, Scene, SourceInstance } from '@ieom/shared'

export interface ResolvedScene {
  /** The Scene for the given state, or undefined if not configured. */
  scene: Scene | undefined
  /** Visible, resolved sources ready for LayerStack. */
  visibleSources: SourceInstance[]
  /**
   * Effective style: uses the scene-level style override when present,
   * otherwise falls back to the root overlayStyle.
   */
  overlayStyle: OverlayStyle
  /**
   * Effective CSS effects: in DESKTOP state with no background, suppresses
   * all CRT/noise/vignette/chromatic effects to avoid visual clutter.
   */
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

/**
 * Derives all scene-level render values from config + current visual state.
 * Pure function — no side effects, safe to call in selectors or components.
 */
export function resolveScene(config: AppConfig, visualState: string): ResolvedScene {
  const scene = (config.scenes[visualState] ?? config.scenes[STATE.DESKTOP]) as Scene | undefined
  const overlayStyle = scene?.style ?? config.overlayStyle

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

/**
 * Resolves the effective OverlayStyle for a specific scene state.
 * Lighter than resolveScene() when only the style is needed.
 */
export function resolveSceneStyle(config: AppConfig, visualState: string): OverlayStyle {
  const scene = config.scenes[visualState] as Scene | undefined
  return scene?.style ?? config.overlayStyle
}
