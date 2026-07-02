import { useEffect, useRef, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'
import { useAppStore } from '../store/useAppStore'
import { patchApplicationConfig } from './configPersistence'
import { dispatchWidgetSignal } from './widgetSimulationEvents'

interface StreamQuestWidgetProps {
  appId?: string
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

/** STREAM-QUEST — stream goal framed as an active MMORPG quest, with a slowly filling progress bar. */
export function StreamQuestWidget({
  appId = 'stream-quest',
  onClose,
  onMinimize,
  onFocus,
  windowState = 'open',
  zIndex,
}: StreamQuestWidgetProps) {
  const questConfig = useAppStore((store) => (
    store.config.applications.find((app) => app.id === appId)?.streamQuestSettings
  ))
  const [title, setTitle]     = useState(questConfig?.title ?? 'Reach 100 Followers')
  const [current, setCurrent] = useState(questConfig?.current ?? 62)
  const [target, setTarget]   = useState(questConfig?.target ?? 100)
  const completedRef = useRef(false)

  useEffect(() => {
    if (!questConfig) return
    setTitle(questConfig.title)
    setCurrent(questConfig.current)
    setTarget(questConfig.target)
    completedRef.current = questConfig.current >= questConfig.target
  }, [questConfig])

  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((c) => {
        if (c >= target) return c
        const next = Math.min(target, c + (Math.random() > 0.5 ? 1 : 0))
        if (next >= target && !completedRef.current) {
          completedRef.current = true
          dispatchWidgetSignal({ source: appId, event: 'quest:complete', payload: { title } })
        }
        patchApplicationConfig(appId, { streamQuestSettings: { title, current: next, target } }).catch(() => {})
        return next
      })
    }, 20000)
    return () => clearInterval(id)
  }, [appId, title, target])

  const pct = Math.max(0, Math.min(100, (current / Math.max(1, target)) * 100))

  return (
    <DesktopWindow
      id={appId}
      title="📜 Quest Log"
      width={300}
      defaultPosition={{ x: 60, y: 640 }}
      zIndex={zIndex}
      state={windowState}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: 12, fontFamily: 'VT323, monospace' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 12, letterSpacing: 4, color: '#c9a24b' }}>ACTIVE QUEST</div>
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            const t = e.currentTarget.textContent ?? title
            setTitle(t)
            patchApplicationConfig(appId, { streamQuestSettings: { title: t, current, target } }).catch(() => {})
          }}
          style={{ fontSize: 20, color: '#ffe9b0', outline: 'none' }}
        >{title}</div>
        <div style={{ position: 'relative', height: 14, background: '#000', border: '2px solid #4a3a20' }}>
          <div style={{
            position: 'absolute', inset: 2, width: `calc(${pct}% - 4px)`,
            background: 'linear-gradient(90deg,#7a5b0f,#e2c23a)', transition: 'width 0.6s ease-out',
          }} />
        </div>
        <div style={{ fontSize: 15, opacity: 0.8 }}>{current} / {target}</div>
        {current >= target && <div style={{ fontSize: 16, color: '#6bcb77' }}>✓ QUEST COMPLETE</div>}
      </div>
    </DesktopWindow>
  )
}
