import { socket } from '../socket/client'
import { STATE } from '@ieom/shared'
import type { Application } from '@ieom/shared'
import { AppIcon } from './AppIcon'
import { Taskbar } from './Taskbar'

interface DesktopProps {
  apps: Application[]
}

export function Desktop({ apps }: DesktopProps) {
  const handleLaunch = (app: Application) => {
    socket.emit('scene:change', app.targetSceneId as STATE)
  }

  return (
    <div className="desktop">
      <div className="desktop-icons">
        {apps.map((app) => (
          <AppIcon key={app.id} app={app} onDoubleClick={() => handleLaunch(app)} />
        ))}
      </div>
      <Taskbar />
    </div>
  )
}
