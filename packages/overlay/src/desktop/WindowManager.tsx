import type { Application } from '@ieomlabs/shared'
import { getWidgetComponent } from '@ieomlabs/shared'
import { AppGlyph } from './AppGlyph'
import { DesktopWindow } from './DesktopWindow'
import type { DesktopWidgetProps } from './widgetRegistry'
import { getDesktopWidgetRenderer, warnMissingDesktopWidgetRegistration } from './widgetRegistry'
import './styles/windows.css'

function resolveWidgetComponent(app: Application) {
  const widgetComponent = getWidgetComponent(app)
  return getDesktopWidgetRenderer(widgetComponent)
}

/** Fallback draggable window for any widget without a registered runtime component. */
function GenericWidget({ app, onClose, onMinimize, onFocus, windowState = 'open', zIndex }: { app: Application } & DesktopWidgetProps) {
  return (
    <DesktopWindow
      id={app.id}
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AppGlyph icon={app.icon} label={app.label} size={16} /> <span>{app.label}</span></span>}
      width={260}
      height={240}
      defaultPosition={{ x: 80, y: 120 }}
      zIndex={zIndex}
      state={windowState}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px 16px', color: 'var(--desktop-title-start)', textAlign: 'center' }}
    >
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <AppGlyph icon={app.icon} label={app.label} size={28} />
      </div>
      <div style={{ marginTop: 6, fontWeight: 'bold' }}>{app.label}</div>
      <div style={{ marginTop: 4, fontSize: 10, color: '#666' }}>Widget — no component registered for id: {app.id}</div>
    </DesktopWindow>
  )
}

interface WindowManagerProps {
  visibleWidgets: Application[]
  closingWidgets: Set<string>
  simEmittingRef: React.MutableRefObject<boolean>
  minimizeWidget: (id: string) => void
  focusWidget: (id: string) => void
  getWidgetZIndex: (id: string) => number
  onWidgetClose: (widgetId: string) => void
  onWarnMissing: (app: Application) => void
}

export function WindowManager({
  visibleWidgets,
  closingWidgets,
  minimizeWidget,
  focusWidget,
  getWidgetZIndex,
  onWidgetClose,
}: WindowManagerProps) {
  return (
    <>
      {visibleWidgets.map((a) => {
        const widgetComponent = getWidgetComponent(a)
        const WidgetComp = resolveWidgetComponent(a)
        const widgetProps: DesktopWidgetProps = {
          appId: a.id,
          defaultCameraLabel: widgetComponent === 'camera' ? (a.cameraSettings?.preferredDeviceLabel ?? '') : undefined,
          defaultMirror: widgetComponent === 'camera' ? (a.cameraSettings?.mirror ?? false) : undefined,
          onClose: () => onWidgetClose(a.id),
          onMinimize: () => minimizeWidget(a.id),
          onFocus: () => focusWidget(a.id),
          windowState: closingWidgets.has(a.id) ? 'closing' : 'open',
          zIndex: getWidgetZIndex(a.id),
        }
        if (WidgetComp) return <WidgetComp key={a.id} {...widgetProps} />
        return <GenericWidget key={a.id} app={a} {...widgetProps} />
      })}
    </>
  )
}
