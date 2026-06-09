import type { Application } from '@ieomlabs/shared'
import './styles/context-menu.css'

interface ContextMenu {
  x: number
  y: number
  type: 'desktop' | 'icon'
  app?: Application
}

interface ContextMenuSystemProps {
  contextMenu: ContextMenu | null
  autoArrangeIcons: boolean
  onArrangeIcons: () => void
  onToggleAutoArrange: () => void
  onResetIconLayout: () => void
  onResetWidgetWindows: () => void
  onLaunch: (app: Application) => void
  onClose: () => void
}

export function ContextMenuSystem({
  contextMenu,
  autoArrangeIcons,
  onArrangeIcons,
  onToggleAutoArrange,
  onResetIconLayout,
  onResetWidgetWindows,
  onLaunch,
  onClose,
}: ContextMenuSystemProps) {
  if (!contextMenu) return null

  const iconMenuLaunchable = !!contextMenu.app

  return (
    <div
      className="context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {contextMenu.type === 'desktop' ? (
        <>
          <button className="context-menu-item" onClick={() => { onArrangeIcons(); onClose() }}>Arrange Icons</button>
          <button className="context-menu-item" onClick={() => { onToggleAutoArrange(); onClose() }}>
            {autoArrangeIcons ? 'Disable Auto Arrange' : 'Enable Auto Arrange'}
          </button>
          <button className="context-menu-item" onClick={onClose}>Refresh</button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={() => { onResetIconLayout(); onClose() }}>Reset Icon Layout</button>
          <button className="context-menu-item" onClick={() => { onResetWidgetWindows(); onClose() }}>Reset Widget Windows</button>
          <div className="context-menu-separator" />
          <button className="context-menu-item context-menu-item--disabled">Properties</button>
        </>
      ) : (
        <>
          <button
            className={`context-menu-item context-menu-item--bold${iconMenuLaunchable ? '' : ' context-menu-item--disabled'}`}
            onClick={() => { if (contextMenu.app && iconMenuLaunchable) { onLaunch(contextMenu.app); onClose() } }}
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
  )
}

export type { ContextMenu }
