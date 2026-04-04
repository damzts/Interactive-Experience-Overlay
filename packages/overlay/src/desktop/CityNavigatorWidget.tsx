import { useEffect, useMemo, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'

interface Props {
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

const MODES = ['route', 'traffic', 'metro', 'dispatch'] as const

const ROUTES = [
  { code: 'M2', from: 'west grid', to: 'river east' },
  { code: 'A7', from: 'harbor loop', to: 'night plaza' },
  { code: 'R4', from: 'old station', to: 'metro dome' },
  { code: 'N1', from: 'broadcast row', to: 'weather hub' },
]

const INCIDENTS = [
  'harbor tunnel slowdown / 8 min delay',
  'tram line amber near central gate',
  'weather desk flags wet road shimmer',
  'wire desk posts parade detour update',
]

export function CityNavigatorWidget({ onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props) {
  const [mode, setMode] = useState<(typeof MODES)[number]>('route')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setTick((prev) => prev + 1), 220)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const modeTimer = window.setInterval(() => {
      setMode((prev) => MODES[(MODES.indexOf(prev) + 1) % MODES.length])
    }, 6100)
    return () => window.clearInterval(modeTimer)
  }, [])

  const routeProgress = useMemo(() => 22 + Math.abs(Math.sin(tick / 5)) * 64, [tick])
  const trafficLoad = useMemo(() => 36 + Math.abs(Math.cos(tick / 6)) * 48, [tick])
  const dispatchLoad = useMemo(() => 18 + Math.abs(Math.sin(tick / 7)) * 62, [tick])
  const mapShift = (tick * 3) % 140

  return (
    <DesktopWindow
      id="city-nav"
      title="City Navigator"
      width={450}
      defaultPosition={{ x: 474, y: 176 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--city-navigator"
      bodyClassName="desktop-window-body--city-navigator"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px' }}
    >
      <div className="widget-stack widget-stack--fill">
        <div className="widget-panel widget-panel--display widget-panel--navigator-desk">
          <div className="widget-navdesk-header">
            <div>
              <div className="widget-led-copy">city navigator / metro atlas / weather-wire linked</div>
              <div className="widget-navdesk-title">routing desk online with live traffic and dispatch overlays</div>
            </div>
            <div className="widget-navdesk-badges">
              <span className="widget-navdesk-badge">eta 12m</span>
              <span className="widget-navdesk-badge">grid green</span>
            </div>
          </div>

          <div className="widget-navdesk-shell">
            <div className="widget-navdesk-planner">
              <span className="widget-led-copy">planner</span>
              <div className="widget-navdesk-field">
                <span>from</span>
                <strong>broadcast row</strong>
              </div>
              <div className="widget-navdesk-field">
                <span>to</span>
                <strong>weather hub</strong>
              </div>
              <div className="widget-navdesk-routebank">
                {ROUTES.map((item) => (
                  <button key={item.code} type="button" className="widget-navdesk-route">
                    <span>{item.code}</span>
                    <span>{item.from}</span>
                    <span>{item.to}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="widget-navdesk-mapdeck">
              <div className="widget-navdesk-toolbar">
                {MODES.map((item) => (
                  <button key={item} type="button" className={`widget-navdesk-mode${mode === item ? ' widget-navdesk-mode--active' : ''}`} onClick={() => setMode(item)}>
                    {item}
                  </button>
                ))}
              </div>

              <div className="widget-navdesk-mapframe">
                <span className="widget-navdesk-road widget-navdesk-road--h" style={{ top: '24%' }} />
                <span className="widget-navdesk-road widget-navdesk-road--h" style={{ top: '52%' }} />
                <span className="widget-navdesk-road widget-navdesk-road--v" style={{ left: '28%' }} />
                <span className="widget-navdesk-road widget-navdesk-road--v" style={{ left: '66%' }} />
                <span className="widget-navdesk-rail" />
                <span className="widget-navdesk-routepath" />
                <span className="widget-navdesk-ping widget-navdesk-ping--a" />
                <span className="widget-navdesk-ping widget-navdesk-ping--b" />
                <span className="widget-navdesk-car" style={{ left: `${18 + routeProgress}%`, top: '58%' }} />
                <span className="widget-navdesk-train" style={{ transform: `translateX(${mapShift}px)` }} />
                <span className="widget-navdesk-pin widget-navdesk-pin--start">A</span>
                <span className="widget-navdesk-pin widget-navdesk-pin--end">B</span>
              </div>

              <div className="widget-navdesk-strip">
                <div className="widget-navdesk-meter">
                  <span>route flow</span>
                  <span className="widget-navdesk-metertrack"><span style={{ width: `${routeProgress}%` }} /></span>
                </div>
                <div className="widget-navdesk-meter">
                  <span>traffic load</span>
                  <span className="widget-navdesk-metertrack"><span style={{ width: `${trafficLoad}%` }} /></span>
                </div>
                <div className="widget-navdesk-meter">
                  <span>dispatch</span>
                  <span className="widget-navdesk-metertrack"><span style={{ width: `${dispatchLoad}%` }} /></span>
                </div>
              </div>
            </div>

            <div className="widget-navdesk-feed">
              <div className="widget-navdesk-feedhead">
                <span className="widget-led-copy">live feed</span>
                <span className="widget-led-subtle">newswire + weather pair</span>
              </div>
              <div className="widget-navdesk-incidentlist">
                {INCIDENTS.map((item, index) => (
                  <button key={item} type="button" className={`widget-navdesk-incident${index === 0 ? ' widget-navdesk-incident--active' : ''}`}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <span>{item}</span>
                  </button>
                ))}
              </div>
              <div className="widget-navdesk-tools">
                {['route', 'reroute', 'weather', 'wire', 'zoom', 'log'].map((label) => (
                  <button key={label} type="button" className="widget-navdesk-tool">{label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DesktopWindow>
  )
}