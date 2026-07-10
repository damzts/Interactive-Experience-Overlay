import type Database from 'better-sqlite3'
import type { AppConfig } from '@ieomlabs/shared'
import logger from '../../lib/logger.js'

function parseJson<T>(v: string | null | undefined, fallback: T): T {
  if (!v) return fallback; try { return JSON.parse(v) as T } catch { return fallback }
}

/**
 * Small, single-table config domains that don't warrant their own repository
 * file: keybinds, OBS connection, audio levels, media gallery, window
 * presets, avatar presets, shows, Twitch credentials, chat reactions.
 *
 * Grouped here (rather than as inline SQL in DesktopConfigService) so the
 * manager stays a thin orchestrator and every persisted domain has exactly
 * one place that knows its table shape.
 */
export class MiscConfigRepository {
  constructor(private db: Database.Database) {}

  // ── Keybinds ─────────────────────────────────────────────────

  loadKeybinds(): AppConfig['keybinds'] {
    const rows = this.db.prepare('SELECT * FROM keybinds').all() as Array<{ scope: string; key: string; action: string }>
    const keybinds: Record<string, string> = {}
    // Historic rows may carry an 'obs' scope from before bindings were
    // unified into a single map — fold them in too so existing bindings
    // aren't silently dropped. 'admin' rows take precedence on conflict.
    // The `action` column holds a plain preset id (AppConfig.sourceEvents)
    // now — Input Engine only triggers a saved preset, never an inline
    // action. A row from either older shape (a JSON-encoded EventAction,
    // or the original bare 'scene:x'/'widget:x'/'event:x' string) doesn't
    // parse as a bare id and is dropped with a warning instead of guessing
    // at a conversion.
    const isLegacyRow = (action: string): boolean => {
      if (action.startsWith('{') || action.startsWith('[')) return true // JSON EventAction
      return /^(scene|widget|event|overlay):/.test(action) // original string-prefix scheme
    }
    for (const row of rows) {
      if (row.scope !== 'obs') continue
      if (isLegacyRow(row.action)) { logger.warn(`[config] Dropping legacy keybind "${row.key}" — pre-preset action shape no longer supported`); continue }
      keybinds[row.key] = row.action
    }
    for (const row of rows) {
      if (row.scope !== 'admin') continue
      if (isLegacyRow(row.action)) { logger.warn(`[config] Dropping legacy keybind "${row.key}" — pre-preset action shape no longer supported`); continue }
      keybinds[row.key] = row.action
    }
    return keybinds
  }

  saveKeybinds(keybinds: AppConfig['keybinds']): void {
    this.db.prepare('DELETE FROM keybinds').run()
    const insert = this.db.prepare('INSERT INTO keybinds (scope, key, action) VALUES (?, ?, ?)')
    for (const [key, presetId] of Object.entries(keybinds ?? {})) insert.run('admin', key, presetId)
  }

  // ── OBS ──────────────────────────────────────────────────────

  loadObsConfig(): AppConfig['obs'] {
    const row = this.db.prepare('SELECT * FROM obs_config WHERE id = 1').get() as { url: string; password: string } | undefined
    return row ? { url: row.url, password: row.password } : { url: '', password: '' }
  }

  saveObsConfig(obs: AppConfig['obs']): void {
    this.db.prepare('INSERT OR REPLACE INTO obs_config (id, url, password) VALUES (1, ?, ?)').run(obs.url, obs.password)
  }

  // ── Audio ────────────────────────────────────────────────────

  loadAudioConfig(): AppConfig['audio'] {
    const row = this.db.prepare('SELECT * FROM audio_config WHERE id = 1').get() as {
      master_volume: number; sfx_volume: number; music_volume: number;
      ambient_track: string | null; ambient_volume: number | null;
    } | undefined
    return row
      ? {
          masterVolume: row.master_volume, sfxVolume: row.sfx_volume, musicVolume: row.music_volume,
          ambientTrack: row.ambient_track ?? '', ambientVolume: row.ambient_volume ?? 0.6,
        }
      : { masterVolume: 1, sfxVolume: 1, musicVolume: 0.7, ambientTrack: '', ambientVolume: 0.6 }
  }

  saveAudioConfig(audio: AppConfig['audio']): void {
    this.db.prepare('INSERT OR REPLACE INTO audio_config (id, master_volume, sfx_volume, music_volume, ambient_track, ambient_volume) VALUES (1, ?, ?, ?, ?, ?)')
      .run(audio.masterVolume, audio.sfxVolume, audio.musicVolume, audio.ambientTrack ?? null, audio.ambientVolume ?? null)
  }

  // ── Media gallery ────────────────────────────────────────────

  loadSourceMedia() {
    const rows = this.db.prepare('SELECT * FROM media_gallery').all() as Array<{
      id: string; name: string; type: string; url: string; duration: number | null;
    }>
    return rows.map((row) => ({ id: row.id, name: row.name, type: row.type as 'image' | 'video', url: row.url, duration: row.duration ?? undefined }))
  }

  saveSourceMedia(entries: NonNullable<AppConfig['sourceMedia']>): void {
    this.db.prepare('DELETE FROM media_gallery').run()
    const insert = this.db.prepare('INSERT INTO media_gallery (id, name, type, url, duration) VALUES (?, ?, ?, ?, ?)')
    for (const entry of entries) {
      insert.run(entry.id, entry.name, entry.type, entry.url, entry.duration ?? null)
    }
  }

  // ── Window presets ───────────────────────────────────────────

  loadWindowPresets() {
    const rows = this.db.prepare('SELECT * FROM media_renders').all() as Array<{
      id: string; label: string; renderer_type: string; config_json: string; default_position_json: string | null;
    }>
    return rows.map((row) => ({
      id: row.id, label: row.label, rendererType: row.renderer_type,
      config: parseJson(row.config_json, {}),
      defaultPosition: parseJson(row.default_position_json, undefined),
    }))
  }

