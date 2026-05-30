import { withDesktopConfigDefaults } from '@ieom/shared'
import type { DesktopConfig, WidgetLayoutDefinition } from '@ieom/shared'
import type { Pool, PoolClient } from 'pg'

export class DesktopRepository {
  constructor(private pool: Pool) {}

  private async loadWidgetLayouts(userId: string): Promise<WidgetLayoutDefinition[]> {
    const result = await this.pool.query<{
      id: string
      label: string
      icon: string
      source: WidgetLayoutDefinition['source']
      description: string | null
      items_json: WidgetLayoutDefinition['items']
      default_config_json: WidgetLayoutDefinition['defaultConfig'] | null
    }>(
      'SELECT id, label, icon, source, description, items_json, default_config_json FROM widget_layouts WHERE user_id = $1 ORDER BY id',
      [userId]
    )

    return result.rows.map((row) => ({
      id: row.id,
      label: row.label,
      icon: row.icon,
      source: row.source,
      description: row.description ?? undefined,
      items: row.items_json ?? [],
      defaultConfig: row.default_config_json ?? undefined,
    }))
  }

  private async saveWidgetLayouts(client: PoolClient, userId: string, layouts: WidgetLayoutDefinition[]): Promise<void> {
    await client.query('DELETE FROM widget_layouts WHERE user_id = $1', [userId])
    for (const layout of layouts) {
      await client.query(
        `INSERT INTO widget_layouts (id, user_id, label, icon, source, description, items_json, default_config_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, id) DO UPDATE SET
           label = EXCLUDED.label,
           icon = EXCLUDED.icon,
           source = EXCLUDED.source,
           description = EXCLUDED.description,
           items_json = EXCLUDED.items_json,
           default_config_json = EXCLUDED.default_config_json`,
        [
          layout.id,
          userId,
          layout.label,
          layout.icon,
          layout.source,
          layout.description ?? null,
          JSON.stringify(layout.items ?? []),
          layout.defaultConfig ? JSON.stringify(layout.defaultConfig) : null,
        ]
      )
    }
  }

  async find(userId: string): Promise<DesktopConfig | undefined> {
    const result = await this.pool.query<{
      global_theme_json: DesktopConfig['globalThemeDefault'] | null
      icon_animation: DesktopConfig['iconAnimation'] | null
      icon_arrangement: DesktopConfig['iconArrangement'] | null
      icon_motion: number | null
      icon_arrangement_motion: number | null
      default_icon_size: DesktopConfig['defaultIconSize'] | null
      auto_arrange_icons: boolean | null
      recycle_bin_json: DesktopConfig['recycleBin'] | null
      screen_saver_json: DesktopConfig['screenSaver'] | null
      system_sounds_json: DesktopConfig['systemSounds'] | null
      widget_positions_json: DesktopConfig['widgetPositions'] | null
      widget_sizes_json: DesktopConfig['widgetSizes'] | null
      widget_z_indices_json: DesktopConfig['widgetZIndices'] | null
      widget_default_z_indices_json: DesktopConfig['widgetDefaultZIndices'] | null
    }>(
      'SELECT * FROM desktop_config WHERE user_id = $1',
      [userId]
    )

    const row = result.rows[0]
    if (!row) return undefined

    const widgetLayouts = await this.loadWidgetLayouts(userId)

    return withDesktopConfigDefaults({
      globalThemeDefault: row.global_theme_json ?? undefined,
      iconAnimation: row.icon_animation ?? undefined,
      iconArrangement: row.icon_arrangement ?? undefined,
      iconMotion: row.icon_motion ?? undefined,
      iconArrangementMotion: row.icon_arrangement_motion ?? undefined,
      defaultIconSize: row.default_icon_size ?? undefined,
      autoArrangeIcons: row.auto_arrange_icons ?? undefined,
      recycleBin: row.recycle_bin_json ?? undefined,
      screenSaver: row.screen_saver_json ?? undefined,
      systemSounds: row.system_sounds_json ?? undefined,
      widgetPositions: row.widget_positions_json ?? undefined,
      widgetSizes: row.widget_sizes_json ?? undefined,
      widgetZIndices: row.widget_z_indices_json ?? undefined,
      widgetDefaultZIndices: row.widget_default_z_indices_json ?? undefined,
      widgetLayouts,
    })
  }

  async save(userId: string, cfg: DesktopConfig): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      await client.query(
        `INSERT INTO desktop_config (
          user_id, global_theme_json, icon_animation, icon_arrangement, icon_motion, icon_arrangement_motion,
          default_icon_size, auto_arrange_icons, recycle_bin_json, screen_saver_json, system_sounds_json,
          widget_positions_json, widget_sizes_json, widget_z_indices_json, widget_default_z_indices_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (user_id) DO UPDATE SET
          global_theme_json = EXCLUDED.global_theme_json,
          icon_animation = EXCLUDED.icon_animation,
          icon_arrangement = EXCLUDED.icon_arrangement,
          icon_motion = EXCLUDED.icon_motion,
          icon_arrangement_motion = EXCLUDED.icon_arrangement_motion,
          default_icon_size = EXCLUDED.default_icon_size,
          auto_arrange_icons = EXCLUDED.auto_arrange_icons,
          recycle_bin_json = EXCLUDED.recycle_bin_json,
          screen_saver_json = EXCLUDED.screen_saver_json,
          system_sounds_json = EXCLUDED.system_sounds_json,
          widget_positions_json = EXCLUDED.widget_positions_json,
          widget_sizes_json = EXCLUDED.widget_sizes_json,
          widget_z_indices_json = EXCLUDED.widget_z_indices_json,
          widget_default_z_indices_json = EXCLUDED.widget_default_z_indices_json`,
        [
          userId,
          JSON.stringify(cfg.globalThemeDefault),
          cfg.iconAnimation,
          cfg.iconArrangement,
          cfg.iconMotion,
          cfg.iconArrangementMotion,
          cfg.defaultIconSize,
          cfg.autoArrangeIcons,
          JSON.stringify(cfg.recycleBin),
          JSON.stringify(cfg.screenSaver),
          JSON.stringify(cfg.systemSounds),
          cfg.widgetPositions ? JSON.stringify(cfg.widgetPositions) : null,
          cfg.widgetSizes ? JSON.stringify(cfg.widgetSizes) : null,
          cfg.widgetZIndices ? JSON.stringify(cfg.widgetZIndices) : null,
          cfg.widgetDefaultZIndices ? JSON.stringify(cfg.widgetDefaultZIndices) : null,
        ]
      )

      await this.saveWidgetLayouts(client, userId, cfg.widgetLayouts ?? [])

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}
