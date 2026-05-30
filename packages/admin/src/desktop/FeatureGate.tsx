import type { ReactNode } from 'react'
import { useDesktopBridge } from './useDesktopBridge'
import { UpgradePrompt } from './UpgradePrompt'

export interface FeatureGateProps {
  /** Feature key to gate (e.g. 'stream-rooms', 'advanced-ambiance-presets', 'priority-support') */
  feature: string
  children: ReactNode
  /** Optional fallback to render when the feature is gated. Defaults to an UpgradePrompt. */
  fallback?: ReactNode
}

/** Maps feature keys to the minimum required license tier */
const FEATURE_GATE_MAP: Record<string, string> = {
  'stream-rooms': 'pro+rooms',
  'advanced-ambiance-presets': 'pro',
  'priority-support': 'pro',
}

/** Tier ordering for comparison: higher index = higher tier */
const TIER_ORDER: string[] = ['free', 'pro', 'pro+rooms']

/**
 * Returns true if the user's current tier meets or exceeds the required tier.
 */
function isTierSufficient(currentTier: string, requiredTier: string): boolean {
  const currentIndex = TIER_ORDER.indexOf(currentTier)
  const requiredIndex = TIER_ORDER.indexOf(requiredTier)

  // If either tier is unknown, default to insufficient
  if (currentIndex === -1 || requiredIndex === -1) return false

  return currentIndex >= requiredIndex
}

/**
 * A wrapper component that conditionally renders children based on license tier.
 *
 * - In web mode (not desktop): always renders children (no gating).
 * - In desktop mode: checks the current license tier against the feature gate map.
 *   If the tier is insufficient, renders a disabled overlay with upgrade messaging.
 */
export function FeatureGate({ feature, children, fallback }: FeatureGateProps): ReactNode {
  const bridge = useDesktopBridge()

  // Not in desktop mode — no gating, always render children
  if (!bridge) {
    return <>{children}</>
  }

  const requiredTier = FEATURE_GATE_MAP[feature]

  // Feature not in the gate map — no restriction, render children
  if (!requiredTier) {
    return <>{children}</>
  }

  const currentTier = bridge.license.tierData?.tier ?? 'free'

  if (isTierSufficient(currentTier, requiredTier)) {
    return <>{children}</>
  }

  // Feature is gated — show fallback or default disabled overlay
  if (fallback !== undefined) {
    return <>{fallback}</>
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm rounded-lg">
        <UpgradePrompt requiredTier={requiredTier} featureName={feature} />
      </div>
    </div>
  )
}
