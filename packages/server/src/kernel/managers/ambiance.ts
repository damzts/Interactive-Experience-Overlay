import type { Server } from 'socket.io'
import { buildWidgetSimulationIntent, getAmbianceInteractMirrorPolicy, pickAmbianceInteractionIntent, withDesktopAmbianceDefaults } from '@ieomlabs/shared'
import type { AppConfig, Manager, ManagerStatus } from '@ieomlabs/shared'
import type { KernelBus } from '../bus.js'
import logger from '../../lib/logger.js'
import type {
  AmbianceDiagnosticsPayload,
  AmbianceHistoryEntry,
  AmbianceSimulationDonePayload,
  AmbianceSimulationPayload,
  AmbianceWidgetBehavior,
  AmbianceNavBehavior,
} from '@ieomlabs/shared'
import { STATE } from '@ieomlabs/shared'

const SIMULATION_PENDING_TIMEOUT_MS = 5000    // "if no ack in 5s, cancel"
const SIMULATION_FALLBACK_TIMEOUT_MS = 30000
const AMBIANCE_HISTORY_LIMIT = 10             // circular buffer
const DEFAULT_BEHAVIOR: AmbianceWidgetBehavior = {
  enabled: true,
  openChance: 0.18,
  closeChance: 0.12,
  interactChance: 0.65,
}
type AmbianceCandidateAction = Pick<AmbianceSimulationPayload, 'widgetId' | 'action'> & {
  targetKind?: AmbianceSimulationPayload['targetKind']
  menuPath?: string[]
}

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

export class AmbianceManager implements Manager {
  readonly name = 'AmbianceManager'
  private _status: ManagerStatus = 'idle'
  private tickTimer: ReturnType<typeof setTimeout> | null = null
  private acceptTimeout: ReturnType<typeof setTimeout> | null = null
  private simulationTimeout: ReturnType<typeof setTimeout> | null = null
  private getOpenWidgetIds?: () => Set<string>
  private getSimulationLeaderSocketId?: () => string | null
  private lastActionAtByWidget = new Map<string, number>()
  private lastWidgetId: string | null = null
  private simulationInFlight = false
  private pendingPhase: 'pending' | 'running' | null = null
  private inFlightActionId: string | null = null
  private actionSequence = 0
  private lastStartedAt: number | null = null
  private lastTickAt: number | null = null
  private lastActionAt: number | null = null
  private lastActionWidgetId: string | null = null
  private lastAction: 'open' | 'close' | 'interact' | 'select' | null = null
  private lastSkipReason: string | null = null
  private overlayReady = false
  private history: AmbianceHistoryEntry[] = []
  private historySequence = 0
  private diagnosticsListener?: (payload: AmbianceDiagnosticsPayload) => void

  constructor(private io: Server, private getConfig: () => AppConfig, private bus?: KernelBus) {}

  // ── Manager interface ────────────────────────────────────────
  init(): void { this._status = 'idle' }
  dispose(): void { this.stop(); this._status = 'stopped' }
  status(): ManagerStatus { return this._status }

  setDiagnosticsListener(listener?: (payload: AmbianceDiagnosticsPayload) => void) {
    this.diagnosticsListener = listener
    this.emitDiagnostics()
  }

  setOpenWidgetIdsGetter(getter: () => Set<string>) {
    this.getOpenWidgetIds = getter
  }

  setSimulationLeaderGetter(getter: () => string | null) {
    this.getSimulationLeaderSocketId = getter
  }

  start() {
    this.stop()
    this._status = 'running'
    const config = withDesktopAmbianceDefaults(this.getConfig().desktopAmbiance)
    this.lastStartedAt = Date.now()

    if (!config.widgetSimulation.enabled) {
      this.lastSkipReason = 'simulation disabled'
      logger.info('[ambiance] AI simulation manager stopped (disabled in config).')
      this.emitDiagnostics()
      return
    }

    this.lastSkipReason = null

    const scheduleNextTick = () => {
      const simCfg = withDesktopAmbianceDefaults(this.getConfig().desktopAmbiance).widgetSimulation
      const intervalMs = Math.max(1000, simCfg.intervalSeconds * 1000)
      const jitter = Math.max(0, Math.min(0.8, simCfg.tickJitterFactor ?? 0.2))
      const variance = (Math.random() * 2 - 1) * jitter * intervalMs
      const delay = Math.max(500, intervalMs + variance)
      this.tickTimer = setTimeout(() => {
        this.tick()
        if (this._status === 'running') scheduleNextTick()
      }, delay)
    }

    scheduleNextTick()
    logger.info({ intervalSec: config.widgetSimulation.intervalSeconds }, 'AI simulation manager started')
    this.emitDiagnostics()
  }

