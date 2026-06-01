export type VisualPresetId = 'jewel' | 'studio' | 'minimal'

export interface VisualPreset {
  label: string
  description: string
  primary: string
  secondary: string
  accent: string
  surface1: string
  surface2: string
}

export const VISUAL_PRESETS: Record<VisualPresetId, VisualPreset> = {
  jewel: {
    label: 'Jewel Suave',
    description: 'High-contrast jewel highlights with elegant dark surfaces.',
    primary: '#55D9CB',
    secondary: '#9B8CFF',
    accent: '#F1B86A',
    surface1: 'rgba(13, 18, 28, 0.92)',
    surface2: 'rgba(20, 26, 39, 0.90)',
  },
  studio: {
    label: 'Studio Focus',
    description: 'Calmer cyan/blue balance optimized for long sessions.',
    primary: '#64D6FF',
    secondary: '#6FA8FF',
    accent: '#F3C574',
    surface1: 'rgba(11, 17, 27, 0.92)',
    surface2: 'rgba(16, 24, 38, 0.9)',
  },
  minimal: {
    label: 'Minimal Slate',
    description: 'Muted palette with low visual noise and subtle emphasis.',
    primary: '#7FD7C6',
    secondary: '#8DA2D6',
    accent: '#C8A97A',
    surface1: 'rgba(14, 17, 23, 0.92)',
    surface2: 'rgba(22, 26, 34, 0.9)',
  },
}

export const DEFAULT_VISUAL_PRESET: VisualPresetId = 'jewel'

export function applyVisualPreset(presetId: VisualPresetId): void {
  if (typeof document === 'undefined') return
  const preset = VISUAL_PRESETS[presetId] ?? VISUAL_PRESETS[DEFAULT_VISUAL_PRESET]
  const root = document.documentElement
  root.style.setProperty('--admin-primary', preset.primary)
  root.style.setProperty('--admin-secondary', preset.secondary)
  root.style.setProperty('--admin-accent', preset.accent)
  root.style.setProperty('--admin-surface-1', preset.surface1)
  root.style.setProperty('--admin-surface-2', preset.surface2)
}
