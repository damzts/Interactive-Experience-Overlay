import { useEffect, useMemo, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'

interface Props {
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

const MODES = ['wire', 'ticker', 'brief', 'edit'] as const

const STORIES = [
  { slug: 'metro', title: 'Metro loop adds night service', mood: 'priority' },
  { slug: 'weather', title: 'Warm front pushes coast haze inland', mood: 'active' },
  { slug: 'games', title: 'Arcade expo confirms fall showcase', mood: 'queued' },
  { slug: 'net', title: 'Campus backbone upgrade hits phase two', mood: 'queued' },
]

const TICKER_LINES = [
  'market pulse steady after late trade dip',
  'district weather watch remains yellow level',
  'studio b opens for overnight request block',
  'lan finals move to moonlight pavilion',
]

export function NewswireDeskWidget({ onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props) {
  const [mode, setMode] = useState<(typeof MODES)[number]>('wire')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setTick((prev) => prev + 1), 220)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const modeTimer = window.setInterval(() => {
      setMode((prev) => MODES[(MODES.indexOf(prev) + 1) % MODES.length])
    }, 6400)
    return () => window.clearInterval(modeTimer)
  }, [])

  const feedLevel = useMemo(() => 32 + Math.abs(Math.sin(tick / 6)) * 56, [tick])
  const lineOffset = useMemo(() => (tick * 12) % 520, [tick])
  const editLevel = useMemo(() => 28 + Math.abs(Math.cos(tick / 5)) * 44, [tick])

  return (
    <DesktopWindow
      id="newswire-desk"
      title="Newswire Desk"
      width={430}
      defaultPosition={{ x: 428, y: 152 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--newswire-desk"
      bodyClassName="desktop-window-body--newswire-desk"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px' }}
    >
      <div className="widget-stack widget-stack--fill">
        <div className="widget-panel widget-panel--display widget-panel--newswire-desk">
          <div className="widget-news-topbar">
            <div>
              <div className="widget-led-copy">wire room / newsroom matrix / edition a</div>
              <div className="widget-news-title">priority desk / four live feeds / rewrite queue armed</div>
            </div>
            <div className="widget-news-badge">wire sync</div>
          </div>

          <div className="widget-news-tabs">
            {MODES.map((item) => (
              <button key={item} type="button" className={`widget-news-tab${mode === item ? ' widget-news-tab--active' : ''}`} onClick={() => setMode(item)}>
                {item}
              </button>
            ))}
          </div>

          <div className={`widget-news-main widget-news-main--${mode}`}>
            <div className="widget-news-stage">
              {mode === 'wire' && (
                <div className="widget-news-wirelist">
                  {STORIES.map((story) => (
                    <button key={story.slug} type="button" className={`widget-news-story widget-news-story--${story.mood}`}>
                      <span>{story.slug}</span>
                      <span>{story.title}</span>
                      <span>{story.mood}</span>
                    </button>
                  ))}
                </div>
              )}

              {mode === 'ticker' && (
                <div className="widget-news-ticker-shell">
                  <div className="widget-news-ticker-band" style={{ transform: `translateX(-${lineOffset}px)` }}>
                    {TICKER_LINES.concat(TICKER_LINES).map((item, index) => (
                      <span key={`${item}-${index}`} className="widget-news-ticker-chip">{item}</span>
                    ))}
                  </div>
                </div>
              )}

              {mode === 'brief' && (
                <div className="widget-news-brief-grid">
                  {[
                    ['lead', 'weather desk joins traffic at 18:20'],
                    ['promo', 'overnight synth special locked'],
                    ['remote', 'harbor cam feed stable'],
                    ['queue', '3 lower-thirds pending'],
                  ].map(([label, value], index) => (
                    <button key={label} type="button" className={`widget-news-brief${index === 0 ? ' widget-news-brief--active' : ''}`}>
                      <span>{label}</span>
                      <span>{value}</span>
                    </button>
                  ))}
                </div>
              )}

              {mode === 'edit' && (
                <div className="widget-news-edit-panel">
                  <div className="widget-news-edit-screen">
                    <span className="widget-news-edit-cursor" style={{ left: `${18 + (tick % 12) * 16}px` }} />
                    <span>rewrite desk: package intro updated for late weather cross</span>
                    <span>host outcue tightened to 08 sec / ticker synced</span>
                    <span>slug: NIGHTDESK / priority lane green</span>
                  </div>
                  <div className="widget-news-meter">
                    <span className="widget-news-meter-label">copy flow</span>
                    <span className="widget-news-meter-track"><span style={{ width: `${editLevel}%` }} /></span>
                  </div>
                </div>
              )}
            </div>

            <div className="widget-news-sidecar">
              <div className="widget-news-sidepanel">
                <span className="widget-led-copy">desk board</span>
                <span className="widget-led-subtle">reuters / upi / citywire</span>
                <span className="widget-led-subtle">rewrite seats / 03 active</span>
                <span className="widget-led-subtle">ticker lane / locked</span>
              </div>
              <div className="widget-news-sidepanel widget-news-sidepanel--meters">
                <span className="widget-led-copy">throughput</span>
                <div className="widget-news-meter">
                  <span className="widget-news-meter-label">feed load</span>
                  <span className="widget-news-meter-track"><span style={{ width: `${feedLevel}%` }} /></span>
                </div>
                <div className="widget-news-meter">
                  <span className="widget-news-meter-label">priority lane</span>
                  <span className="widget-news-meter-track"><span style={{ width: `${54 + Math.abs(Math.cos(tick / 7)) * 32}%` }} /></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="widget-news-footer">
          <div className="widget-toolbar widget-toolbar--music widget-toolbar--news">
            {['flash', 'hold', 'tag', 'send', 'queue', 'print'].map((label) => (
              <button key={label} type="button" className="widget-toolbar-button">{label}</button>
            ))}
          </div>
        </div>
      </div>
    </DesktopWindow>
  )
}