  stop() {
    if (this.tickTimer) {
      clearTimeout(this.tickTimer)
      this.tickTimer = null
      logger.info('[ambiance] AI simulation manager stopped.')
    }
    this._status = 'stopped'
    this.clearSimulationInFlight()
    this.lastActionAtByWidget.clear()
    this.lastWidgetId = null
    this.lastSkipReason = 'manager stopped'
    this.emitDiagnostics()
  }

  isSimulationInFlight() {
    return this.simulationInFlight
  }

  setOverlayReady(ready: boolean) {
    this.overlayReady = ready
    this.emitDiagnostics()
  }

  clearHistory() {
    if (this.history.length === 0) return
    this.history = []
    this.emitDiagnostics()
  }

  recordHistory(
    type: AmbianceHistoryEntry['type'],
    message: string,
    metadata: Omit<Partial<AmbianceHistoryEntry>, 'id' | 'timestamp' | 'type' | 'message'> = {},
  ) {
    const entry: AmbianceHistoryEntry = {
      id: `ambiance-history-${Date.now()}-${++this.historySequence}`,
      timestamp: Date.now(),
      type,
      message,
      ...metadata,
    }
    this.history = [entry, ...this.history].slice(0, AMBIANCE_HISTORY_LIMIT)
    this.emitDiagnostics()
  }

  markSimulationCompleted(
    actionId?: string,
    payload?: Pick<AmbianceSimulationDonePayload, 'ok' | 'durationMs'>,
    options?: { recordHistory?: boolean },
  ) {
    if (actionId && this.inFlightActionId && actionId !== this.inFlightActionId) {
      return
    }
    if ((options?.recordHistory ?? true) && this.inFlightActionId) {
      this.recordHistory(
        'simulate-done',
        `simulation finished${payload?.ok === false ? ' with failure' : ''}`,
        {
          actionId: this.inFlightActionId,
          widgetId: this.lastActionWidgetId ?? undefined,
          action: this.lastAction ?? undefined,
          leaderSocketId: this.getSimulationLeaderSocketId?.() ?? null,
        },
      )
    }
    this.clearSimulationInFlight()
    this.emitDiagnostics()
  }

  private clearSimulationInFlight() {
    this.simulationInFlight = false
    this.pendingPhase = null
    this.inFlightActionId = null
    if (this.acceptTimeout) {
      clearTimeout(this.acceptTimeout)
      this.acceptTimeout = null
    }
    if (this.simulationTimeout) {
      clearTimeout(this.simulationTimeout)
      this.simulationTimeout = null
    }
  }

  markSimulationDispatched(payload: AmbianceSimulationPayload) {
    this.clearSimulationInFlight()
    this.simulationInFlight = true
    this.pendingPhase = 'pending'
    this.inFlightActionId = payload.actionId
    this.recordHistory('simulate-dispatched', `simulation dispatched for ${payload.widgetId}`, {
      actionId: payload.actionId,
      widgetId: payload.widgetId,
      action: payload.action,
      leaderSocketId: this.getSimulationLeaderSocketId?.() ?? null,
    })
    // Single "pending" timeout: if not accepted+started within 5s, cancel
    this.acceptTimeout = setTimeout(() => {
      const actionId = this.inFlightActionId
      this.simulationInFlight = false
      this.pendingPhase = null
      this.inFlightActionId = null
      this.acceptTimeout = null
      this.lastSkipReason = 'simulation pending timeout released lock'
      this.recordHistory('simulate-accept-timeout', 'simulation pending timeout released lock', {
        actionId: actionId ?? undefined,
        widgetId: this.lastActionWidgetId ?? undefined,
        action: this.lastAction ?? undefined,
        leaderSocketId: this.getSimulationLeaderSocketId?.() ?? null,
      })
      this.emitDiagnostics()
    }, SIMULATION_PENDING_TIMEOUT_MS)
    this.emitDiagnostics()
  }

  /** Called when the overlay client accepts the simulation (transitions to running). */
  markSimulationAccepted(actionId?: string) {
    if (actionId && this.inFlightActionId && actionId !== this.inFlightActionId) return
    if (!this.simulationInFlight) return

    // Clear the pending timeout — we're now running
    if (this.acceptTimeout) {
      clearTimeout(this.acceptTimeout)
      this.acceptTimeout = null
    }
    this.pendingPhase = 'running'
    this.recordHistory('simulate-accepted', 'leader accepted and started simulation', {
      actionId: this.inFlightActionId ?? undefined,
      widgetId: this.lastActionWidgetId ?? undefined,
      action: this.lastAction ?? undefined,
      leaderSocketId: this.getSimulationLeaderSocketId?.() ?? null,
    })
    this.simulationTimeout = setTimeout(() => {
      const inFlightActionId = this.inFlightActionId
      this.simulationInFlight = false
      this.pendingPhase = null
      this.inFlightActionId = null
      this.simulationTimeout = null
      this.lastSkipReason = 'simulation completion timeout released lock'
      this.recordHistory('simulate-completion-timeout', 'simulation completion timeout released lock', {
        actionId: inFlightActionId ?? undefined,
        widgetId: this.lastActionWidgetId ?? undefined,
        action: this.lastAction ?? undefined,
        leaderSocketId: this.getSimulationLeaderSocketId?.() ?? null,
      })
      this.emitDiagnostics()
    }, SIMULATION_FALLBACK_TIMEOUT_MS)
    this.emitDiagnostics()
  }

