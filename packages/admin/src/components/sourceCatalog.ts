import type { Scene, SourcePreset } from '@ieom/shared'
import type { AssetKind } from '../assets/catalog'

export type FieldDef = {
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

export type CatalogEntry = {
  type: string
  label: string
  icon: string
  desc: string
  defaultConfig: Record<string, unknown>
  fields: FieldDef[]
  defaultPosition?: { x: number; y: number; width: number; height: number }
}

export const SOURCE_CATALOG: CatalogEntry[] = [
  {
    type: 'image-slideshow', label: 'Game Slideshow', icon: '🎞', desc: 'Auto-cycling scraped game screenshots',
    defaultConfig: { interval: 6, shuffle: true },
    fields: [
      { key: 'interval', label: 'Interval (s)', type: 'number', min: 1, max: 60, step: 1 },
      { key: 'shuffle', label: 'Shuffle', type: 'boolean' },
    ],
  },
  {
    type: 'image-static', label: 'Static Image', icon: '🖼', desc: 'Single image — local path or URL',
    defaultConfig: { url: '', objectFit: 'cover', opacity: 1 },
    fields: [
      { key: 'url', label: 'URL / Path', type: 'text', assetKinds: ['image'], placeholder: '/assets/backgrounds/name.jpg' },
      { key: 'objectFit', label: 'Fit', type: 'select', options: ['cover', 'contain', 'fill'] },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'video-loop', label: 'Video Loop', icon: '🎬', desc: 'Muted looping video — local path or URL',
    defaultConfig: { url: '', opacity: 1 },
    fields: [
      { key: 'url', label: 'URL / Path', type: 'text', assetKinds: ['video'], placeholder: '/assets/video/name.mp4' },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'solid-color', label: 'Solid Color', icon: '⬛', desc: 'Flat opaque color fill',
    defaultConfig: { color: '#000000' },
    fields: [
      { key: 'color', label: 'Color', type: 'color' },
    ],
  },
  {
    type: 'color-overlay', label: 'Color Overlay', icon: '🎨', desc: 'Semi-transparent color wash',
    defaultConfig: { color: '#000000', opacity: 0.5 },
    fields: [
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'crt-effect', label: 'CRT Scanlines', icon: '📺', desc: 'Retro scanline + vignette overlay',
    defaultConfig: { scanlineIntensity: 0.25, vignetteStrength: 0.5 },
    fields: [
      { key: 'scanlineIntensity', label: 'Scanlines', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'vignetteStrength', label: 'Vignette', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'vignette', label: 'Vignette', icon: '◉', desc: 'Edge-darkening radial gradient',
    defaultConfig: { color: '#000000', strength: 0.6 },
    fields: [
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'strength', label: 'Strength', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'noise-grain', label: 'Film Grain', icon: '📽', desc: 'Animated film grain noise (overlay blend)',
    defaultConfig: { opacity: 0.08, animated: true },
    fields: [
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 0.5, step: 0.01 },
      { key: 'animated', label: 'Animated', type: 'boolean' },
    ],
  },
  {
    type: 'text-widget', label: 'Text Label', icon: '✍', desc: 'Static or typewriter text block',
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
    type: 'clock-widget', label: 'Clock', icon: '🕐', desc: 'Live digital clock display',
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

export type SafeSceneLike = Pick<Scene, 'id' | 'label'> & {
  sources?: Scene['sources'] | null
}

export function getSafeSceneSources(scene?: SafeSceneLike | null) {
  return Array.isArray(scene?.sources) ? scene.sources : []
}

export function findSourceCatalogEntry(pluginType: SourcePreset['pluginType']) {
  return SOURCE_CATALOG.find((entry) => entry.type === pluginType)
}
