import type Database from 'better-sqlite3'
import type { AppConfig, DesktopConfig } from '@ieomlabs/shared'

function parseJson<T>(v: string | null | undefined, fallback: T): T {
  if (!v) return fallback; try { return JSON.parse(v) as T } catch { return fallback }
}
function boolToInt(v: boolean | undefined) { return v ? 1 : 0 }

export class ThemeRepository {
  constructor(private db: Database.Database) {}

  loadDesktopConfig(): DesktopConfig | undefined {
    const row = this.db.prepare('SELECT * FROM desktop_config WHERE id = 1').get() as {
      global_theme_json: string | null; icon_animation: string | null;
      icon_arrangement: string | null; icon_motion: number | null;
      icon_arrangement_motion: number | null; default_icon_size: string | null;
      auto_arrange_icons: number | null; recycle_bin_json: string | null;
      screen_saver_json: string | null; system_sounds_json: string | null;
    } | undefined
    if (!row) return undefined
    return {
      globalThemeDefault: parseJson(row.global_theme_json, undefined),
      iconAnimation: row.icon_animation ?? undefined,
      iconArrangement: row.icon_arrangement ?? undefined,
      iconMotion: row.icon_motion ?? undefined,
      iconArrangementMotion: row.icon_arrangement_motion ?? undefined,
      defaultIconSize: row.default_icon_size ?? undefined,
      autoArrangeIcons: row.auto_arrange_icons != null ? row.auto_arrange_icons === 1 : undefined,
      recycleBin: parseJson(row.recycle_bin_json, undefined),
      screenSaver: parseJson(row.screen_saver_json, undefined),
      systemSounds: parseJson(row.system_sounds_json, undefined),
    } as unknown as DesktopConfig
  }

  saveDesktopConfig(dc: DesktopConfig): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO desktop_config (id, global_theme_json, icon_animation, icon_arrangement,
        icon_motion, icon_arrangement_motion, default_icon_size, auto_arrange_icons,
        recycle_bin_json, screen_saver_json, system_sounds_json)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      dc.globalThemeDefault ? JSON.stringify(dc.globalThemeDefault) : null,
      dc.iconAnimation ?? null, dc.iconArrangement ?? null,
      dc.iconMotion ?? null, dc.iconArrangementMotion ?? null,
      dc.defaultIconSize ?? null,
      dc.autoArrangeIcons != null ? boolToInt(dc.autoArrangeIcons) : null,
      dc.recycleBin ? JSON.stringify(dc.recycleBin) : null,
      dc.screenSaver ? JSON.stringify(dc.screenSaver) : null,
      dc.systemSounds ? JSON.stringify(dc.systemSounds) : null,
    )
  }

  loadDesktopAmbiance(): AppConfig['desktopAmbiance'] | undefined {
    const row = this.db.prepare('SELECT * FROM desktop_ambiance WHERE id = 1').get() as { simulation_json: string | null } | undefined
    if (!row?.simulation_json) return undefined
    return parseJson(row.simulation_json, undefined)
  }

  saveDesktopAmbiance(ambiance: NonNullable<AppConfig['desktopAmbiance']>): void {
    this.db.prepare('INSERT OR REPLACE INTO desktop_ambiance (id, simulation_json) VALUES (1, ?)').run(JSON.stringify(ambiance))
  }

  loadEffectAmbiance(): AppConfig['effectAmbiance'] | undefined {
    const row = this.db.prepare('SELECT * FROM effect_ambiance WHERE id = 1').get() as { config_json: string | null } | undefined
    if (!row?.config_json) return undefined
    return parseJson(row.config_json, undefined)
  }

  saveEffectAmbiance(config: NonNullable<AppConfig['effectAmbiance']>): void {
    this.db.prepare('INSERT OR REPLACE INTO effect_ambiance (id, config_json) VALUES (1, ?)').run(JSON.stringify(config))
  }

  loadDesktopThemeDrift(): AppConfig['desktopThemeDrift'] | undefined {
    const row = this.db.prepare('SELECT * FROM desktop_theme_drift WHERE id = 1').get() as { config_json: string | null } | undefined
    if (!row?.config_json) return undefined
    return parseJson(row.config_json, undefined)
  }

  saveDesktopThemeDrift(config: NonNullable<AppConfig['desktopThemeDrift']>): void {
    this.db.prepare('INSERT OR REPLACE INTO desktop_theme_drift (id, config_json) VALUES (1, ?)').run(JSON.stringify(config))
  }
}
