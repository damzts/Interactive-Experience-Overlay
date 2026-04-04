import { useEffect, useMemo, useState } from 'react'

interface DesktopWidgetProps {
  appId?: string
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

const ORB_LABELS = ['syncing vibes', 'dial-up starlight', 'signal bloom', 'neon weather']

export function AuraOrbWidget({ onClose, onMinimize, onFocus, windowState = 'open', zIndex = 65 }: DesktopWidgetProps) {
  const [tick, setTick] = useState(0)
  const [labelIndex, setLabelIndex] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => setTick((prev) => prev + 1), 48)
    const labelTimer = window.setInterval(() => setLabelIndex((prev) => (prev + 1) % ORB_LABELS.length), 4200)
    return () => {
      window.clearInterval(interval)
      window.clearInterval(labelTimer)
    }
  }, [])

  const t = tick / 18
  const x = 1520 + Math.sin(t * 0.65) * 96 + Math.cos(t * 0.22) * 24
  const y = 132 + Math.cos(t * 0.52) * 58 + Math.sin(t * 0.17) * 14
  const scale = 1 + Math.sin(t * 0.8) * 0.04
  const hue = Math.round(Math.sin(t * 0.35) * 14)

  const style = useMemo(() => ({
    left: x,
    top: y,
    zIndex,
    transform: `translate3d(0, 0, 0) scale(${scale})`,
    ['--orb-hue-shift' as string]: `${hue}deg`,
  }), [hue, scale, x, y, zIndex])

  return (
    <div
      className={`desktop-widget-orb desktop-widget-orb--${windowState}`}
      style={style}
      onMouseDown={onFocus}
      data-widget-id="aura-orb"
    >
      <div className="desktop-widget-orb-controls">
        <button type="button" aria-label="Minimize orb" onClick={onMinimize}>_</button>
        <button type="button" aria-label="Close orb" onClick={onClose}>×</button>
      </div>
      <button
        type="button"
        className="desktop-widget-orb-core"
        onClick={() => setLabelIndex((prev) => (prev + 1) % ORB_LABELS.length)}
      >
        <span className="desktop-widget-orb-ring desktop-widget-orb-ring--one" />
        <span className="desktop-widget-orb-ring desktop-widget-orb-ring--two" />
        <span className="desktop-widget-orb-ring desktop-widget-orb-ring--three" />
        <span className="desktop-widget-orb-spark desktop-widget-orb-spark--one" />
        <span className="desktop-widget-orb-spark desktop-widget-orb-spark--two" />
        <span className="desktop-widget-orb-spark desktop-widget-orb-spark--three" />
      </button>
      <div className="desktop-widget-orb-label">{ORB_LABELS[labelIndex]}</div>
    </div>
  )
}