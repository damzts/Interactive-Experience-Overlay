import { useEffect, useMemo, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'

interface Props {
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

const MODES = ['input', 'scope', 'patch', 'record'] as const
const SOURCES = ['composite', 's-video', 'component', 'tuner']

function buildVectorPoints(tick: number) {
  return Array.from({ length: 28 }, (_, index) => {
    const x = 42 + Math.cos(tick / 6 + index * 0.4) * 28 + Math.sin(index) * 6
    const y = 42 + Math.sin(tick / 5 + index * 0.4) * 28
    return `${x},${y}`
  }).join(' ')
}

export function SignalLabWidget({ onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props) {
  const [mode, setMode] = useState<(typeof MODES)[number]>('input')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setTick((prev) => prev + 1), 140)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const modeTimer = window.setInterval(() => {
      setMode((prev) => MODES[(MODES.indexOf(prev) + 1) % MODES.length])
    }, 5600)
    return () => window.clearInterval(modeTimer)
  }, [])

  const points = useMemo(() => buildVectorPoints(tick), [tick])

  return (
    <DesktopWindow
      id="signal-lab"
      title="Signal Lab VX"
      width={410}
      defaultPosition={{ x: 270, y: 152 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--signal-lab"
      bodyClassName="desktop-window-body--signal-lab"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px' }}
    >
      <div className="widget-stack widget-stack--fill">
        <div className="widget-panel widget-panel--display widget-panel--signal-console">
          <div className="widget-signal-topbar">
            <div>
              <div className="widget-led-copy">signal lab vx / router monitor</div>
              <div className="widget-signal-title">input bus locked / chassis 01</div>
            </div>
            <div className="widget-signal-status">genlock ok</div>
          </div>

          <div className="widget-signal-tabs">
            {MODES.map((item) => (
              <button key={item} type="button" className={`widget-signal-tab${mode === item ? ' widget-signal-tab--active' : ''}`} onClick={() => setMode(item)}>
                {item}
              </button>
            ))}
          </div>

          <div className={`widget-signal-main widget-signal-main--${mode}`}>
            {mode === 'input' && (
              <div className="widget-signal-preview-grid">
                {SOURCES.map((source) => (
                  <button key={source} type="button" className="widget-signal-preview">
                    <span className="widget-signal-preview-screen" />
                    <span className="widget-signal-preview-label">{source}</span>
                  </button>
                ))}
              </div>
            )}
            {mode === 'scope' && (
              <div className="widget-signal-scope-wrap">
                <svg viewBox="0 0 84 84" className="widget-signal-vector" preserveAspectRatio="none">
                  <polyline points={points} className="widget-signal-vector-line" />
                </svg>
                <div className="widget-signal-readouts">
                  <span>luma: 93%</span>
                  <span>chroma: stable</span>
                  <span>burst: locked</span>
                </div>
              </div>
            )}
            {mode === 'patch' && (
              <div className="widget-signal-patchbay">
                {['cam a -> rec 1', 'cam b -> aux', 'dvd -> pvw', 'gfx -> pgm'].map((route) => (
                  <button key={route} type="button" className="widget-signal-route">{route}</button>
                ))}
              </div>
            )}
            {mode === 'record' && (
              <div className="widget-signal-record-panel">
                <div className="widget-signal-record-time">00:24:19</div>
                <div className="widget-signal-record-bars">
                  {Array.from({ length: 14 }, (_, index) => (
                    <span key={index} className="widget-signal-record-bar" style={{ height: `${28 + Math.abs(Math.sin(tick / 4 + index * 0.5)) * 62}%` }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="widget-signal-footer">
          <div className="widget-toolbar widget-toolbar--music widget-toolbar--signal">
            {['pvw', 'pgm', 'aux', 'rec', 'safe', 'cue'].map((label) => (
              <button key={label} type="button" className="widget-toolbar-button">{label}</button>
            ))}
          </div>
        </div>
      </div>
    </DesktopWindow>
  )
}