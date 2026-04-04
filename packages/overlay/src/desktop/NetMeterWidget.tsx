import { useEffect, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'

interface Props {
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

export function NetMeterWidget({ onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props) {
  const [samples, setSamples] = useState(() => Array.from({ length: 24 }, () => 20))

  useEffect(() => {
    const id = window.setInterval(() => {
      setSamples((prev) => [...prev.slice(1), 24 + Math.random() * 62])
    }, 220)
    return () => window.clearInterval(id)
  }, [])

  return (
    <DesktopWindow
      id="net-meter"
      title="Net Meter"
      width={280}
      defaultPosition={{ x: 320, y: 270 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--netmeter"
      bodyClassName="desktop-window-body--netmeter"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px' }}
    >
      <div className="widget-stack">
        <div className="widget-panel widget-panel--display widget-panel--net-graph">
          <div className="widget-net-bars">
            {samples.map((sample, index) => (
              <span key={index} className="widget-net-bar" style={{ height: `${sample}%` }} />
            ))}
          </div>
        </div>
        <div className="widget-meta-row">
          <span className="widget-led-accent">down 412 kb/s</span>
          <span className="widget-led-subtle">ping 42 ms</span>
        </div>
      </div>
    </DesktopWindow>
  )
}