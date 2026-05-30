import type { DesktopAmbianceConfig } from '@ieom/shared'
import type { Pool } from 'pg'

interface AmbianceRow {
  user_id: string
  simulation_json: unknown | null
}

export class AmbianceRepository {
  constructor(private pool: Pool) {}

  async find(userId: string): Promise<DesktopAmbianceConfig | undefined> {
    const { rows } = await this.pool.query<AmbianceRow>(
      'SELECT simulation_json FROM desktop_ambiance WHERE user_id = $1',
      [userId]
    )
    if (rows.length === 0) return undefined
    const widgetSimulation = rows[0].simulation_json as DesktopAmbianceConfig['widgetSimulation'] | null
    return widgetSimulation ? { widgetSimulation } : undefined
  }

  async save(userId: string, cfg: DesktopAmbianceConfig): Promise<void> {
    await this.pool.query(
      `INSERT INTO desktop_ambiance (user_id, simulation_json) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET
         simulation_json = EXCLUDED.simulation_json`,
      [userId, JSON.stringify(cfg.widgetSimulation)]
    )
  }
}
