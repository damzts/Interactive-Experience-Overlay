import { useRef } from 'react'
import type { Application, DesktopIconAnimation } from '@ieomlabs/shared'
import { AppGlyph } from './AppGlyph'

type IconSize = NonNullable<Application['iconSize']>

interface AppIconProps {
  app: Application
  selected: boolean
  /** Resolved absolute position — precomputed by Desktop (grid or manual). */
  position?: { x: number; y: number }
  size?: IconSize
  animationMode?: DesktopIconAnimation
  motionAmount?: number
  animationSeed?: number
  reactive?: boolean
  draggable?: boolean
  dragging?: boolean
  onSelect: () => void
  onLaunch: () => void
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void
  consumeClickSuppression?: () => boolean
  onContextMenu: (e: React.MouseEvent) => void
}

const ICON_SIZE: Record<string, number> = { small: 24, normal: 32, large: 40 }

export function AppIcon({
  app,
  selected,
  position,
  size,
  animationMode = 'none',
  motionAmount = 0.45,
  animationSeed = 0,
  reactive = false,
  draggable = false,
  dragging = false,
  onSelect,
  onLaunch,
  onMouseDown,
  consumeClickSuppression,
  onContextMenu,
}: AppIconProps) {
  const lastClickTime = useRef(0)
  const launchable = true
  const resolvedSize = size ?? 'normal'
  const motionStrength = Math.max(0, Math.min(3, motionAmount))

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (consumeClickSuppression?.()) return
    const now = Date.now()
    if (launchable && now - lastClickTime.current < 350) {
      lastClickTime.current = 0
      onLaunch()
    } else {
      lastClickTime.current = now
      onSelect()
    }
  }

  const emojiSize = ICON_SIZE[resolvedSize] ?? 32
  const pos = position ?? app.iconPosition

  const style: React.CSSProperties & Record<string, string | number> = pos
    ? { position: 'absolute', left: pos.x, top: pos.y }
    : {}
  style['--icon-phase'] = `${(animationSeed % 12) * 0.45}s`
  style['--icon-motion-opacity'] = (1 - motionStrength * 0.28).toFixed(2)
  style['--icon-motion-offset'] = `${(motionStrength * 8).toFixed(2)}px`
  style['--icon-motion-jiggle'] = `${(motionStrength * 1.6).toFixed(2)}deg`
  style['--icon-motion-scale'] = (1 + motionStrength * 0.08).toFixed(3)
  style['--icon-motion-reactive-lift'] = `${(motionStrength * 3).toFixed(2)}px`
  style['--icon-motion-reactive-brightness'] = (1 + motionStrength * 0.25).toFixed(2)
  style['--icon-motion-drift-x'] = `${(motionStrength * 6).toFixed(2)}px`
  style['--icon-motion-orbit-x'] = `${(motionStrength * 7).toFixed(2)}px`
  style['--icon-motion-orbit-y'] = `${(motionStrength * 5).toFixed(2)}px`

  return (
    <div
      className={[
        'app-icon',
        `app-icon--size-${resolvedSize}`,
        `app-icon--anim-${animationMode}`,
        selected ? 'app-icon--selected' : '',
        reactive ? 'app-icon--reactive' : '',
        draggable ? 'app-icon--draggable' : '',
        dragging ? 'app-icon--dragging' : '',
      ].filter(Boolean).join(' ')}
      style={style}
      draggable={false}
      onClick={handleClick}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      title={launchable ? `${app.label} — double-click to open` : app.label}
    >
      <AppGlyph icon={app.icon} label={app.label} size={emojiSize} className="app-icon-emoji" />
      <span className="app-icon-label">{app.label}</span>
    </div>
  )
}
