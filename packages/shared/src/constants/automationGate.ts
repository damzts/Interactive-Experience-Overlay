/**
 * Stateful per-rule firing gate for automation rules.
 *
 * Implements the three optional AutomationTrigger conditions that need
 * memory across events: cooldownMs, everyN, and windowCount/windowMs.
 * State is RAM-only (hot path never touches disk) and keyed by rule id.
 *
 * Each evaluator owns ONE gate instance for the rules it executes —
 * the server's AutomationManager for kernel-side actions, the overlay's
 * widget-rule evaluator for custom widget:action rules. The action-kind
 * split guarantees a rule executes (and is therefore gated) in exactly
 * one place, so the two stores never disagree about the same rule.
 *
 * Semantics: everyN and windowCount observe every match (counters advance
 * even while another condition blocks); cooldown is checked last and does
 * not consume counts. On fire: lastFiredAt updates and the window clears.
 */
import type { AutomationRule } from '../contracts/automation.js'

interface RuleGateState {
  lastFiredAt: number
  matchCount: number
  windowTimes: number[]
}

export type AutomationGate = (rule: AutomationRule, now?: number) => boolean

export function createAutomationGate(): AutomationGate {
  const state = new Map<string, RuleGateState>()

  return (rule, now = Date.now()) => {
    const t = rule.trigger
    const cooldownMs = typeof t.cooldownMs === 'number' && t.cooldownMs > 0 ? t.cooldownMs : 0
    const everyN = typeof t.everyN === 'number' && t.everyN >= 2 ? Math.floor(t.everyN) : 0
    const windowCount = typeof t.windowCount === 'number' && t.windowCount >= 2 ? Math.floor(t.windowCount) : 0
    if (!cooldownMs && !everyN && !windowCount) return true

    let s = state.get(rule.id)
    if (!s) {
      s = { lastFiredAt: Number.NEGATIVE_INFINITY, matchCount: 0, windowTimes: [] }
      state.set(rule.id, s)
    }

    let pass = true

    if (everyN) {
      s.matchCount += 1
      if (s.matchCount % everyN !== 0) pass = false
    }

    if (windowCount) {
      const windowMs = typeof t.windowMs === 'number' && t.windowMs > 0 ? t.windowMs : 60_000
      s.windowTimes.push(now)
      const cutoff = now - windowMs
      while (s.windowTimes.length > 0 && s.windowTimes[0] < cutoff) s.windowTimes.shift()
      if (s.windowTimes.length < windowCount) pass = false
    }

    if (pass && cooldownMs && now - s.lastFiredAt < cooldownMs) pass = false

    if (pass) {
      s.lastFiredAt = now
      if (windowCount) s.windowTimes = []
    }
    return pass
  }
}
