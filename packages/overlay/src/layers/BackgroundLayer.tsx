import type { OverlayStyle, PatternPreset } from '@ieomlabs/shared'

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
  screentone: {
    backgroundImage: 'radial-gradient(circle, #111111 1.5px, transparent 1.5px)',
    backgroundSize: '8px 8px',
    backgroundColor: '#f0ede0',
  },
  'anime-lines': {
    backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 3px)',
    backgroundColor: '#06060e',
  },
  'sakura-scatter': {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cellipse cx='30' cy='40' rx='14' ry='7' fill='rgba(255,183,197,0.35)' transform='rotate(-30 30 40)'/%3E%3Cellipse cx='120' cy='80' rx='12' ry='6' fill='rgba(255,183,197,0.28)' transform='rotate(15 120 80)'/%3E%3Cellipse cx='70' cy='150' rx='15' ry='7' fill='rgba(255,183,197,0.32)' transform='rotate(-50 70 150)'/%3E%3Cellipse cx='160' cy='30' rx='11' ry='5' fill='rgba(255,183,197,0.25)' transform='rotate(40 160 30)'/%3E%3Cellipse cx='10' cy='120' rx='13' ry='6' fill='rgba(255,183,197,0.3)' transform='rotate(-20 10 120)'/%3E%3Cellipse cx='180' cy='160' rx='10' ry='5' fill='rgba(255,183,197,0.22)' transform='rotate(60 180 160)'/%3E%3C/svg%3E")`,
    backgroundSize: '200px 200px',
    backgroundColor: '#0a040a',
  },
  'stars-myspace': {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cpolygon points='20,5 22,14 31,14 24,19 27,28 20,23 13,28 16,19 9,14 18,14' fill='rgba(255,200,0,0.55)'/%3E%3Cpolygon points='100,25 101,30 106,30 102,33 104,38 100,35 96,38 98,33 94,30 99,30' fill='rgba(255,100,200,0.5)'/%3E%3Cpolygon points='50,100 52,109 61,109 54,114 57,123 50,118 43,123 46,114 39,109 48,109' fill='rgba(100,200,255,0.45)'/%3E%3Cpolygon points='140,80 141,85 146,85 142,88 144,93 140,90 136,93 138,88 134,85 139,85' fill='rgba(200,100,255,0.5)'/%3E%3Cpolygon points='10,150 11,155 16,155 12,158 14,163 10,160 6,163 8,158 4,155 9,155' fill='rgba(255,180,0,0.4)'/%3E%3C/svg%3E")`,
    backgroundSize: '160px 160px',
    backgroundColor: '#080010',
  },
  'vaporwave-grid': {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='rgba(170,0,255,0)'/%3E%3Cstop offset='1' stop-color='rgba(170,0,255,0.18)'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='300' fill='url(%23g)'/%3E%3Cline x1='200' y1='0' x2='0' y2='300' stroke='rgba(255,0,170,0.25)' stroke-width='1'/%3E%3Cline x1='200' y1='0' x2='80' y2='300' stroke='rgba(255,0,170,0.2)' stroke-width='1'/%3E%3Cline x1='200' y1='0' x2='160' y2='300' stroke='rgba(255,0,170,0.18)' stroke-width='1'/%3E%3Cline x1='200' y1='0' x2='240' y2='300' stroke='rgba(255,0,170,0.18)' stroke-width='1'/%3E%3Cline x1='200' y1='0' x2='320' y2='300' stroke='rgba(255,0,170,0.2)' stroke-width='1'/%3E%3Cline x1='200' y1='0' x2='400' y2='300' stroke='rgba(255,0,170,0.25)' stroke-width='1'/%3E%3Cline x1='0' y1='160' x2='400' y2='160' stroke='rgba(0,255,255,0.1)' stroke-width='1'/%3E%3Cline x1='0' y1='200' x2='400' y2='200' stroke='rgba(0,255,255,0.12)' stroke-width='1'/%3E%3Cline x1='0' y1='230' x2='400' y2='230' stroke='rgba(0,255,255,0.14)' stroke-width='1'/%3E%3Cline x1='0' y1='252' x2='400' y2='252' stroke='rgba(0,255,255,0.16)' stroke-width='1'/%3E%3Cline x1='0' y1='268' x2='400' y2='268' stroke='rgba(0,255,255,0.17)' stroke-width='1'/%3E%3Cline x1='0' y1='280' x2='400' y2='280' stroke='rgba(0,255,255,0.18)' stroke-width='1'/%3E%3Cline x1='0' y1='290' x2='400' y2='290' stroke='rgba(0,255,255,0.2)' stroke-width='1'/%3E%3C/svg%3E")`,
    backgroundSize: '400px 300px',
    backgroundColor: '#0d001a',
  },
  'film-strip': {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='120'%3E%3Crect width='60' height='120' fill='%23111'/%3E%3Crect x='4' y='8' width='12' height='18' rx='3' fill='%23333'/%3E%3Crect x='4' y='36' width='12' height='18' rx='3' fill='%23333'/%3E%3Crect x='4' y='64' width='12' height='18' rx='3' fill='%23333'/%3E%3Crect x='4' y='92' width='12' height='18' rx='3' fill='%23333'/%3E%3Crect x='44' y='8' width='12' height='18' rx='3' fill='%23333'/%3E%3Crect x='44' y='36' width='12' height='18' rx='3' fill='%23333'/%3E%3Crect x='44' y='64' width='12' height='18' rx='3' fill='%23333'/%3E%3Crect x='44' y='92' width='12' height='18' rx='3' fill='%23333'/%3E%3Crect x='20' y='4' width='20' height='112' fill='%231a1a1a'/%3E%3C/svg%3E")`,
    backgroundSize: '60px 120px',
    backgroundColor: '#0a0a0a',
  },
  'static-noise': {
    backgroundImage: [
      'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
      'radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)',
      'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
    ].join(','),
    backgroundSize: '3px 3px, 5px 5px, 7px 7px',
    backgroundPosition: '0 0, 1px 2px, 3px 1px',
    backgroundColor: '#111',
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
