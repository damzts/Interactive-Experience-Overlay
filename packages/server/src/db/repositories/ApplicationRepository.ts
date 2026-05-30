import type { Application } from '@ieom/shared'
import type { Pool } from 'pg'

type ApplicationSettingsPayload = Pick<Application, 'transitionType' | 'introTransition' | 'exitTransition' | 'introTransitions' | 'exitTransitions' | 'launchPipeline' | 'gallerySettings' | 'cameraSettings' | 'sourceWidgetSettings' | 'stickyNotesSettings' | 'recycleBinSettings' | 'themeOverride'>

interface ApplicationRow {
  id: string
  user_id: string
  label: string
  icon: string
  app_type: Application['appType']
  target_scene_id: string
  widget_source: Application['widgetSource'] | null
  widget_component: Application['widgetComponent'] | null
  icon_position_x: number | null
  icon_position_y: number | null
  icon_size: Application['iconSize'] | null
  settings_json: Record<string, unknown> | null
}

function applicationSettings(app: Application): Record<string, unknown> {
  return {
    transitionType: app.transitionType,
    introTransition: app.introTransition,
    exitTransition: app.exitTransition,
    introTransitions: app.introTransitions,
    exitTransitions: app.exitTransitions,
    launchPipeline: app.launchPipeline,
    gallerySettings: app.gallerySettings,
    cameraSettings: app.cameraSettings,
    sourceWidgetSettings: app.sourceWidgetSettings,
    stickyNotesSettings: app.stickyNotesSettings,
    recycleBinSettings: app.recycleBinSettings,
    themeOverride: app.themeOverride,
  }
}

function rowToApplication(row: ApplicationRow): Application {
  const settings = (row.settings_json ?? {}) as ApplicationSettingsPayload
  return {
    id: row.id,
    label: row.label,
    icon: row.icon,
    appType: row.app_type,
    targetSceneId: row.target_scene_id,
    widgetSource: row.widget_source ?? undefined,
    widgetComponent: row.widget_component ?? undefined,
    iconPosition: row.icon_position_x != null && row.icon_position_y != null
      ? { x: row.icon_position_x, y: row.icon_position_y }
      : undefined,
    iconSize: row.icon_size ?? undefined,
    transitionType: settings.transitionType,
    introTransition: settings.introTransition,
    exitTransition: settings.exitTransition,
    introTransitions: settings.introTransitions,
    exitTransitions: settings.exitTransitions,
    launchPipeline: settings.launchPipeline,
    gallerySettings: settings.gallerySettings,
    cameraSettings: settings.cameraSettings,
    sourceWidgetSettings: settings.sourceWidgetSettings,
    stickyNotesSettings: settings.stickyNotesSettings,
    recycleBinSettings: settings.recycleBinSettings,
    themeOverride: settings.themeOverride,
  }
}

export class ApplicationRepository {
  constructor(private pool: Pool) {}

  async findAll(userId: string): Promise<Application[]> {
    const result = await this.pool.query<ApplicationRow>(
      'SELECT * FROM applications WHERE user_id = $1 ORDER BY id',
      [userId]
    )
    return result.rows.map(rowToApplication)
  }

  async save(userId: string, app: Application): Promise<void> {
    await this.pool.query(
      `INSERT INTO applications (
        id, user_id, label, icon, app_type, target_scene_id, widget_source, widget_component,
        icon_position_x, icon_position_y, icon_size, settings_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (user_id, id) DO UPDATE SET
        label = EXCLUDED.label,
        icon = EXCLUDED.icon,
        app_type = EXCLUDED.app_type,
        target_scene_id = EXCLUDED.target_scene_id,
        widget_source = EXCLUDED.widget_source,
        widget_component = EXCLUDED.widget_component,
        icon_position_x = EXCLUDED.icon_position_x,
        icon_position_y = EXCLUDED.icon_position_y,
        icon_size = EXCLUDED.icon_size,
        settings_json = EXCLUDED.settings_json`,
      [
        app.id,
        userId,
        app.label,
        app.icon,
        app.appType,
        app.targetSceneId,
        app.widgetSource ?? null,
        app.widgetComponent ?? null,
        app.iconPosition?.x ?? null,
        app.iconPosition?.y ?? null,
        app.iconSize ?? null,
        JSON.stringify(applicationSettings(app)),
      ]
    )
  }

  async saveAll(userId: string, apps: Application[]): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM applications WHERE user_id = $1', [userId])
      for (const app of apps) {
        await client.query(
          `INSERT INTO applications (
            id, user_id, label, icon, app_type, target_scene_id, widget_source, widget_component,
            icon_position_x, icon_position_y, icon_size, settings_json
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            app.id,
            userId,
            app.label,
            app.icon,
            app.appType,
            app.targetSceneId,
            app.widgetSource ?? null,
            app.widgetComponent ?? null,
            app.iconPosition?.x ?? null,
            app.iconPosition?.y ?? null,
            app.iconSize ?? null,
            JSON.stringify(applicationSettings(app)),
          ]
        )
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM applications WHERE user_id = $1 AND id = $2',
      [userId, id]
    )
  }
}
