import { useEffect, useState } from 'react'
import type { RendererProps } from '../registry'

/** RETRO-HUD — classic arcade HUD: score ticker, level counter, ammo/lives readout. */
export function RetroHudRenderer({ config }: RendererProps) {
  const color      = String(config.color ?? '#ffe14a')
  const startScore = Number(config.score ?? 128400)
  const level      = Number(config.level ?? 1)
  const lives      = Number(config.lives ?? 3)
  const ammo0      = Number(config.ammo ?? 24)
  const tickMs     = Number(config.tickMs ?? 1400)

  const [score, setScore] = useState(startScore)
  const [ammo, setAmmo]   = useState(ammo0)

  useEffect(() => {
    const id = setInterval(() => {
      setScore((s) => s + Math.floor(Math.random() * 250))
      setAmmo((a) => (a <= 0 ? ammo0 : a - (Math.random() > 0.7 ? 1 : 0)))
    }, tickMs)
    return () => clearInterval(id)
  }, [tickMs, ammo0])

  const label = (t: string) => (
    <span style={{ opacity: 0.7, marginRight: 6 }}>{t}</span>
  )

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 14px', fontFamily: '"Press Start 2P", VT323, monospace', fontSize: 14,
      color, textShadow: `0 0 6px ${color}88`, pointerEvents: 'none',
    }}>
      <div>{label('SCORE')}{String(score).padStart(7, '0')}</div>
      <div>{label('LV')}{level}</div>
      <div>{label('AMMO')}{String(ammo).padStart(2, '0')}</div>
      <div>{'♥'.repeat(Math.max(0, lives))}</div>
    </div>
  )
}
