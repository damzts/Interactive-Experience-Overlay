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

/** Behavior for Start Menu nav targets (layouts and scenes). */
export interface AmbianceNavBehavior {
  /** Is this item included in the ambiance simulation? */
  enabled: boolean
  /** Chance (0-1) to navigate to and apply/select this item during a tick. */
  selectChance: number
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

  // ── Variation & feel ─────────────────────────────────────────────
  /**
   * Scales all cursor movement durations. 0.5 = snappier, 2.0 = slower/deliberate. Default 1.0.
   * Applied to every menu navigation step in the timeline.
   */
  cursorSpeedMultiplier?: number
  /**
   * Random ±variance added to each tick interval as a fraction of the base interval.
   * 0.2 means ±20% variance so ticks don't fire on a perfect schedule. Default 0.2.
   */
  tickJitterFactor?: number
  /**
   * Per-step speed variance factor (0–1). Each cursor movement step gets an independent
   * random speed adjustment so no two navigations look identical. Default 0.3.
   */
  moveJitter?: number
  /**
   * Extra delay (ms) added after each completed action before releasing the sim lock.
   * Simulates the AI "reading" the result before doing something else. Default 0.
   */
  pauseAfterActionMs?: number

  /**
   * Per-widget behavior overrides. If a widget's ID is not in this map,
   * it won't be part of the simulation.
   */
  behaviors: Record<string, AmbianceWidgetBehavior>
  /** Per-layout navigation behaviors (keyed by layout ID). */
  layoutBehaviors?: Record<string, AmbianceNavBehavior>
  /** Per-scene navigation behaviors (keyed by scene ID, including STATE.LOBBY / STATE.DESKTOP). */
  sceneBehaviors?: Record<string, AmbianceNavBehavior>
}

export interface DesktopAmbianceConfig {
  widgetSimulation: AmbianceWidgetSimulationConfig
}

// ── Effect Ambiance ───────────────────────────────────────────────

/** Fires randomly selected overlay effects on a timer in the background. */
export interface EffectAmbianceConfig {
  enabled: boolean
  /** Pool of preconfigured effects — one or more are chosen at random each tick. */
  pool: import('../contracts/effects.js').EffectConfig[]
  /** Average seconds between fires */
  intervalSeconds: number
  /** ±jitter as a fraction of the interval. 0.3 = ±30%. Default 0.3. */
  jitterFactor?: number
  /** How many effects to pick from the pool per tick. Default 1. */
  countPerTick?: number
}
