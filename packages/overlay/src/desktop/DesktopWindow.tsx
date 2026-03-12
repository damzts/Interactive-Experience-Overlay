import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'

function saveWidgetPosition(key: string, pos: { x: number; y: number }) {
  const cfg = useAppStore.getState().config
  fetch('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...cfg,
      desktopConfig: {
        ...cfg.desktopConfig,
        widgetPositions: { ...cfg.desktopConfig?.widgetPositions, [key]: pos },
      },
    }),
  }).catch(() => {})
}

interface DesktopWindowProps {
  id: string
  title: React.ReactNode
  width: number
  defaultPosition: { x: number; y: number }
  zIndex?: number
  state?: 'open' | 'closing'
  bodyStyle?: React.CSSProperties
  bodyClassName?: string
  onFocus?: () => void
  onMinimize?: () => void
  onClose: () => void
  children: React.ReactNode
}

export function DesktopWindow({
  id,
  title,
  width,
  defaultPosition,
  zIndex = 60,
  state = 'open',
  bodyStyle,
  bodyClassName = '',
  onFocus,
  onMinimize,
  onClose,
  children,
}: DesktopWindowProps) {
  const configPos = useAppStore((store) => store.config.desktopConfig?.widgetPositions?.[id])
  const [pos, setPos] = useState(() => configPos ?? defaultPosition)
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })
  const posRef = useRef(pos)

  useEffect(() => {
    if (!dragging.current && configPos) {
      setPos(configPos)
      posRef.current = configPos
    }
  }, [configPos])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const next = { x: e.clientX - offset.current.x, y: e.clientY - offset.current.y }
      posRef.current = next
      setPos(next)
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      saveWidgetPosition(id, posRef.current)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [id])

  const handleTitleMouseDown = (e: React.MouseEvent) => {
    onFocus?.()
    dragging.current = true
    offset.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y }
    e.preventDefault()
  }

  return (
    <div
      className={`window desktop-window desktop-window--${state}`}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width,
        userSelect: 'none',
        zIndex,
        boxShadow: '4px 4px 0 #000',
      }}
      onMouseDown={onFocus}
      data-widget-id={id}
    >
      <div className="title-bar desktop-window-title" style={{ cursor: 'move' }} onMouseDown={handleTitleMouseDown}>
        <div className="title-bar-text">{title}</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" onClick={onMinimize} />
          <button aria-label="Maximize" />
          <button aria-label="Close" onClick={onClose} />
        </div>
      </div>
      <div className={`window-body ${bodyClassName}`.trim()} style={bodyStyle}>
        {children}
      </div>
    </div>
  )
}