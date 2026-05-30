import type { POVSwitchingConfig, TransitionConfig } from '@ieom/shared'
import type { Pool } from 'pg'

function clone<T>(value: T): T {
  return structuredClone(value)
}

// ── Defaults ─────────────────────────────────────────────────────

const DEFAULT_POV_CONFIG: POVSwitchingConfig = {
  pollIntervalMs: 100,
  rollingWindowMs: 2000,
  cooldownMs: 3000,
  activityThreshold: 0.15,
  silenceThreshold: 0.05,
  healthCheckIntervalMs: 10000,
  maxConnections: 10,
  transition: { type: 'cut', durationMs: 0 },
  scoreEmitIntervalMs: 500,
  dbFloor: -60,
  dbCeiling: 0,
}

// ── Bounds definitions ───────────────────────────────────────────

interface Bounds {
  min: number
  max: number
}

const BOUNDS: Record<string, Bounds> = {
  pollIntervalMs: { min: 50, max: 2000 },
  rollingWindowMs: { min: 500, max: 10000 },
  cooldownMs: { min: 1000, max: 30000 },
  activityThreshold: { min: 0.01, max: 1.0 },
  silenceThreshold: { min: 0.0, max: 1.0 },
  healthCheckIntervalMs: { min: 1000, max: 60000 },
  maxConnections: { min: 3, max: 10 },
  scoreEmitIntervalMs: { min: 100, max: 5000 },
  dbFloor: { min: -120, max: 0 },
  dbCeiling: { min: -60, max: 20 },
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Fills missing fields in a partial POV config with default values.
 */
export function withPovConfigDefaults(partial?: Partial<POVSwitchingConfig> | null): POVSwitchingConfig {
  if (!partial) return clone(DEFAULT_POV_CONFIG)

  return {
    pollIntervalMs: partial.pollIntervalMs ?? DEFAULT_POV_CONFIG.pollIntervalMs,
    rollingWindowMs: partial.rollingWindowMs ?? DEFAULT_POV_CONFIG.rollingWindowMs,
    cooldownMs: partial.cooldownMs ?? DEFAULT_POV_CONFIG.cooldownMs,
    activityThreshold: partial.activityThreshold ?? DEFAULT_POV_CONFIG.activityThreshold,
    silenceThreshold: partial.silenceThreshold ?? DEFAULT_POV_CONFIG.silenceThreshold,
    healthCheckIntervalMs: partial.healthCheckIntervalMs ?? DEFAULT_POV_CONFIG.healthCheckIntervalMs,
    maxConnections: partial.maxConnections ?? DEFAULT_POV_CONFIG.maxConnections,
    transition: partial.transition ?? clone(DEFAULT_POV_CONFIG.transition),
    scoreEmitIntervalMs: partial.scoreEmitIntervalMs ?? DEFAULT_POV_CONFIG.scoreEmitIntervalMs,
    dbFloor: partial.dbFloor ?? DEFAULT_POV_CONFIG.dbFloor,
    dbCeiling: partial.dbCeiling ?? DEFAULT_POV_CONFIG.dbCeiling,
  }
}

/**
 * Validates bounds on all numeric config fields. Out-of-bound values are
 * replaced with their defaults and a warning is logged for each replacement.
 */
export function validatePovConfigBounds(config: POVSwitchingConfig): POVSwitchingConfig {
  const result = { ...config, transition: { ...config.transition } }

  for (const [key, bounds] of Object.entries(BOUNDS)) {
    const value = result[key as keyof POVSwitchingConfig]
    if (typeof value === 'number') {
      if (value < bounds.min || value > bounds.max) {
        const defaultValue = DEFAULT_POV_CONFIG[key as keyof POVSwitchingConfig] as number
        console.warn(`[pov-config] ${key} value ${value} is out of bounds [${bounds.min}, ${bounds.max}], using default ${defaultValue}`)
        ;(result as Record<string, unknown>)[key] = defaultValue
      }
    }
  }

  // Validate transition type
  if (result.transition.type !== 'cut' && result.transition.type !== 'fade') {
    console.warn(`[pov-config] transition.type "${result.transition.type}" is invalid, using default "cut"`)
    result.transition.type = DEFAULT_POV_CONFIG.transition.type
    result.transition.durationMs = DEFAULT_POV_CONFIG.transition.durationMs
  }

  // Validate transition duration
  if (result.transition.type === 'cut') {
    if (result.transition.durationMs !== 0) {
      console.warn(`[pov-config] transition.durationMs should be 0 for cut, using default 0`)
      result.transition.durationMs = 0
    }
  } else {
    // fade: duration must be between 100 and 60000
    if (result.transition.durationMs < 100 || result.transition.durationMs > 60000) {
      console.warn(`[pov-config] transition.durationMs ${result.transition.durationMs} is out of bounds [100, 60000] for fade, using default 500`)
      result.transition.durationMs = 500
    }
  }

  return result
}

// ── Database row type ────────────────────────────────────────────

interface PovConfigRow {
  user_id: string
  poll_interval_ms: number
  rolling_window_ms: number
  cooldown_ms: number
  activity_threshold: number
  silence_threshold: number
  health_check_interval_ms: number
  max_connections: number
  transition_type: string
  transition_duration_ms: number
  score_emit_interval_ms: number
  db_floor: number
  db_ceiling: number
}

// ── Repository ───────────────────────────────────────────────────

export class PovConfigRepository {
  constructor(private pool: Pool) {}

  /**
   * Loads the POV switching configuration from the database.
   * Returns the config with defaults applied for any missing fields,
   * and bounds validated.
   */
  async getPovConfig(userId: string): Promise<POVSwitchingConfig> {
    const { rows } = await this.pool.query<PovConfigRow>(
      `SELECT poll_interval_ms, rolling_window_ms, cooldown_ms, activity_threshold,
              silence_threshold, health_check_interval_ms, max_connections,
              transition_type, transition_duration_ms, score_emit_interval_ms,
              db_floor, db_ceiling
       FROM pov_config WHERE user_id = $1`,
      [userId]
    )

    if (rows.length === 0) return clone(DEFAULT_POV_CONFIG)

    const row = rows[0]
    const config: POVSwitchingConfig = {
      pollIntervalMs: row.poll_interval_ms,
      rollingWindowMs: row.rolling_window_ms,
      cooldownMs: row.cooldown_ms,
      activityThreshold: row.activity_threshold,
      silenceThreshold: row.silence_threshold,
      healthCheckIntervalMs: row.health_check_interval_ms,
      maxConnections: row.max_connections,
      transition: {
        type: row.transition_type as TransitionConfig['type'],
        durationMs: row.transition_duration_ms,
      },
      scoreEmitIntervalMs: row.score_emit_interval_ms,
      dbFloor: row.db_floor,
      dbCeiling: row.db_ceiling,
    }

    return validatePovConfigBounds(config)
  }

  /**
   * Inserts or updates the POV switching configuration.
   * Applies defaults for missing fields and validates bounds before persisting.
   */
  async upsertPovConfig(userId: string, config: Partial<POVSwitchingConfig>): Promise<POVSwitchingConfig> {
    const full = withPovConfigDefaults(config)
    const validated = validatePovConfigBounds(full)

    await this.pool.query(
      `INSERT INTO pov_config (
        user_id, poll_interval_ms, rolling_window_ms, cooldown_ms, activity_threshold,
        silence_threshold, health_check_interval_ms, max_connections,
        transition_type, transition_duration_ms, score_emit_interval_ms,
        db_floor, db_ceiling
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (user_id) DO UPDATE SET
        poll_interval_ms = EXCLUDED.poll_interval_ms,
        rolling_window_ms = EXCLUDED.rolling_window_ms,
        cooldown_ms = EXCLUDED.cooldown_ms,
        activity_threshold = EXCLUDED.activity_threshold,
        silence_threshold = EXCLUDED.silence_threshold,
        health_check_interval_ms = EXCLUDED.health_check_interval_ms,
        max_connections = EXCLUDED.max_connections,
        transition_type = EXCLUDED.transition_type,
        transition_duration_ms = EXCLUDED.transition_duration_ms,
        score_emit_interval_ms = EXCLUDED.score_emit_interval_ms,
        db_floor = EXCLUDED.db_floor,
        db_ceiling = EXCLUDED.db_ceiling`,
      [
        userId,
        validated.pollIntervalMs,
        validated.rollingWindowMs,
        validated.cooldownMs,
        validated.activityThreshold,
        validated.silenceThreshold,
        validated.healthCheckIntervalMs,
        validated.maxConnections,
        validated.transition.type,
        validated.transition.durationMs,
        validated.scoreEmitIntervalMs,
        validated.dbFloor,
        validated.dbCeiling,
      ]
    )

    return validated
  }
}
