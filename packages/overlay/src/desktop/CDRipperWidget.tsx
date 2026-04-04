import { useEffect, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'

interface Props {
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

const MODES = ['rip', 'encode', 'library', 'burn'] as const
const TRACKS = [
  { name: 'Intro Sequence', duration: '0:52' },
  { name: 'Chrome Runner', duration: '3:44' },
  { name: 'City Afterglow', duration: '4:18' },
  { name: 'Blue Tunnel', duration: '5:02' },
  { name: 'Wake Screen', duration: '3:16' },
]

export function CDRipperWidget({ onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props) {
  const [mode, setMode] = useState<(typeof MODES)[number]>('rip')
  const [progress, setProgress] = useState(18)
  const [discPhase, setDiscPhase] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 12 : prev + 3))
      setDiscPhase((prev) => prev + 1)
    }, 180)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const modeTimer = window.setInterval(() => {
      setMode((prev) => MODES[(MODES.indexOf(prev) + 1) % MODES.length])
    }, 5400)
    return () => window.clearInterval(modeTimer)
  }, [])

  return (
    <DesktopWindow
      id="cd-ripper"
      title="LaserRip Studio"
      width={420}
      defaultPosition={{ x: 230, y: 118 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--cd-ripper"
      bodyClassName="desktop-window-body--cd-ripper"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px' }}
    >
      <div className="widget-stack widget-stack--fill">
        <div className="widget-panel widget-panel--display widget-panel--ripper-console">
          <div className="widget-ripper-topbar">
            <div>
              <div className="widget-led-copy">laserrip studio / optical mastering</div>
              <div className="widget-ripper-title">drive 0: glossy silver session</div>
            </div>
            <div className="widget-ripper-status">8x secure</div>
          </div>

          <div className="widget-ripper-tabs">
            {MODES.map((item) => (
              <button key={item} type="button" className={`widget-ripper-tab${mode === item ? ' widget-ripper-tab--active' : ''}`} onClick={() => setMode(item)}>
                {item}
              </button>
            ))}
          </div>

          <div className={`widget-ripper-main widget-ripper-main--${mode}`}>
            <div className="widget-ripper-discwell">
              <div className="widget-ripper-disc" style={{ transform: `rotate(${discPhase * 8}deg)` }} />
              <div className="widget-ripper-disc-copy">disc id: 02A7 / toc locked</div>
            </div>

            <div className="widget-ripper-panel">
              {mode === 'rip' && (
                <>
                  <div className="widget-ripper-progress-copy">ripping track 03 / chrome runner</div>
                  <div className="widget-ripper-progress"><span style={{ width: `${progress}%` }} /></div>
                  <div className="widget-ripper-readouts">
                    <span>jitter: 0.02%</span>
                    <span>cache: 92%</span>
                    <span>retry: none</span>
                  </div>
                </>
              )}
              {mode === 'encode' && (
                <div className="widget-ripper-chipgrid">
                  {['mp3 128', 'mp3 192', 'ogg q6', 'aac 256', 'normalize', 'tag db'].map((item) => (
                    <button key={item} type="button" className="widget-ripper-chip">{item}</button>
                  ))}
                </div>
              )}
              {mode === 'library' && (
                <div className="widget-ripper-library">
                  {TRACKS.map((track, index) => (
                    <button key={track.name} type="button" className="widget-ripper-track">
                      <span>{String(index + 1).padStart(2, '0')} {track.name}</span>
                      <span>{track.duration}</span>
                    </button>
                  ))}
                </div>
              )}
              {mode === 'burn' && (
                <>
                  <div className="widget-ripper-progress-copy">burn image staging / disc-at-once</div>
                  <div className="widget-ripper-ledrow">
                    <span className="widget-ripper-led widget-ripper-led--green" />
                    <span className="widget-ripper-led widget-ripper-led--amber" />
                    <span className="widget-ripper-led widget-ripper-led--red" />
                  </div>
                  <div className="widget-ripper-readouts">
                    <span>buffer under-run proof</span>
                    <span>lead-out ready</span>
                    <span>verify queued</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="widget-ripper-footer">
          <div className="widget-toolbar widget-toolbar--music widget-toolbar--ripper">
            {['scan', 'rip', 'enc', 'tag', 'burn', 'eject'].map((label) => (
              <button key={label} type="button" className="widget-toolbar-button">{label}</button>
            ))}
          </div>
        </div>
      </div>
    </DesktopWindow>
  )
}