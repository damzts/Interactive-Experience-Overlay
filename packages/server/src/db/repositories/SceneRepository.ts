import type Database from 'better-sqlite3'
import type { Scene } from '@ieomlabs/shared'

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try { return JSON.parse(value) as T } catch { return fallback }
}
function boolToInt(v: boolean | undefined) { return v ? 1 : 0 }

export class SceneRepository {
  constructor(private db: Database.Database) {}

  load(): Record<string, Scene> {
    const rows = this.db.prepare('SELECT * FROM scenes').all() as Array<{
      id: string; label: string; background_opaque: number;
      sources_json: string | null; style_json: string | null;
      lobby_config_json: string | null; on_entry_json: string | null;
      on_exit_json: string | null; music_track: string | null; show_desktop: number | null;
    }>
    const scenes: Record<string, Scene> = {}
    for (const row of rows) {
      scenes[row.id] = {
        id: row.id, label: row.label, backgroundOpaque: row.background_opaque === 1,
        sources: parseJson(row.sources_json, []),
        style: parseJson(row.style_json, undefined),
        lobbyConfig: parseJson(row.lobby_config_json, undefined),
        onEntry: parseJson<string[]>(row.on_entry_json, []),
        onExit: parseJson<string[]>(row.on_exit_json, []),
        musicTrack: row.music_track ?? undefined,
        showDesktop: row.show_desktop === 1,
      }
    }
    return scenes
  }

  save(scenes: Record<string, Scene>): void {
    this.db.prepare('DELETE FROM scenes').run()
    const insert = this.db.prepare(`
      INSERT INTO scenes (id, label, background_opaque, sources_json, style_json, lobby_config_json, on_entry_json, on_exit_json, music_track, show_desktop)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const scene of Object.values(scenes)) {
      insert.run(scene.id, scene.label, boolToInt(scene.backgroundOpaque),
        JSON.stringify(scene.sources ?? []),
        scene.style ? JSON.stringify(scene.style) : null,
        scene.lobbyConfig ? JSON.stringify(scene.lobbyConfig) : null,
        JSON.stringify(scene.onEntry ?? []),
        JSON.stringify(scene.onExit ?? []),
        scene.musicTrack ?? null, boolToInt(scene.showDesktop ?? false))
    }
  }
}
