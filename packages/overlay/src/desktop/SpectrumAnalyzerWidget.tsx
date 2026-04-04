import { useEffect, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'

interface Props {
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

const FREQ_LABELS = ['60', '120', '250', '500', '1k', '2k', '4k', '8k', '12k', '16k']

export function SpectrumAnalyzerWidget({ onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props) {
  const [bars, setBars] = useState(() => Array.from({ length: FREQ_LABELS.length }, () => 40))

  useEffect(() => {
    const id = window.setInterval(() => {
      setBars((prev) => prev.map((value, index) => {
        const target = 18 + Math.abs(Math.sin(Date.now() / 220 + index * 0.6)) * 78
        return value + (target - value) * 0.42
      }))
    }, 90)
    return () => window.clearInterval(id)
  }, [])

  return (
    <DesktopWindow
      id="spectrum-analyzer"
      title="Spectrum Analyzer"
      width={300}
      defaultPosition={{ x: 176, y: 108 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--analyzer"
      bodyClassName="desktop-window-body--analyzer"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px' }}
    >
      <div className="widget-stack">
        <div className="widget-panel widget-panel--display widget-panel--analyzer-grid">
          <div className="widget-led-copy">live fft</div>
          <div className="widget-analyzer-bars">
            {bars.map((value, index) => (
              <div key={FREQ_LABELS[index]} className="widget-analyzer-column">
                <span className="widget-analyzer-bar" style={{ height: `${value}%` }} />
                <span className="widget-analyzer-label">{FREQ_LABELS[index]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="widget-meta-row">
          <span className="widget-led-accent">peak hold: on</span>
          <span className="widget-led-subtle">mode: stereo</span>
        </div>
      </div>
    </DesktopWindow>
  )
}