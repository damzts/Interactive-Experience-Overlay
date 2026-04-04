import { useEffect, useMemo, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'

interface Props {
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

const MODES = ['rundown', 'cues', 'lower3', 'auto'] as const

const RUN_ITEMS = [
  { time: '18:00', label: 'Open / stinger', state: 'ready' },
  { time: '18:02', label: 'Desk intro + headlines', state: 'live' },
  { time: '18:07', label: 'Package A', state: 'queued' },
  { time: '18:11', label: 'Remote hit / cam b', state: 'hold' },
]

const CUE_ITEMS = [
  { lane: 'gfx', action: 'Take lower third: host', state: 'armed' },
  { lane: 'playout', action: 'Roll open animation', state: 'ready' },
  { lane: 'ticker', action: 'Bring in bug + ticker', state: 'live' },
  { lane: 'server', action: 'Stand by package server', state: 'hold' },
]

const LOWER_THIRDS = [
  'ANCHOR | NIGHT DESK',
  'FIELD FEED | RIVER DISTRICT',
  'BREAKING | TRAFFIC UPDATE',
  'SEGMENT | WEATHER WALL',
]

function formatClock(date: Date) {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function BroadcastSchedulerWidget({ onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props) {
  const [mode, setMode] = useState<(typeof MODES)[number]>('rundown')
  const [now, setNow] = useState(() => new Date())
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
      setPulse((prev) => prev + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const modeTimer = window.setInterval(() => {
      setMode((prev) => MODES[(MODES.indexOf(prev) + 1) % MODES.length])
    }, 6200)
    return () => window.clearInterval(modeTimer)
  }, [])

  const automationLevel = useMemo(() => 34 + Math.abs(Math.sin(pulse / 3)) * 52, [pulse])
  const queueLevel = useMemo(() => 20 + Math.abs(Math.cos(pulse / 4)) * 68, [pulse])
  const serverLoad = useMemo(() => 28 + Math.abs(Math.sin(pulse / 5)) * 54, [pulse])
  const clock = formatClock(now)

  return (
    <DesktopWindow
      id="broadcast-scheduler"
      title="Broadcast Scheduler"
      width={430}
      defaultPosition={{ x: 314, y: 124 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--broadcast-hub"
      bodyClassName="desktop-window-body--broadcast-hub"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px' }}
    >
      <div className="widget-stack widget-stack--fill">
        <div className="widget-panel widget-panel--display widget-panel--broadcast-hub">
          <div className="widget-broadcast-header">
            <div className="widget-broadcast-ident">
              <div className="widget-led-copy">automation bay / control room alpha / block a</div>
              <div className="widget-broadcast-title">evening rundown active with lower-third and playout routing</div>
            </div>
            <div className="widget-broadcast-timebox">
              <span className="widget-broadcast-clock">{clock}</span>
              <span className="widget-led-subtle">tc +29.97 df</span>
              <span className="widget-broadcast-live">on air</span>
            </div>
          </div>

          <div className="widget-broadcast-shell">
            <div className="widget-broadcast-rail">
              {MODES.map((item) => (
                <button key={item} type="button" className={`widget-broadcast-rail-button${mode === item ? ' widget-broadcast-rail-button--active' : ''}`} onClick={() => setMode(item)}>
                  {item}
                </button>
              ))}
            </div>

            <div className="widget-broadcast-board">
              <div className="widget-broadcast-board-header">
                <span className="widget-led-copy">active board</span>
                <span className="widget-led-subtle">next event in 01:42</span>
                <span className="widget-led-subtle">gfx queue / 4 ready</span>
              </div>

              {mode === 'rundown' && (
                <div className="widget-broadcast-timeline">
                  {RUN_ITEMS.map((item) => (
                    <button key={item.label} type="button" className={`widget-broadcast-event widget-broadcast-event--${item.state}`}>
                      <span>{item.time}</span>
                      <span>{item.label}</span>
                      <span>{item.state}</span>
                    </button>
                  ))}
                </div>
              )}

              {mode === 'cues' && (
                <div className="widget-broadcast-cuegrid">
                  {CUE_ITEMS.map((item, index) => (
                    <button key={item.action} type="button" className={`widget-broadcast-cuecard${index === 0 ? ' widget-broadcast-cuecard--active' : ''}`}>
                      <span>{item.lane}</span>
                      <strong>{item.action}</strong>
                      <span>{item.state}</span>
                    </button>
                  ))}
                </div>
              )}

              {mode === 'lower3' && (
                <div className="widget-broadcast-l3wall">
                  {LOWER_THIRDS.map((item, index) => (
                    <button key={item} type="button" className={`widget-broadcast-l3card${index === 1 ? ' widget-broadcast-l3card--active' : ''}`}>
                      <span className="widget-broadcast-l3preview" />
                      <span>{item}</span>
                    </button>
                  ))}
                </div>
              )}

              {mode === 'auto' && (
                <div className="widget-broadcast-automation">
                  <div className="widget-broadcast-meter">
                    <span className="widget-broadcast-meter-label">automation lane</span>
                    <span className="widget-broadcast-meter-track"><span style={{ width: `${automationLevel}%` }} /></span>
                  </div>
                  <div className="widget-broadcast-meter">
                    <span className="widget-broadcast-meter-label">cue readiness</span>
                    <span className="widget-broadcast-meter-track"><span style={{ width: `${queueLevel}%` }} /></span>
                  </div>
                  <div className="widget-broadcast-meter">
                    <span className="widget-broadcast-meter-label">server load</span>
                    <span className="widget-broadcast-meter-track"><span style={{ width: `${serverLoad}%` }} /></span>
                  </div>
                  <div className="widget-broadcast-togglebank">
                    {['auto roll', 'ticker arm', 'safe lower3', 'backup playout', 'obs tally', 'hotkey lock'].map((item, index) => (
                      <button key={item} type="button" className={`widget-broadcast-toggle${index % 2 === 0 ? ' widget-broadcast-toggle--on' : ''}`}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="widget-broadcast-commandbar">
                {['take', 'hold', 'roll', 'skip', 'l3', 'auto'].map((label) => (
                  <button key={label} type="button" className="widget-broadcast-command">{label}</button>
                ))}
              </div>
            </div>

            <div className="widget-broadcast-monitor">
              <div className="widget-broadcast-preview">
                <span className="widget-led-copy">program bus</span>
                <span className="widget-broadcast-preview-label">night desk / package a / cam b standby</span>
              </div>
              <div className="widget-broadcast-statusstack">
                <div className="widget-broadcast-statuscard">
                  <span className="widget-led-copy">tallies</span>
                  <div className="widget-broadcast-tallies">
                    <span className="widget-broadcast-tally widget-broadcast-tally--green" />
                    <span className="widget-broadcast-tally widget-broadcast-tally--amber" />
                    <span className="widget-broadcast-tally widget-broadcast-tally--red" />
                  </div>
                </div>
                <div className="widget-broadcast-statuscard">
                  <span className="widget-led-copy">operators</span>
                  <span className="widget-led-subtle">td / live</span>
                  <span className="widget-led-subtle">gfx / ready</span>
                  <span className="widget-led-subtle">audio / nominal</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DesktopWindow>
  )
}