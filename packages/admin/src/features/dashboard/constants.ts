import type { BackgroundType, PatternPreset, ParticlePreset } from '@ieomlabs/shared'

export const GRADIENT_PRESETS = [
  { name: 'Deep Space',   value: 'linear-gradient(135deg, #0c0c1e 0%, #1a0533 50%, #0c0c1e 100%)' },
  { name: 'Cyberpunk',    value: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 40%, #0a1a2e 100%)' },
  { name: 'Forest Night', value: 'linear-gradient(135deg, #080f08 0%, #0a1f0a 60%, #040a04 100%)' },
  { name: 'Blood Moon',   value: 'linear-gradient(135deg, #1a0000 0%, #3d0000 50%, #1a0010 100%)' },
  { name: 'Arctic Abyss', value: 'linear-gradient(135deg, #050f1a 0%, #051525 60%, #020710 100%)' },
  { name: 'Gold Ember',   value: 'linear-gradient(135deg, #1a0f00 0%, #2d1f00 50%, #0d0900 100%)' },
  { name: 'Plasma',       value: 'radial-gradient(ellipse at 20% 20%, #1a0040 0%, #000010 60%, #001a3d 100%)' },
  { name: 'Void',         value: 'radial-gradient(ellipse at center, #0a0a0a 0%, #000000 100%)' },
  { name: 'Amethyst',     value: 'linear-gradient(45deg, #1a0033 0%, #330066 50%, #1a0033 100%)' },
]

export const PATTERN_CSS: Record<PatternPreset, React.CSSProperties> = {
  none:       {},
  grid:       { backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '50px 50px', backgroundColor: '#0a0a0f' },
  dots:       { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)', backgroundSize: '28px 28px', backgroundColor: '#0a0a0f' },
  diagonal:   { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.04) 8px, rgba(255,255,255,0.04) 9px)', backgroundColor: '#0a0a0f' },
  honeycomb:  { backgroundSize: '28px 48px', backgroundImage: 'radial-gradient(circle farthest-side at 0% 50%, transparent 23.5%, rgba(255,255,255,.05) 24%, rgba(255,255,255,.05) 26%, transparent 27.75%)', backgroundColor: '#0a0a0f' },
  circuit:    { backgroundImage: 'linear-gradient(rgba(0,204,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,204,255,.05) 1px, transparent 1px)', backgroundSize: '50px 50px', backgroundColor: '#030810' },
  topography: { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.07)' d='M20 40Q40 20 60 40Q80 60 100 40Q120 20 140 40Q160 60 180 40'/%3E%3C/svg%3E\")", backgroundColor: '#0a0a0f' },
  // Preview approximations of the overlay's patterns — authoritative CSS lives in
  // packages/overlay/src/layers/BackgroundLayer.tsx (PATTERN_CSS); keep in sync.
  screentone: { backgroundImage: 'radial-gradient(circle, #111111 1.5px, transparent 1.5px)', backgroundSize: '8px 8px', backgroundColor: '#f0ede0' },
  'anime-lines': { backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 3px)', backgroundColor: '#06060e' },
  'sakura-scatter': { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cellipse cx='30' cy='40' rx='14' ry='7' fill='rgba(255,183,197,0.35)' transform='rotate(-30 30 40)'/%3E%3Cellipse cx='120' cy='80' rx='12' ry='6' fill='rgba(255,183,197,0.28)' transform='rotate(15 120 80)'/%3E%3Cellipse cx='70' cy='150' rx='15' ry='7' fill='rgba(255,183,197,0.32)' transform='rotate(-50 70 150)'/%3E%3C/svg%3E\")", backgroundSize: '200px 200px', backgroundColor: '#0a040a' },
  'stars-myspace': { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cpolygon points='20,5 22,14 31,14 24,19 27,28 20,23 13,28 16,19 9,14 18,14' fill='rgba(255,200,0,0.55)'/%3E%3Cpolygon points='50,100 52,109 61,109 54,114 57,123 50,118 43,123 46,114 39,109 48,109' fill='rgba(100,200,255,0.45)'/%3E%3C/svg%3E\")", backgroundSize: '160px 160px', backgroundColor: '#080010' },
  'vaporwave-grid': { backgroundImage: 'linear-gradient(rgba(0,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,170,0.2) 1px, transparent 1px)', backgroundSize: '40px 30px', backgroundColor: '#0d001a' },
  'film-strip': { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='120'%3E%3Crect width='60' height='120' fill='%23111'/%3E%3Crect x='4' y='8' width='12' height='18' rx='3' fill='%23333'/%3E%3Crect x='44' y='8' width='12' height='18' rx='3' fill='%23333'/%3E%3Crect x='20' y='4' width='20' height='112' fill='%231a1a1a'/%3E%3C/svg%3E\")", backgroundSize: '60px 120px', backgroundColor: '#0a0a0a' },
  'static-noise': { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)', backgroundSize: '3px 3px, 5px 5px', backgroundColor: '#111' },
}

export const PARTICLE_PRESETS: { id: ParticlePreset; icon: string; label: string }[] = [
  { id: 'none',      icon: '○', label: 'None'      },
  { id: 'stars',     icon: '✦', label: 'Stars'     },
  { id: 'snow',      icon: '❄', label: 'Snow'      },
  { id: 'matrix',    icon: '⌥', label: 'Matrix'    },
  { id: 'fireflies', icon: '◉', label: 'Fireflies' },
  { id: 'ash',       icon: '◦', label: 'Ash'       },
]

export const ACCENT_SWATCHES = ['#00ff41', '#06b6d4', '#a855f7', '#f97316', '#ec4899', '#eab308', '#ef4444', '#ffffff']

export const DASHBOARD_SAVE_BUTTON_CLASS = 'px-4 py-2 text-sm'

export const BG_TYPES: { id: BackgroundType; label: string }[] = [
  { id: 'none',      label: 'None'     },
  { id: 'gradient',  label: 'Gradient' },
  { id: 'image-url', label: 'Image'    },
  { id: 'video-url', label: 'Video'    },
  { id: 'pattern',   label: 'Pattern'  },
]

// Widget dimension bounds
export const WIDGET_WIDTH_MIN = 180
export const WIDGET_WIDTH_MAX = 1400
export const WIDGET_HEIGHT_MIN = 140
export const WIDGET_HEIGHT_MAX = 1000
export const WIDGET_Z_INDEX_MIN = 0
export const WIDGET_Z_INDEX_MAX = 999
