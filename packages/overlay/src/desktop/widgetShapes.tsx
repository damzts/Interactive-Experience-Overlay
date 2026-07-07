import { DEFAULT_WIDGET_THEME_PRESETS } from '@ieomlabs/shared'
import type { WidgetShape, WidgetThemeConfig } from '@ieomlabs/shared'

// ── Morphologic widget silhouettes ────────────────────────────────
//
// Three families:
//  - 'radius' shapes reshape the window with border-radius only. Native
//    border/outline/box-shadow keep working, so the existing chrome CSS applies.
//  - 'polygon' shapes clip the window to a px polygon; the chrome edge is
//    redrawn segment-by-segment with Win98 lighting (lit from top-left).
//  - 'path' shapes clip to a bezier SVG path (Winamp Metalheart lineage);
//    the chrome edge is redrawn as an embossed double stroke along the curve.
// For clipped kinds the rectangular border/outline/shadow die under clip-path,
// so <ShapeChrome> draws the edge inside and the drop shadow moves to a
// filter: drop-shadow() on the positioner (a parent of the clipped element —
// on the same element the clip would cut the shadow away).

export type ShapePoint = readonly [number, number]

export interface ShapeTitleInset {
  top?: number
  left?: number
  right?: number
}

interface ShapeDefBase {
  /** Extra padding on the title bar so text/controls clear clipped regions. */
  titleInset?: ShapeTitleInset | ((w: number) => ShapeTitleInset)
  /** Offset of the resize handle from the bottom-right corner. */
  resizeHandle?: { right: number; bottom: number }
}

export interface PolygonShapeDef extends ShapeDefBase {
  kind: 'polygon'
  /** Clockwise silhouette in px for the current window size. */
  polygon: (w: number, h: number) => ShapePoint[]
}

export interface PathShapeDef extends ShapeDefBase {
  kind: 'path'
  /** Clockwise closed SVG path in px for the current window size. */
  path: (w: number, h: number) => string
}

export interface RadiusShapeDef extends ShapeDefBase {
  kind: 'radius'
  borderRadius: string
}

export type WidgetShapeDef = PolygonShapeDef | PathShapeDef | RadiusShapeDef

/**
 * Sawtooth teeth along the outward side of the valley line (x0,y0)→(x1,y1).
 * Winding must be clockwise in screen coords for the peaks to point outward.
 */
function sawtooth(x0: number, y0: number, x1: number, y1: number, depth: number, toothSpan: number): ShapePoint[] {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  const teeth = Math.max(2, Math.round(len / toothSpan))
  const ux = dx / len
  const uy = dy / len
  const nx = uy
  const ny = -ux
  const step = len / teeth
  const pts: ShapePoint[] = [[x0, y0]]
  for (let i = 0; i < teeth; i += 1) {
    const mid = i * step + step / 2
    const end = (i + 1) * step
    pts.push([x0 + ux * mid + nx * depth, y0 + uy * mid + ny * depth])
    pts.push([x0 + ux * end, y0 + uy * end])
  }
  return pts
}

/** Jagged torn-drip bottom edge, right→left: peaks sit on the base line, each
 *  valley is pulled up by its own depth — reads as spray-paint drips without
 *  ever extending past the widget's own bounds. */
function dripEdge(w: number, h: number, depths: number[]): ShapePoint[] {
  const n = depths.length
  const step = w / n
  const pts: ShapePoint[] = []
  for (let i = 0; i < n; i += 1) {
    const xRight = w - i * step
    const xMid = xRight - step / 2
    const xLeft = w - (i + 1) * step
    pts.push([xRight, h], [xMid, h - depths[i]], [xLeft, h])
  }
  return pts
}

