import type { STATE } from './state.js'
import type { AppConfig, DesktopAmbianceConfig, DesktopConfig, EventConfig, TransitionStep } from './scene.js'
import type { OverlayTriggerPayload } from './effects.js'

/** Shape of the transition:play socket event */
export interface TransitionPlayPayload {
  from: STATE
  to: STATE
  /** Ordered exit pipeline — plays before scene content swaps */
  exit: TransitionStep[]
  /** Ordered intro pipeline — plays after scene content swaps */
  intro: TransitionStep[]
}

export interface DesktopNotificationPayload {
  title: string
  body: string
  icon?: string
  durationMs?: number
}

export interface DesktopRecycleBinPayload {
  full: boolean
}

export interface DesktopScreenSaverPreviewPayload {
  preset: DesktopConfig['screenSaver']['preset']
}

export interface DesktopRuntimeStatePayload {
  openWidgetIds: string[]
  recycleBinFull: boolean
  startMenuState?: DesktopStartMenuStatePayload
}

export type DesktopStartMenuRoot = 'programs' | 'widget-layouts' | null

export interface DesktopStartMenuStatePayload {
  open: boolean
  activeRoot: DesktopStartMenuRoot
}

export type DesktopStartMenuSimulationPhase =
  | 'open'
  | 'programs-hover'
  | 'programs-open'
  | 'target-hover'
  | 'target-select'
  | 'clear'

export interface DesktopStartMenuSimulationPhasePayload {
  phase: DesktopStartMenuSimulationPhase
  targetAppId?: string
}

export interface KeybindExecutionPayload {
  scope: 'obs' | 'admin'
  key?: string
  action?: string
}

export type CursorMirrorPayload =
  | { kind: 'move'; x: number; y: number; duration?: number }
  | { kind: 'click' }
  | { kind: 'visible'; visible: boolean }

export interface MenuPathTimingStep {
  moveMs: number
  hoverMs: number
  postMs: number
}

export interface OpenWidgetMenuTimelinePayload {
  widgetLabel: string
  menuPath: string[]
  targetAppId?: string
  startMoveMs: number
  startPostMs: number
  steps: MenuPathTimingStep[]
}

export interface AmbianceSimulationPayload {
  actionId: string
  widgetId: string
  action: 'open' | 'close' | 'interact'
  mirrorPolicy: AmbianceMirrorPolicy
  sharedIntent: WidgetSimulationIntentPayload | null
}

export interface AmbianceSimulationAcceptedPayload {
  actionId: string
  widgetId: string
  action: 'open' | 'close' | 'interact'
}

export interface AmbianceSimulationStartedPayload {
  actionId: string
  widgetId: string
  action: 'open' | 'close' | 'interact'
  startedAt?: number
}

export interface AmbianceSimulationDonePayload {
  actionId: string
  widgetId: string
  action: 'open' | 'close' | 'interact'
  ok: boolean
  durationMs?: number
}

export type OverlayClientKind = 'runtime' | 'embedded-preview' | 'dev' | 'unknown'

export type AmbianceMirrorPolicy = 'shared-safe' | 'leader-only' | 'unsafe-requires-runtime-event'

export interface OverlayRuntimeStatusPayload {
  mounted: boolean
  cursorReady: boolean
  widgetRegistryReady: boolean
  ready: boolean
}

export interface OverlayClientDiagnostics {
  socketId: string
  kind: OverlayClientKind
  port: string | null
  label: string
  mounted: boolean
  cursorReady: boolean
  widgetRegistryReady: boolean
  ready: boolean
  readyAt: number | null
  lastHeartbeatAt: number | null
}

export interface AmbianceHistoryEntry {
  id: string
  timestamp: number
  type:
    | 'leader-elected'
    | 'leader-cleared'
    | 'leader-expired'
    | 'simulate-dispatched'
    | 'simulate-accepted'
    | 'simulate-started'
    | 'simulate-done'
    | 'simulate-accept-timeout'
    | 'simulate-start-timeout'
    | 'simulate-completion-timeout'
    | 'resync-requested'
  message: string
  actionId?: string
  widgetId?: string
  action?: 'open' | 'close' | 'interact'
  leaderSocketId?: string | null
}

type WidgetSimulationIntentBase = {
  actionId: string
  widgetId: string
}

type WidgetSimulationIntentSeedBase = {
  widgetId: string
}

