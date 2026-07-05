/**
 * Desktop Theme Drift — ambient art-style variation.
 *
 * Sibling of desktop ambiance (widget open/close/interact simulation) and
 * effect ambiance (random effect firing): on a tick, each enabled field
 * group independently rolls a chance to change to a new random value.
 * Applied as a runtime config override that never auto-reverts — the
 * drift is the new "current look" until the next drift or an explicit
 * runtime-config reset (see runtime:config:reset). This is what lets a
 * stream's aesthetic evolve across a session instead of looking identical
 * every time.
 */

export interface ThemeDriftFieldGroupConfig {
  enabled: boolean
  /** Chance (0-1) this group rolls a change on any given tick. */
  chance: number
}

export interface DesktopThemeDriftConfig {
  enabled: boolean
  /** How often (seconds) the manager evaluates each group. */
  intervalSeconds: number
  /** Random ±variance added to each tick interval as a fraction of the base interval. */
  tickJitterFactor?: number
  groups: {
    /** DesktopTheme + widget skin/shape together — the biggest visual swing. */
    theme: ThemeDriftFieldGroupConfig
    /** accentColor / textColor within the current theme/skin. */
    colors: ThemeDriftFieldGroupConfig
    /** iconAnimation / iconArrangement / iconMotion / iconArrangementMotion. */
    motion: ThemeDriftFieldGroupConfig
    /** Widget theme animation / atmosphere / motion / glow / shell / shadow intensities. */
    atmosphere: ThemeDriftFieldGroupConfig
  }
}
