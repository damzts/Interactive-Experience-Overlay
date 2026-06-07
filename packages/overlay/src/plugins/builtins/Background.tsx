/**
 * builtin:background — renders the OverlayBackground config as a source.
 * config shape mirrors OverlayBackground, passed verbatim from TieredScene.
 */
import type { PluginProps } from '../registry'

export function BuiltinBackgroundRenderer({ config }: PluginProps) {
  const type     = String(config.type ?? 'none')
  const opacity  = Number(config.opacity ?? 1)
  const blur     = Number(config.blur ?? 0)

  const base: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    opacity,
    filter: blur > 0 ? `blur(${blur}px)` : undefined,
    pointerEvents: 'none',
  }

  if (type === 'color')
    return <div style={{ ...base, backgroundColor: String(config.color ?? '#000') }} />

  if (type === 'gradient')
    return <div style={{ ...base, background: String(config.gradient ?? '') }} />

  if (type === 'image-url' && config.imageUrl)
    return <div style={{ ...base, backgroundImage: `url(${JSON.stringify(config.imageUrl)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />

  if (type === 'video-url' && config.videoUrl)
    return <video src={String(config.videoUrl)} autoPlay loop muted playsInline style={{ ...base, width: '100%', height: '100%', objectFit: 'cover' }} />

  if (type === 'pattern') {
    const PATTERNS: Record<string, React.CSSProperties> = {
      grid:       { backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '50px 50px', backgroundColor: '#0a0a0f' },
      dots:       { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)', backgroundSize: '28px 28px', backgroundColor: '#0a0a0f' },
      diagonal:   { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.04) 8px, rgba(255,255,255,0.04) 9px)', backgroundColor: '#0a0a0f' },
      circuit:    { backgroundImage: 'linear-gradient(rgba(0,204,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,204,255,.05) 1px, transparent 1px)', backgroundSize: '50px 50px', backgroundColor: '#030810' },
    }
    return <div style={{ ...base, ...(PATTERNS[String(config.pattern ?? '')] ?? {}) }} />
  }

  return null
}
