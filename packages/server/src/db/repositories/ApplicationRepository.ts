import type { Application } from '@ieom/shared'
import type { Database as DatabaseType } from 'better-sqlite3'
import { parseJson } from '../utils.js'

type ApplicationSettingsPayload = Pick<Application, 'transitionType' | 'introTransition' | 'exitTransition' | 'introTransitions' | 'exitTransitions' | 'launchPipeline' | 'gallerySettings' | 'cameraSettings' | 'sourceWidgetSettings' | 'stickyNotesSettings' | 'recycleBinSettings' | 'themeOverride'>

function applicationSettings(app: Application): string {
  return JSON.stringify({
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
  } satisfies ApplicationSettingsPayload)
}

export class ApplicationRepository {
  constructor(private db: DatabaseType) {}

  findAll(): Application[] {
    const rows = this.db.prepare('SELECT * FROM applications ORDER BY rowid').all() as Array<{
      id: string
      label: string
      icon: string
      app_type: Application['appType']
      target_scene_id: string
      widget_source: Application['widgetSource'] | null
      widget_component: Application['widgetComponent'] | null
      icon_position_x: number | null
      icon_position_y: number | null
      icon_size: Application['iconSize'] | null
      settings_json: string | null
    }>

    return rows.map((row) => {
      const settings = parseJson<ApplicationSettingsPayload>(row.settings_json) ?? {}
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
    })
  }

  save(app: Application): void {
    this.db.prepare(`
      INSERT INTO applications (
        id, label, icon, app_type, target_scene_id, widget_source, widget_component,
        icon_position_x, icon_position_y, icon_size, settings_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        label = excluded.label,
        icon = excluded.icon,
        app_type = excluded.app_type,
        target_scene_id = excluded.target_scene_id,
        widget_source = excluded.widget_source,
        widget_component = excluded.widget_component,
        icon_position_x = excluded.icon_position_x,
        icon_position_y = excluded.icon_position_y,
        icon_size = excluded.icon_size,
        settings_json = excluded.settings_json
    `).run(
      app.id,
      app.label,
      app.icon,
      app.appType,
      app.targetSceneId,
      app.widgetSource ?? null,
      app.widgetComponent ?? null,
      app.iconPosition?.x ?? null,
      app.iconPosition?.y ?? null,
      app.iconSize ?? null,
      applicationSettings(app),
    )
  }

  saveAll(apps: Application[]): void {
    this.db.transaction(() => {
      this.db.exec('DELETE FROM applications')
      for (const app of apps) this.save(app)
    })()
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM applications WHERE id = ?').run(id)
  }
}
