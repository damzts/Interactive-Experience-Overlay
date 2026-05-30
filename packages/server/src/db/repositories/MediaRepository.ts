import type { MediaEntry } from '@ieom/shared'
import type { Pool } from 'pg'

interface MediaRow {
  id: string
  user_id: string
  name: string
  type: MediaEntry['type']
  url: string
  duration: number | null
}

function rowToMedia(row: MediaRow): MediaEntry {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    url: row.url,
    duration: row.duration ?? undefined,
  }
}

export class MediaRepository {
  constructor(private pool: Pool) {}

  async findAll(userId: string): Promise<MediaEntry[]> {
    const { rows } = await this.pool.query<MediaRow>(
      'SELECT * FROM media_library WHERE user_id = $1 ORDER BY id',
      [userId]
    )
    return rows.map(rowToMedia)
  }

  async save(userId: string, entry: MediaEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO media_library (id, user_id, name, type, url, duration) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, id) DO UPDATE SET
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         url = EXCLUDED.url,
         duration = EXCLUDED.duration`,
      [entry.id, userId, entry.name, entry.type, entry.url, entry.duration ?? null]
    )
  }

  async saveAll(userId: string, entries: MediaEntry[]): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM media_library WHERE user_id = $1', [userId])
      for (const entry of entries) {
        await client.query(
          `INSERT INTO media_library (id, user_id, name, type, url, duration) VALUES ($1, $2, $3, $4, $5, $6)`,
          [entry.id, userId, entry.name, entry.type, entry.url, entry.duration ?? null]
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
      'DELETE FROM media_library WHERE user_id = $1 AND id = $2',
      [userId, id]
    )
  }
}
