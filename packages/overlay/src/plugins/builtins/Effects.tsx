/**
 * builtin:effects — renders the OverlayEffects config as a source.
 * Thin re-export of CSSEffectsLayer with PluginProps adapter.
 */
import type { PluginProps } from '../registry'
import { CSSEffectsLayer } from '../../layers/CSSEffectsLayer'

export function BuiltinEffectsRenderer({ config }: PluginProps) {
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
