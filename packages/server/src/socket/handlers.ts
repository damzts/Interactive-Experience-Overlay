import type { Server, Socket } from 'socket.io'
import {
  DEFAULT_WIDGET_THEME_PRESETS,
  STATE,
  mergeAppConfig,
  withEventConfigDefaults,
  withDesktopAmbianceDefaults,
  withDesktopConfigDefaults,
  type AmbianceSimulationStartedPayload,
  type AmbianceHistoryEntry,
  type TransitionStep,
  type TransitionPlayPayload,
  type DesktopNotificationPayload,
  type DesktopRuntimeStatePayload,
  type DesktopRecycleBinPayload,
  type DesktopScreenSaverPreviewPayload,
  type DesktopStartMenuSimulationPhasePayload,
  type AmbianceSimulationAcceptedPayload,
  type AmbianceSimulationDonePayload,
  type CameraPermissionState,
  type OverlayClientDiagnostics,
  type OverlayClientKind,
  type OverlayRuntimeStatusPayload,
  type RuntimeConfigOverridePayload,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type InterServerEvents,
  type SocketData,
  type KeybindExecutionPayload,
  type OverlayTriggerPayload,
  type WidgetSimulationIntentPayload,
  type WidgetSimulationCommandPayload,
  type DesktopTheme,
  type EventWidgetThemePatch,
  type WidgetSkinTheme,
  type WidgetThemeConfig,
} from '@ieom/shared'
import type { AppConfig, DesktopAmbianceConfig, DesktopConfig, EventConfig } from '@ieom/shared'
import type { SceneMachine, TransitionStartPayload } from '../state/machine.js'
import type { EventScheduler } from '../events/scheduler.js'
import type { AmbianceManager } from '../ambiance/manager.js'
import { getConfig, persistConfig } from '../services/ConfigService.js'

type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

/** Coerce a legacy single-string transition into a one-step array.
 *  Returns undefined (not []) when nothing is configured so callers can
 *  distinguish "explicitly empty" from "unset". */
function stepFromString(s: string | undefined): TransitionStep[] | undefined {
  if (!s || s === 'none') return undefined
  // Parse optional ?duration=N suffix
  const qi  = s.indexOf('?')
  const id  = qi >= 0 ? s.slice(0, qi) : s
  const dur = qi >= 0 ? new URLSearchParams(s.slice(qi + 1)).get('duration') : null
  return [{ id, ...(dur ? { duration: parseFloat(dur) } : {}) }]
}

function isNavigableState(value: string): value is STATE {
  return value === STATE.LOBBY || value === STATE.DESKTOP
}

function normalizeActionId(value: string) {
  return value.toLowerCase().replace(/[_\s]+/g, '-')
}

const RANDOMIZABLE_DESKTOP_THEMES: DesktopTheme[] = [
  'win98',
  'frutiger aero',
  'y2k candy',
  'midnight chrome',
  'sunset boulevard',
  'coastal glass',
  'amber terminal',
]

const RANDOMIZABLE_WIDGET_SKINS = Object.keys(DEFAULT_WIDGET_THEME_PRESETS) as WidgetSkinTheme[]

function pickRandomEntry<T>(entries: T[]): T | null {
  if (entries.length === 0) return null
  return entries[Math.floor(Math.random() * entries.length)] ?? entries[0] ?? null
}

function resolveRuntimeDesktopTheme(theme?: DesktopTheme | 'random', currentTheme?: DesktopTheme): DesktopTheme | undefined {
  if (theme === undefined) return undefined
  if (theme !== 'random') return theme
  const pool = currentTheme
    ? RANDOMIZABLE_DESKTOP_THEMES.filter((entry) => entry !== currentTheme)
    : RANDOMIZABLE_DESKTOP_THEMES
  return pickRandomEntry(pool) ?? currentTheme ?? 'win98'
}

function resolveRuntimeWidgetThemePatch(patch?: EventWidgetThemePatch): Partial<WidgetThemeConfig> | undefined {
  if (!patch) return undefined

  if (patch.skin === undefined) {
    return Object.keys(patch).length > 0 ? (patch as Partial<WidgetThemeConfig>) : undefined
  }

  const resolvedSkin = patch.skin === 'random'
    ? pickRandomEntry(RANDOMIZABLE_WIDGET_SKINS) ?? 'metalheart'
    : patch.skin
  const baseTheme = structuredClone(DEFAULT_WIDGET_THEME_PRESETS[resolvedSkin])
  return {
    ...baseTheme,
    ...patch,
    skin: resolvedSkin,
  }
}

/** Resolve exit + intro TransitionStep[] for a scene:change.
 *  Precedence: app-level arrays → app-level legacy strings → scene-level arrays → scene-level legacy strings */
function resolvePipelines(
  cfg: AppConfig,
  fromState: STATE,
  toState: STATE,
): { exit: TransitionStep[]; intro: TransitionStep[] } {
  let exit:  TransitionStep[] | undefined
  let intro: TransitionStep[] | undefined

  // App-level (highest priority)
  for (const app of cfg.applications) {
    if (app.targetSceneId === toState && intro === undefined) {
      intro = app.introTransitions?.length
        ? app.introTransitions
        : stepFromString(app.introTransition)
    }
    if (app.targetSceneId === fromState && exit === undefined) {
      exit = app.exitTransitions?.length
        ? app.exitTransitions
        : stepFromString(app.exitTransition)
    }
  }

  // Scene-level fallback
  if (!intro) {
    const targetScene = cfg.scenes[toState]
    intro = targetScene?.introTransitions?.length
      ? targetScene.introTransitions
      : stepFromString(targetScene?.introTransition)
  }
  if (!exit) {
    const fromScene = cfg.scenes[fromState]
    exit = fromScene?.exitTransitions?.length
      ? fromScene.exitTransitions
      : stepFromString(fromScene?.exitTransition)
  }

  return { exit: exit ?? [], intro: intro ?? [] }
}

