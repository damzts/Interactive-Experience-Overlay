/**
 * SceneLayer — renders one z-tier of WindowInstances via WindowHost.
 * Tiers are rendered in order: background → particles → content → post → transition.
 */
import type { WindowInstance, TierName } from '@ieomlabs/shared'
import { WindowHost } from './WindowHost'

interface Props {
  tier: TierName
  windows: WindowInstance[]
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

export function SceneLayer({ tier, windows, sceneAge, openWidgets, activeOverride }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: TIER_Z[tier],
        pointerEvents: 'none',
      }}
    >
      {windows.map((instance) => (
        <WindowHost
          key={instance.id}
          instance={instance}
          tierWindows={windows}
          sceneAge={sceneAge}
          openWidgets={openWidgets}
          activeOverride={activeOverride}
        />
      ))}
    </div>
  )
}
