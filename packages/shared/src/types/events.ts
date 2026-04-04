import type { STATE } from './state.js'
import type { AppConfig, DesktopConfig, TransitionStep } from './scene.js'
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
}

export interface AmbianceSimulationDonePayload {
  actionId: string
  widgetId: string
  action: 'open' | 'close' | 'interact'
  ok: boolean
  durationMs?: number
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
  'obs:status': (payload: { connected: boolean }) => void
  'ambiance:leader': (payload: { socketId: string | null }) => void
  'ambiance:metrics': (payload: { accepted: number; rejected: number }) => void
  'ambiance:simulate': (payload: AmbianceSimulationPayload) => void
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
  'keybind:execute': (payload: KeybindExecutionPayload, callback?: (err: string | null) => void) => void
  'ambiance:leader:request': (callback: (payload: { socketId: string | null }) => void) => void
  'ambiance:simulate:done': (payload: AmbianceSimulationDonePayload) => void
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
