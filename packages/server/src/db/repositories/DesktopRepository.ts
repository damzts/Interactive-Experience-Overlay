import { withDesktopConfigDefaults } from '@ieom/shared'
import type { DesktopConfig, WidgetLayoutDefinition } from '@ieom/shared'
import type { Database as DatabaseType } from 'better-sqlite3'
import { parseJson, boolToInt } from '../utils.js'

export class DesktopRepository {
  constructor(private db: DatabaseType) {}

  private loadWidgetLayouts(): WidgetLayoutDefinition[] {
    const rows = this.db.prepare('SELECT * FROM widget_layouts ORDER BY rowid').all() as Array<{
      id: string
      label: string
      icon: string
      source: WidgetLayoutDefinition['source']
      description: string | null
      items_json: string
      default_config_json: string | null
    }>

    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      icon: row.icon,
      source: row.source,
      description: row.description ?? undefined,
      items: parseJson<WidgetLayoutDefinition['items']>(row.items_json) ?? [],
      defaultConfig: parseJson<WidgetLayoutDefinition['defaultConfig']>(row.default_config_json),
    }))
  }

  private upsertWidgetLayout(layout: WidgetLayoutDefinition): void {
    this.db.prepare(`
      INSERT INTO widget_layouts (
        id, label, icon, source, description, items_json, default_config_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        label = excluded.label,
        icon = excluded.icon,
        source = excluded.source,
        description = excluded.description,
        items_json = excluded.items_json,
        default_config_json = excluded.default_config_json
    `).run(
      layout.id,
      layout.label,
      layout.icon,
      layout.source,
      layout.description ?? null,
      JSON.stringify(layout.items ?? []),
      layout.defaultConfig ? JSON.stringify(layout.defaultConfig) : null,
    )
  }

  private saveWidgetLayouts(layouts: WidgetLayoutDefinition[]): void {
    this.db.exec('DELETE FROM widget_layouts')
    for (const layout of layouts) this.upsertWidgetLayout(layout)
  }

  find(): DesktopConfig | undefined {
    const row = this.db.prepare('SELECT * FROM desktop_config WHERE id = 1').get() as {
      global_theme_json: string | null
      icon_animation: DesktopConfig['iconAnimation'] | null
      icon_arrangement: DesktopConfig['iconArrangement'] | null
      icon_motion: number | null
      icon_arrangement_motion: number | null
      default_icon_size: DesktopConfig['defaultIconSize'] | null
      auto_arrange_icons: number | null
      recycle_bin_json: string | null
      screen_saver_json: string | null
      system_sounds_json: string | null
      widget_positions_json: string | null
      widget_sizes_json: string | null
      widget_z_indices_json: string | null
      widget_default_z_indices_json: string | null
    } | undefined

    if (!row) return undefined

    return withDesktopConfigDefaults({
      globalThemeDefault: parseJson<DesktopConfig['globalThemeDefault']>(row.global_theme_json),
      iconAnimation: row.icon_animation ?? undefined,
      iconArrangement: row.icon_arrangement ?? undefined,
      iconMotion: row.icon_motion ?? undefined,
      iconArrangementMotion: row.icon_arrangement_motion ?? undefined,
      defaultIconSize: row.default_icon_size ?? undefined,
      autoArrangeIcons: Boolean(row.auto_arrange_icons),
      recycleBin: parseJson<DesktopConfig['recycleBin']>(row.recycle_bin_json),
      screenSaver: parseJson<DesktopConfig['screenSaver']>(row.screen_saver_json),
      systemSounds: parseJson<DesktopConfig['systemSounds']>(row.system_sounds_json),
      widgetPositions: parseJson<DesktopConfig['widgetPositions']>(row.widget_positions_json),
      widgetSizes: parseJson<DesktopConfig['widgetSizes']>(row.widget_sizes_json),
      widgetZIndices: parseJson<DesktopConfig['widgetZIndices']>(row.widget_z_indices_json),
      widgetDefaultZIndices: parseJson<DesktopConfig['widgetDefaultZIndices']>(row.widget_default_z_indices_json),
      widgetLayouts: this.loadWidgetLayouts(),
    })
  }

  save(cfg: DesktopConfig): void {
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO desktop_config (
          id, global_theme_json, icon_animation, icon_arrangement, icon_motion, icon_arrangement_motion,
          default_icon_size, auto_arrange_icons, recycle_bin_json, screen_saver_json, system_sounds_json,
          widget_positions_json, widget_sizes_json, widget_z_indices_json, widget_default_z_indices_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          global_theme_json = excluded.global_theme_json,
          icon_animation = excluded.icon_animation,
          icon_arrangement = excluded.icon_arrangement,
          icon_motion = excluded.icon_motion,
          icon_arrangement_motion = excluded.icon_arrangement_motion,
          default_icon_size = excluded.default_icon_size,
          auto_arrange_icons = excluded.auto_arrange_icons,
          recycle_bin_json = excluded.recycle_bin_json,
          screen_saver_json = excluded.screen_saver_json,
          system_sounds_json = excluded.system_sounds_json,
          widget_positions_json = excluded.widget_positions_json,
          widget_sizes_json = excluded.widget_sizes_json,
          widget_z_indices_json = excluded.widget_z_indices_json,
          widget_default_z_indices_json = excluded.widget_default_z_indices_json
      `).run(
        1,
        JSON.stringify(cfg.globalThemeDefault),
        cfg.iconAnimation,
        cfg.iconArrangement,
        cfg.iconMotion,
        cfg.iconArrangementMotion,
        cfg.defaultIconSize,
        boolToInt(cfg.autoArrangeIcons),
        JSON.stringify(cfg.recycleBin),
        JSON.stringify(cfg.screenSaver),
        JSON.stringify(cfg.systemSounds),
        cfg.widgetPositions ? JSON.stringify(cfg.widgetPositions) : null,
        cfg.widgetSizes ? JSON.stringify(cfg.widgetSizes) : null,
        cfg.widgetZIndices ? JSON.stringify(cfg.widgetZIndices) : null,
        cfg.widgetDefaultZIndices ? JSON.stringify(cfg.widgetDefaultZIndices) : null,
      )
      this.saveWidgetLayouts(cfg.widgetLayouts ?? [])
    })()
  }
}
