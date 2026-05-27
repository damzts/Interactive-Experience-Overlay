import { useEffect, useRef, useState } from 'react'

export function CursorOverlay({ target, onClick }: { target: { x: number, y: number }, onClick?: () => void }) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const cursorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const anim = setInterval(() => {
      setPos((prev) => ({
        x: prev.x + (target.x - prev.x) * 0.2,
        y: prev.y + (target.y - prev.y) * 0.2,
      }))
    }, 16)
    return () => clearInterval(anim)
  }, [target])

  useEffect(() => {
    if (Math.abs(pos.x - target.x) < 5 && Math.abs(pos.y - target.y) < 5 && onClick) {
      onClick()
    }
  }, [pos, target, onClick])

  return (
    <div
      ref={cursorRef}
      className="pointer-events-none fixed z-[9999] h-6 w-6"
      style={{ left: pos.x, top: pos.y }}
    >
      <svg width="24" height="24">
        <circle cx="12" cy="12" r="8" fill="rgba(9,9,11,0.8)" stroke="rgba(34,211,238,0.8)" strokeWidth="1.5" />
      </svg>
    </div>
  )
}
