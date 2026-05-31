import type { OnlineModeConfig, TransitionConfig } from '@ieom/shared'
import { DEFAULT_ONLINE_MODE_CONFIG, ONLINE_CONFIG_BOUNDS } from '@ieom/shared'
import type { Pool } from 'pg'

function clone<T>(value: T): T { return structuredClone(value) }

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

export function validateOnlineConfigBounds(config: OnlineModeConfig): OnlineModeConfig {
  const result = { ...config, transition: { ...config.transition } }
  for (const [key, bounds] of Object.entries(ONLINE_CONFIG_BOUNDS)) {
    const value = result[key as keyof OnlineModeConfig]
    if (typeof value === 'number' && (value < bounds.min || value > bounds.max)) {
      ;(result as Record<string, unknown>)[key] = DEFAULT_ONLINE_MODE_CONFIG[key as keyof OnlineModeConfig]
    }
  }
  if (result.transition.type !== 'cut' && result.transition.type !== 'fade') {
    result.transition = clone(DEFAULT_ONLINE_MODE_CONFIG.transition)
  }
  if (result.transition.type === 'cut' && result.transition.durationMs !== 0) result.transition.durationMs = 0
  if (result.transition.type === 'fade' && (result.transition.durationMs < 100 || result.transition.durationMs > 60000)) result.transition.durationMs = 500
  return result
}

interface OnlineConfigRow {
  audio_report_interval_ms: number; rolling_window_ms: number; cooldown_ms: number
  activity_threshold: number; silence_threshold: number; max_players_per_room: number
  max_active_rooms: number; score_emit_interval_ms: number; idle_timeout_ms: number
  transition_type: string; transition_duration_ms: number
}

export class OnlineConfigRepository {
  constructor(private pool: Pool) {}

  async getOnlineConfig(userId: string): Promise<OnlineModeConfig> {
    const { rows } = await this.pool.query<OnlineConfigRow>(
      `SELECT audio_report_interval_ms, rolling_window_ms, cooldown_ms, activity_threshold,
              silence_threshold, max_players_per_room, max_active_rooms,
              score_emit_interval_ms, idle_timeout_ms, transition_type, transition_duration_ms
       FROM online_config WHERE user_id = $1`, [userId])
    if (rows.length === 0) return clone(DEFAULT_ONLINE_MODE_CONFIG)
    const r = rows[0]
    return validateOnlineConfigBounds({
      audioReportIntervalMs: r.audio_report_interval_ms, rollingWindowMs: r.rolling_window_ms,
      cooldownMs: r.cooldown_ms, activityThreshold: r.activity_threshold, silenceThreshold: r.silence_threshold,
      maxPlayersPerRoom: r.max_players_per_room, maxActiveRooms: r.max_active_rooms,
      scoreEmitIntervalMs: r.score_emit_interval_ms, idleTimeoutMs: r.idle_timeout_ms,
      transition: { type: r.transition_type as TransitionConfig['type'], durationMs: r.transition_duration_ms },
    })
  }

  async upsertOnlineConfig(userId: string, config: Partial<OnlineModeConfig>): Promise<OnlineModeConfig> {
    const validated = validateOnlineConfigBounds(withOnlineConfigDefaults(config))
    await this.pool.query(
      `INSERT INTO online_config (user_id, audio_report_interval_ms, rolling_window_ms, cooldown_ms, activity_threshold,
        silence_threshold, max_players_per_room, max_active_rooms, score_emit_interval_ms, idle_timeout_ms, transition_type, transition_duration_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (user_id) DO UPDATE SET audio_report_interval_ms=EXCLUDED.audio_report_interval_ms, rolling_window_ms=EXCLUDED.rolling_window_ms,
        cooldown_ms=EXCLUDED.cooldown_ms, activity_threshold=EXCLUDED.activity_threshold, silence_threshold=EXCLUDED.silence_threshold,
        max_players_per_room=EXCLUDED.max_players_per_room, max_active_rooms=EXCLUDED.max_active_rooms,
        score_emit_interval_ms=EXCLUDED.score_emit_interval_ms, idle_timeout_ms=EXCLUDED.idle_timeout_ms,
        transition_type=EXCLUDED.transition_type, transition_duration_ms=EXCLUDED.transition_duration_ms`,
      [userId, validated.audioReportIntervalMs, validated.rollingWindowMs, validated.cooldownMs, validated.activityThreshold,
       validated.silenceThreshold, validated.maxPlayersPerRoom, validated.maxActiveRooms, validated.scoreEmitIntervalMs,
       validated.idleTimeoutMs, validated.transition.type, validated.transition.durationMs])
    return validated
  }
}
