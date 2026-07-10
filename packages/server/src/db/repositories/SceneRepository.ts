import type Database from 'better-sqlite3'
import type { Scene, SequenceStep } from '@ieomlabs/shared'

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
      windows_json: string | null; style_json: string | null;
      intro_sequence_id: string | null;
      exit_sequence_id: string | null;
      intro_steps_json: string | null;
      exit_steps_json: string | null;
      ambient_track: string | null; show_desktop: number | null;
    }>
    const scenes: Record<string, Scene> = {}
    for (const row of rows) {
      scenes[row.id] = {
        id: row.id, label: row.label, backgroundOpaque: row.background_opaque === 1,
        windows: parseJson(row.windows_json, []),
        style: parseJson(row.style_json, undefined),
        introSequenceId: row.intro_sequence_id ?? undefined,
        exitSequenceId: row.exit_sequence_id ?? undefined,
        introSteps: row.intro_steps_json ? parseJson<SequenceStep[]>(row.intro_steps_json, []) : undefined,
        exitSteps: row.exit_steps_json ? parseJson<SequenceStep[]>(row.exit_steps_json, []) : undefined,
        ambientTrack: row.ambient_track ?? undefined,
        showDesktop: row.show_desktop === 1,
      }
    }
    return scenes
  }

  save(scenes: Record<string, Scene>): void {
    this.db.prepare('DELETE FROM scenes').run()
    const insert = this.db.prepare(`
      INSERT INTO scenes (id, label, background_opaque, windows_json, style_json, intro_sequence_id, exit_sequence_id, intro_steps_json, exit_steps_json, ambient_track, show_desktop)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const scene of Object.values(scenes)) {
      insert.run(scene.id, scene.label, boolToInt(scene.backgroundOpaque),
        JSON.stringify(scene.windows ?? []),
        scene.style ? JSON.stringify(scene.style) : null,
        scene.introSequenceId ?? null,
        scene.exitSequenceId ?? null,
        scene.introSteps ? JSON.stringify(scene.introSteps) : null,
        scene.exitSteps ? JSON.stringify(scene.exitSteps) : null,
        scene.ambientTrack ?? null, boolToInt(scene.showDesktop ?? false))
    }
  }

  upsert(scene: Scene): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO scenes (id, label, background_opaque, windows_json, style_json, intro_sequence_id, exit_sequence_id, intro_steps_json, exit_steps_json, ambient_track, show_desktop)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      scene.id, scene.label, boolToInt(scene.backgroundOpaque),
      JSON.stringify(scene.windows ?? []),
      scene.style ? JSON.stringify(scene.style) : null,
      scene.introSequenceId ?? null,
      scene.exitSequenceId ?? null,
      scene.introSteps ? JSON.stringify(scene.introSteps) : null,
      scene.exitSteps ? JSON.stringify(scene.exitSteps) : null,
      scene.ambientTrack ?? null, boolToInt(scene.showDesktop ?? false),
    )
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM scenes WHERE id = ?').run(id)
  }
}
