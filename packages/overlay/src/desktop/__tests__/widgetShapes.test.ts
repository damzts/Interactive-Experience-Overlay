import { describe, expect, it } from 'vitest'
import type { WidgetShape, WidgetThemeConfig } from '@ieomlabs/shared'
import {
  buildShapeClipPath,
  getWidgetShapeDef,
  isClippedShape,
  resolveTitleInset,
  resolveWidgetShape,
} from '../widgetShapes'

const POLYGON_SHAPES: WidgetShape[] = ['bevel', 'notch-hud', 'sticker', 'shard']
const PATH_SHAPES: WidgetShape[] = ['metalheart', 'wing', 'wave']
const RADIUS_SHAPES: WidgetShape[] = ['blob', 'tv', 'pod']
const SIZES: ReadonlyArray<readonly [number, number]> = [[180, 140], [420, 320], [1400, 1000]]

function pointsWithinBounds(points: ReadonlyArray<readonly [number, number]>, w: number, h: number) {
  return points.every(([x, y]) => x >= 0 && x <= w && y >= 0 && y <= h)
}

/**
 * Shoelace sum Σ(x2-x1)(y2+y1): negative for clockwise winding in screen
 * coords (y down) — e.g. the square (0,0)→(10,0)→(10,10)→(0,10) gives -200.
 */
function signedArea(points: ReadonlyArray<readonly [number, number]>) {
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    sum += (x2 - x1) * (y2 + y1)
  }
  return sum
}

describe('resolveWidgetShape', () => {
  it('prefers the explicit theme shape', () => {
    expect(resolveWidgetShape({ skin: 'aqua pop', shape: 'bevel' })).toBe('bevel')
  })

  it('falls back to the skin preset for pre-shape persisted themes', () => {
    expect(resolveWidgetShape({ skin: 'aqua pop' })).toBe('blob')
    expect(resolveWidgetShape({ skin: 'y2k futurism' })).toBe('notch-hud')
    expect(resolveWidgetShape({ skin: 'metalheart' })).toBe('metalheart')
    expect(resolveWidgetShape({ skin: 'chromecore' })).toBe('rect')
  })

  it('falls back to rect for unknown skins', () => {
    expect(resolveWidgetShape({ skin: 'not-a-skin' as WidgetThemeConfig['skin'] })).toBe('rect')
  })
})

describe('shape registry', () => {
  it('rect has no definition (native rectangular chrome)', () => {
    expect(getWidgetShapeDef('rect')).toBeNull()
  })

  it.each(RADIUS_SHAPES)('%s is a radius shape with a border-radius value', (shape) => {
    const def = getWidgetShapeDef(shape)
    expect(def?.kind).toBe('radius')
    if (def?.kind === 'radius') expect(def.borderRadius).toMatch(/px/)
  })

  it.each(POLYGON_SHAPES)('%s polygon stays in bounds and winds clockwise', (shape) => {
    const def = getWidgetShapeDef(shape)
    expect(def?.kind).toBe('polygon')
    if (def?.kind !== 'polygon') return

    for (const [w, h] of SIZES) {
      const points = def.polygon(w, h)
      expect(points.length).toBeGreaterThanOrEqual(6)
      expect(pointsWithinBounds(points, w, h)).toBe(true)
      expect(signedArea(points)).toBeLessThan(0)
    }
  })

  it.each(PATH_SHAPES)('%s produces a closed SVG path with finite coordinates', (shape) => {
    const def = getWidgetShapeDef(shape)
    expect(def?.kind).toBe('path')
    if (def?.kind !== 'path') return

    for (const [w, h] of SIZES) {
      const d = def.path(w, h)
      expect(d.startsWith('M ')).toBe(true)
      expect(d.trim().endsWith('Z')).toBe(true)
      expect(d).not.toMatch(/NaN|Infinity/)
      // Every numeric coordinate must stay within the window box
      const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number)
      expect(Math.min(...numbers)).toBeGreaterThanOrEqual(-0.001)
      expect(Math.max(...numbers)).toBeLessThanOrEqual(Math.max(w, h) + 0.001)
    }
  })

  it('clip-path values use px polygons or path() strings', () => {
    const bevel = getWidgetShapeDef('bevel')
    const metal = getWidgetShapeDef('metalheart')
    if (!isClippedShape(bevel) || !isClippedShape(metal)) throw new Error('expected clipped defs')
    expect(buildShapeClipPath(bevel, 400, 300)).toMatch(/^polygon\(.*px.*\)$/)
    expect(buildShapeClipPath(metal, 400, 300)).toMatch(/^path\('M .*Z'\)$/)
  })

  it('width-aware title insets scale with window width', () => {
    const wing = getWidgetShapeDef('wing')
    const narrow = resolveTitleInset(wing, 200)
    const wide = resolveTitleInset(wing, 1200)
    expect(narrow?.right).toBeLessThan(wide?.right ?? 0)
  })

  it('bevel cut scales with window size but stays clamped', () => {
    const def = getWidgetShapeDef('bevel')
    if (def?.kind !== 'polygon') throw new Error('bevel must be a polygon shape')
    const small = def.polygon(180, 140)
    const large = def.polygon(1400, 1000)
    // First point is (cut, 0)
    expect(small[0][0]).toBeGreaterThanOrEqual(8)
    expect(large[0][0]).toBeLessThanOrEqual(16)
  })
})
