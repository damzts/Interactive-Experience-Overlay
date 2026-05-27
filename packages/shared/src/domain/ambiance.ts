// ── Desktop ambiance (AI simulation) domain ──────────────────────

export interface AmbianceWidgetBehavior {
  /** Is this widget included in the ambiance simulation? */
  enabled: boolean
  /** Chance (0-1) to open this widget if it's closed during a tick. */
  openChance: number
  /** Chance (0-1) to close this widget if it's open during a tick. */
  closeChance: number
  /** Chance (0-1) to interact with this widget while open. Falls back to recipe default when omitted. */
  interactChance?: number
}

export interface AmbianceWidgetSimulationConfig {
  /** Is the widget simulation active? */
  enabled: boolean
  /** How often (in seconds) the manager should evaluate actions. */
  intervalSeconds: number
  /** Maximum number of simultaneously open widgets the simulator can keep. */
  maxOpenWidgets?: number
  /** When exactly one widget is open, chance (0-1) to open a second one instead of interacting/closing. */
  openWhileOneOpenChance?: number
  /**
   * Per-widget behavior overrides. If a widget's ID is not in this map,
   * it won't be part of the simulation.
   */
  behaviors: Record<string, AmbianceWidgetBehavior>
}

export interface DesktopAmbianceConfig {
  widgetSimulation: AmbianceWidgetSimulationConfig
}
