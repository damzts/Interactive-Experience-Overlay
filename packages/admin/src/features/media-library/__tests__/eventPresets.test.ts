import { describe, expect, it } from 'vitest'
import {
  createEffectDraft,
  EFFECT_CATEGORIES,
  EVENT_EFFECT_TYPES,
  normalizeEventEffectConfig,
} from '../eventPresets'

describe('EFFECT_CATEGORIES', () => {
  it('lists each effect type at most once across all categories', () => {
    const seen = new Set<string>()
    for (const category of EFFECT_CATEGORIES) {
      for (const type of category.effects) {
        expect(seen.has(type), `duplicate effect type "${type}"`).toBe(false)
        seen.add(type)
      }
    }
  })
})

describe('createEffectDraft', () => {
  it('produces a populated draft for every pickable effect type', () => {
    for (const type of EVENT_EFFECT_TYPES) {
      const draft = createEffectDraft(type)
      expect(draft.type).toBe(type)
      expect(draft.delay).toBe(0)
      expect(draft.cfg, `empty default cfg for "${type}"`).toBeTypeOf('object')
      expect(Object.keys(draft.cfg).length, `empty default cfg for "${type}"`).toBeGreaterThan(0)
    }
  })

  it('returns an independent clone each time (no shared default mutation)', () => {
    const first = createEffectDraft('confetti-burst')
    if (first.type !== 'confetti-burst') throw new Error('unreachable')
    first.cfg.colors!.push('#123456')
    first.cfg.count = 9999

    const second = createEffectDraft('confetti-burst')
    if (second.type !== 'confetti-burst') throw new Error('unreachable')
    expect(second.cfg.colors).not.toContain('#123456')
    expect(second.cfg.count).not.toBe(9999)
  })
})

describe('normalizeEventEffectConfig', () => {
  it('fills missing cfg keys from the defaults while keeping explicit values', () => {
    const normalized = normalizeEventEffectConfig({
      type: 'confetti-burst',
      cfg: { count: 10 },
    } as never)
    if (normalized.type !== 'confetti-burst') throw new Error('unreachable')

    expect(normalized.cfg.count).toBe(10)
    expect(normalized.cfg.duration).toBe(4) // from the draft default
    expect(normalized.cfg.colors?.length).toBeGreaterThan(0)
  })
})
