import { describe, expect, it } from 'vitest'
import { STATE } from '@ieomlabs/shared'
import type { AutomationRule } from '@ieomlabs/shared'
import { evaluateWidgetRules } from '../widgetRuleEvaluator'

function rule(overrides: Partial<AutomationRule>): AutomationRule {
  return {
    id: 'r1',
    enabled: true,
    trigger: { source: 'widget', event: 'weather:storm' },
    action: { kind: 'widget:action', params: { targetWidgetId: 'gallery', action: 'gallery:next' } },
    ...overrides,
  }
}

const storm = { source: 'weather', event: 'weather:storm', payload: {} }

describe('evaluateWidgetRules', () => {
  it('returns local widget actions for matching widget-source rules', () => {
    const actions = evaluateWidgetRules([rule({})], storm, STATE.DESKTOP)
    expect(actions).toEqual([{ targetWidgetId: 'gallery', action: 'gallery:next' }])
  })

  it('skips disabled rules, kernel-source rules, and non-matching events', () => {
    const rules = [
      rule({ id: 'r1', enabled: false }),
      rule({ id: 'r2', trigger: { source: 'kernel', event: 'weather:storm' } }),
      rule({ id: 'r3', trigger: { source: 'widget', event: 'weather:clear' } }),
    ]
    expect(evaluateWidgetRules(rules, storm, STATE.DESKTOP)).toEqual([])
  })

  it('filters on the emitting widget when widgetId is set', () => {
    const rules = [rule({ trigger: { source: 'widget', event: 'weather:storm', widgetId: 'other' } })]
    expect(evaluateWidgetRules(rules, storm, STATE.DESKTOP)).toEqual([])

    const anySource = [rule({ trigger: { source: 'widget', event: 'weather:storm', widgetId: '' } })]
    expect(evaluateWidgetRules(anySource, storm, STATE.DESKTOP)).toHaveLength(1)
  })

  it('enforces sceneIs and payload match gates', () => {
    const gated = [rule({ trigger: { source: 'widget', event: 'weather:storm', sceneIs: [STATE.LOBBY] } })]
    expect(evaluateWidgetRules(gated, storm, STATE.DESKTOP)).toEqual([])
    expect(evaluateWidgetRules(gated, storm, STATE.LOBBY)).toHaveLength(1)

    const matched = [rule({ trigger: { source: 'widget', event: 'weather:storm', match: { severity: 'high' } } })]
    expect(evaluateWidgetRules(matched, storm, STATE.DESKTOP)).toEqual([])
    expect(evaluateWidgetRules(matched, { ...storm, payload: { severity: 'high' } }, STATE.DESKTOP)).toHaveLength(1)
  })

  it('never returns authoritative open/close/toggle or non-widget:action kinds', () => {
    const rules = [
      rule({ id: 'r1', action: { kind: 'widget:action', params: { targetWidgetId: 'g', action: 'open' } } }),
      rule({ id: 'r2', action: { kind: 'widget:action', params: { targetWidgetId: 'g', action: 'toggle' } } }),
      rule({ id: 'r3', action: { kind: 'overlay:show', params: {} } }),
      rule({ id: 'r4', action: { kind: 'signal:emit', params: { event: 'x' } } }),
    ]
    expect(evaluateWidgetRules(rules, storm, STATE.DESKTOP)).toEqual([])
  })
})
