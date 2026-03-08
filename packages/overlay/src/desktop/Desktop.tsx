import { useState } from 'react'
import { socket } from '../socket/client'
import { STATE } from '@ieom/shared'
import type { Application } from '@ieom/shared'
import { AppIcon } from './AppIcon'
import { Taskbar } from './Taskbar'

interface DesktopProps {
  apps: Application[]
}

export function Desktop({ apps }: DesktopProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleLaunch = (app: Application) => {
    socket.emit('scene:change', app.targetSceneId as STATE)
    setSelectedId(null)
  }

  return (
    <div className="desktop" onMouseDown={() => setSelectedId(null)}>
      <div className="desktop-icons" onMouseDown={(e) => e.stopPropagation()}>
        {apps.map((app) => (
          <AppIcon
            key={app.id}
            app={app}
            selected={selectedId === app.id}
            onSelect={() => setSelectedId(app.id)}
            onLaunch={() => handleLaunch(app)}
          />
        ))}
      </div>
      <Taskbar />
    </div>
  )
}
