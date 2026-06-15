import type { Application, DesktopStartMenuRoot, DesktopStartMenuSimulationPhasePayload } from '@ieomlabs/shared'
import { STATE } from '@ieomlabs/shared'
import { AppGlyph } from './AppGlyph'
import { socket } from '../socket/client'
import { useAppStore } from '../store/useAppStore'
import './styles/start-menu.css'

interface StartMenuProps {
  open: boolean
  activeRoot: DesktopStartMenuRoot
  simulationPhase: DesktopStartMenuSimulationPhasePayload | null
  launchableApps: Application[]
  onEmitState: (open: boolean, activeRoot: DesktopStartMenuRoot) => void
  onLaunch: (app: Application) => void
  onClose: () => void
}

export function StartMenu({
  open,
  activeRoot,
  simulationPhase,
  launchableApps,
  onEmitState,
  onLaunch,
  onClose,
}: StartMenuProps) {
  const config = useAppStore((s) => s.config)

  if (!open) return null

  const simProgramsOpen = simulationPhase?.phase === 'programs-open'
    || simulationPhase?.phase === 'target-hover'
    || simulationPhase?.phase === 'target-select'
  const simProgramsHover = simulationPhase?.phase === 'programs-hover'
  const simTargetAppId = simulationPhase?.targetAppId
  const simTargetHover = simulationPhase?.phase === 'target-hover' || simulationPhase?.phase === 'target-select'

  const widgetApps = launchableApps.filter(
    (app) => app.widgetComponent !== undefined || app.widgetSource !== undefined,
  )
  const layouts = (config.widgetLayouts ?? []).filter((l) => l.source === 'user')
  const customScenes = Object.values(config.scenes ?? {}).filter(
    (s) => s.id !== STATE.LOBBY && s.id !== STATE.DESKTOP,
  )

  return (
    <div className="start-menu" onMouseDown={(e) => e.stopPropagation()}>
      <div className="start-menu-banner">
        <span className="start-menu-banner-text">IEOM</span>
      </div>
      <div
        className="start-menu-items"
        onMouseLeave={() => onEmitState(true, null)}
      >
        {/* Programs */}
        <div
          className={`start-menu-item start-menu-item--has-sub${activeRoot === 'programs' || simProgramsOpen ? ' start-menu-item--sim-open' : ''}${simProgramsHover ? ' start-menu-item--sim-hover' : ''}`}
          onMouseEnter={() => onEmitState(true, 'programs')}
        >
          <span className="start-menu-item-icon">📂</span>
          <span className="start-menu-item-label">Programs</span>
          <span className="start-menu-item-arrow">▶</span>
          <div className="start-menu-sub">
            {widgetApps.length === 0 && (
              <div className="start-menu-sub-empty">No widgets</div>
            )}
            {widgetApps.map((app) => (
              <button
                key={app.id}
                className={`start-menu-sub-item${simTargetHover && simTargetAppId === app.id ? ' start-menu-sub-item--sim-hover' : ''}`}
                data-start-app-id={app.id}
                data-start-app-label={app.label}
                onClick={() => onLaunch(app)}
              >
                <AppGlyph icon={app.icon} label={app.label} size={16} />
                <span>{app.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Layouts */}
        <div
          className={`start-menu-item start-menu-item--has-sub${activeRoot === 'layouts' ? ' start-menu-item--sim-open' : ''}`}
          onMouseEnter={() => onEmitState(true, 'layouts')}
        >
          <span className="start-menu-item-icon">📐</span>
          <span className="start-menu-item-label">Layouts</span>
          <span className="start-menu-item-arrow">▶</span>
          <div className="start-menu-sub">
            {layouts.length === 0 && (
              <div className="start-menu-sub-empty">No layouts</div>
            )}
            {layouts.map((layout) => (
              <button
                key={layout.id}
                className="start-menu-sub-item"
                onClick={() => { socket.emit('widget:layout:apply', layout.id); onClose() }}
              >
                <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>{layout.icon || '📐'}</span>
                <span>{layout.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scenes */}
        <div
          className={`start-menu-item start-menu-item--has-sub${activeRoot === 'scenes' ? ' start-menu-item--sim-open' : ''}`}
          onMouseEnter={() => onEmitState(true, 'scenes')}
        >
          <span className="start-menu-item-icon">🎬</span>
          <span className="start-menu-item-label">Scenes</span>
          <span className="start-menu-item-arrow">▶</span>
          <div className="start-menu-sub">
            <button className="start-menu-sub-item"
              onClick={() => { socket.emit('scene:change', STATE.LOBBY); onClose() }}>
              <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>🌐</span>
              <span>Lobby</span>
            </button>
            <button className="start-menu-sub-item"
              onClick={() => { socket.emit('scene:change', STATE.DESKTOP); onClose() }}>
              <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>🖥</span>
              <span>Desktop</span>
            </button>
            {customScenes.map((scene) => (
              <button key={scene.id} className="start-menu-sub-item"
                onClick={() => { socket.emit('scene:change', scene.id as unknown as STATE); onClose() }}>
                <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>🎬</span>
                <span>{scene.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
