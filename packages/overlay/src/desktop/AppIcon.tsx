import { useRef } from 'react'
import type { Application } from '@ieom/shared'

interface AppIconProps {
  app: Application
  selected: boolean
  onSelect: () => void
  onLaunch: () => void
}

export function AppIcon({ app, selected, onSelect, onLaunch }: AppIconProps) {
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

  return (
    <div
      className={`app-icon${selected ? ' app-icon--selected' : ''}`}
      onClick={handleClick}
      title={`${app.label} — double-click to open`}
    >
      <span className="app-icon-emoji" role="img" aria-label={app.label}>
        {app.icon}
      </span>
      <span className="app-icon-label">{app.label}</span>
    </div>
  )
}
