import type { EventConfig } from '@ieom/shared'
import type { Pool } from 'pg'

function clone<T>(value: T): T {
  return structuredClone(value)
}

const DEFAULT_EVENT_AUTO: EventConfig['auto'] = {
  enabled: false,
  mode: 'interval',
  intervalMin: 60,
  idleMin: 5,
  chance: 1,
  cooldownMin: 0,
}

interface EventRow {
  id: string
  user_id: string
  label: string
  icon: string
  color: string
  desc: string
  effects_json: unknown
  actions_json: unknown | null
  auto_json: unknown
}

function rowToEvent(row: EventRow): EventConfig {
  return {
    id: row.id,
    label: row.label,
    icon: row.icon,
    color: row.color,
    desc: row.desc,
    effects: (row.effects_json as EventConfig['effects']) ?? [],
    actions: (row.actions_json as EventConfig['actions']) ?? undefined,
    auto: (row.auto_json as EventConfig['auto']) ?? clone(DEFAULT_EVENT_AUTO),
  }
}

export class EventRepository {
  constructor(private pool: Pool) {}

  async findAll(userId: string): Promise<EventConfig[]> {
    const { rows } = await this.pool.query<EventRow>(
      'SELECT * FROM events WHERE user_id = $1 ORDER BY id',
      [userId]
    )
    return rows.map(rowToEvent)
  }

  async save(userId: string, event: EventConfig): Promise<void> {
    await this.pool.query(
      `INSERT INTO events (id, user_id, label, icon, color, desc, effects_json, actions_json, auto_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, id) DO UPDATE SET
         label = EXCLUDED.label,
         icon = EXCLUDED.icon,
         color = EXCLUDED.color,
         desc = EXCLUDED.desc,
         effects_json = EXCLUDED.effects_json,
         actions_json = EXCLUDED.actions_json,
         auto_json = EXCLUDED.auto_json`,
      [
        event.id,
        userId,
        event.label,
        event.icon,
        event.color,
        event.desc,
        JSON.stringify(event.effects ?? []),
        event.actions ? JSON.stringify(event.actions) : null,
        JSON.stringify(event.auto),
      ]
    )
  }

  async saveAll(userId: string, events: EventConfig[]): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM events WHERE user_id = $1', [userId])
      for (const event of events) {
        await client.query(
          `INSERT INTO events (id, user_id, label, icon, color, desc, effects_json, actions_json, auto_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            event.id,
            userId,
            event.label,
            event.icon,
            event.color,
            event.desc,
            JSON.stringify(event.effects ?? []),
            event.actions ? JSON.stringify(event.actions) : null,
            JSON.stringify(event.auto),
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
      'DELETE FROM events WHERE user_id = $1 AND id = $2',
      [userId, id]
    )
  }
}
