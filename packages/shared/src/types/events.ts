import type { STATE } from './state.js'
import type { AppConfig, TransitionStep } from './scene.js'
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

export interface DesktopRuntimeStatePayload {
  openWidgetIds: string[]
  recycleBinFull: boolean
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
  startMoveMs: number
  startPostMs: number
  steps: MenuPathTimingStep[]
}

/** Events the server sends to clients */
export interface ServerToClientEvents {
  'state:update': (payload: { state: STATE; previousState: STATE }) => void
  'transition:play': (payload: TransitionPlayPayload) => void
  'overlay:show': (payload: OverlayTriggerPayload) => void
  'config:update': (config: AppConfig) => void
  'obs:status': (payload: { connected: boolean }) => void
  'ambiance:leader': (payload: { socketId: string | null }) => void
  'ambiance:metrics': (payload: { accepted: number; rejected: number }) => void
  'cursor:mirror': (payload: CursorMirrorPayload) => void
  'cursor:mirror:menu-timeline': (payload: OpenWidgetMenuTimelinePayload) => void
  'widget:toggle': (widgetId: string) => void
  'desktop:notify': (payload: DesktopNotificationPayload) => void
  'desktop:recycle-bin': (payload: DesktopRecycleBinPayload) => void
}

/** Events clients send to the server */
export interface ClientToServerEvents {
  'scene:change': (target: STATE, callback?: (err: string | null) => void) => void
  'overlay:trigger': (payload: OverlayTriggerPayload) => void
  'keybind:execute': (payload: KeybindExecutionPayload, callback?: (err: string | null) => void) => void
  'ambiance:leader:request': (callback: (payload: { socketId: string | null }) => void) => void
  'state:request': (callback: (state: STATE) => void) => void
  'desktop:state:request': (callback: (payload: DesktopRuntimeStatePayload) => void) => void
  'widget:toggle': (widgetId: string) => void
  'widget:simulate': (widgetId: string) => void
  'cursor:mirror': (payload: CursorMirrorPayload) => void
  'cursor:mirror:menu-timeline': (payload: OpenWidgetMenuTimelinePayload) => void
  'desktop:notify': (payload: DesktopNotificationPayload) => void
  'desktop:recycle-bin': (payload: DesktopRecycleBinPayload) => void
  'transition:preview': (steps: TransitionStep[]) => void
  'panic': () => void
}

export interface InterServerEvents {}
export interface SocketData {}
