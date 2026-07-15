/**
 * Pure candidate-scoring/weighting functions for the ambiance widget
 * simulation tick. No manager state, no I/O — kept standalone so the
 * selection algorithm can be tested and reasoned about in isolation from
 * AmbianceManager's timers/diagnostics bookkeeping.
 */

import type { AmbianceSimulationPayload, AmbianceWidgetBehavior } from '@ieomlabs/shared'

export const DEFAULT_BEHAVIOR: AmbianceWidgetBehavior = {
  enabled: true,
  openChance: 0.18,
  closeChance: 0.12,
  interactChance: 0.65,
}

export type AmbianceCandidateAction = Pick<AmbianceSimulationPayload, 'widgetId' | 'action'> & {
  targetKind?: AmbianceSimulationPayload['targetKind']
}

export function shouldTrigger(chance: number): boolean {
  if (chance <= 0) return false
  if (chance >= 1) return true
  return Math.random() < chance
}

export function pickWeightedAction(
  candidates: AmbianceCandidateAction[],
  minActionGapMs: number,
  lastActionAtByWidget: Map<string, number>,
  lastWidgetId: string | null,
): AmbianceCandidateAction | null {
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  const now = Date.now()
  const weights = candidates.map((candidate) => {
    const age = now - (lastActionAtByWidget.get(candidate.widgetId) ?? 0)
    let weight = Math.max(0.1, age / Math.max(1, minActionGapMs))
    if (lastWidgetId && candidate.widgetId === lastWidgetId && candidates.some((c) => c.widgetId !== lastWidgetId)) {
      weight *= 0.2
    }
    weight += Math.random() * 0.75
    return weight
  })

  const totalWeight = weights.reduce((sum, value) => sum + value, 0)
  let target = Math.random() * totalWeight
  let picked = candidates[candidates.length - 1]
  for (let index = 0; index < candidates.length; index += 1) {
    target -= weights[index]
    if (target <= 0) {
      picked = candidates[index]
      break
    }
  }

  return picked
}
