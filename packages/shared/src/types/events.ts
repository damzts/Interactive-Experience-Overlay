import type { STATE } from './state.js'
import type { AppConfig } from './scene.js'
import type { OverlayTriggerPayload } from './effects.js'

/** Events the server sends to clients */
export interface ServerToClientEvents {
  'state:update': (payload: { state: STATE; previousState: STATE }) => void
  'transition:play': (payload: { from: STATE; to: STATE; transitionType: string; exitTransition?: string; introTransition?: string }) => void
  'overlay:show': (payload: OverlayTriggerPayload) => void
  'config:update': (config: AppConfig) => void
  'obs:status': (payload: { connected: boolean }) => void
}

/** Events clients send to the server */
export interface ClientToServerEvents {
  'scene:change': (target: STATE, callback?: (err: string | null) => void) => void
  'overlay:trigger': (payload: OverlayTriggerPayload) => void
  'transition:complete': () => void
  'state:request': (callback: (state: STATE) => void) => void
  'panic': () => void
}

export interface InterServerEvents {}
export interface SocketData {}
