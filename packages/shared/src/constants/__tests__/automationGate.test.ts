import { describe, it, expect } from 'vitest'
import { createAutomationGate } from '../automationGate'
import type { AutomationRule, AutomationTrigger } from '../../contracts/automation'

function rule(trigger: Partial<AutomationTrigger>, id = 'r1'): AutomationRule {
  return {
    id,
    enabled: true,
    trigger: { source: 'kernel', event: 'twitch:follow', ...trigger },
    action: { kind: 'desktop:notify', params: {} },
  }
}

describe('createAutomationGate', () => {
  it('passes everything when no stateful condition is set', () => {
    const gate = createAutomationGate()
    const r = rule({})
    expect(gate(r, 0)).toBe(true)
    expect(gate(r, 1)).toBe(true)
  })

  it('cooldownMs blocks refires inside the window and allows after it', () => {
    const gate = createAutomationGate()
    const r = rule({ cooldownMs: 1000 })
    expect(gate(r, 0)).toBe(true)
    expect(gate(r, 500)).toBe(false)
    expect(gate(r, 999)).toBe(false)
    expect(gate(r, 1000)).toBe(true)
    expect(gate(r, 1500)).toBe(false)
  })

  it('everyN fires only on every Nth match', () => {
    const gate = createAutomationGate()
    const r = rule({ everyN: 3 })
    const results = [1, 2, 3, 4, 5, 6, 7].map((t) => gate(r, t))
    expect(results).toEqual([false, false, true, false, false, true, false])
  })

  it('everyN of 1 or less means every match', () => {
    const gate = createAutomationGate()
    expect(gate(rule({ everyN: 1 }), 0)).toBe(true)
    expect(gate(rule({ everyN: 0 }, 'r2'), 0)).toBe(true)
  })

  it('windowCount fires when N matches arrive within windowMs, then clears', () => {
    const gate = createAutomationGate()
    const r = rule({ windowCount: 3, windowMs: 1000 })
    expect(gate(r, 0)).toBe(false)
    expect(gate(r, 100)).toBe(false)
    expect(gate(r, 200)).toBe(true)    // 3 within 1s → fire, window clears
    expect(gate(r, 300)).toBe(false)   // counting restarts
    expect(gate(r, 400)).toBe(false)
    expect(gate(r, 500)).toBe(true)
  })

  it('windowCount does not fire when matches are spread wider than the window', () => {
    const gate = createAutomationGate()
    const r = rule({ windowCount: 3, windowMs: 1000 })
    expect(gate(r, 0)).toBe(false)
    expect(gate(r, 600)).toBe(false)
    expect(gate(r, 1200)).toBe(false)  // t=0 pruned — only 2 in window
    expect(gate(r, 1300)).toBe(true)   // 600/1200/1300 all within 1s
  })

  it('cooldown blocks a window fire without consuming the streak forever', () => {
    const gate = createAutomationGate()
    const r = rule({ windowCount: 2, windowMs: 1000, cooldownMs: 5000 })
    expect(gate(r, 0)).toBe(false)
    expect(gate(r, 100)).toBe(true)    // window met → fire
    expect(gate(r, 200)).toBe(false)
    expect(gate(r, 300)).toBe(false)   // window met again but cooldown blocks
    expect(gate(r, 5200)).toBe(false)  // old timestamps pruned; 1 in window
    expect(gate(r, 5300)).toBe(true)   // window met, cooldown expired
  })

  it('tracks state per rule id independently', () => {
    const gate = createAutomationGate()
    const a = rule({ cooldownMs: 1000 }, 'a')
    const b = rule({ cooldownMs: 1000 }, 'b')
    expect(gate(a, 0)).toBe(true)
    expect(gate(b, 1)).toBe(true)      // b unaffected by a's cooldown
    expect(gate(a, 2)).toBe(false)
  })
})
