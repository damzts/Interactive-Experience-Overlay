import { useEffect, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'

interface Props {
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

const BANDS = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k']

export function EqualizerRackWidget({ onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props) {
  const [levels, setLevels] = useState(() => BANDS.map((_, index) => 50 + Math.sin(index) * 18))

  useEffect(() => {
    const id = window.setInterval(() => {
      setLevels((prev) => prev.map((level, index) => {
        const drift = Math.sin(Date.now() / 400 + index * 0.8) * 8
        return Math.max(4, Math.min(96, level * 0.72 + (50 + drift) * 0.28))
      }))
    }, 160)
    return () => window.clearInterval(id)
  }, [])

  return (
    <DesktopWindow
      id="equalizer-rack"
      title="Equalizer Rack"
      width={320}
      defaultPosition={{ x: 210, y: 150 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--equalizer"
      bodyClassName="desktop-window-body--equalizer"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px' }}
    >
      <div className="widget-stack">
        <div className="widget-panel widget-panel--display">
          <div className="widget-led-copy">10 band eq</div>
          <div className="widget-eq-rack">
            {levels.map((level, index) => (
              <div key={BANDS[index]} className="widget-eq-band">
                <span className="widget-eq-track">
                  <span className="widget-eq-fill" style={{ height: `${Math.round(level)}%` }} />
                </span>
                <span className="widget-eq-label">{BANDS[index]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="widget-toolbar widget-toolbar--music">
          <button className="widget-toolbar-button">Rock</button>
          <button className="widget-toolbar-button">Club</button>
          <button className="widget-toolbar-button">Flat</button>
          <button className="widget-toolbar-button">Live</button>
        </div>
      </div>
    </DesktopWindow>
  )
}