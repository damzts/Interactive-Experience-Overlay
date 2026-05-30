import type { ReactNode } from 'react'

export interface UpgradePromptProps {
  requiredTier: string
  featureName: string
}

/**
 * A reusable component that shows an upgrade message indicating
 * which tier is required to unlock a specific feature.
 */
export function UpgradePrompt({ requiredTier, featureName }: UpgradePromptProps): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/80 p-6 text-center">
      <svg
        className="h-8 w-8 text-amber-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-10V4m6.364 1.636l-1.414 1.414M18 12h2M4 12h2m.636-6.364l1.414 1.414M12 20a8 8 0 100-16 8 8 0 000 16z"
        />
      </svg>
      <p className="text-sm text-zinc-300">
        This feature requires the <span className="font-semibold text-amber-400">{requiredTier}</span> plan.
        Upgrade to unlock <span className="font-medium text-zinc-100">{featureName}</span>.
      </p>
    </div>
  )
}
