import { useState, useCallback, useRef } from 'react'
import { socket } from '../socket/client'
import { STATE } from '@ieom/shared'
import type { Application, OverlayBackground } from '@ieom/shared'
import { useAppStore } from '../store/useAppStore'
import { AppIcon } from './AppIcon'
import { Taskbar } from './Taskbar'
import { ScreenSaver } from './ScreenSaver'
import { MusicWidget } from './MusicWidget'
import { ArchiveWidget } from './ArchiveWidget'
import { ChatWidget } from './ChatWidget'

/** Maps widget app IDs to their component. Add new widgets here. */
const WIDGET_COMPONENTS: Record<string, React.ComponentType<{ onClose: () => void }>> = {
  music:   MusicWidget,
  archive: ArchiveWidget,
  spotify: MusicWidget,
  chat:    ChatWidget,
}

interface ContextMenu {
  x: number
  y: number
  type: 'desktop' | 'icon'
  app?: Application
}

interface DesktopProps {
  apps: Application[]
}

/** Convert the background config to a CSS background shorthand */
function bgToCss(bg: OverlayBackground): React.CSSProperties {
  switch (bg.type) {
    case 'color':
      return { backgroundColor: bg.color }
    case 'gradient':
      return { background: bg.gradient }
    case 'image-url':
      return {
        backgroundImage: `url("${bg.imageUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    case 'video-url':
    case 'pattern':
    case 'none':
    default:
      // These types are handled by BackgroundLayer (behind the desktop canvas),
      // or are intentionally transparent for camera pass-through.
      return { background: 'transparent' }
  }
}

/** Fallback draggable window for any widget ID not registered in WIDGET_COMPONENTS */
function GenericWidget({ app, onClose }: { app: Application; onClose: () => void }) {
  const [pos, setPos] = useState({ x: 80, y: 120 })
  const dragging = useRef(false)
  const offset   = useRef({ x: 0, y: 0 })
  const posRef   = useRef(pos)

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    offset.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y }
    const onMove = (me: MouseEvent) => {
      if (!dragging.current) return
      const next = { x: me.clientX - offset.current.x, y: me.clientY - offset.current.y }
      posRef.current = next
      setPos(next)
    }
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      style={{
        position: 'absolute', left: pos.x, top: pos.y,
        width: 260, zIndex: 100,
        background: '#c0c0c0',
        border: '2px solid',
        borderColor: '#ffffff #808080 #808080 #ffffff',
        boxShadow: '2px 2px 0 #000',
        fontFamily: 'MS Sans Serif, Arial, sans-serif',
        fontSize: 12,
      }}
    >
      {/* Title bar */}
      <div
        onMouseDown={onMouseDown}
        style={{
          background: 'linear-gradient(90deg,#000080,#1084d0)',
          padding: '2px 4px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'move', userSelect: 'none',
        }}
      >
        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>
          {app.icon} {app.label}
        </span>
        <button
          onClick={onClose}
          style={{
            background: '#c0c0c0', border: '1px solid', borderColor: '#fff #808080 #808080 #fff',
            width: 16, height: 14, fontSize: 10, lineHeight: '12px',
            cursor: 'pointer', padding: 0, fontWeight: 'bold',
          }}
        >✕</button>
      </div>
      {/* Body */}
      <div style={{ padding: '12px 16px', color: '#000080', textAlign: 'center' }}>
        <div style={{ fontSize: 28 }}>{app.icon}</div>
        <div style={{ marginTop: 6, fontWeight: 'bold' }}>{app.label}</div>
        <div style={{ marginTop: 4, fontSize: 10, color: '#666' }}>Widget — no component registered for id: {app.id}</div>
      </div>
    </div>
  )
}

export function Desktop({ apps }: DesktopProps) {
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [startMenuOpen, setStartMenuOpen] = useState(false)
  const [contextMenu, setContextMenu]     = useState<ContextMenu | null>(null)

  const openWidgets  = useAppStore((s) => s.openWidgets)
  const toggleWidget = useAppStore((s) => s.toggleWidget)

  const desktopRef = useRef<HTMLDivElement>(null)

  const config = useAppStore((s) => s.config)
  const desktopStyle = (config.scenes[STATE.DESKTOP] as { style?: { background?: OverlayBackground } } | undefined)
    ?.style?.background

  const wallpaperStyle = desktopStyle ? bgToCss(desktopStyle) : { background: 'transparent' }

  const ss = config.desktopConfig?.screenSaver

  const handleLaunch = (app: Application) => {
    setSelectedId(null)
    setStartMenuOpen(false)

    // Widgets are floating windows — toggle open/closed, no state change.
    if (app.appType === 'widget') { toggleWidget(app.id); return }
    if (app.appType !== 'scene') return

    if (app.launchPipeline && app.launchPipeline.effects.length > 0) {
      socket.emit('overlay:trigger', {
        id: `launch-${app.id}`,
        effects: app.launchPipeline.effects,
      })
      setTimeout(() => {
        socket.emit('scene:change', app.targetSceneId as STATE)
      }, app.launchPipeline.delayMs)
    } else {
      socket.emit('scene:change', app.targetSceneId as STATE)
    }
  }

  const handleDesktopMouseDown = () => {
    setSelectedId(null)
    setStartMenuOpen(false)
    setContextMenu(null)
  }

  const handleDesktopContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setStartMenuOpen(false)
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'desktop' })
  }

  const handleIconContextMenu = useCallback((e: React.MouseEvent, app: Application) => {
    e.preventDefault()
    e.stopPropagation()
    setStartMenuOpen(false)
    const rect = (desktopRef.current ?? document.body).getBoundingClientRect()
    setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, type: 'icon', app })
  }, [])

  const closeMenus = () => {
    setStartMenuOpen(false)
    setContextMenu(null)
  }

  return (
    <div
      ref={desktopRef}
      className="desktop"
      style={wallpaperStyle}
      onMouseDown={handleDesktopMouseDown}
      onContextMenu={handleDesktopContextMenu}
    >
      {/* Desktop icon canvas */}
      <div className="desktop-icons" onMouseDown={(e) => e.stopPropagation()}>
        {apps.map((app) => (
          <AppIcon
            key={app.id}
            app={app}
            selected={selectedId === app.id}
            onSelect={() => { setSelectedId(app.id); closeMenus() }}
            onLaunch={() => handleLaunch(app)}
            onContextMenu={(e) => handleIconContextMenu(e, app)}
          />
        ))}
      </div>

      {/* Start Menu */}
      {startMenuOpen && (
        <div className="start-menu" onMouseDown={(e) => e.stopPropagation()}>
          <div className="start-menu-banner">
            <span className="start-menu-banner-text">IEOM</span>
          </div>
          <div className="start-menu-items">
            {/* Programs sub-list */}
            <div className="start-menu-item start-menu-item--has-sub">
              <span className="start-menu-item-icon">📂</span>
              <span className="start-menu-item-label">Programs</span>
              <span className="start-menu-item-arrow">▶</span>
              <div className="start-menu-sub">
                {apps.map((app) => (
                  <button
                    key={app.id}
                    className="start-menu-sub-item"
                    onClick={() => handleLaunch(app)}
                  >
                    <span>{app.icon}</span>
                    <span>{app.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="start-menu-separator" />

            <button
              className="start-menu-item"
              onClick={() => { socket.emit('scene:change', STATE.LOBBY); closeMenus() }}
            >
              <span className="start-menu-item-icon">🖥</span>
              <span className="start-menu-item-label">LOBBY</span>
            </button>

            <div className="start-menu-separator" />

            <button
              className="start-menu-item start-menu-item--danger"
              onClick={() => { socket.emit('panic'); closeMenus() }}
            >
              <span className="start-menu-item-icon">🔴</span>
              <span className="start-menu-item-label">PANIC</span>
            </button>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'desktop' ? (
            <>
              <button className="context-menu-item context-menu-item--disabled">Arrange Icons</button>
              <button className="context-menu-item" onClick={closeMenus}>Refresh</button>
              <div className="context-menu-separator" />
              <button className="context-menu-item context-menu-item--disabled">New Folder</button>
              <div className="context-menu-separator" />
              <button className="context-menu-item context-menu-item--disabled">Properties</button>
            </>
          ) : (
            <>
              <button
                className="context-menu-item context-menu-item--bold"
                onClick={() => { if (contextMenu.app) handleLaunch(contextMenu.app) }}
              >
                Open
              </button>
              <div className="context-menu-separator" />
              <button className="context-menu-item context-menu-item--disabled">Create Shortcut</button>
              <button className="context-menu-item context-menu-item--disabled">Delete</button>
              <button className="context-menu-item context-menu-item--disabled">Rename</button>
              <div className="context-menu-separator" />
              <button className="context-menu-item context-menu-item--disabled">Properties</button>
            </>
          )}
        </div>
      )}

      <Taskbar
        startMenuOpen={startMenuOpen}
        onStartClick={() => { setStartMenuOpen((o) => !o); setContextMenu(null) }}
      />

      {/* Screen saver — activates after idle timeout if enabled */}
      {ss && (
        <ScreenSaver
          enabled={ss.enabled}
          timeoutMinutes={ss.timeoutMinutes}
          preset={ss.preset}
        />
      )}

      {/* Widget windows — rendered above desktop content (z=50 within desktop stacking context) */}
      {apps.filter((a) => a.appType === 'widget' && openWidgets.has(a.id)).map((a) => {
        const WidgetComp = WIDGET_COMPONENTS[a.id]
        if (WidgetComp) return <WidgetComp key={a.id} onClose={() => toggleWidget(a.id)} />
        return <GenericWidget key={a.id} app={a} onClose={() => toggleWidget(a.id)} />
      })}
    </div>
  )
}
