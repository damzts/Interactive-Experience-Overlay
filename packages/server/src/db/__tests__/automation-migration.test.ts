import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { migrateAutomationRules } from '../desktop-db.js'
import { AutomationRuleRepository } from '../repositories/AutomationRuleRepository.js'

function makeOldShapeDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE automation_rules (
      id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      condition_event TEXT NOT NULL,
      condition_match_json TEXT,
      action_kind TEXT NOT NULL CHECK(action_kind IN ('widget:toggle','scene:change','overlay:show','desktop:notify')),
      action_params_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE widget_wires (
      id TEXT PRIMARY KEY,
      trigger_widget_id TEXT NOT NULL,
      trigger_event TEXT NOT NULL,
      target_widget_id TEXT NOT NULL,
      target_action TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      condition_json TEXT
    );
  `)
  return db
}

describe('migrateAutomationRules', () => {
  it('rebuilds old-shape rules as kernel triggers and imports wires as widget triggers', () => {
    const db = makeOldShapeDb()
    db.prepare(
      "INSERT INTO automation_rules (id, enabled, condition_event, condition_match_json, action_kind, action_params_json) VALUES ('old-1', 1, 'twitch:follow', ?, 'desktop:notify', ?)"
    ).run(JSON.stringify({ tier: 1 }), JSON.stringify({ title: 'welcome' }))
    db.prepare(
      "INSERT INTO widget_wires (id, trigger_widget_id, trigger_event, target_widget_id, target_action, enabled, condition_json) VALUES ('w1', 'weather', 'weather:storm', 'gallery', 'gallery:next', 1, ?)"
    ).run(JSON.stringify({ sceneIs: ['DESKTOP'] }))

    migrateAutomationRules(db)

    const rules = new AutomationRuleRepository(db).list()
    expect(rules).toHaveLength(2)

    const kernelRule = rules.find((r) => r.id === 'old-1')!
    expect(kernelRule.trigger).toEqual({ source: 'kernel', event: 'twitch:follow', widgetId: undefined, match: { tier: 1 }, sceneIs: undefined })
    expect(kernelRule.action).toEqual({ kind: 'desktop:notify', params: { title: 'welcome' } })

    const wireRule = rules.find((r) => r.id === 'wire-w1')!
    expect(wireRule.enabled).toBe(true)
    expect(wireRule.trigger).toEqual({ source: 'widget', event: 'weather:storm', widgetId: 'weather', match: undefined, sceneIs: ['DESKTOP'] })
    expect(wireRule.action).toEqual({ kind: 'widget:action', params: { targetWidgetId: 'gallery', action: 'gallery:next' } })

    const wiresTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='widget_wires'").get()
    expect(wiresTable).toBeUndefined()
    db.close()
  })

  it('is idempotent — a second run is a no-op', () => {
    const db = makeOldShapeDb()
    db.prepare(
      "INSERT INTO widget_wires (id, trigger_widget_id, trigger_event, target_widget_id, target_action, enabled) VALUES ('w1', 'a', 'a:sig', 'b', 'b:act', 0)"
    ).run()

    migrateAutomationRules(db)
    migrateAutomationRules(db)

    const rules = new AutomationRuleRepository(db).list()
    expect(rules).toHaveLength(1)
    expect(rules[0].enabled).toBe(false)
    db.close()
  })

  it('imports wires with malformed condition_json without a scene gate', () => {
    const db = makeOldShapeDb()
    db.prepare(
      "INSERT INTO widget_wires (id, trigger_widget_id, trigger_event, target_widget_id, target_action, enabled, condition_json) VALUES ('w1', 'a', 'a:sig', 'b', 'b:act', 1, 'not json')"
    ).run()

    migrateAutomationRules(db)

    const rules = new AutomationRuleRepository(db).list()
    expect(rules).toHaveLength(1)
    expect(rules[0].trigger.sceneIs).toBeUndefined()
    db.close()
  })
})
