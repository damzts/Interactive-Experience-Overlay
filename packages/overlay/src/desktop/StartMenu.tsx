import type { Application, DesktopStartMenuRoot, DesktopStartMenuSimulationPhasePayload, WidgetLayoutDefinition } from '@ieomlabs/shared'
import { STATE } from '@ieomlabs/shared'
import { AppGlyph } from './AppGlyph'
import { socket } from '../socket/client'
import './styles/start-menu.css'

interface StartMenuProps {
  open: boolean
  activeRoot: DesktopStartMenuRoot
  simulationPhase: DesktopStartMenuSimulationPhasePayload | null
  launchableApps: Application[]
  widgetLayouts: WidgetLayoutDefinition[]
  widgetAppById: Map<string, Application>
  sourceCenterToggleLayoutId: string
  onEmitState: (open: boolean, activeRoot: DesktopStartMenuRoot) => void
  onLaunch: (app: Application) => void
  onApplyLayout: (layoutId: string) => void
  onClose: () => void
}

export function StartMenu({
  open,
  activeRoot,
  simulationPhase,
  launchableApps,
  widgetLayouts,
  widgetAppById,
  sourceCenterToggleLayoutId,
  onEmitState,
  onLaunch,
  onApplyLayout,
  onClose,
}: StartMenuProps) {
  if (!open) return null

  const simProgramsOpen = simulationPhase?.phase === 'programs-open'
    || simulationPhase?.phase === 'target-hover'
    || simulationPhase?.phase === 'target-select'
  const simProgramsHover = simulationPhase?.phase === 'programs-hover'
  const simTargetAppId = simulationPhase?.targetAppId
  const simTargetHover = simulationPhase?.phase === 'target-hover' || simulationPhase?.phase === 'target-select'

  const systemLayouts = widgetLayouts.filter((l) => l.source === 'system')
  const userLayouts = widgetLayouts.filter((l) => l.source === 'user')
  const orderedLayouts = [...systemLayouts, ...userLayouts]

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
            {launchableApps.map((app) => (
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

        {/* Widget Layouts */}
        <div
          className={`start-menu-item start-menu-item--has-sub${activeRoot === 'widget-layouts' ? ' start-menu-item--sim-open' : ''}`}
          onMouseEnter={() => onEmitState(true, 'widget-layouts')}
        >
          <span className="start-menu-item-icon">📐</span>
          <span className="start-menu-item-label">Widget Layouts</span>
          <span className="start-menu-item-arrow">▶</span>
          <div className="start-menu-sub">
            {orderedLayouts.map((layout) => {
              const enabledWidgets = layout.items
                .filter((item) => item.enabled)
                .map((item) => widgetAppById.get(item.widgetId))
                .filter((app): app is Application => !!app)
              return (
                <button
                  key={layout.id}
                  className="start-menu-sub-item"
                  onClick={() => onApplyLayout(layout.id)}
                  title={enabledWidgets.length > 0
                    ? `${layout.label}: ${enabledWidgets.map((a) => a.label).join(', ')}`
                    : layout.label}
                >
                  <span style={{ width: 18, textAlign: 'center' }}>{layout.icon || '📐'}</span>
                  <span className="start-menu-sub-item-content">
                    <span className="start-menu-sub-item-title">{layout.label}</span>
                    <span className="start-menu-sub-item-meta">
                      {enabledWidgets.length > 0 ? enabledWidgets.map((a) => (
                        <span key={`${layout.id}-${a.id}`} className="start-menu-sub-item-badge">
                          <span className="start-menu-sub-item-badge-icon">{typeof a.icon === 'string' ? a.icon : '■'}</span>
                          <span>{a.label}</span>
                        </span>
                      )) : (
                        <span className="start-menu-sub-item-badge start-menu-sub-item-badge--muted">No enabled widgets</span>
                      )}
                    </span>
                  </span>
                </button>
              )
            })}
            {systemLayouts.length > 0 && orderedLayouts.length > 0 && <div className="start-menu-separator" />}
            {systemLayouts.length > 0 && (
              <button
                className="start-menu-sub-item"
                onClick={() => onApplyLayout(sourceCenterToggleLayoutId)}
              >
                <span style={{ width: 18, textAlign: 'center' }}>⇄</span>
                <span className="start-menu-sub-item-content">
                  <span className="start-menu-sub-item-title">Toggle Source A/B</span>
                  <span className="start-menu-sub-item-meta">
                    <span className="start-menu-sub-item-badge start-menu-sub-item-badge--muted">Switch between the two source-center system layouts</span>
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="start-menu-separator" />

        <button
          className="start-menu-item"
          onClick={() => { socket.emit('scene:change', STATE.LOBBY); onClose() }}
        >
          <span className="start-menu-item-icon">🖥</span>
          <span className="start-menu-item-label">LOBBY</span>
        </button>

        <div className="start-menu-separator" />

        <button
          className="start-menu-item start-menu-item--danger"
          onClick={() => { socket.emit('panic'); onClose() }}
        >
          <span className="start-menu-item-icon">🔴</span>
          <span className="start-menu-item-label">PANIC</span>
        </button>
      </div>
    </div>
  )
}
