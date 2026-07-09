/**
 * Overlay-owned presentation-state vocabulary.
 *
 * These key/value shapes travel through the kernel's generic
 * `presentation:state` relay (see @ieomlabs/shared PresentationStatePayload).
 * The kernel stores and rebroadcasts them opaquely — the skin (this overlay,
 * plus any admin mirror) is the only party that knows what they mean.
 */

export const PRESENTATION_KEY_START_MENU = 'start-menu'
export const PRESENTATION_KEY_RECYCLE_BIN = 'recycle-bin'

export type StartMenuRoot = 'programs' | 'widget-layouts' | 'layouts' | 'scenes' | null

export interface StartMenuStateValue {
  open: boolean
  activeRoot: StartMenuRoot
}

export interface RecycleBinStateValue {
  full: boolean
}

export function readStartMenuState(presentation: Record<string, unknown> | undefined): StartMenuStateValue | null {
  const value = presentation?.[PRESENTATION_KEY_START_MENU]
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<StartMenuStateValue>
  return { open: !!v.open, activeRoot: v.open ? (v.activeRoot ?? null) : null }
}

export function readRecycleBinState(presentation: Record<string, unknown> | undefined): RecycleBinStateValue | null {
  const value = presentation?.[PRESENTATION_KEY_RECYCLE_BIN]
  if (!value || typeof value !== 'object') return null
  return { full: !!(value as Partial<RecycleBinStateValue>).full }
}
