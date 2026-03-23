import type { Server } from 'socket.io'
import { appendLog } from '../db/db.js'
import { getConfig } from '../routes/config.js'
import { withDesktopAmbianceDefaults } from '@ieom/shared'
import type { AmbianceSimulationPayload } from '@ieom/shared'

const SIMULATION_FALLBACK_TIMEOUT_MS = 30000
type AmbianceCandidateAction = Pick<AmbianceSimulationPayload, 'widgetId' | 'action'>

function shouldTrigger(chance: number): boolean {
  if (chance <= 0) return false
  if (chance >= 1) return true
  return Math.random() < chance
}

function pickWeightedAction(
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

export class AmbianceManager {
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private simulationTimeout: ReturnType<typeof setTimeout> | null = null
  private getOpenWidgetIds?: () => Set<string>
  private getSimulationLeaderSocketId?: () => string | null
  private lastActionAtByWidget = new Map<string, number>()
  private lastWidgetId: string | null = null
  private simulationInFlight = false
  private inFlightActionId: string | null = null
  private actionSequence = 0

  constructor(private io: Server) {}

  setOpenWidgetIdsGetter(getter: () => Set<string>) {
    this.getOpenWidgetIds = getter
  }

  setSimulationLeaderGetter(getter: () => string | null) {
    this.getSimulationLeaderSocketId = getter
  }

  start() {
    this.stop()
    const config = withDesktopAmbianceDefaults(getConfig().desktopAmbiance)
    const intervalMs = Math.max(1, config.widgetSimulation.intervalSeconds) * 1000
    
    if (intervalMs > 0) {
      this.tickTimer = setInterval(() => this.tick(), intervalMs)
      console.log(`[ambiance] AI simulation manager started. Ticking every ${intervalMs / 1000}s.`)
    }
  }

  stop() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
      console.log('[ambiance] AI simulation manager stopped.')
    }
    this.clearSimulationInFlight()
    this.lastActionAtByWidget.clear()
    this.lastWidgetId = null
  }

  markSimulationCompleted(actionId?: string) {
    if (actionId && this.inFlightActionId && actionId !== this.inFlightActionId) {
      return
    }
    this.clearSimulationInFlight()
  }

  private clearSimulationInFlight() {
    this.simulationInFlight = false
    this.inFlightActionId = null
    if (this.simulationTimeout) {
      clearTimeout(this.simulationTimeout)
      this.simulationTimeout = null
    }
  }

  private markSimulationInFlight(actionId: string) {
    this.clearSimulationInFlight()
    this.simulationInFlight = true
    this.inFlightActionId = actionId
    this.simulationTimeout = setTimeout(() => {
      this.simulationInFlight = false
      this.inFlightActionId = null
      this.simulationTimeout = null
      appendLog('ambiance-sim', 'simulation completion timeout, releasing lock')
    }, SIMULATION_FALLBACK_TIMEOUT_MS)
  }

  private tick() {
    const config = withDesktopAmbianceDefaults(getConfig().desktopAmbiance)
    const simConfig = config.widgetSimulation

    if (!simConfig.enabled) {
      return
    }

    const leaderSocketId = this.getSimulationLeaderSocketId?.() ?? null
    if (!leaderSocketId) {
      this.clearSimulationInFlight()
      return
    }

    if (this.simulationInFlight) {
      return
    }

    const openWidgetIds = this.getOpenWidgetIds?.() ?? new Set()
    const intervalMs = Math.max(1, simConfig.intervalSeconds) * 1000
    const minActionGapMs = Math.max(1500, Math.round(intervalMs * 0.8))
    const maxOpenWidgets = Math.max(1, simConfig.maxOpenWidgets ?? 2)
    const openWhileOneOpenChance = Math.max(0, Math.min(1, simConfig.openWhileOneOpenChance ?? 0.35))
    const openCount = openWidgetIds.size
    const allowOpenActions = openCount < maxOpenWidgets
    const widgetIdSet = new Set(
      getConfig().applications
        .filter((app) => app.appType === 'widget')
        .map((app) => app.id),
    )

    const closeCandidates: AmbianceCandidateAction[] = []
    const interactCandidates: AmbianceCandidateAction[] = []
    const openCandidates: AmbianceCandidateAction[] = []
    const enabledBehaviors = Object.entries(simConfig.behaviors)
      .filter(([, behavior]) => !!behavior?.enabled)

    for (const [widgetId, behavior] of enabledBehaviors) {
      if (!widgetIdSet.has(widgetId)) {
        continue
      }

      const lastActionAt = this.lastActionAtByWidget.get(widgetId) ?? 0
      if (Date.now() - lastActionAt < minActionGapMs) {
        continue
      }

      const isOpen = openWidgetIds.has(widgetId)
      if (isOpen) {
        if (shouldTrigger(behavior.closeChance)) {
          closeCandidates.push({ widgetId, action: 'close' })
        } else if (shouldTrigger(behavior.interactChance ?? 0.65)) {
          interactCandidates.push({ widgetId, action: 'interact' })
        }
      } else if (allowOpenActions && shouldTrigger(behavior.openChance)) {
        openCandidates.push({ widgetId, action: 'open' })
      }
    }

    let candidates: AmbianceCandidateAction[] = []
    if (openCount === 0) {
      candidates = openCandidates
    } else if (openCount >= maxOpenWidgets) {
      candidates = interactCandidates.length > 0 ? interactCandidates : closeCandidates
    } else {
      const shouldOpenSecondWidget = openCandidates.length > 0 && Math.random() < openWhileOneOpenChance
      if (shouldOpenSecondWidget) {
        candidates = openCandidates
      } else {
        candidates = interactCandidates.length > 0
          ? interactCandidates
          : closeCandidates.length > 0
            ? closeCandidates
            : openCandidates
      }
    }

    const picked = pickWeightedAction(candidates, minActionGapMs, this.lastActionAtByWidget, this.lastWidgetId)
    if (!picked) {
      return
    }

    const actionId = `${Date.now()}-${++this.actionSequence}`
    this.io.to(leaderSocketId).emit('ambiance:simulate', { ...picked, actionId })
    this.markSimulationInFlight(actionId)
    this.lastActionAtByWidget.set(picked.widgetId, Date.now())
    this.lastWidgetId = picked.widgetId
    appendLog('ambiance-sim', `${picked.action} requested for widget: ${picked.widgetId} (server-authoritative, actionId=${actionId})`)
  }
}
