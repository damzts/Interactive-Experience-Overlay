import { useEffect, useMemo, useRef, useState } from 'react'
import { withDesktopConfigDefaults } from '@ieomlabs/shared'
import { useAppStore } from '../store/useAppStore'
import { socket } from '../socket/client'
import type { DesktopWidgetDragPayload, DesktopWidgetResizePayload } from '@ieomlabs/shared'
import { buildWidgetThemeScopeClassNames, buildWidgetThemeVars } from './widgetTheme'
import { ShapeChrome, buildShapeClipPath, getWidgetShapeDef, isClippedShape, resolveTitleInset, resolveWidgetShape } from './widgetShapes'

const TASKBAR_HEIGHT_PX = 40

function hashString(input: string) {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

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

function clampWindowPosition(
  position: { x: number; y: number },
  dimensions: { width: number; height: number },
) {
  if (typeof window === 'undefined') return position

  const maxX = Math.max(0, window.innerWidth - dimensions.width)
  const workAreaHeight = Math.max(0, window.innerHeight - TASKBAR_HEIGHT_PX)
  const maxY = Math.max(0, workAreaHeight - dimensions.height)

  return {
    x: clampDimension(position.x, 0, maxX),
    y: clampDimension(position.y, 0, maxY),
  }
}

interface BroadcastState<T> {
  lastSentAt: number
  rafId: number | null
  pending: T | null
}

function makeThrottledEmitter<T>(event: string, stateRef: { current: BroadcastState<T> }) {
  return (payload: T & { phase: string }, immediate = false) => {
    if (!socket.connected) return
    const state = stateRef.current
    const flush = (next: T) => {
      socket.emit(event, next)
      state.lastSentAt = Date.now()
    }
    if (immediate || payload.phase !== 'move') {
      if (state.rafId !== null) {
        window.cancelAnimationFrame(state.rafId)
        state.rafId = null
        state.pending = null
      }
      flush(payload)
      return
    }
    if (Date.now() - state.lastSentAt >= 33) {
      flush(payload)
      return
    }
    state.pending = payload
    if (state.rafId !== null) return
    state.rafId = window.requestAnimationFrame(() => {
      state.rafId = null
      const pending = state.pending
      state.pending = null
      if (pending) flush(pending)
    })
  }
}

interface DesktopWindowProps {
  id: string
  title: React.ReactNode
  width: number
  height?: number
  defaultPosition: { x: number; y: number }
  zIndex?: number
  state?: 'open' | 'closing'
  windowClassName?: string
  bodyStyle?: React.CSSProperties
  bodyClassName?: string
  frameless?: boolean
  onFocus?: () => void
  onMinimize?: () => void
  onClose: () => void
  children: React.ReactNode
}

export function DesktopWindow({
  id,
  title,
  width,
  height,
  defaultPosition,
  zIndex = 60,
  state = 'open',
  windowClassName = '',
  bodyStyle,
  bodyClassName = '',
  frameless = false,
  onFocus,
  onMinimize,
  onClose,
  children,
}: DesktopWindowProps) {
  const rawDesktopConfig = useAppStore((store) => store.config.desktopConfig)
  const configPos = useAppStore((store) => store.config.applications.find((a) => a.id === id)?.windowPosition)
  const sizeOverride = useAppStore((store) => store.config.applications.find((a) => a.id === id)?.windowSize)
  const persistedAppTheme = useAppStore((store) => store.config.applications.find((a) => a.id === id)?.theme)
  const desktopConfig = withDesktopConfigDefaults(rawDesktopConfig)
  // Runtime event theme wins over persisted app theme
  const widgetTheme = desktopConfig.widgetThemes?.[id] ?? persistedAppTheme
  // Shape needs JS-side geometry, so resolve it against the global default too
  const effectiveWidgetTheme = widgetTheme ?? desktopConfig.globalThemeDefault.widgetTheme
  const shapeDef = getWidgetShapeDef(resolveWidgetShape(effectiveWidgetTheme))
  const isShapeClipped = isClippedShape(shapeDef)
  const windowSeed = hashString(id)
  const motionPhase = (windowSeed % 17) / 2
  const hueShift = (windowSeed % 9) - 4
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [opening, setOpening] = useState(true)
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })
  const resizing = useRef(false)
  const resizeStartPointer = useRef({ x: 0, y: 0 })
  const resizeStartSize = useRef({ width: width, height: height ?? 0 })
  const resolvedWidth = resolveWidth(sizeOverride?.width, width)
  const resolvedHeight = resolveHeight(sizeOverride?.height ?? height)
  const [liveSize, setLiveSize] = useState(() => ({ width: resolvedWidth, height: resolvedHeight }))
  const sizeRef = useRef(liveSize)
  const measureWindowHeight = () => frameRef.current?.offsetHeight ?? liveSize.height ?? height ?? 260
  const clampPosition = (nextPos: { x: number; y: number }, nextSize = sizeRef.current) => {
    return clampWindowPosition(nextPos, {
      width: nextSize.width,
      height: nextSize.height ?? measureWindowHeight(),
    })
  }
  const [pos, setPos] = useState(() => clampPosition(configPos ?? defaultPosition, liveSize))
  const posRef = useRef(pos)
  const dragBroadcastRef = useRef<BroadcastState<DesktopWidgetDragPayload>>({ lastSentAt: 0, rafId: null, pending: null })
  const resizeBroadcastRef = useRef<BroadcastState<DesktopWidgetResizePayload>>({ lastSentAt: 0, rafId: null, pending: null })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const emitWidgetDrag = useMemo(() => makeThrottledEmitter<DesktopWidgetDragPayload>('desktop:widget:drag', dragBroadcastRef), [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const emitWidgetResize = useMemo(() => makeThrottledEmitter<DesktopWidgetResizePayload>('desktop:widget:resize', resizeBroadcastRef), [])

  useEffect(() => {
    if (resizing.current) return
    const next = { width: resolvedWidth, height: resolvedHeight }
    setLiveSize(next)
    sizeRef.current = next
  }, [resolvedWidth, resolvedHeight])

  // Clipped silhouettes are generated in px, so auto-height windows need a
  // measured height; fixed-height windows read liveSize directly below.
  const [measuredFrame, setMeasuredFrame] = useState<{ width: number; height: number } | null>(null)
  useEffect(() => {
    if (!isShapeClipped) {
      setMeasuredFrame(null)
      return
    }
    const el = frameRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setMeasuredFrame({ width: el.offsetWidth, height: el.offsetHeight })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [isShapeClipped])

  useEffect(() => {
    if (dragging.current) return

    const next = clampPosition(configPos ?? defaultPosition)
    if (next.x === posRef.current.x && next.y === posRef.current.y) return

    setPos(next)
    posRef.current = next
  }, [configPos, defaultPosition.x, defaultPosition.y, liveSize.height, liveSize.width])

  useEffect(() => {
    const syncToViewport = () => {
      const next = clampPosition(posRef.current)
      if (next.x === posRef.current.x && next.y === posRef.current.y) return

      posRef.current = next
      setPos(next)
    }

    syncToViewport()
    window.addEventListener('resize', syncToViewport)
    return () => window.removeEventListener('resize', syncToViewport)
  }, [liveSize.height, liveSize.width])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragging.current) {
        const next = clampPosition({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y })
        posRef.current = next
        setPos(next)
        emitWidgetDrag({ widgetId: id, x: next.x, y: next.y, phase: 'move' })
      } else if (resizing.current) {
        const dx = e.clientX - resizeStartPointer.current.x
        const dy = e.clientY - resizeStartPointer.current.y
        const maxResizableHeight = Math.max(140, window.innerHeight - TASKBAR_HEIGHT_PX)
        const next = {
          width: clampDimension(resizeStartSize.current.width + dx, 180, 1400),
          height: clampDimension(resizeStartSize.current.height + dy, 140, maxResizableHeight),
        }
        sizeRef.current = next
        setLiveSize(next)

        const clampedPos = clampPosition(posRef.current, next)
        if (clampedPos.x !== posRef.current.x || clampedPos.y !== posRef.current.y) {
          posRef.current = clampedPos
          setPos(clampedPos)
        }

        emitWidgetResize({
          widgetId: id,
          x: posRef.current.x,
          y: posRef.current.y,
          width: next.width,
          height: next.height,
          phase: 'move',
        })
      }
    }
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false
        emitWidgetDrag({ widgetId: id, x: posRef.current.x, y: posRef.current.y, phase: 'end' }, true)
      }
      if (resizing.current) {
        resizing.current = false
        emitWidgetResize({
          widgetId: id,
          x: posRef.current.x,
          y: posRef.current.y,
          width: sizeRef.current.width,
          height: sizeRef.current.height ?? resizeStartSize.current.height,
          phase: 'end',
        }, true)
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [id])

  const handleTitleMouseDown = (e: React.MouseEvent) => {
    onFocus?.()
    dragging.current = true
    offset.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y }
    emitWidgetDrag({ widgetId: id, x: posRef.current.x, y: posRef.current.y, phase: 'start' }, true)
    e.preventDefault()
  }

  useEffect(() => {
    return () => {
      const broadcastState = dragBroadcastRef.current
      if (broadcastState.rafId !== null) {
        window.cancelAnimationFrame(broadcastState.rafId)
      }

      const resizeBroadcastState = resizeBroadcastRef.current
      if (resizeBroadcastState.rafId !== null) {
        window.cancelAnimationFrame(resizeBroadcastState.rafId)
      }
    }
  }, [])

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    onFocus?.()
    resizing.current = true
    resizeStartPointer.current = { x: e.clientX, y: e.clientY }
    resizeStartSize.current = {
      width: sizeRef.current.width,
      height: sizeRef.current.height ?? frameRef.current?.offsetHeight ?? height ?? 260,
    }
    emitWidgetResize({
      widgetId: id,
      x: posRef.current.x,
      y: posRef.current.y,
      width: resizeStartSize.current.width,
      height: resizeStartSize.current.height,
      phase: 'start',
    }, true)
    e.preventDefault()
    e.stopPropagation()
  }

  // Fixed-height windows derive geometry from liveSize (fresher during a
  // resize drag); auto-height windows wait for the ResizeObserver measurement.
  const shapeGeometry = liveSize.height
    ? { width: liveSize.width, height: liveSize.height }
    : measuredFrame
  const shapeClipPath = isClippedShape(shapeDef) && shapeGeometry
    ? buildShapeClipPath(shapeDef, shapeGeometry.width, shapeGeometry.height)
    : undefined

  const titleInset = resolveTitleInset(shapeDef, liveSize.width)
  const resizeHandleOffset = shapeDef?.resizeHandle ?? { right: 2, bottom: 2 }

  const frame = (
    <div
      ref={frameRef}
      className={`window desktop-window${opening ? ' desktop-window--opening' : ''} desktop-window--${state}${isShapeClipped ? ' desktop-window--shaped' : ''}${frameless ? ' desktop-window--frameless' : ''} ${windowClassName}`.trim()}
      onAnimationEnd={() => setOpening(false)}
      style={{
        position: 'relative',
        width: '100%',
        height: liveSize.height ? '100%' : undefined,
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        boxShadow: frameless || isShapeClipped ? 'none' : 'var(--widget-shell-shadow-drop, 4px 4px 0 #000)',
        clipPath: shapeClipPath,
        borderRadius: shapeDef?.kind === 'radius' ? shapeDef.borderRadius : undefined,
        ['--widget-phase' as string]: `${motionPhase}s`,
        ['--widget-hue-shift' as string]: `${hueShift}deg`,
      }}
      onMouseDown={frameless ? handleTitleMouseDown : onFocus}
      data-widget-id={id}
    >
      {!frameless && (
        <div
          className="title-bar desktop-window-title"
          style={{
            cursor: 'move',
            ...(titleInset?.top !== undefined ? { paddingTop: titleInset.top } : {}),
            ...(titleInset?.left !== undefined ? { paddingLeft: titleInset.left } : {}),
            ...(titleInset?.right !== undefined ? { paddingRight: titleInset.right } : {}),
          }}
          onMouseDown={handleTitleMouseDown}
          data-widget-title-bar="true"
        >
          <div className="title-bar-text">{title}</div>
          <div className="title-bar-controls">
            <button aria-label="Minimize" onClick={onMinimize} />
            <button aria-label="Maximize" />
            <button aria-label="Close" onClick={onClose} />
          </div>
        </div>
      )}
      <div
        className={`window-body desktop-window-body ${bodyClassName}`.trim()}
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
        data-widget-resize-handle="true"
        style={{
          position: 'absolute',
          right: resizeHandleOffset.right,
          bottom: resizeHandleOffset.bottom,
          width: 12,
          height: 12,
          cursor: 'nwse-resize',
          zIndex: 4,
          background: 'var(--widget-resize-handle, linear-gradient(135deg, transparent 0%, transparent 35%, #4f4f4f 35%, #4f4f4f 55%, #bfbfbf 55%, #bfbfbf 75%, #4f4f4f 75%, #4f4f4f 100%))',
        }}
      />
      {isClippedShape(shapeDef) && shapeGeometry ? (
        <ShapeChrome def={shapeDef} width={shapeGeometry.width} height={shapeGeometry.height} />
      ) : null}
    </div>
  )

  return (
    <div
      className={widgetTheme ? buildWidgetThemeScopeClassNames(widgetTheme) : undefined}
      style={widgetTheme ? buildWidgetThemeVars(widgetTheme) : undefined}
    >
      {/*
        Positioner carries placement and the silhouette drop shadow. The shadow
        must live on a parent of the clipped frame: filter + clip-path on the
        same element clips the shadow away.
      */}
      <div
        style={{
          position: 'absolute',
          left: pos.x,
          top: pos.y,
          width: liveSize.width,
          height: liveSize.height,
          zIndex,
          filter: isShapeClipped
            ? 'drop-shadow(4px 5px calc(var(--widget-shadow-scale, 1) * 10px) rgba(0, 0, 0, 0.42))'
            : undefined,
        }}
      >
        {frame}
      </div>
    </div>
  )
}