/**
 * builtin:effects — renders the OverlayEffects config as a window.
 * Thin re-export of CSSEffectsLayer with RendererProps adapter.
 */
import type { RendererProps } from '../registry'
import { CSSEffectsLayer } from '../../layers/CSSEffectsLayer'

export function BuiltinEffectsRenderer({ config }: RendererProps) {
  return (
    <CSSEffectsLayer
      effects={{
        crt:              config.crt !== false,
        noise:            config.noise !== false,
        vignette:         config.vignette !== false,
        flicker:          config.flicker === true,
        chromatic:        config.chromatic === true,
        scanlineOpacity:  Number(config.scanlineOpacity ?? 0.15),
        noiseOpacity:     Number(config.noiseOpacity ?? 0.05),
        vignetteStrength: Number(config.vignetteStrength ?? 0.5),
      }}
    />
  )
}
