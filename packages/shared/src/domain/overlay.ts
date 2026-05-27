// ── Overlay visual style domain ─────────────────────────────────

export type BackgroundType = 'none' | 'color' | 'gradient' | 'image-url' | 'video-url' | 'pattern'
export type PatternPreset  = 'none' | 'grid' | 'dots' | 'diagonal' | 'honeycomb' | 'circuit' | 'topography'
export type ParticlePreset = 'none' | 'stars' | 'snow' | 'matrix' | 'fireflies' | 'ash'

export interface OverlayBackground {
  type: BackgroundType
  color: string
  gradient: string
  imageUrl: string
  videoUrl: string
  pattern: PatternPreset
  /** 0–1 */
  opacity: number
  /** px */
  blur: number
}

export interface OverlayEffects {
  crt: boolean
  noise: boolean
  vignette: boolean
  flicker: boolean
  chromatic: boolean
  scanlineOpacity: number
  noiseOpacity: number
  vignetteStrength: number
}

export interface OverlayParticles {
  enabled: boolean
  preset: ParticlePreset
  /** 0–1 */
  density: number
  /** 0–1 */
  speed: number
}

export interface OverlayStyle {
  background: OverlayBackground
  effects: OverlayEffects
  particles: OverlayParticles
  /** Google Font name, or 'default' */
  fontFamily: string
  accentColor: string
  textColor: string
}

// ── Media asset entry ────────────────────────────────────────────

/** A named media asset saved in the centralised Asset Library */
export interface MediaEntry {
  id: string
  name: string
  type: 'image' | 'video'
  url: string
  /** Display duration in seconds (images only; videos auto-detect) */
  duration?: number
}
