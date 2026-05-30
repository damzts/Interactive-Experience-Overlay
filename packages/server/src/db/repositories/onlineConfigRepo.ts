import type { OnlineModeConfig, TransitionConfig } from '@ieom/shared'
import { DEFAULT_ONLINE_MODE_CONFIG, ONLINE_CONFIG_BOUNDS } from '@ieom/shared'
import type { Pool } from 'pg'

function clone<T>(value: T): T {
  return structuredClone(value)
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Fills missing fields in a partial online config with default values.
 */
export function withOnlineConfigDefaults(partial?: Partial<OnlineModeConfig> | null): OnlineModeConfig {
  if (!partial) return clone(DEFAULT_ONLINE_MODE_CONFIG)

  return {
    audioReportIntervalMs: partial.audioReportIntervalMs ?? DEFAULT_ONLINE_MODE_CONFIG.audioReportIntervalMs,
    rollingWindowMs: partial.rollingWindowMs ?? DEFAULT_ONLINE_MODE_CONFIG.rollingWindowMs,
    cooldownMs: partial.cooldownMs ?? DEFAULT_ONLINE_MODE_CONFIG.cooldownMs,
    activityThreshold: partial.activityThreshold ?? DEFAULT_ONLINE_MODE_CONFIG.activityThreshold,
    silenceThreshold: partial.silenceThreshold ?? DEFAULT_ONLINE_MODE_CONFIG.silenceThreshold,
    maxPlayersPerRoom: partial.maxPlayersPerRoom ?? DEFAULT_ONLINE_MODE_CONFIG.maxPlayersPerRoom,
    maxActiveRooms: partial.maxActiveRooms ?? DEFAULT_ONLINE_MODE_CONFIG.maxActiveRooms,
    scoreEmitIntervalMs: partial.scoreEmitIntervalMs ?? DEFAULT_ONLINE_MODE_CONFIG.scoreEmitIntervalMs,
    idleTimeoutMs: partial.idleTimeoutMs ?? DEFAULT_ONLINE_MODE_CONFIG.idleTimeoutMs,
    transition: partial.transition ?? clone(DEFAULT_ONLINE_MODE_CONFIG.transition),
  }
}

/**
 * Validates bounds on all numeric config fields. Out-of-bound values are
 * replaced with their defaults and a warning is logged for each replacement.
 */
export function validateOnlineConfigBounds(config: OnlineModeConfig): OnlineModeConfig {
  const result = { ...config, transition: { ...config.transition } }

  for (const [key, bounds] of Object.entries(ONLINE_CONFIG_BOUNDS)) {
    const value = result[key as keyof OnlineModeConfig]
    if (typeof value === 'number') {
      if (value < bounds.min || value > bounds.max) {
        const defaultValue = DEFAULT_ONLINE_MODE_CONFIG[key as keyof OnlineModeConfig] as number
        console.warn(`[online-config] ${key} value ${value} is out of bounds [${bounds.min}, ${bounds.max}], using default ${defaultValue}`)
        ;(result as Record<string, unknown>)[key] = defaultValue
      }
    }
  }

  // Validate transition type
  if (result.transition.type !== 'cut' && result.transition.type !== 'fade') {
    console.warn(`[online-config] transition.type "${result.transition.type}" is invalid, using default "cut"`)
    result.transition.type = DEFAULT_ONLINE_MODE_CONFIG.transition.type
    result.transition.durationMs = DEFAULT_ONLINE_MODE_CONFIG.transition.durationMs
  }

  // Validate transition duration
  if (result.transition.type === 'cut') {
    if (result.transition.durationMs !== 0) {
      console.warn(`[online-config] transition.durationMs should be 0 for cut, using default 0`)
      result.transition.durationMs = 0
    }
  } else {
    // fade: duration must be between 100 and 60000
    if (result.transition.durationMs < 100 || result.transition.durationMs > 60000) {
      console.warn(`[online-config] transition.durationMs ${result.transition.durationMs} is out of bounds [100, 60000] for fade, using default 500`)
      result.transition.durationMs = 500
    }
  }

  return result
}

// ── Database row type ────────────────────────────────────────────

interface OnlineConfigRow {
  user_id: string
  audio_report_interval_ms: number
  rolling_window_ms: number
  cooldown_ms: number
  activity_threshold: number
  silence_threshold: number
  max_players_per_room: number
  max_active_rooms: number
  score_emit_interval_ms: number
  idle_timeout_ms: number
  transition_type: string
  transition_duration_ms: number
}

// ── Repository ───────────────────────────────────────────────────

export class OnlineConfigRepository {
  constructor(private pool: Pool) {}

  /**
   * Loads the online mode configuration from the database.
   * Returns the config with defaults applied for any missing fields,
   * and bounds validated.
   */
  async getOnlineConfig(userId: string): Promise<OnlineModeConfig> {
    const { rows } = await this.pool.query<OnlineConfigRow>(
      `SELECT audio_report_interval_ms, rolling_window_ms, cooldown_ms, activity_threshold,
              silence_threshold, max_players_per_room, max_active_rooms,
              score_emit_interval_ms, idle_timeout_ms,
              transition_type, transition_duration_ms
       FROM online_config WHERE user_id = $1`,
      [userId]
    )

    if (rows.length === 0) return clone(DEFAULT_ONLINE_MODE_CONFIG)

    const row = rows[0]
    const config: OnlineModeConfig = {
      audioReportIntervalMs: row.audio_report_interval_ms,
      rollingWindowMs: row.rolling_window_ms,
      cooldownMs: row.cooldown_ms,
      activityThreshold: row.activity_threshold,
      silenceThreshold: row.silence_threshold,
      maxPlayersPerRoom: row.max_players_per_room,
      maxActiveRooms: row.max_active_rooms,
      scoreEmitIntervalMs: row.score_emit_interval_ms,
      idleTimeoutMs: row.idle_timeout_ms,
      transition: {
        type: row.transition_type as TransitionConfig['type'],
        durationMs: row.transition_duration_ms,
      },
    }

    return validateOnlineConfigBounds(config)
  }

  /**
   * Inserts or updates the online mode configuration.
   * Applies defaults for missing fields and validates bounds before persisting.
   */
  async upsertOnlineConfig(userId: string, config: Partial<OnlineModeConfig>): Promise<OnlineModeConfig> {
    const full = withOnlineConfigDefaults(config)
    const validated = validateOnlineConfigBounds(full)

    await this.pool.query(
      `INSERT INTO online_config (
        user_id, audio_report_interval_ms, rolling_window_ms, cooldown_ms, activity_threshold,
        silence_threshold, max_players_per_room, max_active_rooms,
        score_emit_interval_ms, idle_timeout_ms,
        transition_type, transition_duration_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (user_id) DO UPDATE SET
        audio_report_interval_ms = EXCLUDED.audio_report_interval_ms,
        rolling_window_ms = EXCLUDED.rolling_window_ms,
        cooldown_ms = EXCLUDED.cooldown_ms,
        activity_threshold = EXCLUDED.activity_threshold,
        silence_threshold = EXCLUDED.silence_threshold,
        max_players_per_room = EXCLUDED.max_players_per_room,
        max_active_rooms = EXCLUDED.max_active_rooms,
        score_emit_interval_ms = EXCLUDED.score_emit_interval_ms,
        idle_timeout_ms = EXCLUDED.idle_timeout_ms,
        transition_type = EXCLUDED.transition_type,
        transition_duration_ms = EXCLUDED.transition_duration_ms`,
      [
        userId,
        validated.audioReportIntervalMs,
        validated.rollingWindowMs,
        validated.cooldownMs,
        validated.activityThreshold,
        validated.silenceThreshold,
        validated.maxPlayersPerRoom,
        validated.maxActiveRooms,
        validated.scoreEmitIntervalMs,
        validated.idleTimeoutMs,
        validated.transition.type,
        validated.transition.durationMs,
      ]
    )

    return validated
  }
}