  saveWindowPresets(presets: NonNullable<AppConfig['windowPresets']>): void {
    this.db.prepare('DELETE FROM media_renders').run()
    const insert = this.db.prepare(
      'INSERT INTO media_renders (id, label, renderer_type, config_json, default_position_json) VALUES (?, ?, ?, ?, ?)'
    )
    for (const preset of presets) {
      insert.run(
        preset.id, preset.label, preset.rendererType,
        JSON.stringify(preset.config ?? {}),
        preset.defaultPosition ? JSON.stringify(preset.defaultPosition) : null,
      )
    }
  }

  // ── Avatar presets ───────────────────────────────────────────

  loadAvatarPresets() {
    const rows = this.db.prepare('SELECT * FROM avatar_presets').all() as Array<{
      id: string; name: string; mode: string; images_json: string; corner: string; width_px: number; linger_ms: number;
    }>
    return rows.map((row) => ({
      id: row.id, name: row.name, mode: row.mode as 'pop-in' | 'persistent',
      images: parseJson(row.images_json, [] as string[]),
      corner: row.corner as 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right',
      widthPx: row.width_px, lingerMs: row.linger_ms,
    }))
  }

  saveAvatarPresets(presets: NonNullable<AppConfig['avatarPresets']>): void {
    this.db.prepare('DELETE FROM avatar_presets').run()
    const insert = this.db.prepare(
      'INSERT INTO avatar_presets (id, name, mode, images_json, corner, width_px, linger_ms) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    for (const preset of presets) {
      insert.run(
        preset.id, preset.name, preset.mode,
        JSON.stringify(preset.images ?? []),
        preset.corner, preset.widthPx, preset.lingerMs,
      )
    }
  }

  // ── Shows ────────────────────────────────────────────────────

  loadShows(): NonNullable<AppConfig['shows']> {
    const rows = this.db.prepare('SELECT * FROM shows').all() as Array<{
      id: string; label: string; steps_json: string
    }>
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      steps: JSON.parse(row.steps_json ?? '[]'),
    }))
  }

  saveShows(shows: NonNullable<AppConfig['shows']>): void {
    this.db.prepare('DELETE FROM shows').run()
    const insert = this.db.prepare('INSERT INTO shows (id, label, steps_json) VALUES (?, ?, ?)')
    for (const show of shows) {
      insert.run(show.id, show.label, JSON.stringify(show.steps ?? []))
    }
  }

  // ── Twitch ───────────────────────────────────────────────────

  saveTwitchConfig(cfg: NonNullable<AppConfig['twitch']>): void {
    // Ensure new columns exist (idempotent — no-op if already present)
    try { this.db.exec('ALTER TABLE twitch_config ADD COLUMN client_id TEXT') } catch {}
    try { this.db.exec('ALTER TABLE twitch_config ADD COLUMN event_reactions_json TEXT') } catch {}

    this.db.prepare(
      'INSERT OR REPLACE INTO twitch_config (id, channel, access_token, enabled, client_id, event_reactions_json) VALUES (1, ?, ?, ?, ?, ?)'
    ).run(
      cfg.channel,
      cfg.accessToken ?? null,
      cfg.enabled ? 1 : 0,
      cfg.clientId ?? null,
      cfg.eventReactions?.length ? JSON.stringify(cfg.eventReactions) : null,
    )
  }

  loadTwitchConfig(): AppConfig['twitch'] {
    const columns = (this.db.prepare('PRAGMA table_info(twitch_config)').all() as Array<{ name: string }>).map((c) => c.name)
    const row = this.db.prepare('SELECT * FROM twitch_config WHERE id = 1').get() as {
      channel: string; access_token: string | null; enabled: number;
      client_id?: string | null; event_reactions_json?: string | null
    } | undefined
    if (!row) return undefined
    return {
      channel: row.channel,
      enabled: row.enabled === 1,
      accessToken: row.access_token ?? undefined,
      clientId: columns.includes('client_id') ? (row.client_id ?? undefined) : undefined,
      eventReactions: columns.includes('event_reactions_json') && row.event_reactions_json
        ? JSON.parse(row.event_reactions_json)
        : undefined,
    }
  }

  // ── Chat reactions ───────────────────────────────────────────

  saveChatReactions(rules: NonNullable<AppConfig['chatReactions']>): void {
    this.db.prepare('DELETE FROM chat_reactions').run()
    const insert = this.db.prepare(
      'INSERT INTO chat_reactions (id, label, enabled, match_json, actions_json, effects_json, cooldown_ms) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    for (const rule of rules) {
      insert.run(
        rule.id, rule.label, rule.enabled ? 1 : 0,
        JSON.stringify(rule.match),
        rule.actions ? JSON.stringify(rule.actions) : null,
        rule.effects ? JSON.stringify(rule.effects) : null,
        rule.cooldownMs ?? 0,
      )
    }
  }

  loadChatReactions(): NonNullable<AppConfig['chatReactions']> {
    const rows = this.db.prepare('SELECT * FROM chat_reactions').all() as Array<{
      id: string; label: string; enabled: number;
      match_json: string; actions_json: string | null;
      effects_json: string | null; cooldown_ms: number
    }>
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      enabled: row.enabled === 1,
      match: JSON.parse(row.match_json),
      actions: row.actions_json ? JSON.parse(row.actions_json) : undefined,
      effects: row.effects_json ? JSON.parse(row.effects_json) : undefined,
      cooldownMs: row.cooldown_ms || undefined,
    }))
  }
}
