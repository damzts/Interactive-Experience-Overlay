import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { RendererProps } from '../registry'

/** NEON-BORDER — persistent animated neon frame with plasma color cycling. */
export function NeonBorderRenderer({ config }: RendererProps) {
  const thickness = Number(config.thickness ?? 4)
  const rainbow   = config.rainbow !== false
  const color     = String(config.color ?? '#ff00ff')
  const speed     = Number(config.speed ?? 6)
  const cornerRadius = Number(config.cornerRadius ?? 0)

  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || !rainbow) return
    const el = ref.current
    const tween = gsap.fromTo(el, { '--neon-hue': 0 } as any, {
      '--neon-hue': 360,
      duration: speed,
      repeat: -1,
      ease: 'none',
    } as any)
    return () => { tween.kill() }
  }, [rainbow, speed])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        borderRadius: cornerRadius,
        border: `${thickness}px solid ${rainbow ? `hsl(var(--neon-hue,0),100%,55%)` : color}`,
        boxShadow: rainbow
          ? `0 0 12px hsl(var(--neon-hue,0),100%,55%), inset 0 0 12px hsl(var(--neon-hue,0),100%,55%)`
          : `0 0 12px ${color}, inset 0 0 12px ${color}`,
      } as React.CSSProperties}
    />
  )
}
