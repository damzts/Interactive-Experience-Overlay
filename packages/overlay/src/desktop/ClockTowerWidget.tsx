import { useEffect, useMemo, useState, useRef } from 'react'
import { DesktopWindow } from './DesktopWindow'
import { dispatchWidgetSignal } from './widgetSimulationEvents'

interface Props {
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

const CLOCK_VIEWS = ['analog', 'digital', 'minimal'] as const

type ClockView = (typeof CLOCK_VIEWS)[number]

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDate(now: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(now)
}

function formatPeriod(now: Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(now)
}

function getTimeZoneLabel() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const parts = zone.split('/')
  return parts[parts.length - 1]?.replace(/_/g, ' ') || zone
}

export function ClockTowerWidget({ appId = 'clock-tower', onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props & { appId?: string }) {
  const [now, setNow] = useState(() => new Date())
  const [clockView, setClockView] = useState<ClockView>('analog')
  const lastHourRef = useRef<number>(-1)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow((prev) => {
        const next = new Date()
        const h = next.getHours()
        if (next.getMinutes() === 0 && next.getSeconds() === 0 && h !== lastHourRef.current) {
          lastHourRef.current = h
          dispatchWidgetSignal({ source: appId, event: h === 0 ? 'clock:midnight' : 'clock:hour', payload: { hour: h } })
        }
        return next
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const hour = now.getHours()
  const minute = now.getMinutes()
  const second = now.getSeconds()
  const localTime = `${pad(hour)}:${pad(minute)}:${pad(second)}`
  const displayTime = useMemo(() => formatPeriod(now), [now])
  const displayDate = useMemo(() => formatDate(now), [now])
  const timeZoneLabel = useMemo(() => getTimeZoneLabel(), [])
  const secondsProgress = useMemo(() => `${(second / 60) * 100}%`, [second])
  const dayProgress = useMemo(() => {
    const secondsSinceMidnight = hour * 3600 + minute * 60 + second
    return `${(secondsSinceMidnight / 86400) * 100}%`
  }, [hour, minute, second])
  const phaseLabel = hour < 6 ? 'Late Night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'
  const minuteRotation = minute * 6 + second * 0.1
  const hourRotation = (hour % 12) * 30 + minute * 0.5

  const cycleClockView = () => {
    const currentIndex = CLOCK_VIEWS.indexOf(clockView)
    const nextIndex = (currentIndex + 1) % CLOCK_VIEWS.length
    setClockView(CLOCK_VIEWS[nextIndex])
  }

  const analogFace = (
    <div className={`widget-clock-facecard${clockView === 'analog' ? ' widget-clock-facecard--analog' : ''}`}>
      <div className="widget-clock-face">
        {Array.from({ length: 12 }).map((_, index) => (
          <span key={index} className="widget-clock-marker" style={{ rotate: `${index * 30}deg` }} />
        ))}
        <span className="widget-clock-ring" />
        <span className="widget-clock-hand widget-clock-hand--hour" style={{ rotate: `${hourRotation}deg` }} />
        <span className="widget-clock-hand widget-clock-hand--minute" style={{ rotate: `${minuteRotation}deg` }} />
        <span className="widget-clock-hand widget-clock-hand--second" style={{ rotate: `${second * 6}deg` }} />
        <span className="widget-clock-cap" />
      </div>
      <div className="widget-clock-phase">
        <span className="widget-clock-phase-label">Day Phase</span>
        <strong className="widget-clock-phase-value">{phaseLabel}</strong>
      </div>
    </div>
  )

  const infoCard = (
    <div className={`widget-clock-datacard${clockView === 'analog' ? ' widget-clock-datacard--analog' : ''}`}>
      <div className="widget-clock-primarytime">{displayTime}</div>
      <div className="widget-clock-secondline">{localTime}</div>
      <div className="widget-clock-date">{displayDate}</div>

      <div className="widget-clock-statgrid">
        <div className="widget-clock-statcard">
          <span>Seconds</span>
          <strong>{pad(second)}</strong>
        </div>
        <div className="widget-clock-statcard">
          <span>24 Hour</span>
          <strong>{pad(hour)}:{pad(minute)}</strong>
        </div>
      </div>

      <div className="widget-clock-meter">
        <div className="widget-clock-meter-row">
          <span>Minute Progress</span>
          <strong>{second}s</strong>
        </div>
        <span className="widget-clock-metertrack"><span style={{ width: secondsProgress }} /></span>
      </div>

      <div className="widget-clock-meter">
        <div className="widget-clock-meter-row">
          <span>Day Progress</span>
          <strong>{phaseLabel}</strong>
        </div>
        <span className="widget-clock-metertrack widget-clock-metertrack--day"><span style={{ width: dayProgress }} /></span>
      </div>
    </div>
  )

  const digitalCard = (
    <div className="widget-clock-digitalcard">
      <span className="widget-clock-digitaltag">Digital View</span>
      <div className="widget-clock-digitalreadout">
        <span className="widget-clock-digitalmain">{pad(hour)}:{pad(minute)}</span>
        <span className="widget-clock-digitalseconds">{pad(second)}</span>
      </div>
      <div className="widget-clock-date">{displayDate}</div>
      <div className="widget-clock-digitalmeta">{timeZoneLabel} / {phaseLabel}</div>
    </div>
  )

  const minimalCard = (
    <div className="widget-clock-minimalcard">
      <span className="widget-clock-minimaltag">Minimal View</span>
      <div className="widget-clock-minimaltime">{displayTime}</div>
      <div className="widget-clock-minimalseconds">{localTime}</div>
      <div className="widget-clock-minimalmeta">{displayDate} / {timeZoneLabel}</div>
    </div>
  )

  return (
    <DesktopWindow
      id="clock-tower"
      title="Clock"
      width={500}
      defaultPosition={{ x: 392, y: 168 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--clocktower-suite"
      bodyClassName="desktop-window-body--clocktower-suite"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px', minHeight: '420px', minWidth: 'min(500px, calc(100vw - 48px))' }}
    >
      <div className="widget-stack widget-stack--fill">
        <div className="widget-panel widget-panel--display widget-panel--clocktower-suite">
          <div className={`widget-clock-shell widget-clock-shell--${clockView}`}>
            <div className="widget-clock-hero">
              <div className="widget-clock-brand">
                <span className="widget-clock-channel">Clock Channel</span>
                <span className="widget-clock-title">Local Time</span>
                <span className="widget-clock-summary">A self-contained home clock with switchable analog, digital, and minimal views.</span>
              </div>
              <div className="widget-clock-controls">
                <div className="widget-clock-pill">
                  <span className="widget-clock-pill-label">Time Zone</span>
                  <strong className="widget-clock-pill-value">{timeZoneLabel}</strong>
                </div>
                <button type="button" className="widget-clock-viewbutton" onClick={cycleClockView}>
                  <span className="widget-clock-viewbutton-label">View</span>
                  <strong className="widget-clock-viewbutton-value">{clockView}</strong>
                </button>
              </div>
            </div>

            <div className={`widget-clock-layout widget-clock-layout--${clockView}`}>
              {clockView === 'analog' && analogFace}
              {clockView === 'digital' && digitalCard}
              {clockView === 'minimal' && minimalCard}
              {infoCard}
            </div>
          </div>
        </div>
      </div>
    </DesktopWindow>
  )
}