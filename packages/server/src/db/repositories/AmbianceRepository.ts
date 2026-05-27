import type { DesktopAmbianceConfig } from '@ieom/shared'
import type { Database as DatabaseType } from 'better-sqlite3'
import { parseJson } from '../utils.js'

export class AmbianceRepository {
  constructor(private db: DatabaseType) {}

  find(): DesktopAmbianceConfig | undefined {
    const row = this.db.prepare('SELECT simulation_json FROM desktop_ambiance WHERE id = 1').get() as { simulation_json: string | null } | undefined
    const widgetSimulation = parseJson<DesktopAmbianceConfig['widgetSimulation']>(row?.simulation_json)
    return widgetSimulation ? { widgetSimulation } : undefined
  }

  save(cfg: DesktopAmbianceConfig): void {
    this.db.prepare(`
      INSERT INTO desktop_ambiance (id, simulation_json) VALUES (?, ?)
      ON CONFLICT(id) DO UPDATE SET
        simulation_json = excluded.simulation_json
    `).run(1, JSON.stringify(cfg.widgetSimulation))
  }
}
