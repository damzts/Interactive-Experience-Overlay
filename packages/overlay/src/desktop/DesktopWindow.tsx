import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { patchDesktopConfig } from './configPersistence'

function clampDimension(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function resolveWidth(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return clampDimension(value as number, 180, 1400)
}

function resolveHeight(value: number | undefined) {
  if (!Number.isFinite(value)) return undefined
  return clampDimension(value as number, 140, 1000)
}

function saveWidgetPosition(key: string, pos: { x: number; y: number }) {
  const cfg = useAppStore.getState().config
  patchDesktopConfig({
    widgetPositions: { ...cfg.desktopConfig?.widgetPositions, [key]: pos },
  }).catch(() => {})
}

function saveWidgetSize(key: string, size: { width: number; height: number }) {
  const cfg = useAppStore.getState().config
  patchDesktopConfig({
    widgetSizes: { ...cfg.desktopConfig?.widgetSizes, [key]: size },
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
  const sizeOverride = useAppStore((store) => store.config.desktopConfig?.widgetSizes?.[id])
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState(() => configPos ?? defaultPosition)
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })
  const posRef = useRef(pos)
  const resizing = useRef(false)
  const resizeStartPointer = useRef({ x: 0, y: 0 })
  const resizeStartSize = useRef({ width: width, height: 0 })
  const resolvedWidth = resolveWidth(sizeOverride?.width, width)
  const resolvedHeight = resolveHeight(sizeOverride?.height)
  const [liveSize, setLiveSize] = useState(() => ({ width: resolvedWidth, height: resolvedHeight }))
  const sizeRef = useRef(liveSize)

  useEffect(() => {
    if (resizing.current) return
    const next = { width: resolvedWidth, height: resolvedHeight }
    setLiveSize(next)
    sizeRef.current = next
  }, [resolvedWidth, resolvedHeight])

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
    const onResizeMove = (e: MouseEvent) => {
      if (!resizing.current) return
      const dx = e.clientX - resizeStartPointer.current.x
      const dy = e.clientY - resizeStartPointer.current.y
      const next = {
        width: clampDimension(resizeStartSize.current.width + dx, 180, 1400),
        height: clampDimension(resizeStartSize.current.height + dy, 140, 1000),
      }
      sizeRef.current = next
      setLiveSize(next)
    }
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false
        saveWidgetPosition(id, posRef.current)
      }
      if (resizing.current) {
        resizing.current = false
        saveWidgetSize(id, {
          width: sizeRef.current.width,
          height: sizeRef.current.height ?? resizeStartSize.current.height,
        })
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousemove', onResizeMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousemove', onResizeMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [id])

  const handleTitleMouseDown = (e: React.MouseEvent) => {
    onFocus?.()
    dragging.current = true
    offset.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y }
    e.preventDefault()
  }

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    onFocus?.()
    resizing.current = true
    resizeStartPointer.current = { x: e.clientX, y: e.clientY }
    resizeStartSize.current = {
      width: sizeRef.current.width,
      height: sizeRef.current.height ?? frameRef.current?.offsetHeight ?? 260,
    }
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      ref={frameRef}
      className={`window desktop-window desktop-window--${state}`}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: liveSize.width,
        height: liveSize.height,
        display: 'flex',
        flexDirection: 'column',
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
      <div
        className={`window-body ${bodyClassName}`.trim()}
        style={{
          ...bodyStyle,
          ...(liveSize.height ? { flex: 1, overflow: 'auto' } : {}),
        }}
      >
        {children}
      </div>
      <div
        role="presentation"
        onMouseDown={handleResizeMouseDown}
        style={{
          position: 'absolute',
          right: 2,
          bottom: 2,
          width: 12,
          height: 12,
          cursor: 'nwse-resize',
          background:
            'linear-gradient(135deg, transparent 0%, transparent 35%, #4f4f4f 35%, #4f4f4f 55%, #bfbfbf 55%, #bfbfbf 75%, #4f4f4f 75%, #4f4f4f 100%)',
        }}
      />
    </div>
  )
}