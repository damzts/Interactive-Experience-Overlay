import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { RendererProps } from '../registry'

/** LETTERBOX — cinematic widescreen bars slide in/out at top and bottom. */
export function LetterboxRenderer({ config }: RendererProps) {
  const height   = Number(config.height   ?? 80)
  const color    = String(config.color    ?? '#000000')
  const animated = config.animated !== false
  const topRef   = useRef<HTMLDivElement>(null)
  const botRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!animated) return
    gsap.from(topRef.current, { y: -height, duration: 0.6, ease: 'power2.out' })
    gsap.from(botRef.current, { y: height,  duration: 0.6, ease: 'power2.out' })
  }, [animated, height])

  const barStyle: React.CSSProperties = {
    position: 'absolute', left: 0, width: '100%', height,
    background: color, pointerEvents: 'none',
  }

  return (
    <>
      <div ref={topRef} style={{ ...barStyle, top: 0 }} />
      <div ref={botRef} style={{ ...barStyle, bottom: 0 }} />
    </>
  )
}
