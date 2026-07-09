/**
 * Cursor simulation service — module-scoped state shared between the
 * CursorOverlayProvider (which registers the controller), cursorSimUtils
 * (which drives it and flips the simulation flags), and Desktop.tsx
 * (which consults both). Replaces the old `window.__cursor*` /
 * `window.__simulating*` globals.
 */
import type { CursorOverlayController } from './CursorOverlay'

let controller: CursorOverlayController | null = null

export const cursorSim = {
  get controller(): CursorOverlayController | null {
    return controller
  },
  setController(next: CursorOverlayController | null): void {
    controller = next
  },

  /** Cursor theater is mirroring only — real user-facing DOM actions must not fire. */
  mirrorVisualOnly: false,
  /** A simulated cursor click is in progress — suppress reactions to synthetic mouse events. */
  simulatingClick: false,
  /** A simulated widget focus is in progress — suppress desktop deselection. */
  simulatingWidgetFocus: false,
}
