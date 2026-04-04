import { useEffect, useMemo, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'

interface Props {
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

function buildPoints(tick: number) {
  return Array.from({ length: 32 }, (_, index) => {
    const x = index * 9.2
    const y = 64 + Math.sin(tick / 4 + index * 0.45) * 26 + Math.cos(tick / 6 + index * 0.2) * 10
    return `${x},${y}`
  }).join(' ')
}

export function WaveScopeWidget({ onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((prev) => prev + 1), 90)
    return () => window.clearInterval(id)
  }, [])

  const points = useMemo(() => buildPoints(tick), [tick])

  return (
    <DesktopWindow
      id="wave-scope"
      title="Wave Scope"
      width={320}
      defaultPosition={{ x: 248, y: 192 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--wavescope"
      bodyClassName="desktop-window-body--wavescope"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px' }}
    >
      <div className="widget-stack">
        <div className="widget-panel widget-panel--display widget-panel--scope-screen">
          <svg viewBox="0 0 286 128" className="widget-scope-svg" preserveAspectRatio="none">
            <polyline points={points} className="widget-scope-line" />
          </svg>
        </div>
        <div className="widget-meta-row">
          <span className="widget-led-accent">lissajous</span>
          <span className="widget-led-subtle">sync locked</span>
        </div>
      </div>
    </DesktopWindow>
  )
}