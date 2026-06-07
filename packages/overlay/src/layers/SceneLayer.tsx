/**
 * SceneLayer — renders one z-tier of SourceInstances via SourceRenderer.
 * Tiers are rendered in order: background → particles → content → post → transition.
 */
import type { SourceInstance, TierName } from '@ieom/shared'
import { SourceRenderer } from './SourceRenderer'

interface Props {
  tier: TierName
  sources: SourceInstance[]
  sceneAge?: number
  openWidgets?: string[]
  activeOverride?: string
}

const TIER_Z: Record<TierName, number> = {
  background: 0,
  particles:  1,
  content:    5,
  post:       30,
  transition: 50,
}

export function SceneLayer({ tier, sources, sceneAge, openWidgets, activeOverride }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: TIER_Z[tier],
        pointerEvents: 'none',
      }}
    >
      {sources.map((source) => (
        <SourceRenderer
          key={source.id}
          source={source}
          tierSources={sources}
          sceneAge={sceneAge}
          openWidgets={openWidgets}
          activeOverride={activeOverride}
        />
      ))}
    </div>
  )
}
