import { useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'

interface PresetDef {
  filter?: string
  overlay?: string
  mixBlend?: string
}

const PRESETS: Record<string, PresetDef> = {
  sepia: {
    filter: 'sepia(0.9) brightness(0.9)',
  },
  retro: {
    filter: 'sepia(0.6) contrast(1.1) brightness(0.85)',
    overlay: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 3px)',
  },
  anime: {
    filter: 'saturate(1.6) contrast(1.05)',
  },
  gloom: {
    filter: 'saturate(0.2) brightness(0.65)',
    overlay: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)',
  },
  bloom: {
    filter: 'brightness(1.15)',
    overlay: 'radial-gradient(ellipse at center, rgba(255,255,255,0.12) 0%, transparent 70%)',
    mixBlend: 'screen',
  },
  vhs: {
    filter: 'sepia(0.4) hue-rotate(-10deg) brightness(0.9) contrast(1.1)',
    overlay: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 4px)',
  },
  pixelate: {
    // Scale trick: can't do true pixelate in CSS alone without canvas,
    // but we approximate with a dot-pattern overlay for texture
    filter: 'contrast(1.2) brightness(0.95)',
    overlay: 'radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)',
  },
  night: {
    filter: 'hue-rotate(200deg) saturate(0.8) brightness(0.6)',
    overlay: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,30,0.5) 100%)',
  },
}

let styleInjected = false

export function AestheticOverlayRenderer({ config }: RendererProps) {
  const preset  = (config.preset  as string | undefined) ?? 'anime'
  const opacity = (config.opacity as number | undefined) ?? 1
  const wrapRef = useRef<HTMLDivElement>(null)

  const def = PRESETS[preset] ?? PRESETS.anime

  useEffect(() => {
    if (!styleInjected) {
      styleInjected = true
      const s = document.createElement('style')
      s.textContent = `.aesthetic-root { image-rendering: auto; }`
      document.head.appendChild(s)
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        pointerEvents: 'none',
      }}
    >
      {/* CSS filter applied to a transparent layer over content via backdrop-filter-like trick:
          we use a full-size ::before-equivalent div with filter */}
      {def.filter && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backdropFilter: def.filter,
            WebkitBackdropFilter: def.filter,
          }}
        />
      )}
      {def.overlay && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: def.overlay,
            backgroundSize: preset === 'pixelate' ? '4px 4px' : preset === 'retro' || preset === 'vhs' ? '100% 3px' : undefined,
            mixBlendMode: (def.mixBlend as React.CSSProperties['mixBlendMode']) ?? 'normal',
          }}
        />
      )}
    </div>
  )
}