/** Scalloped curtain edge along the bottom, right→left, valleys rising to depth. */
function scallops(w: number, h: number, depth: number, span: number): string {
  const waves = Math.max(2, Math.round(w / span))
  const step = w / waves
  let d = ''
  for (let i = 0; i < waves; i += 1) {
    const x0 = w - i * step
    const x1 = w - (i + 1) * step
    d += ` Q ${(x0 + x1) / 2},${h + depth * 0.9} ${x1},${h - depth}`
  }
  return d
}

const SHAPE_DEFS: Record<WidgetShape, WidgetShapeDef | null> = {
  rect: null,

  /** Winamp-style octagon: all four corners cut at 45°. */
  bevel: {
    kind: 'polygon',
    polygon: (w, h) => {
      const cut = Math.max(8, Math.min(16, Math.round(Math.min(w, h) * 0.08)))
      return [
        [cut, 0], [w - cut, 0], [w, cut], [w, h - cut],
        [w - cut, h], [cut, h], [0, h - cut], [0, cut],
      ]
    },
    titleInset: { left: 8, right: 8 },
    resizeHandle: { right: 6, bottom: 6 },
  },

  /** Asymmetric Y2K HUD: long diagonal top-right, mirrored diagonal bottom-left. */
  'notch-hud': {
    kind: 'polygon',
    polygon: (w, h) => [
      [6, 0], [w - 32, 0], [w, 16], [w, h - 6],
      [w - 6, h], [20, h], [0, h - 16], [0, 6],
    ],
    titleInset: { right: 30 },
    resizeHandle: { right: 4, bottom: 8 },
  },

  /** Organic wobbly plastic — asymmetric corner radii, no clipping needed. */
  blob: {
    kind: 'radius',
    borderRadius: '26px 42px 34px 46px / 42px 28px 46px 30px',
    titleInset: { left: 12, right: 12 },
    resizeHandle: { right: 12, bottom: 14 },
  },

  /** CRT screen bulge — soft top corners, heavy rounded bottom. */
  tv: {
    kind: 'radius',
    borderRadius: '16px 16px 34px 34px / 14px 14px 30px 30px',
    titleInset: { left: 8, right: 8 },
    resizeHandle: { right: 12, bottom: 12 },
  },

  /** Soft capsule pod — heavier uniform rounding than blob, egg-bottomed. */
  pod: {
    kind: 'radius',
    borderRadius: '32px 32px 40px 40px / 30px 30px 44px 44px',
    titleInset: { left: 18, right: 18 },
    resizeHandle: { right: 14, bottom: 16 },
  },

  /** Sticker burst: sawtooth teeth around the whole perimeter. */
  sticker: {
    kind: 'polygon',
    polygon: (w, h) => {
      const d = 8
      const tooth = 22
      return [
        ...sawtooth(d, d, w - d, d, d, tooth),
        ...sawtooth(w - d, d, w - d, h - d, d, tooth),
        ...sawtooth(w - d, h - d, d, h - d, d, tooth),
        ...sawtooth(d, h - d, d, d, d, tooth),
      ]
    },
    titleInset: { top: 6, left: 6, right: 6 },
    resizeHandle: { right: 12, bottom: 12 },
  },

  /** Crystalline shard — jagged asymmetric facets on every edge. */
  shard: {
    kind: 'polygon',
    polygon: (w, h) => [
      [w * 0.06, 0], [w * 0.62, 6], [w * 0.78, 0], [w, 26],
      [w * 0.96, h * 0.42], [w, h * 0.6], [w * 0.94, h - 8],
      [w * 0.62, h], [w * 0.5, h - 14], [w * 0.3, h], [w * 0.06, h - 6],
      [0, h * 0.72], [w * 0.04, h * 0.5], [0, h * 0.2],
    ],
    titleInset: (w) => ({ left: Math.round(w * 0.06) + 6, right: Math.round(w * 0.22) + 8 }),
    resizeHandle: { right: 30, bottom: 14 },
  },

  /**
   * Metalheart deck — asymmetric hardware hull: rounded top-left, a carved
   * fin recess in the top-right, a raised shelf along the bottom-right and a
   * curved keel ramp back to full depth. MMD3 Winamp-skin lineage.
   */
  metalheart: {
    kind: 'path',
    path: (w, h) => {
      const fin = Math.min(96, w * 0.3)
      const finX = w - fin
      return [
        `M 0,24`,
        `C 0,7 8,0 24,0`,
        `L ${finX - 34},0`,
        `C ${finX - 10},0 ${finX - 8},18 ${finX + 14},20`,
        `L ${w - 16},20`,
        `C ${w - 6},20 ${w},28 ${w},38`,
        `L ${w},${h - 34}`,
        `C ${w},${h - 12} ${w - 14},${h - 6} ${w - 34},${h - 6}`,
        `L ${w * 0.5},${h - 6}`,
        `C ${w * 0.42},${h - 6} ${w * 0.4},${h} ${w * 0.3},${h}`,
        `L 24,${h}`,
        `C 8,${h} 0,${h - 8} 0,${h - 22}`,
        `Z`,
      ].join(' ')
    },
    titleInset: (w) => ({ left: 12, right: Math.min(96, Math.round(w * 0.3)) + 40 }),
    resizeHandle: { right: 38, bottom: 10 },
  },

  /** Blade swoosh — top edge sweeps down into the right side, SSX energy. */
  wing: {
    kind: 'path',
    path: (w, h) => {
      const sweep = Math.min(170, w * 0.42)
      const drop = Math.min(64, h * 0.3)
      return [
        `M 0,18`,
        `C 0,6 6,0 18,0`,
        `L ${w - sweep},0`,
        `C ${w - sweep * 0.55},0 ${w - sweep * 0.2},${drop * 0.2} ${w},${drop}`,
        `L ${w},${h - 24}`,
        `C ${w},${h - 8} ${w - 10},${h} ${w - 26},${h}`,
        `L 20,${h}`,
        `C 7,${h} 0,${h - 7} 0,${h - 20}`,
        `Z`,
      ].join(' ')
    },
    titleInset: (w) => ({ right: Math.min(170, Math.round(w * 0.42)) + 4 }),
    resizeHandle: { right: 10, bottom: 8 },
  },

  /** Banner with a scalloped curtain hem along the bottom — webcore flag. */
  wave: {
    kind: 'path',
    path: (w, h) => {
      const depth = Math.min(14, h * 0.08)
      return [
        `M 0,10`,
        `C 0,3 3,0 10,0`,
        `L ${w - 10},0`,
        `C ${w - 3},0 ${w},3 ${w},10`,
        `L ${w},${h - depth}`,
        scallops(w, h, depth, 90),
        `Z`,
      ].join(' ')
    },
    titleInset: { left: 6, right: 6 },
    resizeHandle: { right: 8, bottom: 18 },
  },

  /** JRPG dialogue-box tab — small corner cuts plus a triangular tab notch
   *  pointing down into the top edge, like a menu-box pointer. Save Point lineage. */
  codex: {
    kind: 'polygon',
    polygon: (w, h) => {
      const cut = 10
      const midW = w / 2
      const notchHalf = Math.min(18, w * 0.12)
      const notchDepth = 14
      return [
        [cut, 0], [midW - notchHalf, 0], [midW, notchDepth], [midW + notchHalf, 0], [w - cut, 0],
        [w, cut], [w, h - cut],
        [w - cut, h], [cut, h],
        [0, h - cut], [0, cut],
      ]
    },
    titleInset: { top: 4, left: 6, right: 6 },
    resizeHandle: { right: 8, bottom: 8 },
  },

  /** Spray-tag silhouette — torn drip edge along the bottom, Jet Set Radio lineage. */
  tag: {
    kind: 'polygon',
    polygon: (w, h) => [
      [10, 0], [w - 10, 0], [w, 16], [w, h - 30],
      ...dripEdge(w, h, [30, 10, 40, 16, 24]),
      [0, h - 30], [0, 16],
    ],
    titleInset: { left: 6, right: 6 },
    resizeHandle: { right: 10, bottom: 44 },
  },
}

