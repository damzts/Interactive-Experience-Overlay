import { useState, useCallback, useRef } from 'react'
import { socket } from '../socket/client'
import { STATE } from '@ieom/shared'
import type { Application, OverlayBackground } from '@ieom/shared'
import { useAppStore } from '../store/useAppStore'
import { AppIcon } from './AppIcon'
import { Taskbar } from './Taskbar'
import { ScreenSaver } from './ScreenSaver'

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

export function Desktop({ apps }: DesktopProps) {
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [startMenuOpen, setStartMenuOpen] = useState(false)
  const [contextMenu, setContextMenu]     = useState<ContextMenu | null>(null)
  const desktopRef = useRef<HTMLDivElement>(null)

  const config = useAppStore((s) => s.config)
  const desktopStyle = (config.scenes[STATE.DESKTOP] as { style?: { background?: OverlayBackground } } | undefined)
    ?.style?.background

  const wallpaperStyle = desktopStyle ? bgToCss(desktopStyle) : { background: 'transparent' }

  const ss = config.desktopConfig?.screenSaver

  const handleLaunch = (app: Application) => {
    setSelectedId(null)
    setStartMenuOpen(false)

    // Widgets do not change state — they are floating windows on top of the current scene.
    // Only 'scene' apps emit scene:change and may play a launchPipeline.
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
    </div>
  )
}
