import type { TierName } from './scene.js'

export type AssetKind = 'image' | 'video' | 'audio'

export type RendererCategory = 'background' | 'media' | 'overlay' | 'text' | 'post' | 'builtin'

export type RendererFieldDef = {
  key: string
  label: string
  type: 'text' | 'number' | 'color' | 'boolean' | 'select'
  assetKinds?: AssetKind[]
  options?: string[]
  min?: number
  max?: number
  step?: number
  placeholder?: string
}

export type RendererCatalogEntry = {
  id: string
  label: string
  icon: string
  desc: string
  category: RendererCategory
  defaultConfig: Record<string, unknown>
  fields: RendererFieldDef[]
  defaultPosition?: { x: number; y: number; width: number; height: number }
  defaultTier?: TierName
}

export const RENDERER_CATALOG: RendererCatalogEntry[] = [
  // ── Builtin tier renderers ───────────────────────────────────────
  {
    id: 'builtin:background', label: 'Background', icon: '🖼', category: 'builtin', defaultTier: 'background',
    desc: 'Solid color, gradient, image, video, or pattern background',
    defaultConfig: { type: 'color', color: '#0a0a0f', opacity: 1, blur: 0 },
    fields: [
      { key: 'type', label: 'Type', type: 'select', options: ['none', 'color', 'gradient', 'image-url', 'video-url', 'pattern'] },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'gradient', label: 'Gradient CSS', type: 'text' },
      { key: 'imageUrl', label: 'Image URL', type: 'text', assetKinds: ['image'] },
      { key: 'videoUrl', label: 'Video URL', type: 'text', assetKinds: ['video'] },
      { key: 'pattern', label: 'Pattern', type: 'select', options: ['none', 'grid', 'dots', 'diagonal', 'honeycomb', 'circuit', 'topography'] },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'blur', label: 'Blur (px)', type: 'number', min: 0, max: 20, step: 0.5 },
    ],
  },
  {
    id: 'builtin:particles', label: 'Particles', icon: '✨', category: 'builtin', defaultTier: 'particles',
    desc: 'Animated particle system (stars, snow, matrix, fireflies, ash)',
    defaultConfig: { enabled: true, preset: 'stars', density: 0.5, speed: 0.5 },
    fields: [
      { key: 'preset', label: 'Preset', type: 'select', options: ['none', 'stars', 'snow', 'matrix', 'fireflies', 'ash'] },
      { key: 'density', label: 'Density', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'speed', label: 'Speed', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: 'builtin:effects', label: 'Post Effects', icon: '📺', category: 'builtin', defaultTier: 'post',
    desc: 'CRT scanlines, vignette, film grain, flicker, chromatic aberration',
    defaultConfig: { crt: true, vignette: true, noise: false, flicker: false, chromatic: false, scanlineOpacity: 0.18, vignetteStrength: 0.65, noiseOpacity: 0.06 },
    fields: [
      { key: 'crt', label: 'CRT Scanlines', type: 'boolean' },
      { key: 'scanlineOpacity', label: 'Scanline Intensity', type: 'number', min: 0, max: 1, step: 0.01 },
      { key: 'vignette', label: 'Vignette', type: 'boolean' },
      { key: 'vignetteStrength', label: 'Vignette Strength', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'noise', label: 'Film Grain', type: 'boolean' },
      { key: 'noiseOpacity', label: 'Grain Opacity', type: 'number', min: 0, max: 0.5, step: 0.01 },
      { key: 'flicker', label: 'Flicker', type: 'boolean' },
      { key: 'chromatic', label: 'Chromatic Aberration', type: 'boolean' },
    ],
  },
  // ── Renderer entries ─────────────────────────────────────────────
  {
    id: 'image-slideshow', label: 'Game Slideshow', icon: '🎞', category: 'media', defaultTier: 'content',
    desc: 'Auto-cycling scraped game screenshots',
    defaultConfig: { interval: 6, shuffle: true },
    fields: [
      { key: 'interval', label: 'Interval (s)', type: 'number', min: 1, max: 60, step: 1 },
      { key: 'shuffle', label: 'Shuffle', type: 'boolean' },
    ],
  },
  {
    id: 'image-static', label: 'Static Image', icon: '🖼', category: 'media', defaultTier: 'content',
    desc: 'Single image — local path or URL',
    defaultConfig: { url: '', objectFit: 'cover', opacity: 1 },
    fields: [
      { key: 'url', label: 'URL / Path', type: 'text', assetKinds: ['image'], placeholder: '/assets/backgrounds/name.jpg' },
      { key: 'objectFit', label: 'Fit', type: 'select', options: ['cover', 'contain', 'fill'] },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: 'video-loop', label: 'Video Loop', icon: '🎬', category: 'media', defaultTier: 'content',
    desc: 'Muted looping video — local path or URL',
    defaultConfig: { url: '', opacity: 1 },
    fields: [
      { key: 'url', label: 'URL / Path', type: 'text', assetKinds: ['video'], placeholder: '/assets/video/name.mp4' },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: 'solid-color', label: 'Solid Color', icon: '⬛', category: 'background', defaultTier: 'background',
    desc: 'Flat opaque color fill',
    defaultConfig: { color: '#000000' },
    fields: [
      { key: 'color', label: 'Color', type: 'color' },
    ],
  },
  {
    id: 'color-overlay', label: 'Color Overlay', icon: '🎨', category: 'overlay', defaultTier: 'post',
    desc: 'Semi-transparent color wash',
    defaultConfig: { color: '#000000', opacity: 0.5 },
    fields: [
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: 'crt-effect', label: 'CRT Scanlines', icon: '📺', category: 'post', defaultTier: 'post',
    desc: 'Retro scanline + vignette overlay',
    defaultConfig: { scanlineIntensity: 0.25, vignetteStrength: 0.5 },
    fields: [
      { key: 'scanlineIntensity', label: 'Scanlines', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'vignetteStrength', label: 'Vignette', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: 'vignette', label: 'Vignette', icon: '◉', category: 'post', defaultTier: 'post',
    desc: 'Edge-darkening radial gradient',
    defaultConfig: { color: '#000000', strength: 0.6 },
    fields: [
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'strength', label: 'Strength', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: 'noise-grain', label: 'Film Grain', icon: '📽', category: 'post', defaultTier: 'post',
    desc: 'Animated film grain noise (overlay blend)',
    defaultConfig: { opacity: 0.08, animated: true },
    fields: [
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 0.5, step: 0.01 },
      { key: 'animated', label: 'Animated', type: 'boolean' },
    ],
  },
  {
    id: 'text-widget', label: 'Text Label', icon: '✍', category: 'text', defaultTier: 'content',
    desc: 'Static or typewriter text block',
    defaultConfig: { content: 'Label', font: 'vt323', fontSize: 28, color: '#ffffff', typewriterMode: false },
    fields: [
      { key: 'content', label: 'Content', type: 'text' },
      { key: 'font', label: 'Font', type: 'select', options: ['vt323', 'press-start', 'monospace', 'serif'] },
      { key: 'fontSize', label: 'Size', type: 'number', min: 8, max: 200, step: 2 },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'typewriterMode', label: 'Typewriter', type: 'boolean' },
    ],
  },
  {
    id: 'pov-stream', label: 'POV Stream', icon: '📹', category: 'media', defaultTier: 'content',
    desc: 'Live WebRTC stream from the active room participant',
    defaultConfig: { objectFit: 'cover', opacity: 1, muted: false },
    fields: [
      { key: 'objectFit', label: 'Fit', type: 'select', options: ['cover', 'contain'] },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'muted', label: 'Muted', type: 'boolean' },
    ],
  },
  {
    id: 'clock-widget', label: 'Clock', icon: '🕐', category: 'text', defaultTier: 'content',
    desc: 'Live digital clock display',
    defaultConfig: { format: '24h', color: '#00ff41', fontSize: 36, font: 'vt323' },
    defaultPosition: { x: 1680, y: 20, width: 220, height: 60 },
    fields: [
      { key: 'format', label: 'Format', type: 'select', options: ['24h', '12h', '24h-sec', '12h-sec'] },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'fontSize', label: 'Size', type: 'number', min: 8, max: 200, step: 2 },
      { key: 'font', label: 'Font', type: 'select', options: ['vt323', 'press-start', 'monospace', 'serif'] },
    ],
  },
]

export function findRendererCatalogEntry(rendererType: string | undefined): RendererCatalogEntry | undefined {
  return RENDERER_CATALOG.find((entry) => entry.id === rendererType)
}
