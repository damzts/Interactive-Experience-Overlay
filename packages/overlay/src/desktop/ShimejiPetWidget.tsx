import { useEffect, useMemo, useState } from 'react'

interface DesktopWidgetProps {
  appId?: string
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

const PET_LINES = [
  'brb, stealing your cursor',
  'desktop feels cozy today',
  'widgets are glowing nicely',
  'i live here now',
  'stream aura detected',
]

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function ShimejiPetWidget({ onClose, onMinimize, onFocus, windowState = 'open', zIndex = 75 }: DesktopWidgetProps) {
  const [viewport, setViewport] = useState(() => ({ width: typeof window === 'undefined' ? 1920 : window.innerWidth, height: typeof window === 'undefined' ? 1080 : window.innerHeight }))
  const [position, setPosition] = useState({ x: 140, y: 0 })
  const [targetX, setTargetX] = useState(360)
  const [pose, setPose] = useState<'idle' | 'walk' | 'hop' | 'nap'>('walk')
  const [messageIndex, setMessageIndex] = useState(0)
  const [bubbleVisible, setBubbleVisible] = useState(true)

  useEffect(() => {
    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const planner = window.setInterval(() => {
      const nextTarget = 96 + Math.random() * Math.max(220, viewport.width - 280)
      setTargetX(nextTarget)
      const nextPose = Math.random() > 0.82 ? 'hop' : Math.random() > 0.9 ? 'nap' : 'walk'
      setPose(nextPose)
      if (Math.random() > 0.45) {
        setMessageIndex((prev) => (prev + 1) % PET_LINES.length)
        setBubbleVisible(true)
      } else {
        setBubbleVisible(false)
      }
    }, 3600)
    return () => window.clearInterval(planner)
  }, [viewport.width])

  useEffect(() => {
    let frame = 0
    let last = performance.now()

    const tick = (now: number) => {
      const delta = Math.min(40, now - last)
      last = now
      setPosition((prev) => {
        const distance = targetX - prev.x
        const direction = Math.sign(distance) || 1
        const speed = pose === 'hop' ? 0.21 : pose === 'nap' ? 0.03 : 0.09
        const step = direction * Math.min(Math.abs(distance), delta * speed)
        return {
          x: clamp(prev.x + step, 24, Math.max(24, viewport.width - 180)),
          y: prev.y,
        }
      })
      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [pose, targetX, viewport.width])

  const floorOffset = useMemo(() => 56, [])
  const groundedBottom = Math.max(56, viewport.height > 720 ? 68 : floorOffset)
  const facing = targetX >= position.x ? 'right' : 'left'
  const bounce = pose === 'hop' ? 10 : pose === 'walk' ? 4 : 1

  return (
    <div
      className={`desktop-widget-pet desktop-widget-pet--${windowState} desktop-widget-pet--${pose} desktop-widget-pet--facing-${facing}`}
      style={{
        left: position.x,
        bottom: groundedBottom,
        zIndex,
        ['--pet-bounce' as string]: `${bounce}px`,
      }}
      onMouseDown={onFocus}
      data-widget-id="desktop-pet"
    >
      <div className="desktop-widget-pet-controls">
        <button type="button" aria-label="Minimize pet" onClick={onMinimize}>_</button>
        <button type="button" aria-label="Close pet" onClick={onClose}>×</button>
      </div>
      {bubbleVisible && (
        <button
          type="button"
          className="desktop-widget-pet-bubble"
          onClick={() => {
            setMessageIndex((prev) => (prev + 1) % PET_LINES.length)
            setBubbleVisible((prev) => !prev)
          }}
        >
          {PET_LINES[messageIndex]}
        </button>
      )}
      <button
        type="button"
        className="desktop-widget-pet-body"
        onClick={() => {
          setMessageIndex((prev) => (prev + 1) % PET_LINES.length)
          setBubbleVisible(true)
          setPose((prev) => (prev === 'nap' ? 'walk' : 'hop'))
        }}
      >
        <span className="desktop-widget-pet-shadow" />
        <span className="desktop-widget-pet-ears" />
        <span className="desktop-widget-pet-face">
          <span className="desktop-widget-pet-eye" />
          <span className="desktop-widget-pet-eye" />
          <span className="desktop-widget-pet-mouth" />
        </span>
        <span className="desktop-widget-pet-heart">★</span>
      </button>
    </div>
  )
}