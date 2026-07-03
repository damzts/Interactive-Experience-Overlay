import { useEffect, useRef, useState } from 'react'
import type { RendererProps } from '../registry'

interface Bar { pct: number; regenTo: number }

/** RPG-HUD — MMORPG-style HP/MP/XP bars + hotbar + minimap, always alive with slow idle regen.
 *  Accepts the `rpg:level-up` automation action: bumps the level and refills the bars. */
export function RpgHudRenderer({ config, onSignal, instanceId }: RendererProps) {
  const hp0    = Number(config.hp ?? 82)
  const mp0    = Number(config.mp ?? 54)
  const xp0    = Number(config.xp ?? 30)
  const level0 = Number(config.level ?? 12)
  const name   = String(config.name ?? 'STREAMER')
  const slots  = Number(config.hotbarSlots ?? 8)
  const showMinimap = config.showMinimap !== false

  const [hp, setHp] = useState<Bar>({ pct: hp0, regenTo: hp0 })
  const [mp, setMp] = useState<Bar>({ pct: mp0, regenTo: mp0 })
  const [xp, setXp] = useState(xp0)
  const [levelBoost, setLevelBoost] = useState(0)
  const level = level0 + levelBoost

  useEffect(() => {
    return onSignal('action', (data) => {
      const detail = data as { targetWidgetId: string; action: string }
      if (detail.targetWidgetId !== instanceId || detail.action !== 'rpg:level-up') return
      setLevelBoost((b) => b + 1)
      setHp({ pct: 100, regenTo: 100 })
      setMp({ pct: 100, regenTo: 100 })
      setXp(0)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId])

  useEffect(() => {
    const id = setInterval(() => {
      setHp((b) => {
        const regenTo = Math.min(100, Math.max(20, b.regenTo + (Math.random() - 0.45) * 8))
        return { pct: b.pct + (regenTo - b.pct) * 0.15, regenTo }
      })
      setMp((b) => {
        const regenTo = Math.min(100, Math.max(15, b.regenTo + (Math.random() - 0.4) * 10))
        return { pct: b.pct + (regenTo - b.pct) * 0.15, regenTo }
      })
      setXp((x) => (x + 0.15) % 100)
    }, 900)
    return () => clearInterval(id)
  }, [])

  const bar = (pct: number, from: string, to: string, glow: string) => (
    <div style={{ position: 'relative', width: 220, height: 14, background: '#000', border: '2px solid #4a3a20', boxShadow: 'inset 0 0 4px #000' }}>
      <div style={{
        position: 'absolute', inset: 2, width: `calc(${Math.max(0, Math.min(100, pct))}% - 4px)`,
        background: `linear-gradient(90deg, ${from}, ${to})`,
        boxShadow: `0 0 8px ${glow}`,
        transition: 'width 0.6s ease-out',
      }} />
    </div>
  )

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end', gap: 6, padding: 10,
      fontFamily: 'VT323, monospace', color: '#fff', pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', background: 'radial-gradient(circle,#3a2f1a,#150f08)',
          border: '2px solid #c9a24b', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: '#ffd76b', flexShrink: 0,
        }}>{level}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 14, letterSpacing: 1, color: '#e8d9b0', textShadow: '0 0 4px #000' }}>{name}</div>
          {bar(hp.pct, '#8f1b1b', '#e23a3a', '#ff4444')}
          {bar(mp.pct, '#1b3f8f', '#3a7ae2', '#4499ff')}
          {bar(xp, '#7a5b0f', '#e2c23a', '#ffd94a')}
        </div>
        {showMinimap && (
          <div style={{
            width: 56, height: 56, borderRadius: '50%', marginLeft: 8,
            background: 'radial-gradient(circle,#0e1a10,#040704)',
            border: '2px solid #4a3a20', boxShadow: 'inset 0 0 10px #000',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: 6, height: 6, borderRadius: '50%', background: '#ffd76b', transform: 'translate(-50%,-50%)', boxShadow: '0 0 6px #ffd76b' }} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: slots }).map((_, i) => (
          <div key={i} style={{
            width: 32, height: 32, background: 'rgba(20,16,10,0.85)',
            border: '1px solid #6b5730', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: '#8a7a55',
          }}>{i + 1}</div>
        ))}
      </div>
    </div>
  )
}
