import { useRef } from 'react'
import type { Application, DesktopIconAnimation } from '@ieom/shared'
import { AppGlyph } from './AppGlyph'

interface AppIconProps {
  app: Application
  selected: boolean
  /** Resolved absolute position — precomputed by Desktop (grid or manual). */
  position?: { x: number; y: number }
  animationMode?: DesktopIconAnimation
  animationSeed?: number
  reactive?: boolean
  onSelect: () => void
  onLaunch: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

const ICON_SIZE: Record<string, number> = { small: 24, normal: 32, large: 40 }

export function AppIcon({
  app,
  selected,
  position,
  animationMode = 'none',
  animationSeed = 0,
  reactive = false,
  onSelect,
  onLaunch,
  onContextMenu,
}: AppIconProps) {
  const lastClickTime = useRef(0)
  const launchable = app.appType === 'scene' || app.appType === 'widget'

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const now = Date.now()
    if (launchable && now - lastClickTime.current < 350) {
      lastClickTime.current = 0
      onLaunch()
    } else {
      lastClickTime.current = now
      onSelect()
    }
  }

  const emojiSize = ICON_SIZE[app.iconSize ?? 'normal'] ?? 32
  const pos = position ?? app.iconPosition

  const style: React.CSSProperties & Record<string, string | number> = pos
    ? { position: 'absolute', left: pos.x, top: pos.y }
    : {}
  style['--icon-phase'] = `${(animationSeed % 12) * 0.45}s`

  return (
    <div
      className={[
        'app-icon',
        `app-icon--size-${app.iconSize ?? 'normal'}`,
        `app-icon--anim-${animationMode}`,
        selected ? 'app-icon--selected' : '',
        reactive ? 'app-icon--reactive' : '',
        app.appType === 'decoration' ? 'app-icon--decoration' : '',
      ].filter(Boolean).join(' ')}
      style={style}
      onClick={handleClick}
      onContextMenu={onContextMenu}
      title={launchable ? `${app.label} — double-click to open` : app.label}
    >
      <AppGlyph icon={app.icon} label={app.label} size={emojiSize} className="app-icon-emoji" />
      <span className="app-icon-label">{app.label}</span>
    </div>
  )
}
