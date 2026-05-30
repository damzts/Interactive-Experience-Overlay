import type { Scene, OverlayStyle } from '@ieom/shared'
import type { Pool } from 'pg'

type SceneTransitionsPayload = Pick<Scene, 'introTransition' | 'exitTransition' | 'introTransitions' | 'exitTransitions' | 'musicTrack'>

function sceneTransitions(scene: Scene): SceneTransitionsPayload {
  return {
    introTransition: scene.introTransition,
    exitTransition: scene.exitTransition,
    introTransitions: scene.introTransitions,
    exitTransitions: scene.exitTransitions,
    musicTrack: scene.musicTrack,
  }
}

interface SceneRow {
  id: string
  user_id: string
  label: string
  background_opaque: boolean
  sources_json: unknown
  style_json: unknown | null
  lobby_config_json: unknown | null
  transitions_json: unknown | null
}

function rowToScene(row: SceneRow): Scene {
  const transitions = (row.transitions_json as SceneTransitionsPayload | null) ?? {}
  return {
    id: row.id,
    label: row.label,
    backgroundOpaque: row.background_opaque,
    sources: (row.sources_json as Scene['sources']) ?? [],
    style: (row.style_json as OverlayStyle | undefined) ?? undefined,
    lobbyConfig: (row.lobby_config_json as Scene['lobbyConfig'] | undefined) ?? undefined,
    introTransition: transitions.introTransition,
    exitTransition: transitions.exitTransition,
    introTransitions: transitions.introTransitions,
    exitTransitions: transitions.exitTransitions,
    musicTrack: transitions.musicTrack,
  }
}

export class SceneRepository {
  constructor(private pool: Pool) {}

  async findAll(userId: string): Promise<Record<string, Scene>> {
    const { rows } = await this.pool.query<SceneRow>(
      'SELECT * FROM scenes WHERE user_id = $1',
      [userId]
    )

    return Object.fromEntries(
      rows.map((row) => [row.id, rowToScene(row)])
    )
  }

  async save(userId: string, scene: Scene): Promise<void> {
    await this.pool.query(
      `INSERT INTO scenes (id, user_id, label, background_opaque, sources_json, style_json, lobby_config_json, transitions_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, id) DO UPDATE SET
         label = EXCLUDED.label,
         background_opaque = EXCLUDED.background_opaque,
         sources_json = EXCLUDED.sources_json,
         style_json = EXCLUDED.style_json,
         lobby_config_json = EXCLUDED.lobby_config_json,
         transitions_json = EXCLUDED.transitions_json`,
      [
        scene.id,
        userId,
        scene.label,
        scene.backgroundOpaque,
        JSON.stringify(scene.sources ?? []),
        scene.style ? JSON.stringify(scene.style) : null,
        scene.lobbyConfig ? JSON.stringify(scene.lobbyConfig) : null,
        JSON.stringify(sceneTransitions(scene)),
      ]
    )
  }

  async saveAll(userId: string, scenes: Record<string, Scene>): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM scenes WHERE user_id = $1', [userId])
      for (const scene of Object.values(scenes)) {
        await client.query(
          `INSERT INTO scenes (id, user_id, label, background_opaque, sources_json, style_json, lobby_config_json, transitions_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            scene.id,
            userId,
            scene.label,
            scene.backgroundOpaque,
            JSON.stringify(scene.sources ?? []),
            scene.style ? JSON.stringify(scene.style) : null,
            scene.lobbyConfig ? JSON.stringify(scene.lobbyConfig) : null,
            JSON.stringify(sceneTransitions(scene)),
          ]
        )
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM scenes WHERE user_id = $1 AND id = $2',
      [userId, id]
    )
  }
}
