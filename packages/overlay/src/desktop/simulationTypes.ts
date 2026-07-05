/**
 * Presentation-layer simulation types — start-menu choreography phases and
 * cursor menu timelines. These are Win98-desktop theater concerns owned by
 * the overlay; the kernel ABI never speaks them. (Moved out of
 * @ieomlabs/shared contracts/signals.ts during the presentation purge.)
 */

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
