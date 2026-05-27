import type { Scene, OverlayStyle } from '@ieom/shared'
import type { Database as DatabaseType } from 'better-sqlite3'
import { parseJson, boolToInt } from '../utils.js'

type SceneTransitionsPayload = Pick<Scene, 'introTransition' | 'exitTransition' | 'introTransitions' | 'exitTransitions' | 'musicTrack'>

function sceneTransitions(scene: Scene): string {
  return JSON.stringify({
    introTransition: scene.introTransition,
    exitTransition: scene.exitTransition,
    introTransitions: scene.introTransitions,
    exitTransitions: scene.exitTransitions,
    musicTrack: scene.musicTrack,
  } satisfies SceneTransitionsPayload)
}

export class SceneRepository {
  constructor(private db: DatabaseType) {}

  findAll(): Record<string, Scene> {
    const rows = this.db.prepare('SELECT * FROM scenes').all() as Array<{
      id: string
      label: string
      background_opaque: number
      sources_json: string
      style_json: string | null
      lobby_config_json: string | null
      transitions_json: string | null
    }>

    return Object.fromEntries(rows.map((row) => {
      const transitions = parseJson<SceneTransitionsPayload>(row.transitions_json) ?? {}
      const scene: Scene = {
        id: row.id,
        label: row.label,
        backgroundOpaque: Boolean(row.background_opaque),
        sources: parseJson<Scene['sources']>(row.sources_json) ?? [],
        style: parseJson<OverlayStyle>(row.style_json),
        lobbyConfig: parseJson<Scene['lobbyConfig']>(row.lobby_config_json),
        introTransition: transitions.introTransition,
        exitTransition: transitions.exitTransition,
        introTransitions: transitions.introTransitions,
        exitTransitions: transitions.exitTransitions,
        musicTrack: transitions.musicTrack,
      }
      return [row.id, scene]
    }))
  }

  save(scene: Scene): void {
    this.db.prepare(`
      INSERT INTO scenes (
        id, label, background_opaque, sources_json, style_json, lobby_config_json, transitions_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        label = excluded.label,
        background_opaque = excluded.background_opaque,
        sources_json = excluded.sources_json,
        style_json = excluded.style_json,
        lobby_config_json = excluded.lobby_config_json,
        transitions_json = excluded.transitions_json
    `).run(
      scene.id,
      scene.label,
      boolToInt(scene.backgroundOpaque),
      JSON.stringify(scene.sources ?? []),
      scene.style ? JSON.stringify(scene.style) : null,
      scene.lobbyConfig ? JSON.stringify(scene.lobbyConfig) : null,
      sceneTransitions(scene),
    )
  }

  saveAll(scenes: Record<string, Scene>): void {
    this.db.transaction(() => {
      this.db.exec('DELETE FROM scenes')
      for (const scene of Object.values(scenes)) this.save(scene)
    })()
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM scenes WHERE id = ?').run(id)
  }
}
