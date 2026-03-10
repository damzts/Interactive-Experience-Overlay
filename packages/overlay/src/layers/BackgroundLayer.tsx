import type { OverlayStyle, PatternPreset } from '@ieom/shared'

/**
 * Pure CSS background rendering — no canvas, no external libs.
 * Sits at z-index 0 behind all other layers.
 */

const PATTERN_CSS: Record<PatternPreset, React.CSSProperties> = {
  none: {},
  grid: {
    backgroundImage:
      'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)',
    backgroundSize: '50px 50px',
    backgroundColor: '#0a0a0f',
  },
  dots: {
    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)',
    backgroundSize: '28px 28px',
    backgroundColor: '#0a0a0f',
  },
  diagonal: {
    backgroundImage:
      'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.04) 8px, rgba(255,255,255,0.04) 9px)',
    backgroundColor: '#0a0a0f',
  },
  honeycomb: {
    backgroundSize: '28px 48px',
    backgroundImage:
      'radial-gradient(circle farthest-side at 0% 50%, transparent 23.5%, rgba(255,255,255,.05) 24%, rgba(255,255,255,.05) 26%, transparent 27.75%), linear-gradient(rgba(255,255,255,.04) 14.75%, rgba(255,255,255,.04) 85%, transparent 85.25%)',
    backgroundColor: '#0a0a0f',
  },
  circuit: {
    backgroundImage:
      'linear-gradient(rgba(0,204,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,204,255,.05) 1px, transparent 1px)',
    backgroundSize: '50px 50px',
    backgroundColor: '#030810',
  },
  topography: {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.07)' d='M20 40Q40 20 60 40Q80 60 100 40Q120 20 140 40Q160 60 180 40'/%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.05)' d='M0 70Q20 50 40 70Q60 90 80 70Q100 50 120 70Q140 90 160 70Q180 50 200 70'/%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.06)' d='M20 100Q40 80 60 100Q80 120 100 100Q120 80 140 100Q160 120 180 100'/%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.04)' d='M0 130Q20 110 40 130Q60 150 80 130Q100 110 120 130Q140 150 160 130Q180 110 200 130'/%3E%3C/svg%3E")`,
    backgroundColor: '#0a0a0f',
  },
}

interface Props {
  style: OverlayStyle
}

export function BackgroundLayer({ style }: Props) {
  const bg = style.background
  const base: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    opacity: bg.opacity,
    filter: bg.blur > 0 ? `blur(${bg.blur}px)` : undefined,
    pointerEvents: 'none',
  }

  if (bg.type === 'none') return null

  if (bg.type === 'color') {
    return (
      <div style={{ ...base, backgroundColor: bg.color }} />
    )
  }

  if (bg.type === 'gradient') {
    return (
      <div style={{ ...base, background: bg.gradient }} />
    )
  }

  if (bg.type === 'image-url' && bg.imageUrl) {
    return (
      <div
        style={{
          ...base,
          backgroundImage: `url(${JSON.stringify(bg.imageUrl)})`,  
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
    )
  }

  if (bg.type === 'video-url' && bg.videoUrl) {
    return (
      <video
        src={bg.videoUrl}
        autoPlay
        loop
        muted
        playsInline
        style={{
          ...base,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    )
  }

  if (bg.type === 'pattern') {
    const patternStyle = PATTERN_CSS[bg.pattern] ?? {}
    return (
      <div style={{ ...base, ...patternStyle }} />
    )
  }

  return null
}
