import { useRef } from 'react'
import type { Application } from '@ieom/shared'

interface AppIconProps {
  app: Application
  selected: boolean
  onSelect: () => void
  onLaunch: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

const ICON_SIZE: Record<string, number> = { small: 24, normal: 32, large: 40 }

export function AppIcon({ app, selected, onSelect, onLaunch, onContextMenu }: AppIconProps) {
  const lastClickTime = useRef(0)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const now = Date.now()
    if (now - lastClickTime.current < 350) {
      lastClickTime.current = 0
      onLaunch()
    } else {
      lastClickTime.current = now
      onSelect()
    }
  }

  const emojiSize = ICON_SIZE[app.iconSize ?? 'normal'] ?? 32
  const pos = app.iconPosition

  const style: React.CSSProperties = pos
    ? { position: 'absolute', left: pos.x, top: pos.y }
    : {}

  return (
    <div
      className={`app-icon app-icon--size-${app.iconSize ?? 'normal'}${selected ? ' app-icon--selected' : ''}`}
      style={style}
      onClick={handleClick}
      onContextMenu={onContextMenu}
      title={`${app.label} — double-click to open`}
    >
      <span
        className="app-icon-emoji"
        role="img"
        aria-label={app.label}
        style={{ fontSize: emojiSize }}
      >
        {app.icon}
      </span>
      <span className="app-icon-label">{app.label}</span>
    </div>
  )
}
