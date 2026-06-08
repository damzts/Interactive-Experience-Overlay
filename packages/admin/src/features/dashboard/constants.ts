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