/**
 * Shape resolution mirrors skin resolution: an explicit theme shape wins,
 * otherwise the skin's preset shape applies (covers pre-shape persisted themes).
 */
export function resolveWidgetShape(theme: Pick<WidgetThemeConfig, 'skin'> & { shape?: WidgetShape }): WidgetShape {
  return theme.shape ?? DEFAULT_WIDGET_THEME_PRESETS[theme.skin]?.shape ?? 'rect'
}

export function getWidgetShapeDef(shape: WidgetShape): WidgetShapeDef | null {
  return SHAPE_DEFS[shape] ?? null
}

export function isClippedShape(def: WidgetShapeDef | null): def is PolygonShapeDef | PathShapeDef {
  return def?.kind === 'polygon' || def?.kind === 'path'
}

export function resolveTitleInset(def: WidgetShapeDef | null, width: number): ShapeTitleInset | undefined {
  if (!def?.titleInset) return undefined
  return typeof def.titleInset === 'function' ? def.titleInset(width) : def.titleInset
}

function polygonToPathD(points: ShapePoint[]): string {
  return `M ${points.map(([x, y]) => `${x},${y}`).join(' L ')} Z`
}

/** CSS clip-path value for a clipped shape at the given px size. */
export function buildShapeClipPath(def: PolygonShapeDef | PathShapeDef, w: number, h: number): string {
  if (def.kind === 'polygon') {
    return `polygon(${def.polygon(w, h).map(([x, y]) => `${x}px ${y}px`).join(', ')})`
  }
  return `path('${def.path(w, h)}')`
}

