import type { Application } from '@ieom/shared'

interface AppIconProps {
  app: Application
  onDoubleClick: () => void
}

export function AppIcon({ app, onDoubleClick }: AppIconProps) {
  return (
    <div className="app-icon" onDoubleClick={onDoubleClick} title={app.label}>
      <span className="app-icon-emoji" role="img" aria-label={app.label}>
        {app.icon}
      </span>
      <span className="app-icon-label">{app.label}</span>
    </div>
  )
}
