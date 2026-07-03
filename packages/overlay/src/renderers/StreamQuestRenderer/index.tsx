import { useEffect, useRef, useState } from 'react'
import type { RendererProps } from '../registry'

/** STREAM-QUEST — stream goal framed as an active MMORPG quest with a filling progress bar.
 *  Emits `quest:complete` into the automation pipeline when the target is reached.
 *  Accepts `quest:advance` (payload.amount, default 1) and `quest:reset` rule actions. */
export function StreamQuestRenderer({ config, emit, onSignal, instanceId }: RendererProps) {
  const title        = String(config.title ?? 'Reach 100 Followers')
  const target       = Math.max(1, Number(config.target ?? 100))
  const initial      = Number(config.current ?? 0)
  const autoProgress = config.autoProgress !== false
  const color        = String(config.color ?? '#e2c23a')

  const [current, setCurrent] = useState(initial)
  const completedRef = useRef(initial >= target)

  const advance = (amount: number) => {
    setCurrent((c) => {
      const next = Math.min(target, c + amount)
      if (next >= target && !completedRef.current) {
        completedRef.current = true
        emit('signal', { source: instanceId, event: 'quest:complete', payload: { title } })
      }
      return next
    })
  }

  // Slow ambient progress, like the original desktop widget
  useEffect(() => {
    if (!autoProgress) return
    const id = setInterval(() => {
      if (Math.random() > 0.5) advance(1)
    }, 20000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoProgress, target, title])

  // Automation rule actions
  useEffect(() => {
    return onSignal('action', (data) => {
      const detail = data as { targetWidgetId: string; action: string; sourceSignal?: { payload?: unknown } }
      if (detail.targetWidgetId !== instanceId) return
      if (detail.action === 'quest:advance') {
        const amount = Number((detail.sourceSignal?.payload as { amount?: unknown } | undefined)?.amount ?? 1)
        advance(Number.isFinite(amount) && amount > 0 ? amount : 1)
      } else if (detail.action === 'quest:reset') {
        completedRef.current = false
        setCurrent(0)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId, target, title])

  const pct = Math.max(0, Math.min(100, (current / target) * 100))

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      justifyContent: 'center', gap: 6, padding: 12,
      background: 'rgba(10,8,4,0.6)', border: '1px solid #4a3a20',
      fontFamily: 'VT323, monospace', color: '#fff', pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 12, letterSpacing: 4, color: '#c9a24b' }}>ACTIVE QUEST</div>
      <div style={{ fontSize: 20, color: '#ffe9b0', textShadow: '0 0 4px #000' }}>{title}</div>
      <div style={{ position: 'relative', height: 14, background: '#000', border: '2px solid #4a3a20' }}>
        <div style={{
          position: 'absolute', inset: 2, width: `calc(${pct}% - 4px)`,
          background: `linear-gradient(90deg, #7a5b0f, ${color})`,
          boxShadow: `0 0 8px ${color}`,
          transition: 'width 0.6s ease-out',
        }} />
      </div>
      <div style={{ fontSize: 15, opacity: 0.8 }}>{current} / {target}</div>
      {current >= target && <div style={{ fontSize: 16, color: '#6bcb77' }}>✓ QUEST COMPLETE</div>}
    </div>
  )
}