  /** Alias: overlay accepted → same as markSimulationAccepted in 2-phase model */
  markSimulationStarted(actionId?: string) {
    this.markSimulationAccepted(actionId)
  }

  getDiagnostics(): AmbianceDiagnosticsPayload {
    const config = withDesktopAmbianceDefaults(this.getConfig().desktopAmbiance)
    const simConfig = config.widgetSimulation
    const openWidgetCount = this.getOpenWidgetIds?.().size ?? 0
    const enabledWidgetCount = this.getEffectiveBehaviors().filter(([, behavior]) => behavior.enabled).length
    const leaderSocketId = this.getSimulationLeaderSocketId?.() ?? null

    return {
      enabled: simConfig.enabled,
      intervalSeconds: Math.max(1, simConfig.intervalSeconds),
      lastStartedAt: this.lastStartedAt,
      lastTickAt: this.lastTickAt,
      lastActionAt: this.lastActionAt,
      lastActionWidgetId: this.lastActionWidgetId,
      lastAction: this.lastAction,
      inFlight: this.simulationInFlight,
      pendingPhase: this.pendingPhase,
      pendingActionId: this.inFlightActionId,
      leaderSocketId,
      overlayReady: this.overlayReady,
      history: this.history,
      openWidgetCount,
      enabledWidgetCount,
      maxOpenWidgets: Math.max(1, simConfig.maxOpenWidgets ?? 2),
      openWhileOneOpenChance: Math.max(0, Math.min(1, simConfig.openWhileOneOpenChance ?? 0.35)),
      lastSkipReason: this.lastSkipReason,
    }
  }

  private emitDiagnostics() {
    this.diagnosticsListener?.(this.getDiagnostics())
  }

  private getEffectiveBehaviors() {
    const widgetIds = this.getConfig().applications.map((app) => app.id)
    const configuredBehaviors = withDesktopAmbianceDefaults(this.getConfig().desktopAmbiance).widgetSimulation.behaviors
    const hasEnabledBehavior = Object.values(configuredBehaviors).some((behavior) => !!behavior?.enabled)

    return widgetIds.map((widgetId) => {
      const configured = configuredBehaviors[widgetId]
      return [
        widgetId,
        configured
          ? configured
          : hasEnabledBehavior
            ? { ...DEFAULT_BEHAVIOR, enabled: false }
            : { ...DEFAULT_BEHAVIOR },
      ] as const
    })
  }

  private getNavCandidatePool(): AmbianceCandidateAction[] {
    const appConfig = this.getConfig()
    const simConfig = withDesktopAmbianceDefaults(appConfig.desktopAmbiance).widgetSimulation
    const layouts = appConfig.widgetLayouts ?? []
    const scenes = appConfig.scenes ?? {}
    const candidates: AmbianceCandidateAction[] = []

    for (const [layoutId, behavior] of Object.entries(simConfig.layoutBehaviors ?? {})) {
      if (!behavior?.enabled) continue
      const layout = layouts.find((l) => l.id === layoutId)
      if (!layout) continue
      candidates.push({ widgetId: layoutId, action: 'select', targetKind: 'layout', menuPath: ['Layouts', layout.label] })
    }

    const sceneLabel = (id: string): string => {
      if (id === STATE.LOBBY) return 'Lobby'
      if (id === STATE.DESKTOP) return 'Desktop'
      return scenes[id]?.label ?? id
    }
    for (const [sceneId, behavior] of Object.entries(simConfig.sceneBehaviors ?? {})) {
      if (!behavior?.enabled) continue
      candidates.push({ widgetId: sceneId, action: 'select', targetKind: 'scene', menuPath: ['Scenes', sceneLabel(sceneId)] })
    }

    return candidates
  }