export type WidgetSimulationIntentSeed =
  | (WidgetSimulationIntentSeedBase & { kind: 'gallery:next' })
  | (WidgetSimulationIntentSeedBase & { kind: 'gallery:previous' })
  | (WidgetSimulationIntentSeedBase & { kind: 'music:prev' })
  | (WidgetSimulationIntentSeedBase & { kind: 'music:play-pause' })
  | (WidgetSimulationIntentSeedBase & { kind: 'music:next' })
  | (WidgetSimulationIntentSeedBase & { kind: 'sticky:set-color'; color: string })
  | (WidgetSimulationIntentSeedBase & { kind: 'chat:add-message'; message: { user: string; text: string; color: string } })

export type WidgetSimulationIntentPayload =
  | (WidgetSimulationIntentBase & { kind: 'gallery:next' })
  | (WidgetSimulationIntentBase & { kind: 'gallery:previous' })
  | (WidgetSimulationIntentBase & { kind: 'music:prev' })
  | (WidgetSimulationIntentBase & { kind: 'music:play-pause' })
  | (WidgetSimulationIntentBase & { kind: 'music:next' })
  | (WidgetSimulationIntentBase & { kind: 'sticky:set-color'; color: string })
  | (WidgetSimulationIntentBase & { kind: 'chat:add-message'; message: { user: string; text: string; color: string } })

export interface ObsStatusPayload {
  connected: boolean
  url: string
  reconnecting: boolean
  reconnectAttempt: number
  retryDelayMs: number | null
  nextRetryAt: number | null
  lastError: string | null
}

export interface SchedulerEventDiagnostics {
  id: string
  label: string
  enabled: boolean
  mode: 'interval' | 'idle'
  effectsCount: number
  actionsCount: number
  intervalMin: number
  idleMin: number
  chance: number
  cooldownMin: number
  allowedStates?: STATE[]
  nextRunAt: number | null
  idleTriggered: boolean
  due: boolean
}

export interface SchedulerDiagnosticsPayload {
  tickMs: number
  currentState: STATE
  lastEvaluatedAt: number | null
  lastActivityAt: number
  lastTriggeredEventId: string | null
  lastTriggeredAt: number | null
  activeEventCount: number
  events: SchedulerEventDiagnostics[]
}

export interface AmbianceDiagnosticsPayload {
  enabled: boolean
  intervalSeconds: number
  lastStartedAt: number | null
  lastTickAt: number | null
  lastActionAt: number | null
  lastActionWidgetId: string | null
  lastAction: 'open' | 'close' | 'interact' | null
  inFlight: boolean
  pendingPhase: 'awaiting-acceptance' | 'awaiting-start' | 'running' | null
  pendingActionId: string | null
  leaderSocketId: string | null
  leaderClientKind: OverlayClientKind | null
  leaderClientPort: string | null
  leaderClientLabel: string | null
  leaderReady: boolean
  leaderLeaseDurationMs: number
  leaderLeaseExpiresAt: number | null
  leaderLastHeartbeatAt: number | null
  overlayClients: OverlayClientDiagnostics[]
  history: AmbianceHistoryEntry[]
  openWidgetCount: number
  enabledWidgetCount: number
  maxOpenWidgets: number
  openWhileOneOpenChance: number
  lastSkipReason: string | null
}

export interface RuntimeDiagnosticsPayload {
  scheduler: SchedulerDiagnosticsPayload
  ambiance: AmbianceDiagnosticsPayload
}

export interface RuntimeConfigOverridePayload {
  desktopConfig?: Pick<Partial<DesktopConfig>, 'theme' | 'widgetTheme' | 'widgetThemeOverrides' | 'iconAnimation' | 'iconMotion' | 'widgetPositions' | 'widgetSizes' | 'widgetZIndices' | 'screenSaver'>
  desktopAmbiance?: Partial<DesktopAmbianceConfig>
}

export interface DesktopIconDragPayload {
  appId: string
  x: number
  y: number
  phase: 'start' | 'move' | 'end'
}

export interface DesktopWidgetDragPayload {
  widgetId: string
  x: number
  y: number
  phase: 'start' | 'move' | 'end'
}

export interface DesktopWidgetResizePayload {
  widgetId: string
  x: number
  y: number
  width: number
  height: number
  phase: 'start' | 'move' | 'end'
}

export interface WidgetSimulationCommandPayload {
  widgetId: string
  action: 'open' | 'close' | 'toggle'
}

