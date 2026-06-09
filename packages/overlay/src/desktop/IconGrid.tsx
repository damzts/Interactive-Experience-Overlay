import type { Application, DesktopConfig } from '@ieomlabs/shared'
import { AppIcon } from './AppIcon'

type IconSize = NonNullable<Application['iconSize']>

interface IconGridProps {
  apps: Application[]
  selectedId: string | null
  draggingId: string | null
  autoArrangeIcons: boolean
  defaultIconSize: IconSize
  iconAnimation: DesktopConfig['iconAnimation']
  iconMotion: number
  reactiveIconId: string | null
  resolveIconPosition: (app: Application) => { x: number; y: number } | undefined
  resolveIconSize: (app: Application) => IconSize
  onSelect: (appId: string) => void
  onLaunch: (app: Application) => void
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>, app: Application) => void
  onContextMenu: (e: React.MouseEvent, app: Application) => void
  consumeClickSuppression: () => boolean
  closeMenus: () => void
}

export function IconGrid({
  apps,
  selectedId,
  draggingId,
  autoArrangeIcons,
  defaultIconSize,
  iconAnimation,
  iconMotion,
  reactiveIconId,
  resolveIconPosition,
  resolveIconSize,
  onSelect,
  onLaunch,
  onMouseDown,
  onContextMenu,
  consumeClickSuppression,
  closeMenus,
}: IconGridProps) {
  return (
    <div className="desktop-icons" onMouseDown={(e) => e.stopPropagation()}>
      {apps.map((app, index) => {
        const resolvedPos = resolveIconPosition(app)
        const resolvedSize = resolveIconSize(app)
        return (
          <AppIcon
            key={app.id}
            app={app}
            position={resolvedPos}
            size={resolvedSize}
            selected={selectedId === app.id}
            animationMode={iconAnimation}
            motionAmount={iconMotion}
            animationSeed={index}
            reactive={iconAnimation === 'reactive' && reactiveIconId === app.id}
            draggable={!autoArrangeIcons}
            dragging={draggingId === app.id}
            onSelect={() => { onSelect(app.id); closeMenus() }}
            onLaunch={() => onLaunch(app)}
            onMouseDown={(event) => onMouseDown(event, app)}
            consumeClickSuppression={consumeClickSuppression}
            onContextMenu={(e) => onContextMenu(e, app)}
          />
        )
      })}
    </div>
  )
}
