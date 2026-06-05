/**
 * Query contracts — request/response pairs.
 *
 * These are commands with callbacks: the client sends a request and expects
 * a typed response synchronously via Socket.IO's acknowledgement mechanism.
 *
 * Direction: client emits with callback → server responds via callback
 *
 * Note: queries are a subset of ClientToServerEvents. They are separated here
 * for documentation clarity — there is no runtime difference.
 */

import type { STATE } from './state.js'
import type { DesktopRuntimeStatePayload, OverlayRuntimeStatusPayload } from './commands.js'

export type { DesktopRuntimeStatePayload, OverlayRuntimeStatusPayload }

/**
 * Query event map — events that have a typed response callback.
 *
 * Used as documentation. Actual types are embedded in ClientToServerEvents.
 */
export interface QueryEvents {
  /**
   * Request current scene state from the kernel.
   * Use on reconnect to sync visual state without a full resync signal.
   */
  'state:request': (callback: (state: STATE) => void) => void

  /**
   * Request the full desktop runtime state snapshot.
   * Returns open widgets, recycle bin state, and start menu state.
   * Use on connect/reconnect to restore UI without waiting for individual signals.
   */
  'desktop:state:request': (callback: (payload: DesktopRuntimeStatePayload) => void) => void
}
