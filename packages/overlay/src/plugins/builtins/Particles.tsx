/**
 * builtin:particles — renders the OverlayParticles config as a source.
 * Thin re-export of ParticlesLayer with PluginProps adapter.
 */
import type { PluginProps } from '../registry'
import { ParticlesLayer } from '../../layers/ParticlesLayer'
import type { ParticlePreset } from '@ieom/shared'

export function BuiltinParticlesRenderer({ config }: PluginProps) {
  return (
    <ParticlesLayer
      enabled={config.enabled !== false}
      preset={String(config.preset ?? 'none') as ParticlePreset}
      density={Number(config.density ?? 0.5)}
      speed={Number(config.speed ?? 0.5)}
    />
  )
}