/**
 * Redraws the chrome edge inside a clipped silhouette. Polygon shapes get
 * per-segment Win98 bevels (lit from the top-left); path shapes get an
 * embossed double stroke offset along the light axis. Strokes are centered
 * on the silhouette, so the clip halves them — widths are 2× the visible
 * thickness.
 */
export function ShapeChrome({ def, width, height }: { def: PolygonShapeDef | PathShapeDef; width: number; height: number }) {
  const common = {
    className: 'desktop-window-shape-chrome',
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    'aria-hidden': true as const,
  }

  if (def.kind === 'polygon') {
    const points = def.polygon(width, height)
    return (
      <svg {...common}>
        {points.map(([x1, y1], index) => {
          const [x2, y2] = points[(index + 1) % points.length]
          // Outward normal for clockwise winding; lit when facing the top-left light
          const nx = y2 - y1
          const ny = -(x2 - x1)
          const lit = nx + ny <= 0
          return (
            <line
              key={index}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={lit ? 'var(--widget-shell-highlight)' : 'var(--widget-shell-shadow)'}
              strokeWidth={5}
            />
          )
        })}
        <polygon
          points={points.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none" stroke="var(--widget-shell-outline)" strokeWidth={2.5}
        />
      </svg>
    )
  }

  const d = def.path(width, height)
  return (
    <svg {...common}>
      <path d={d} fill="none" stroke="var(--widget-shell-shadow)" strokeWidth={5} transform="translate(1.5 1.5)" />
      <path d={d} fill="none" stroke="var(--widget-shell-highlight)" strokeWidth={5} transform="translate(-1.5 -1.5)" />
      <path d={d} fill="none" stroke="var(--widget-shell-outline)" strokeWidth={2.5} />
    </svg>
  )
}

/** Debug/preview helper: silhouette path data for any clipped shape. */
export function shapeOutlinePathD(def: PolygonShapeDef | PathShapeDef, w: number, h: number): string {
  return def.kind === 'polygon' ? polygonToPathD(def.polygon(w, h)) : def.path(w, h)
}