/** Events the server sends to clients */
export interface ServerToClientEvents {
  'state:update': (payload: { state: STATE; previousState: STATE }) => void
  'transition:play': (payload: TransitionPlayPayload) => void
  'overlay:show': (payload: OverlayTriggerPayload) => void
  'config:update': (config: AppConfig) => void
  'config:patch': (updates: Partial<AppConfig>) => void
  'obs:status': (payload: ObsStatusPayload) => void
  'ambiance:leader': (payload: { socketId: string | null }) => void
  'ambiance:metrics': (payload: { accepted: number; rejected: number }) => void
  'runtime:diagnostics': (payload: RuntimeDiagnosticsPayload) => void
  'runtime:config:override': (payload: RuntimeConfigOverridePayload) => void
  'ambiance:simulate': (payload: AmbianceSimulationPayload) => void
  'overlay:resync': (payload: { reason: string }) => void
  'widget:simulate:intent': (payload: WidgetSimulationIntentPayload) => void
  'cursor:mirror': (payload: CursorMirrorPayload) => void
  'cursor:mirror:menu-timeline': (payload: OpenWidgetMenuTimelinePayload) => void
  'widget:toggle': (widgetId: string) => void
  'widget:layout:apply': (layoutId: string) => void
  'desktop:icon:drag': (payload: DesktopIconDragPayload) => void
  'desktop:widget:drag': (payload: DesktopWidgetDragPayload) => void
  'desktop:widget:resize': (payload: DesktopWidgetResizePayload) => void
  'desktop:notify': (payload: DesktopNotificationPayload) => void
  'desktop:recycle-bin': (payload: DesktopRecycleBinPayload) => void
  'desktop:start-menu:state': (payload: DesktopStartMenuStatePayload) => void
  'desktop:start-menu:phase': (payload: DesktopStartMenuSimulationPhasePayload) => void
  'desktop:screen-saver:test': (payload: DesktopScreenSaverPreviewPayload) => void
}

/** Events clients send to the server */
export interface ClientToServerEvents {
  'scene:change': (target: STATE, callback?: (err: string | null) => void) => void
  'overlay:trigger': (payload: OverlayTriggerPayload) => void
  'event:preview': (event: EventConfig, callback?: (err: string | null) => void) => void
  'runtime:config:override:clear': (callback?: (err: string | null) => void) => void
  'keybind:execute': (payload: KeybindExecutionPayload, callback?: (err: string | null) => void) => void
  'ambiance:leader:request': (callback: (payload: { socketId: string | null }) => void) => void
  'ambiance:leader:heartbeat': () => void
  'ambiance:history:clear': () => void
  'overlay:runtime:status': (payload: OverlayRuntimeStatusPayload) => void
  'overlay:force-resync': (payload?: { reason?: string }) => void
  'ambiance:simulate:accepted': (payload: AmbianceSimulationAcceptedPayload) => void
  'ambiance:simulate:started': (payload: AmbianceSimulationStartedPayload) => void
  'ambiance:simulate:done': (payload: AmbianceSimulationDonePayload) => void
  'widget:simulate:intent': (payload: WidgetSimulationIntentPayload) => void
  'state:request': (callback: (state: STATE) => void) => void
  'desktop:state:request': (callback: (payload: DesktopRuntimeStatePayload) => void) => void
  'widget:toggle': (widgetId: string) => void
  'widget:simulate': (widgetId: string) => void
  'widget:simulate:action': (payload: WidgetSimulationCommandPayload) => void
  'widget:layout:apply': (layoutId: string) => void
  'desktop:icon:drag': (payload: DesktopIconDragPayload) => void
  'desktop:widget:drag': (payload: DesktopWidgetDragPayload) => void
  'desktop:widget:resize': (payload: DesktopWidgetResizePayload) => void
  'cursor:mirror': (payload: CursorMirrorPayload) => void
  'cursor:mirror:menu-timeline': (payload: OpenWidgetMenuTimelinePayload) => void
  'desktop:notify': (payload: DesktopNotificationPayload) => void
  'desktop:recycle-bin': (payload: DesktopRecycleBinPayload) => void
  'desktop:start-menu:state': (payload: DesktopStartMenuStatePayload) => void
  'desktop:start-menu:phase': (payload: DesktopStartMenuSimulationPhasePayload) => void
  'desktop:screen-saver:test': (payload: DesktopScreenSaverPreviewPayload) => void
  'transition:preview': (steps: TransitionStep[]) => void
  'panic': () => void
}

export interface InterServerEvents {}
export interface SocketData {}
