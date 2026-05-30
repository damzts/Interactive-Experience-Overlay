import type { Pool } from 'pg'

export interface PovFeedRow {
  id: string
  user_id: string
  label: string
  obs_address: string
  obs_password: string
  scene_name: string
  registered_at: number
}

export interface PovFeedInsert {
  id: string
  label: string
  obsAddress: string
  obsPassword: string
  sceneName: string
  registeredAt: number
}

export class PovFeedsRepository {
  constructor(private pool: Pool) {}

  async getAllFeeds(userId: string): Promise<PovFeedRow[]> {
    const { rows } = await this.pool.query<PovFeedRow>(
      'SELECT * FROM pov_feeds WHERE user_id = $1 ORDER BY registered_at',
      [userId]
    )
    return rows
  }

  async getFeedById(userId: string, id: string): Promise<PovFeedRow | undefined> {
    const { rows } = await this.pool.query<PovFeedRow>(
      'SELECT * FROM pov_feeds WHERE user_id = $1 AND id = $2',
      [userId, id]
    )
    return rows[0] ?? undefined
  }

  async getFeedByAddress(userId: string, address: string): Promise<PovFeedRow | undefined> {
    const { rows } = await this.pool.query<PovFeedRow>(
      'SELECT * FROM pov_feeds WHERE user_id = $1 AND obs_address = $2',
      [userId, address]
    )
    return rows[0] ?? undefined
  }

  async insertFeed(userId: string, feed: PovFeedInsert): Promise<void> {
    await this.pool.query(
      `INSERT INTO pov_feeds (id, user_id, label, obs_address, obs_password, scene_name, registered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [feed.id, userId, feed.label, feed.obsAddress, feed.obsPassword, feed.sceneName, feed.registeredAt]
    )
  }

  async updateFeed(userId: string, id: string, partial: Partial<Omit<PovFeedInsert, 'id' | 'registeredAt'>>): Promise<void> {
    const fields: string[] = []
    const values: unknown[] = []
    let paramIndex = 3 // $1 = userId, $2 = id

    if (partial.label !== undefined) {
      fields.push(`label = $${paramIndex++}`)
      values.push(partial.label)
    }
    if (partial.obsAddress !== undefined) {
      fields.push(`obs_address = $${paramIndex++}`)
      values.push(partial.obsAddress)
    }
    if (partial.obsPassword !== undefined) {
      fields.push(`obs_password = $${paramIndex++}`)
      values.push(partial.obsPassword)
    }
    if (partial.sceneName !== undefined) {
      fields.push(`scene_name = $${paramIndex++}`)
      values.push(partial.sceneName)
    }

    if (fields.length === 0) return

    await this.pool.query(
      `UPDATE pov_feeds SET ${fields.join(', ')} WHERE user_id = $1 AND id = $2`,
      [userId, id, ...values]
    )
  }

  async deleteFeed(userId: string, id: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM pov_feeds WHERE user_id = $1 AND id = $2',
      [userId, id]
    )
  }
}
