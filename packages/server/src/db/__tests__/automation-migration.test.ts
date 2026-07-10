import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { migrateAutomationRules, migrateAutomationActionShapes } from '../desktop-db.js'
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
    migrateAutomationActionShapes(db)

    const rules = new AutomationRuleRepository(db).list()
    expect(rules).toHaveLength(2)

    const kernelRule = rules.find((r) => r.id === 'old-1')!
    expect(kernelRule.trigger).toEqual({ source: 'kernel', event: 'twitch:follow', widgetId: undefined, match: { tier: 1 }, sceneIs: undefined })
    expect(kernelRule.action).toEqual({ kind: 'desktop-notify', title: 'welcome', body: '' })

    const wireRule = rules.find((r) => r.id === 'wire-w1')!
    expect(wireRule.enabled).toBe(true)
    expect(wireRule.trigger).toEqual({ source: 'widget', event: 'weather:storm', widgetId: 'weather', match: undefined, sceneIs: ['DESKTOP'] })
    expect(wireRule.action).toEqual({ kind: 'widget-command', widgetId: 'gallery', action: 'gallery:next' })

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

describe('migrateAutomationActionShapes', () => {
  function makeNewShapeDb(): Database.Database {
    const db = new Database(':memory:')
    db.exec(`
      CREATE TABLE automation_rules (
        id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 1,
        trigger_source TEXT NOT NULL DEFAULT 'kernel',
        trigger_widget_id TEXT,
        trigger_event TEXT NOT NULL,
        trigger_match_json TEXT,
        scene_is_json TEXT,
        action_kind TEXT NOT NULL,
        action_params_json TEXT NOT NULL DEFAULT '{}'
      );
    `)
    return db
  }

  function insertRule(db: Database.Database, id: string, kind: string, params: Record<string, unknown>) {
    db.prepare(
      'INSERT INTO automation_rules (id, trigger_event, action_kind, action_params_json) VALUES (?, ?, ?, ?)'
    ).run(id, 'some:event', kind, JSON.stringify(params))
  }

  it('rewrites every old colon-style kind onto the EventAction vocabulary', () => {
    const db = makeNewShapeDb()
    insertRule(db, 'notify', 'desktop:notify', { title: 'hi', body: 'there' })
    insertRule(db, 'emit', 'signal:emit', { event: 'party:time', payload: { mood: 'hype' } })
    insertRule(db, 'action', 'widget:action', { targetWidgetId: 'gallery', action: 'open' })
    insertRule(db, 'custom-action', 'widget:action', { targetWidgetId: 'gallery', action: 'gallery:next' })
    insertRule(db, 'toggle', 'widget:toggle', { widgetId: 'music' })
    insertRule(db, 'scene', 'scene:change', { sceneId: 'DESKTOP' })
    insertRule(db, 'overlay', 'overlay:show', { id: 'x', effects: [{ type: 'level-up', cfg: {} }] })

    migrateAutomationActionShapes(db)

    const rules = new AutomationRuleRepository(db).list()
    const byId = new Map(rules.map((r) => [r.id, r.action]))
    expect(byId.get('notify')).toEqual({ kind: 'desktop-notify', title: 'hi', body: 'there' })
    expect(byId.get('emit')).toEqual({ kind: 'signal-emit', event: 'party:time', payload: JSON.stringify({ mood: 'hype' }) })
    expect(byId.get('action')).toEqual({ kind: 'widget-command', widgetId: 'gallery', action: 'open' })
    expect(byId.get('custom-action')).toEqual({ kind: 'widget-command', widgetId: 'gallery', action: 'gallery:next' })
    expect(byId.get('toggle')).toEqual({ kind: 'widget-command', widgetId: 'music', action: 'toggle' })
    expect(byId.get('scene')).toEqual({ kind: 'scene-change', target: 'DESKTOP' })
    expect(byId.get('overlay')).toEqual({ kind: 'overlay-trigger', effectsJson: JSON.stringify([{ type: 'level-up', cfg: {} }]) })
    db.close()
  })

  it('leaves already-new-shape rows untouched', () => {
    const db = makeNewShapeDb()
    insertRule(db, 'already-new', 'desktop-notify', { title: 'hi', body: '' })

    migrateAutomationActionShapes(db)
    migrateAutomationActionShapes(db)

    const rules = new AutomationRuleRepository(db).list()
    expect(rules[0].action).toEqual({ kind: 'desktop-notify', title: 'hi', body: '' })
    db.close()
  })

  it('is idempotent — a second run is a no-op', () => {
    const db = makeNewShapeDb()
    insertRule(db, 'notify', 'desktop:notify', { title: 'hi' })

    migrateAutomationActionShapes(db)
    migrateAutomationActionShapes(db)

    const rules = new AutomationRuleRepository(db).list()
    expect(rules[0].action).toEqual({ kind: 'desktop-notify', title: 'hi', body: '' })
    db.close()
  })
})
