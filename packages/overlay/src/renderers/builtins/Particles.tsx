/**
 * builtin:particles — renders the OverlayParticles config as a window.
 * Thin re-export of ParticlesLayer with RendererProps adapter.
 */
import type { RendererProps } from '../registry'
import { ParticlesLayer } from '../../layers/ParticlesLayer'
import type { ParticlePreset } from '@ieomlabs/shared'

export function BuiltinParticlesRenderer({ config }: RendererProps) {
  return (
    <ParticlesLayer
      enabled={config.enabled !== false}
      preset={String(config.preset ?? 'none') as ParticlePreset}
      density={Number(config.density ?? 0.5)}
      speed={Number(config.speed ?? 0.5)}
    />
  )
}
