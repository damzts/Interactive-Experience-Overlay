import type Database from 'better-sqlite3'
import type { Application, WidgetLayoutDefinition, WidgetLayoutItem } from '@ieomlabs/shared'

function parseJson<T>(v: string | null | undefined, fallback: T): T {
  if (!v) return fallback; try { return JSON.parse(v) as T } catch { return fallback }
}

export class WidgetRepository {
  constructor(private db: Database.Database) {}

  loadApplications(): Application[] {
    const rows = this.db.prepare('SELECT * FROM widgets').all() as Array<{
      id: string; label: string; icon: string;
      widget_source: string | null; widget_component: string | null;
      window_x: number | null; window_y: number | null;
      window_width: number | null; window_height: number | null;
      z_index_default: number | null; z_index_current: number | null;
      settings_json: string | null;
    }>
    return rows.map((row) => {
      const settings = parseJson<Record<string, unknown>>(row.settings_json, {})
      return {
        id: row.id, label: row.label, icon: row.icon,
        widgetSource: row.widget_source as Application['widgetSource'] | undefined,
        widgetComponent: row.widget_component as Application['widgetComponent'] | undefined,
        windowPosition: row.window_x != null && row.window_y != null ? { x: row.window_x, y: row.window_y } : undefined,
        windowSize: row.window_width != null || row.window_height != null
          ? { width: row.window_width ?? undefined, height: row.window_height ?? undefined } : undefined,
        zIndexDefault: row.z_index_default ?? undefined,
        zIndexCurrent: row.z_index_current ?? undefined,
        ...settings,
      } as Application
    })
  }

  private appToRow(app: Application): unknown[] {
    const settings: Record<string, unknown> = {}
    if (app.gallerySettings)      settings.gallerySettings      = app.gallerySettings
    if (app.winampWindowSettings) settings.winampWindowSettings = app.winampWindowSettings
    if (app.cameraSettings)       settings.cameraSettings       = app.cameraSettings
    if (app.screenSettings)       settings.screenSettings       = app.screenSettings
    if (app.windowWidgetSettings) settings.windowWidgetSettings = app.windowWidgetSettings
    if (app.stickyNotesSettings)  settings.stickyNotesSettings  = app.stickyNotesSettings
    if (app.theme)                settings.theme                = app.theme
    if (app.iconSize)             settings.iconSize             = app.iconSize
    if (app.iconPosition)         settings.iconPosition         = app.iconPosition
    if (app.recycleBinSettings)   settings.recycleBinSettings   = app.recycleBinSettings
    if (app.targetSceneId)        settings.targetSceneId        = app.targetSceneId
    return [
      app.id, app.label, app.icon ?? '',
      app.widgetSource ?? null, app.widgetComponent ?? null,
      app.windowPosition?.x ?? null, app.windowPosition?.y ?? null,
      app.windowSize?.width ?? null, app.windowSize?.height ?? null,
      app.zIndexDefault ?? null, app.zIndexCurrent ?? null,
      Object.keys(settings).length > 0 ? JSON.stringify(settings) : null,
    ]
  }

  upsertApplication(app: Application): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO widgets (id, label, icon, widget_source, widget_component,
        window_x, window_y, window_width, window_height, z_index_default, z_index_current, settings_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...this.appToRow(app))
  }

  saveApplications(apps: Application[]): void {
    this.db.prepare('DELETE FROM widgets').run()
    const insert = this.db.prepare(`
      INSERT INTO widgets (id, label, icon, widget_source, widget_component,
        window_x, window_y, window_width, window_height, z_index_default, z_index_current, settings_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const app of apps) insert.run(...this.appToRow(app))
  }

  loadLayouts(): WidgetLayoutDefinition[] {
    type LayoutRow = { id: string; label: string; icon: string; source: string; description: string | null; sort_order: number }
    type ItemRow = { layout_id: string; widget_id: string; enabled: number; x: number; y: number; width: number; height: number; focus_priority: number }
    const layouts = this.db.prepare('SELECT * FROM widget_layouts ORDER BY sort_order ASC').all() as LayoutRow[]
    const allItems = this.db.prepare('SELECT * FROM widget_layout_items').all() as ItemRow[]
    const itemsByLayout = new Map<string, WidgetLayoutItem[]>()
    for (const item of allItems) {
      const list = itemsByLayout.get(item.layout_id) ?? []
      list.push({ widgetId: item.widget_id, enabled: item.enabled === 1, x: item.x, y: item.y, width: item.width, height: item.height, focusPriority: item.focus_priority })
      itemsByLayout.set(item.layout_id, list)
    }
    return layouts.map((row) => ({
      id: row.id, label: row.label, icon: row.icon,
      source: row.source as 'system' | 'user',
      description: row.description ?? undefined,
      items: itemsByLayout.get(row.id) ?? [],
    }))
  }

  saveLayouts(layouts: WidgetLayoutDefinition[]): void {
    const userLayouts = layouts.filter((l) => l.source !== 'system')
    const deleteItems = this.db.prepare('DELETE FROM widget_layout_items WHERE layout_id = ?')
    const deleteLayout = this.db.prepare('DELETE FROM widget_layouts WHERE id = ? AND source = ?')
    const upsertLayout = this.db.prepare('INSERT OR REPLACE INTO widget_layouts (id, label, icon, source, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
    const insertItem = this.db.prepare('INSERT INTO widget_layout_items (layout_id, widget_id, enabled, x, y, width, height, focus_priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')

    const existingIds = (this.db.prepare("SELECT id FROM widget_layouts WHERE source = 'user'").all() as { id: string }[]).map((r) => r.id)
    const incomingIds = new Set(userLayouts.map((l) => l.id))
    for (const id of existingIds) {
      if (!incomingIds.has(id)) { deleteItems.run(id); deleteLayout.run(id, 'user') }
    }
    for (let i = 0; i < userLayouts.length; i++) {
      const layout = userLayouts[i]
      deleteItems.run(layout.id)
      upsertLayout.run(layout.id, layout.label, layout.icon, 'user', layout.description ?? null, i)
      for (const item of layout.items) {
        insertItem.run(layout.id, item.widgetId, item.enabled ? 1 : 0, item.x, item.y, item.width, item.height, item.focusPriority)
      }
    }
  }
}