  private tick() {
    const config = withDesktopAmbianceDefaults(this.getConfig().desktopAmbiance)
    const simConfig = config.widgetSimulation
    this.lastTickAt = Date.now()

    if (!simConfig.enabled) {
      this.lastSkipReason = 'simulation disabled'
      this.emitDiagnostics()
      return
    }

    const leaderSocketId = this.getSimulationLeaderSocketId?.() ?? null
    if (!leaderSocketId) {
      this.clearSimulationInFlight()
      this.lastSkipReason = 'no simulation leader connected'
      this.emitDiagnostics()
      return
    }

    if (this.simulationInFlight) {
      this.lastSkipReason = 'waiting for prior simulated action to finish'
      this.emitDiagnostics()
      return
    }

    const openWidgetIds = this.getOpenWidgetIds?.() ?? new Set()
    const intervalMs = Math.max(1, simConfig.intervalSeconds) * 1000
    const minActionGapMs = Math.max(1500, Math.round(intervalMs * 0.8))
    const maxOpenWidgets = Math.max(1, simConfig.maxOpenWidgets ?? 2)
    const openWhileOneOpenChance = Math.max(0, Math.min(1, simConfig.openWhileOneOpenChance ?? 0.35))
    const openCount = openWidgetIds.size
    const allowOpenActions = openCount < maxOpenWidgets
    const closeCandidates: AmbianceCandidateAction[] = []
    const interactCandidates: AmbianceCandidateAction[] = []
    const openCandidates: AmbianceCandidateAction[] = []
    const selectCandidates: AmbianceCandidateAction[] = []
    const enabledBehaviors = this.getEffectiveBehaviors()
      .filter(([, behavior]) => !!behavior?.enabled)

    for (const [widgetId, behavior] of enabledBehaviors) {
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

    // Layout/scene select candidates — evaluated independently of widget open/close state
    const simConfig2 = withDesktopAmbianceDefaults(this.getConfig().desktopAmbiance).widgetSimulation
    const navPool = this.getNavCandidatePool()
    for (const candidate of navPool) {
      const lastActionAt = this.lastActionAtByWidget.get(candidate.widgetId) ?? 0
      if (Date.now() - lastActionAt < minActionGapMs) continue
      const navBehaviors = candidate.targetKind === 'layout'
        ? (simConfig2.layoutBehaviors ?? {})
        : (simConfig2.sceneBehaviors ?? {})
      const navBehavior = navBehaviors[candidate.widgetId]
      if (navBehavior && shouldTrigger(navBehavior.selectChance)) {
        selectCandidates.push(candidate)
      }
    }

    let candidates: AmbianceCandidateAction[] = []
    if (openCount === 0) {
      candidates = openCandidates.length > 0 ? openCandidates : selectCandidates
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
            : openCandidates.length > 0
              ? openCandidates
              : selectCandidates
      }
    }

    // Merge in select candidates when there are no other candidates
    if (candidates.length === 0 && selectCandidates.length > 0) {
      candidates = selectCandidates
    }

    const enabledBehaviorCount = enabledBehaviors.length
    if (enabledBehaviorCount === 0 && selectCandidates.length === 0) {
      this.lastSkipReason = 'no widget or nav behaviors are enabled'
      this.emitDiagnostics()
      return
    }

    const picked = pickWeightedAction(candidates, minActionGapMs, this.lastActionAtByWidget, this.lastWidgetId)
    if (!picked) {
      this.lastSkipReason = openCount === 0
        ? 'no widgets passed open thresholds this tick'
        : 'no widgets passed interaction or close thresholds this tick'
      this.emitDiagnostics()
      return
    }

    const actionId = `${Date.now()}-${++this.actionSequence}`
    const mirrorPolicy = picked.action === 'interact'
      ? getAmbianceInteractMirrorPolicy(picked.widgetId)
      : 'shared-safe'
    const sharedIntent = picked.action === 'interact'
      ? (() => {
          const intent = pickAmbianceInteractionIntent(picked.widgetId)
          return intent ? buildWidgetSimulationIntent(actionId, intent) : null
        })()
      : null
    const payload: AmbianceSimulationPayload = {
      widgetId: picked.widgetId,
      action: picked.action,
      ...(picked.targetKind ? { targetKind: picked.targetKind } : {}),
      ...(picked.menuPath ? { menuPath: picked.menuPath } : {}),
      actionId,
      mirrorPolicy,
      sharedIntent,
    }
    this.io.to(leaderSocketId).emit('ambiance:simulate', payload)
    this.bus?.emit('ambiance:tick', { widgetId: picked.widgetId, action: picked.action })
    this.markSimulationDispatched(payload)
    this.lastActionAtByWidget.set(picked.widgetId, Date.now())
    this.lastWidgetId = picked.widgetId
    this.lastActionAt = Date.now()
    this.lastActionWidgetId = picked.widgetId
    this.lastAction = picked.action
    this.lastSkipReason = null
this.emitDiagnostics()
  }
}
