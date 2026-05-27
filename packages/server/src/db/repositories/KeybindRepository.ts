import type { AppConfig } from '@ieom/shared'
import type { Database as DatabaseType } from 'better-sqlite3'

export class KeybindRepository {
  constructor(private db: DatabaseType) {}

  find(): AppConfig['keybinds'] {
    const rows = this.db.prepare('SELECT scope, key, action FROM keybinds').all() as Array<{
      scope: keyof AppConfig['keybinds']
      key: string
      action: string
    }>

    const keybinds: AppConfig['keybinds'] = { obs: {}, admin: {} }
    for (const row of rows) {
      if (row.scope === 'obs' || row.scope === 'admin') keybinds[row.scope][row.key] = row.action
    }
    return keybinds
  }

  save(keybinds: AppConfig['keybinds']): void {
    this.db.transaction(() => {
      this.db.exec('DELETE FROM keybinds')
      for (const [key, action] of Object.entries(keybinds.obs)) {
        this.db.prepare('INSERT INTO keybinds (scope, key, action) VALUES (?, ?, ?)').run('obs', key, action)
      }
      for (const [key, action] of Object.entries(keybinds.admin)) {
        this.db.prepare('INSERT INTO keybinds (scope, key, action) VALUES (?, ?, ?)').run('admin', key, action)
      }
    })()
  }
}
