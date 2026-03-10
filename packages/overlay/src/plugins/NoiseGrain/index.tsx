import { useEffect, useRef } from 'react'

/** Animated film grain via a small tiled canvas — refreshes at ~20fps. */
export function NoiseGrainRenderer({ config }: { config: Record<string, unknown> }) {
  const opacity  = Number(config.opacity ?? 0.08)
  const animated = config.animated !== false
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 256
    const H = 256
    canvas.width  = W
    canvas.height = H

    let animId: number

    const draw = () => {
      const img = ctx.createImageData(W, H)
      const d   = img.data
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0
        d[i] = d[i + 1] = d[i + 2] = v
        d[i + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
      if (animated) animId = setTimeout(() => requestAnimationFrame(draw), 50) as unknown as number
    }

    draw()
    return () => { clearTimeout(animId); cancelAnimationFrame(animId) }
  }, [animated])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity,
        pointerEvents: 'none',
        mixBlendMode: 'overlay',
      }}
    />
  )
}