export function setupSocketHandlers(
  io: IO,
  machine: SceneMachine,
  scheduler: EventScheduler,
  ambianceManager: AmbianceManager,
  options?: {
    getObsStatus?: () => import('@ieom/shared').ObsStatusPayload
  },
) {
  const LEADER_LEASE_DURATION_MS = 5000
  const LEADER_LEASE_SWEEP_MS = 1000
  const RUNTIME_DIAGNOSTICS_MIN_INTERVAL_MS = 1000
  const openWidgetIds = new Set<string>()
  const socketClientTypes = new Map<string, 'overlay' | 'admin' | 'unknown'>()
  const overlayClientDiagnostics = new Map<string, OverlayClientDiagnostics>()
  let recycleBinFull = withDesktopConfigDefaults(getConfig().desktopConfig).recycleBin.fullOnStart
  let startMenuState: { open: boolean; activeRoot: 'programs' | 'widget-layouts' | null } = { open: false, activeRoot: null }
  let simulationLeaderSocketId: string | null = null
  let leaderLeaseExpiresAt: number | null = null
  let leaderLastHeartbeatAt: number | null = null
  let acceptedSimulatedToggles = 0
  let rejectedSimulatedToggles = 0
  let cameraOwnerSocketId: string | null = null
  let runtimeConfigOverride: RuntimeConfigOverridePayload = {}
  const RUNTIME_OVERRIDE_RESET_SCOPES = [
    'desktop.globalThemeDefault',
    'desktop.iconAnimation',
    'desktop.iconMotion',
    'desktop.screenSaver',
    'desktop.widgetThemeOverrides',
    'ambiance.widgetSimulation',
  ] as const
  type RuntimeOverrideResetScope = typeof RUNTIME_OVERRIDE_RESET_SCOPES[number]
  const runtimeOverrideResetTimers = Object.fromEntries(RUNTIME_OVERRIDE_RESET_SCOPES.map((scope) => [scope, null])) as Record<RuntimeOverrideResetScope, ReturnType<typeof setTimeout> | null>
  const runtimeOverrideResetVersions = Object.fromEntries(RUNTIME_OVERRIDE_RESET_SCOPES.map((scope) => [scope, 0])) as Record<RuntimeOverrideResetScope, number>
  const widgetLayoutOverrideResetTimers = new Map<string, ReturnType<typeof setTimeout>>()
  let runtimeDiagnosticsQueued = false
  let runtimeDiagnosticsFlushTimer: ReturnType<typeof setTimeout> | null = null
  let lastRuntimeDiagnosticsEmitAt = 0

  // Give managers access to live widget state
  ambianceManager.setOpenWidgetIdsGetter(() => openWidgetIds)
  ambianceManager.setSimulationLeaderGetter(() => simulationLeaderSocketId)
  ambianceManager.setOverlayClientDiagnosticsGetter(() => [...overlayClientDiagnostics.values()])

  const getDesktopRuntimeState = (): DesktopRuntimeStatePayload => ({
    openWidgetIds: [...openWidgetIds],
    recycleBinFull,
    startMenuState,
  })

  const emitCameraOwner = () => {
    io.emit('camera:owner', { socketId: cameraOwnerSocketId })
  }

  const pickGrantedCameraOwner = () => {
    const grantedClients = [...overlayClientDiagnostics.values()]
      .filter((client) => client.cameraPermission === 'granted')
      .sort((left, right) => getOverlayLeaderRank(right) - getOverlayLeaderRank(left))
    return grantedClients[0]?.socketId ?? null
  }

  const reconcileCameraOwner = () => {
    if (cameraOwnerSocketId) {
      const current = overlayClientDiagnostics.get(cameraOwnerSocketId)
      if (current?.cameraPermission === 'granted') return
    }

    const nextOwner = pickGrantedCameraOwner()
    if (nextOwner === cameraOwnerSocketId) return
    cameraOwnerSocketId = nextOwner
    emitCameraOwner()
  }

  const mergeRuntimeConfigOverride = (
    base: RuntimeConfigOverridePayload,
    updates: RuntimeConfigOverridePayload,
  ): RuntimeConfigOverridePayload => ({
    desktopConfig: updates.desktopConfig
      ? {
          ...(base.desktopConfig ?? {}),
          ...updates.desktopConfig,
          globalThemeDefault: updates.desktopConfig.globalThemeDefault
            ? {
                ...(base.desktopConfig?.globalThemeDefault ?? {}),
                ...updates.desktopConfig.globalThemeDefault,
                widgetTheme: updates.desktopConfig.globalThemeDefault.widgetTheme
                  ? {
                      ...(base.desktopConfig?.globalThemeDefault?.widgetTheme ?? {}),
                      ...updates.desktopConfig.globalThemeDefault.widgetTheme,
                    }
                  : base.desktopConfig?.globalThemeDefault?.widgetTheme,
              }
            : base.desktopConfig?.globalThemeDefault,
          widgetThemeOverrides: updates.desktopConfig.widgetThemeOverrides
            ? {
                ...(base.desktopConfig?.widgetThemeOverrides ?? {}),
                ...updates.desktopConfig.widgetThemeOverrides,
              }
            : base.desktopConfig?.widgetThemeOverrides,
          widgetPositions: updates.desktopConfig.widgetPositions
            ? {
                ...(base.desktopConfig?.widgetPositions ?? {}),
                ...updates.desktopConfig.widgetPositions,
              }
            : base.desktopConfig?.widgetPositions,
          widgetSizes: updates.desktopConfig.widgetSizes
            ? {
                ...(base.desktopConfig?.widgetSizes ?? {}),
                ...updates.desktopConfig.widgetSizes,
              }
            : base.desktopConfig?.widgetSizes,
          widgetZIndices: updates.desktopConfig.widgetZIndices
            ? {
                ...(base.desktopConfig?.widgetZIndices ?? {}),
                ...updates.desktopConfig.widgetZIndices,
              }
            : base.desktopConfig?.widgetZIndices,
          screenSaver: updates.desktopConfig.screenSaver
            ? {
                ...(base.desktopConfig?.screenSaver ?? {}),
                ...updates.desktopConfig.screenSaver,
              } as NonNullable<RuntimeConfigOverridePayload['desktopConfig']>['screenSaver']
            : base.desktopConfig?.screenSaver,
        } as RuntimeConfigOverridePayload['desktopConfig']
      : base.desktopConfig,
    desktopAmbiance: updates.desktopAmbiance
      ? {
          ...(base.desktopAmbiance ?? {}),
          ...updates.desktopAmbiance,
          widgetSimulation: updates.desktopAmbiance.widgetSimulation
            ? {
                ...(base.desktopAmbiance?.widgetSimulation ?? {}),
                ...updates.desktopAmbiance.widgetSimulation,
                behaviors: updates.desktopAmbiance.widgetSimulation.behaviors
                  ? {
                      ...(base.desktopAmbiance?.widgetSimulation?.behaviors ?? {}),
                      ...updates.desktopAmbiance.widgetSimulation.behaviors,
                    }
                  : base.desktopAmbiance?.widgetSimulation?.behaviors,
              } as Partial<DesktopAmbianceConfig>['widgetSimulation']
            : base.desktopAmbiance?.widgetSimulation,
        } as RuntimeConfigOverridePayload['desktopAmbiance']
      : base.desktopAmbiance,
  })

  const emitRuntimeConfigOverride = () => {
    io.emit('runtime:config:override', runtimeConfigOverride)
  }

  const applyRuntimeConfigOverride = (updates: RuntimeConfigOverridePayload) => {
    runtimeConfigOverride = mergeRuntimeConfigOverride(runtimeConfigOverride, updates)
    emitRuntimeConfigOverride()
  }

  const clearRuntimeOverrideResetTimer = (scope: RuntimeOverrideResetScope) => {
    if (runtimeOverrideResetTimers[scope]) {
      clearTimeout(runtimeOverrideResetTimers[scope])
      runtimeOverrideResetTimers[scope] = null
    }
  }

  const clearWidgetLayoutOverrideResetTimer = (widgetId: string) => {
    const timer = widgetLayoutOverrideResetTimers.get(widgetId)
    if (!timer) return
    clearTimeout(timer)
    widgetLayoutOverrideResetTimers.delete(widgetId)
  }

  const clearRuntimeConfigOverrideScopes = (scopes: RuntimeOverrideResetScope[]) => {
    const nextDesktopConfig = { ...(runtimeConfigOverride.desktopConfig ?? {}) }
    const nextDesktopAmbiance = { ...(runtimeConfigOverride.desktopAmbiance ?? {}) }

    for (const scope of scopes) {
      if (scope === 'desktop.globalThemeDefault') delete nextDesktopConfig.globalThemeDefault
      if (scope === 'desktop.iconAnimation') delete nextDesktopConfig.iconAnimation
      if (scope === 'desktop.iconMotion') delete nextDesktopConfig.iconMotion
      if (scope === 'desktop.screenSaver') delete nextDesktopConfig.screenSaver
      if (scope === 'desktop.widgetThemeOverrides') delete nextDesktopConfig.widgetThemeOverrides
      if (scope === 'ambiance.widgetSimulation') delete nextDesktopAmbiance.widgetSimulation
    }

    runtimeConfigOverride = {
      desktopConfig: Object.keys(nextDesktopConfig).length ? nextDesktopConfig : undefined,
      desktopAmbiance: Object.keys(nextDesktopAmbiance).length ? nextDesktopAmbiance : undefined,
    }
    emitRuntimeConfigOverride()
  }

  const scheduleRuntimeConfigOverrideReset = (scopes: RuntimeOverrideResetScope[], timeoutSeconds: number) => {
    for (const scope of scopes) {
      clearRuntimeOverrideResetTimer(scope)
      const version = runtimeOverrideResetVersions[scope] + 1
      runtimeOverrideResetVersions[scope] = version
      runtimeOverrideResetTimers[scope] = setTimeout(() => {
        if (runtimeOverrideResetVersions[scope] !== version) return
        runtimeOverrideResetTimers[scope] = null
        clearRuntimeConfigOverrideScopes([scope])
      }, timeoutSeconds * 1000)
    }
  }

  const clearAllRuntimeConfigOverrides = () => {
    for (const scope of RUNTIME_OVERRIDE_RESET_SCOPES) {
      clearRuntimeOverrideResetTimer(scope)
      runtimeOverrideResetVersions[scope] += 1
    }
    for (const widgetId of widgetLayoutOverrideResetTimers.keys()) {
      clearWidgetLayoutOverrideResetTimer(widgetId)
    }
    runtimeConfigOverride = {}
    emitRuntimeConfigOverride()
  }

  const clearWidgetRuntimeLayoutOverride = (widgetId: string) => {
    const nextDesktopConfig = { ...(runtimeConfigOverride.desktopConfig ?? {}) }
    const nextPositions = { ...(nextDesktopConfig.widgetPositions ?? {}) }
    const nextSizes = { ...(nextDesktopConfig.widgetSizes ?? {}) }
    const nextZIndices = { ...(nextDesktopConfig.widgetZIndices ?? {}) }
    let changed = false

    if (widgetId in nextPositions) {
      delete nextPositions[widgetId]
      changed = true
    }
    if (widgetId in nextSizes) {
      delete nextSizes[widgetId]
      changed = true
    }
    if (widgetId in nextZIndices) {
      delete nextZIndices[widgetId]
      changed = true
    }

    if (!changed) return false

    if (Object.keys(nextPositions).length) nextDesktopConfig.widgetPositions = nextPositions
    else delete nextDesktopConfig.widgetPositions

    if (Object.keys(nextSizes).length) nextDesktopConfig.widgetSizes = nextSizes
    else delete nextDesktopConfig.widgetSizes

    if (Object.keys(nextZIndices).length) nextDesktopConfig.widgetZIndices = nextZIndices
    else delete nextDesktopConfig.widgetZIndices

    runtimeConfigOverride = {
      desktopConfig: Object.keys(nextDesktopConfig).length ? nextDesktopConfig : undefined,
      desktopAmbiance: runtimeConfigOverride.desktopAmbiance,
    }
    emitRuntimeConfigOverride()
    return true
  }

  const clearWidgetRuntimeLayoutOverrides = (widgetIds: string[]) => {
    let changed = false

    for (const widgetId of widgetIds) {
      clearWidgetLayoutOverrideResetTimer(widgetId)
      if (clearWidgetRuntimeLayoutOverride(widgetId)) {
        changed = true
      }
    }

    return changed
  }

  const scheduleWidgetLayoutRuntimeOverrideReset = (widgetIds: string[], timeoutSeconds: number) => {
    for (const widgetId of widgetIds) {
      clearWidgetLayoutOverrideResetTimer(widgetId)
      const timer = setTimeout(() => {
        widgetLayoutOverrideResetTimers.delete(widgetId)
        clearWidgetRuntimeLayoutOverride(widgetId)
      }, timeoutSeconds * 1000)
      widgetLayoutOverrideResetTimers.set(widgetId, timer)
    }
  }

  const toggleWidgetRuntime = (widgetId: string) => {
    if (openWidgetIds.has(widgetId)) openWidgetIds.delete(widgetId)
    else openWidgetIds.add(widgetId)
    io.emit('widget:toggle', widgetId)
    queueRuntimeDiagnosticsEmit()
  }

  const setWidgetRuntimeOpenState = (widgetId: string, shouldOpen: boolean) => {
    const isOpen = openWidgetIds.has(widgetId)
    if (shouldOpen === isOpen) return
    if (shouldOpen) openWidgetIds.add(widgetId)
    else openWidgetIds.delete(widgetId)
    io.emit('widget:toggle', widgetId)
    queueRuntimeDiagnosticsEmit()
  }

  const emitSimulationLeader = () => {
    io.emit('ambiance:leader', { socketId: simulationLeaderSocketId })
  }

  const updateLeaderLeaseDiagnostics = () => {
    const leaderInfo = simulationLeaderSocketId ? overlayClientDiagnostics.get(simulationLeaderSocketId) : null
    ambianceManager.setLeaderLeaseState({
      ready: leaderInfo?.ready ?? false,
      leaseDurationMs: LEADER_LEASE_DURATION_MS,
      expiresAt: leaderLeaseExpiresAt,
      lastHeartbeatAt: leaderLastHeartbeatAt,
    })
  }

  const emitSimulationMetrics = () => {
    io.emit('ambiance:metrics', {
      accepted: acceptedSimulatedToggles,
      rejected: rejectedSimulatedToggles,
    })
  }

  const emitRuntimeDiagnostics = () => {
    runtimeDiagnosticsQueued = false
    if (runtimeDiagnosticsFlushTimer) {
      clearTimeout(runtimeDiagnosticsFlushTimer)
      runtimeDiagnosticsFlushTimer = null
    }
    lastRuntimeDiagnosticsEmitAt = Date.now()
    io.emit('runtime:diagnostics', {
      scheduler: scheduler.getDiagnostics(),
      ambiance: ambianceManager.getDiagnostics(),
    })
  }

  const queueRuntimeDiagnosticsEmit = () => {
    if (runtimeDiagnosticsQueued) return
    runtimeDiagnosticsQueued = true
    const flush = () => {
      runtimeDiagnosticsFlushTimer = null
      emitRuntimeDiagnostics()
    }

    const waitMs = Math.max(0, RUNTIME_DIAGNOSTICS_MIN_INTERVAL_MS - (Date.now() - lastRuntimeDiagnosticsEmitAt))
    if (waitMs === 0) {
      queueMicrotask(flush)
      return
    }

    runtimeDiagnosticsFlushTimer = setTimeout(flush, waitMs)
  }

  scheduler.setDiagnosticsListener(() => {
    queueRuntimeDiagnosticsEmit()
  })
  ambianceManager.setDiagnosticsListener(() => {
    queueRuntimeDiagnosticsEmit()
  })

  const getSocketClientType = (socket: AppSocket): 'overlay' | 'admin' | 'unknown' => {
    const auth = socket.handshake.auth as { clientType?: string } | undefined
    return auth?.clientType === 'overlay' || auth?.clientType === 'admin'
      ? auth.clientType
      : 'unknown'
  }

  const getOverlayClientDiagnosticsFromSocket = (socket: AppSocket): OverlayClientDiagnostics | null => {
    const auth = socket.handshake.auth as {
      overlayKind?: string
      overlayPort?: string
      overlayLabel?: string
    } | undefined

    const kind: OverlayClientKind = auth?.overlayKind === 'runtime'
      || auth?.overlayKind === 'embedded-preview'
      || auth?.overlayKind === 'dev'
      ? auth.overlayKind
      : 'unknown'

    if (socketClientTypes.get(socket.id) !== 'overlay') {
      return null
    }

    const port = auth?.overlayPort?.trim() ? auth.overlayPort.trim() : null
    const label = auth?.overlayLabel?.trim()
      || (kind === 'runtime'
        ? 'OBS Browser Source (3000)'
        : kind === 'embedded-preview'
          ? `Admin Preview${port ? ` (${port})` : ''}`
          : kind === 'dev'
            ? `Direct Overlay Browser${port ? ` (${port})` : ''}`
            : `Overlay${port ? ` (${port})` : ''}`)

    return {
      socketId: socket.id,
      kind,
      port,
      label,
      mounted: false,
      cursorReady: false,
      widgetRegistryReady: false,
      ready: false,
      readyAt: null,
      lastHeartbeatAt: null,
      cameraPermission: 'unknown',
    }
  }

  const getOverlayLeaderRank = (client: OverlayClientDiagnostics | undefined) => {
    if (!client) return -1
    if (client.kind === 'runtime') return 3
    if (client.kind === 'embedded-preview') return 2
    if (client.kind === 'dev') return 1
    return 0
  }

  const isOverlayLeadershipReady = (client: OverlayClientDiagnostics | undefined | null) => !!client?.ready

  const emitOverlayResync = (reason: string) => {
    for (const candidate of io.sockets.sockets.values()) {
      if (socketClientTypes.get(candidate.id) !== 'overlay') continue
      candidate.emit('overlay:resync', { reason })
    }
    ambianceManager.recordHistory('resync-requested', `overlay resync requested: ${reason}`, {
      leaderSocketId: simulationLeaderSocketId,
    })
  }

  const refreshLeaderLease = (socketId: string) => {
    if (!simulationLeaderSocketId || socketId !== simulationLeaderSocketId) return
    const now = Date.now()
    leaderLastHeartbeatAt = now
    leaderLeaseExpiresAt = now + LEADER_LEASE_DURATION_MS
    const leaderInfo = overlayClientDiagnostics.get(socketId)
    if (leaderInfo) {
      overlayClientDiagnostics.set(socketId, {
        ...leaderInfo,
        lastHeartbeatAt: now,
      })
    }
    updateLeaderLeaseDiagnostics()
    queueRuntimeDiagnosticsEmit()
  }

  const promoteSimulationLeader = (socketId: string, reason: string) => {
    simulationLeaderSocketId = socketId
    refreshLeaderLease(socketId)
    emitSimulationLeader()
    ambianceManager.recordHistory('leader-elected', reason, { leaderSocketId: socketId })
    queueRuntimeDiagnosticsEmit()
  }

  const isAmbianceLeaderEnabled = () => withDesktopAmbianceDefaults(getConfig().desktopAmbiance).widgetSimulation.enabled

  const clearSimulationLeader = (
    reason: string,
    options?: {
      expired?: boolean
      resyncReason?: string
    },
  ) => {
    if (!simulationLeaderSocketId) {
      leaderLeaseExpiresAt = null
      leaderLastHeartbeatAt = null
      updateLeaderLeaseDiagnostics()
      return
    }
    const previousLeaderSocketId = simulationLeaderSocketId
    const shouldResync = !!options?.resyncReason || ambianceManager.isSimulationInFlight()
    ambianceManager.markSimulationCompleted(undefined, undefined, { recordHistory: false })
    simulationLeaderSocketId = null
    leaderLeaseExpiresAt = null
    leaderLastHeartbeatAt = null
    emitSimulationLeader()
    updateLeaderLeaseDiagnostics()
    ambianceManager.recordHistory(options?.expired ? 'leader-expired' : 'leader-cleared', reason, {
      leaderSocketId: previousLeaderSocketId,
    })
    if (shouldResync) {
      emitOverlayResync(options?.resyncReason ?? 'leader-cleared')
    }
    queueRuntimeDiagnosticsEmit()
  }

  const syncSimulationLeaderState = () => {
    if (!isAmbianceLeaderEnabled()) {
      clearSimulationLeader('ambiance disabled cleared simulation leader')
      return
    }
    electSimulationLeaderIfNeeded('sync')
  }

  const electSimulationLeaderIfNeeded = (reason: string) => {
    if (!isAmbianceLeaderEnabled()) {
      clearSimulationLeader('ambiance disabled cleared simulation leader')
      return
    }
    const currentLeader = simulationLeaderSocketId ? overlayClientDiagnostics.get(simulationLeaderSocketId) : null
    const readyCandidates = [...overlayClientDiagnostics.values()]
      .filter((candidate) => isOverlayLeadershipReady(candidate))
      .sort((left, right) => getOverlayLeaderRank(right) - getOverlayLeaderRank(left))[0]

    if (
      simulationLeaderSocketId
      && io.sockets.sockets.has(simulationLeaderSocketId)
      && socketClientTypes.get(simulationLeaderSocketId) === 'overlay'
      && isOverlayLeadershipReady(currentLeader)
      && leaderLeaseExpiresAt !== null
      && leaderLeaseExpiresAt > Date.now()
    ) {
      if (
        readyCandidates
        && readyCandidates.socketId !== simulationLeaderSocketId
        && getOverlayLeaderRank(readyCandidates) > getOverlayLeaderRank(currentLeader ?? undefined)
        && !ambianceManager.isSimulationInFlight()
      ) {
        promoteSimulationLeader(readyCandidates.socketId, `higher-ranked overlay promoted leader (${reason})`)
      }
      return
    }

    if (!readyCandidates) {
      clearSimulationLeader('no ready overlay leader is available')
      return
    }

    if (readyCandidates.socketId !== simulationLeaderSocketId) {
      promoteSimulationLeader(readyCandidates.socketId, `ready overlay elected leader (${reason})`)
      return
    }

    refreshLeaderLease(readyCandidates.socketId)
  }

  updateLeaderLeaseDiagnostics()

  setInterval(() => {
    if (!simulationLeaderSocketId || leaderLeaseExpiresAt === null) {
      return
    }
    if (leaderLeaseExpiresAt > Date.now()) {
      return
    }
    clearSimulationLeader('leader lease expired before disconnect', {
      expired: true,
      resyncReason: 'leader-lease-expired',
    })
    electSimulationLeaderIfNeeded('lease-expired')
  }, LEADER_LEASE_SWEEP_MS)

  const executeConfiguredEvent = (eventDef: EventConfig): { ok: boolean; error?: string } => {
    if (eventDef.effects.length > 0) {
      machine.triggerOverlay({ id: eventDef.id, effects: eventDef.effects })
    }

    for (const action of eventDef.actions ?? []) {
      if (action.kind === 'desktop-config') {
        const currentEffectiveDesktop = withDesktopConfigDefaults(
          mergeAppConfig(getConfig(), runtimeConfigOverride as unknown as Partial<AppConfig>).desktopConfig,
        )
        const resolvedDesktopTheme = resolveRuntimeDesktopTheme(action.patch.theme, currentEffectiveDesktop.globalThemeDefault.theme)
        const resolvedWidgetThemePatch = resolveRuntimeWidgetThemePatch(action.patch.widgetTheme)
        const globalThemeDefaultPatch = resolvedDesktopTheme !== undefined || resolvedWidgetThemePatch
          ? {
              ...(resolvedDesktopTheme !== undefined ? { theme: resolvedDesktopTheme } : {}),
              ...(resolvedWidgetThemePatch ? { widgetTheme: resolvedWidgetThemePatch } : {}),
            }
          : undefined
        const desktopConfigPatch = {
          ...(globalThemeDefaultPatch ? { globalThemeDefault: globalThemeDefaultPatch } : {}),
          ...(action.patch.iconAnimation !== undefined ? { iconAnimation: action.patch.iconAnimation } : {}),
          ...(action.patch.iconMotion !== undefined ? { iconMotion: action.patch.iconMotion } : {}),
          ...(action.patch.screenSaver ? { screenSaver: action.patch.screenSaver } : {}),
        }
        applyRuntimeConfigOverride({ desktopConfig: desktopConfigPatch as RuntimeConfigOverridePayload['desktopConfig'] })
        const resetScopes: RuntimeOverrideResetScope[] = []
        if (globalThemeDefaultPatch !== undefined) resetScopes.push('desktop.globalThemeDefault')
        if (desktopConfigPatch.iconAnimation !== undefined) resetScopes.push('desktop.iconAnimation')
        if (desktopConfigPatch.iconMotion !== undefined) resetScopes.push('desktop.iconMotion')
        if (desktopConfigPatch.screenSaver !== undefined) resetScopes.push('desktop.screenSaver')
        if (resetScopes.length > 0) scheduleRuntimeConfigOverrideReset(resetScopes, action.timeoutSeconds ?? 30)
        continue
      }

      if (action.kind === 'widget-theme-overrides') {
        const currentConfig = getConfig()
        const currentDesktop = withDesktopConfigDefaults(currentConfig.desktopConfig)
        const resolvedThemePatch = resolveRuntimeWidgetThemePatch(action.theme)
        const nextOverrides: NonNullable<DesktopConfig['widgetThemeOverrides']> = {}
        for (const widgetId of action.widgetIds) {
          const globalWidgetTheme = currentDesktop.globalThemeDefault.widgetTheme
          const persistedAppOverride = currentConfig.applications.find((a) => a.id === widgetId)?.themeOverride
          const baseTheme = action.clearExisting
            ? globalWidgetTheme
            : currentDesktop.widgetThemeOverrides?.[widgetId] ?? persistedAppOverride ?? globalWidgetTheme
          nextOverrides[widgetId] = { ...baseTheme, ...(resolvedThemePatch ?? {}) }
        }

        applyRuntimeConfigOverride({
          desktopConfig: {
            widgetThemeOverrides: nextOverrides,
          },
        })
        scheduleRuntimeConfigOverrideReset(['desktop.widgetThemeOverrides'], action.timeoutSeconds ?? 30)
        continue
      }

      if (action.kind === 'widget-layout') {
        const currentDesktop = withDesktopConfigDefaults(getConfig().desktopConfig)
        const layout = (currentDesktop.widgetLayouts ?? []).find((entry) => entry.id === action.layoutId)
        const result = applySavedWidgetLayout(action.layoutId, { persist: false })
        if (!result.ok) return result
        const layoutWidgetIds = Array.from(new Set((layout?.items ?? []).map((item) => item.widgetId).filter(Boolean)))
        if (layoutWidgetIds.length > 0) {
          scheduleWidgetLayoutRuntimeOverrideReset(layoutWidgetIds, action.timeoutSeconds ?? 30)
        }
        continue
      }

      if (action.kind === 'widget-command') {
        if (action.action === 'toggle') {
          toggleWidgetRuntime(action.widgetId)
        } else {
          setWidgetRuntimeOpenState(action.widgetId, action.action === 'open')
        }
        continue
      }

      applyRuntimeConfigOverride({
        desktopAmbiance: {
          widgetSimulation: { ...action.patch } as Partial<DesktopAmbianceConfig>['widgetSimulation'],
        },
      })
      scheduleRuntimeConfigOverrideReset(['ambiance.widgetSimulation'], action.timeoutSeconds ?? 30)
    }

    return { ok: true }
  }

  const triggerConfiguredEvent = (eventId: string): { ok: boolean; error?: string } => {
    const normalized = normalizeActionId(eventId)
    const eventDef = (getConfig().events ?? []).find((entry) => normalizeActionId(entry.id) === normalized)
    if (!eventDef) {
      return { ok: false, error: `Unknown event: ${eventId}` }
    }
    return executeConfiguredEvent(eventDef)
  }

  const runConfiguredAction = (action: string): { ok: boolean; error?: string } => {
    if (!action) return { ok: false, error: 'No action provided' }

    if (action === 'panic') {
      machine.forceState(STATE.DESKTOP)
      return { ok: true }
    }

    if (action.startsWith('scene:')) {
      const target = action.slice(6).trim()
      if (!isNavigableState(target)) {
        return { ok: false, error: `Unknown scene target: ${target}` }
      }
      const cfg = getConfig()
      const { exit, intro } = resolvePipelines(cfg, machine.currentState, target)
      return machine.transition(target, { exit, intro })
    }

    if (action.startsWith('widget:')) {
      const widgetId = action.slice(7).trim()
      if (!widgetId) return { ok: false, error: 'Missing widget id' }
      toggleWidgetRuntime(widgetId)
      return { ok: true }
    }

    if (action.startsWith('event:')) {
      return triggerConfiguredEvent(action.slice(6))
    }

    if (action.startsWith('overlay:')) {
      return triggerConfiguredEvent(action.slice(8))
    }

    return { ok: false, error: `Unsupported action: ${action}` }
  }

  const applySavedWidgetLayout = (layoutId: string, options?: { persist?: boolean }): { ok: boolean; error?: string } => {
    const currentConfig = getConfig()
    const currentDesktop = withDesktopConfigDefaults(currentConfig.desktopConfig)
    const layout = (currentDesktop.widgetLayouts ?? []).find((entry) => entry.id === layoutId)
    if (!layout) {
      return { ok: false, error: `Unknown widget layout: ${layoutId}` }
    }

    const validWidgetIds = new Set(
      currentConfig.applications
        .filter((app) => app.appType === 'widget')
        .map((app) => app.id),
    )
    const layoutItems = layout.items.filter((item) => validWidgetIds.has(item.widgetId))
    if (layoutItems.length === 0) {
      return { ok: false, error: `Widget layout has no valid widgets: ${layoutId}` }
    }

    const nextPositions = { ...(currentDesktop.widgetPositions ?? {}) }
    const nextSizes = { ...(currentDesktop.widgetSizes ?? {}) }
    const nextRuntimeZIndices = { ...(currentDesktop.widgetZIndices ?? {}) }
    const defaultZIndices = currentDesktop.widgetDefaultZIndices ?? {}
    const enabledLayoutItems = layoutItems.filter((item) => item.enabled)

    for (const item of layoutItems) {
      nextPositions[item.widgetId] = { x: item.x, y: item.y }
      nextSizes[item.widgetId] = { width: item.width, height: item.height }
    }

    const orderedEnabledItems = [...enabledLayoutItems]
      .sort((a, b) => {
        if (a.focusPriority !== b.focusPriority) return a.focusPriority - b.focusPriority
        return (defaultZIndices[a.widgetId] ?? 0) - (defaultZIndices[b.widgetId] ?? 0)
      })

    for (const item of orderedEnabledItems) {
      nextRuntimeZIndices[item.widgetId] = item.focusPriority
    }

    if (options?.persist === false) {
      const nextDesktopConfig = { ...(runtimeConfigOverride.desktopConfig ?? {}) }
      const nextRuntimePositions = { ...(nextDesktopConfig.widgetPositions ?? {}) }
      const nextRuntimeSizes = { ...(nextDesktopConfig.widgetSizes ?? {}) }
      const nextRuntimeZIndices = { ...(nextDesktopConfig.widgetZIndices ?? {}) }

      for (const item of layoutItems) {
        delete nextRuntimePositions[item.widgetId]
        delete nextRuntimeSizes[item.widgetId]
        delete nextRuntimeZIndices[item.widgetId]
      }

      for (const item of enabledLayoutItems) {
        nextRuntimePositions[item.widgetId] = { x: item.x, y: item.y }
        nextRuntimeSizes[item.widgetId] = { width: item.width, height: item.height }
      }

      for (const item of orderedEnabledItems) {
        nextRuntimeZIndices[item.widgetId] = item.focusPriority
      }

      if (Object.keys(nextRuntimePositions).length) nextDesktopConfig.widgetPositions = nextRuntimePositions
      else delete nextDesktopConfig.widgetPositions

      if (Object.keys(nextRuntimeSizes).length) nextDesktopConfig.widgetSizes = nextRuntimeSizes
      else delete nextDesktopConfig.widgetSizes

      if (Object.keys(nextRuntimeZIndices).length) nextDesktopConfig.widgetZIndices = nextRuntimeZIndices
      else delete nextDesktopConfig.widgetZIndices

      runtimeConfigOverride = {
        desktopConfig: Object.keys(nextDesktopConfig).length
          ? nextDesktopConfig as RuntimeConfigOverridePayload['desktopConfig']
          : undefined,
        desktopAmbiance: runtimeConfigOverride.desktopAmbiance,
      }
      emitRuntimeConfigOverride()
    } else {
      const nextConfig = mergeAppConfig(currentConfig, {
        desktopConfig: {
          widgetPositions: nextPositions,
          widgetSizes: nextSizes,
          widgetZIndices: nextRuntimeZIndices,
        } as DesktopConfig,
      })
      persistConfig(nextConfig, machine, {
        desktopConfig: {
          widgetPositions: nextConfig.desktopConfig?.widgetPositions,
          widgetSizes: nextConfig.desktopConfig?.widgetSizes,
          widgetZIndices: nextConfig.desktopConfig?.widgetZIndices,
        } as DesktopConfig,
      })
    }

    for (const item of layoutItems) {
      const isOpen = openWidgetIds.has(item.widgetId)
      if (item.enabled !== isOpen) {
        toggleWidgetRuntime(item.widgetId)
      }
    }

    io.emit('widget:layout:apply', layoutId)
    return { ok: true }
  }

  const resolveKeybindAction = (payload: KeybindExecutionPayload) => {
    const inlineAction = payload.action?.trim()
    if (inlineAction) return inlineAction
    const key = payload.key?.trim()
    if (!key) return undefined
    return getConfig().keybinds[payload.scope]?.[key]
  }

  // Broadcast machine state events to all clients
  machine.on('state:change', (payload: { state: STATE; previousState: STATE }) => {
    io.emit('state:update', payload)
  })

  machine.on('config:patch', (updates: Partial<AppConfig>, _config: AppConfig) => {
    io.emit('config:patch', updates)
  })

  machine.on('config:update', (config: AppConfig) => {
    const nextRecycleBinFull = withDesktopConfigDefaults(config.desktopConfig).recycleBin.fullOnStart
    if (nextRecycleBinFull !== recycleBinFull) {
      recycleBinFull = nextRecycleBinFull
      io.emit('desktop:recycle-bin', { full: recycleBinFull })
    }

    syncSimulationLeaderState()
  })

  machine.on('transition:start', (payload: TransitionStartPayload) => {
    const out: TransitionPlayPayload = {
      from: payload.from,
      to:   payload.to,
      exit: payload.exit,
      intro: payload.intro,
    }
    io.emit('transition:play', out)
  })

  machine.on('overlay:trigger', (payload: OverlayTriggerPayload) => {
    io.emit('overlay:show', payload)
  })

  machine.on('event:trigger', (eventDef: EventConfig) => {
    void executeConfiguredEvent(eventDef)
  })

  io.on('connection', (socket: AppSocket) => {
    const clientType = getSocketClientType(socket)
    socketClientTypes.set(socket.id, clientType)
    const overlayInfo = clientType === 'overlay' ? getOverlayClientDiagnosticsFromSocket(socket) : null
    if (overlayInfo) {
      overlayClientDiagnostics.set(socket.id, overlayInfo)
      queueRuntimeDiagnosticsEmit()
    }
    console.log(`[socket] connected: ${socket.id}`)

    if (clientType === 'overlay') {
      electSimulationLeaderIfNeeded('connect')
    }
    socket.emit('ambiance:leader', { socketId: simulationLeaderSocketId })
    socket.emit('ambiance:metrics', {
      accepted: acceptedSimulatedToggles,
      rejected: rejectedSimulatedToggles,
    })
    socket.emit('camera:owner', { socketId: cameraOwnerSocketId })
    socket.emit('runtime:config:override', runtimeConfigOverride)
    socket.emit('runtime:diagnostics', {
      scheduler: scheduler.getDiagnostics(),
      ambiance: ambianceManager.getDiagnostics(),
    })
    if (options?.getObsStatus) {
      socket.emit('obs:status', options.getObsStatus())
    }

    socket.on('state:request', (callback) => {
      callback(machine.currentState)
    })

    socket.on('ambiance:leader:request', (callback) => {
      callback({ socketId: simulationLeaderSocketId })
    })

    socket.on('ambiance:leader:heartbeat', () => {
      if (socket.id !== simulationLeaderSocketId) {
        return
      }
      refreshLeaderLease(socket.id)
    })

    socket.on('ambiance:history:clear', () => {
      if (socketClientTypes.get(socket.id) !== 'admin') {
        return
      }
      ambianceManager.clearHistory()
      queueRuntimeDiagnosticsEmit()
    })

    socket.on('overlay:runtime:status', (payload: OverlayRuntimeStatusPayload) => {
      if (socketClientTypes.get(socket.id) !== 'overlay') {
        return
      }
      const current = overlayClientDiagnostics.get(socket.id)
      if (!current) {
        return
      }
      overlayClientDiagnostics.set(socket.id, {
        ...current,
        mounted: payload.mounted,
        cursorReady: payload.cursorReady,
        widgetRegistryReady: payload.widgetRegistryReady,
        ready: payload.ready,
        readyAt: payload.ready ? current.readyAt ?? Date.now() : null,
        cameraPermission: payload.cameraPermission,
      })

      if (socket.id === simulationLeaderSocketId) {
        if (payload.ready) {
          refreshLeaderLease(socket.id)
        } else {
          clearSimulationLeader('leader reported not ready', {
            resyncReason: 'leader-not-ready',
          })
        }
      }

      if (socket.id === cameraOwnerSocketId && payload.cameraPermission !== 'granted') {
        reconcileCameraOwner()
      }

      electSimulationLeaderIfNeeded('runtime-status')
      queueRuntimeDiagnosticsEmit()
    })

    socket.on('camera:owner:select', (nextSocketId, callback) => {
      if (socketClientTypes.get(socket.id) !== 'admin') {
        if (callback) callback('Only admin clients can select the camera owner')
        return
      }

      const normalizedSocketId = typeof nextSocketId === 'string' ? nextSocketId.trim() : null
      if (!normalizedSocketId) {
        cameraOwnerSocketId = null
        emitCameraOwner()
        if (callback) callback(null)
        return
      }

      const candidate = overlayClientDiagnostics.get(normalizedSocketId)
      if (!candidate) {
        if (callback) callback('Overlay client not found')
        return
      }

      if (candidate.cameraPermission !== 'granted') {
        if (callback) callback('Selected overlay client has not granted camera permission')
        return
      }

      cameraOwnerSocketId = normalizedSocketId
      emitCameraOwner()
      if (callback) callback(null)
    })

    socket.on('overlay:force-resync', (payload?: { reason?: string }) => {
      if (socketClientTypes.get(socket.id) !== 'admin') {
        return
      }
      emitOverlayResync(payload?.reason?.trim() || 'admin-force-resync')
      queueRuntimeDiagnosticsEmit()
    })

    socket.on('runtime:config:override:clear', (callback) => {
      if (socketClientTypes.get(socket.id) !== 'admin') {
        if (callback) callback('Only admin clients can clear runtime overrides')
        return
      }
      clearAllRuntimeConfigOverrides()
      if (callback) callback(null)
    })

    socket.on('runtime:config:override:widget:clear', (widgetId, callback) => {
      if (socketClientTypes.get(socket.id) !== 'admin') {
        if (callback) callback('Only admin clients can clear widget runtime overrides')
        return
      }

      const normalizedWidgetId = widgetId.trim()
      if (!normalizedWidgetId) {
        if (callback) callback('Missing widget id')
        return
      }

      clearWidgetRuntimeLayoutOverride(normalizedWidgetId)
      if (callback) callback(null)
    })

    socket.on('runtime:config:override:widget-layout:clear', (widgetIds, callback) => {
      if (socketClientTypes.get(socket.id) !== 'admin') {
        if (callback) callback('Only admin clients can clear widget layout runtime overrides')
        return
      }

      const normalizedWidgetIds = [...new Set(
        (widgetIds ?? [])
          .map((widgetId) => widgetId.trim())
          .filter(Boolean),
      )]

      if (normalizedWidgetIds.length === 0) {
        if (callback) callback('Missing widget ids')
        return
      }

      clearWidgetRuntimeLayoutOverrides(normalizedWidgetIds)
      if (callback) callback(null)
    })

    socket.on('desktop:state:request', (callback) => {
      callback(getDesktopRuntimeState())
    })

    socket.on('widget:layout:apply', (layoutId) => {
      scheduler?.noteActivity()
      applySavedWidgetLayout(layoutId, { persist: false })
    })

    socket.on('desktop:icon:drag', (payload) => {
      scheduler?.noteActivity()
      socket.broadcast.emit('desktop:icon:drag', payload)
    })

    socket.on('desktop:widget:drag', (payload) => {
      if (payload.phase !== 'move') {
        scheduler?.noteActivity()
      }
      if (payload.phase === 'end') {
        applyRuntimeConfigOverride({
          desktopConfig: {
            widgetPositions: {
              [payload.widgetId]: {
                x: Math.max(0, Math.round(payload.x)),
                y: Math.max(0, Math.round(payload.y)),
              },
            },
          },
        })
      }
      socket.broadcast.emit('desktop:widget:drag', payload)
    })

    socket.on('desktop:widget:resize', (payload) => {
      if (payload.phase !== 'move') {
        scheduler?.noteActivity()
      }
      if (payload.phase === 'end') {
        applyRuntimeConfigOverride({
          desktopConfig: {
            widgetPositions: {
              [payload.widgetId]: {
                x: Math.max(0, Math.round(payload.x)),
                y: Math.max(0, Math.round(payload.y)),
              },
            },
            widgetSizes: {
              [payload.widgetId]: {
                width: Math.max(180, Math.round(payload.width)),
                height: Math.max(140, Math.round(payload.height)),
              },
            },
          },
        })
      }
      socket.broadcast.emit('desktop:widget:resize', payload)
    })

    socket.on('scene:change', (target, callback) => {
      scheduler?.noteActivity()
      const cfg = getConfig()
      const { exit, intro } = resolvePipelines(cfg, machine.currentState, target)
      const result = machine.transition(target, { exit, intro })
      if (callback) callback(result.ok ? null : result.error ?? 'Unknown error')
    })

    socket.on('overlay:trigger', (payload: OverlayTriggerPayload) => {
      scheduler?.noteActivity()
      machine.triggerOverlay(payload)
    })

    socket.on('event:preview', (eventDef: EventConfig, callback) => {
      scheduler?.noteActivity()
      const result = executeConfiguredEvent(withEventConfigDefaults(eventDef))
      if (callback) callback(result.ok ? null : result.error ?? 'Unknown error')
    })

    socket.on('keybind:execute', (payload, callback) => {
      scheduler?.noteActivity()
      const action = resolveKeybindAction(payload)
      if (!action) {
        if (callback) callback(`No ${payload.scope} keybind action found`)
        return
      }
      const result = runConfiguredAction(action)
      if (callback) callback(result.ok ? null : result.error ?? 'Unknown error')
    })

    socket.on('panic', () => {
      scheduler?.noteActivity()
      machine.forceState(STATE.DESKTOP)
    })

    socket.on('widget:toggle', (widgetId: string) => {
      scheduler?.noteActivity()
      toggleWidgetRuntime(widgetId)
    })

    socket.on('widget:simulate', (widgetId: string) => {
      if (socket.id !== simulationLeaderSocketId) {
        rejectedSimulatedToggles += 1
        emitSimulationMetrics()
        console.warn(`[ambiance] Ignored simulated widget toggle from non-leader ${socket.id} for ${widgetId}`)
        return
      }
      acceptedSimulatedToggles += 1
      emitSimulationMetrics()
      toggleWidgetRuntime(widgetId)
    })

    socket.on('widget:simulate:action', (payload: WidgetSimulationCommandPayload) => {
      if (socket.id !== simulationLeaderSocketId) {
        rejectedSimulatedToggles += 1
        emitSimulationMetrics()
        console.warn(`[ambiance] Ignored simulated widget action from non-leader ${socket.id} for ${payload.widgetId}`)
        return
      }

      acceptedSimulatedToggles += 1
      emitSimulationMetrics()

      if (payload.action === 'toggle') {
        toggleWidgetRuntime(payload.widgetId)
        return
      }

      setWidgetRuntimeOpenState(payload.widgetId, payload.action === 'open')
    })

    socket.on('ambiance:simulate:accepted', (payload: AmbianceSimulationAcceptedPayload) => {
      if (socket.id !== simulationLeaderSocketId) {
        return
      }
      ambianceManager.markSimulationAccepted(payload.actionId)
    })

    socket.on('ambiance:simulate:started', (payload: AmbianceSimulationStartedPayload) => {
      if (socket.id !== simulationLeaderSocketId) {
        return
      }
      ambianceManager.markSimulationStarted(payload.actionId)
    })

    socket.on('ambiance:simulate:done', (payload: AmbianceSimulationDonePayload) => {
      if (socket.id !== simulationLeaderSocketId) {
        return
      }
      ambianceManager.markSimulationCompleted(payload.actionId, payload)
      if (!payload.ok) {
        console.warn(`[ambiance] Simulation reported failure for ${payload.widgetId} (${payload.action}, actionId=${payload.actionId})`)
      }
    })

    socket.on('widget:simulate:intent', (payload: WidgetSimulationIntentPayload) => {
      if (socket.id !== simulationLeaderSocketId) {
        return
      }
      io.emit('widget:simulate:intent', payload)
    })

    socket.on('cursor:mirror', (payload) => {
      if (socket.id !== simulationLeaderSocketId) {
        return
      }
      socket.broadcast.emit('cursor:mirror', payload)
    })

    socket.on('cursor:mirror:menu-timeline', (payload) => {
      if (socket.id !== simulationLeaderSocketId) {
        return
      }
      socket.broadcast.emit('cursor:mirror:menu-timeline', payload)
    })

    socket.on('desktop:notify', (payload: DesktopNotificationPayload) => {
      scheduler?.noteActivity()
      io.emit('desktop:notify', payload)
    })

    socket.on('desktop:recycle-bin', (payload: DesktopRecycleBinPayload) => {
      scheduler?.noteActivity()
      recycleBinFull = payload.full
      io.emit('desktop:recycle-bin', payload)
    })

    socket.on('desktop:start-menu:state', (payload) => {
      if (payload.open) {
        scheduler?.noteActivity()
      }
      startMenuState = {
        open: payload.open,
        activeRoot: payload.open ? payload.activeRoot : null,
      }
      io.emit('desktop:start-menu:state', startMenuState)
    })

    socket.on('desktop:start-menu:phase', (payload: DesktopStartMenuSimulationPhasePayload) => {
      if (socket.id !== simulationLeaderSocketId) {
        return
      }
      io.emit('desktop:start-menu:phase', payload)
    })

    socket.on('desktop:screen-saver:test', (payload: DesktopScreenSaverPreviewPayload) => {
      scheduler?.noteActivity()
      io.emit('desktop:screen-saver:test', payload)
    })

    socket.on('transition:preview', (steps: TransitionStep[]) => {
      scheduler?.noteActivity()
      // Dry-run: emit a transition:play with the same steps for both exit and intro
      // so the overlay plays them without a real scene change.
      const payload: TransitionPlayPayload = {
        from: machine.currentState,
        to:   machine.currentState,
        exit:  steps,
        intro: [],
      }
      io.emit('transition:play', payload)
    })

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`)
      socketClientTypes.delete(socket.id)
      overlayClientDiagnostics.delete(socket.id)
      if (socket.id === cameraOwnerSocketId) {
        cameraOwnerSocketId = null
        reconcileCameraOwner()
      }
      if (socket.id === simulationLeaderSocketId) {
        clearSimulationLeader('leader disconnected', {
          resyncReason: 'leader-disconnected',
        })
        syncSimulationLeaderState()
      } else {
        electSimulationLeaderIfNeeded('disconnect')
        queueRuntimeDiagnosticsEmit()
      }
    })
  })
}
