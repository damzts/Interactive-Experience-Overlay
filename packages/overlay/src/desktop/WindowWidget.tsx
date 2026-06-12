import { useMemo, useEffect, useState } from 'react'
import { resolveWindowInstance } from '@ieomlabs/shared'
import { useAppStore } from '../store/useAppStore'
import { resolveRenderer, type RendererDefinition } from '../renderers/registry'
import { DesktopWindow } from './DesktopWindow'
import { AppGlyph } from './AppGlyph'

// Stable no-ops for the desktop preview context
const NOOP_EMIT = () => {}
const NOOP_SIGNAL = () => () => {}

interface DesktopWidgetProps {
  appId?: string
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

function WindowWidgetPlaceholder({
  icon,
  title,
  detail,
}: {
  icon: string
  title: string
  detail: string
}) {
  return (
    <div className="widget-panel widget-source-placeholder">
      <span className="widget-source-placeholder-icon">{icon}</span>
      <div className="widget-source-placeholder-title">{title}</div>
      <div className="widget-source-placeholder-detail">{detail}</div>
    </div>
  )
}

export function WindowWidget({ appId, onClose, onMinimize, onFocus, windowState = 'open', zIndex }: DesktopWidgetProps) {
  const applications = useAppStore((s) => s.config.applications)
  const scenes = useAppStore((s) => s.config.scenes)
  const sourcePresets = useAppStore((s) => s.config.sourcePresets)

  const app = useMemo(
    () => applications.find((entry) => entry.id === appId),
    [applications, appId],
  )
  const sceneId = app?.windowWidgetSettings?.sceneId ?? ''
  const windowId = app?.windowWidgetSettings?.windowId ?? ''
  const scene = sceneId ? scenes[sceneId] : undefined
  const instance = useMemo(() => {
    const entry = scene?.windows.find((candidate) => candidate.id === windowId)
    return entry ? resolveWindowInstance(entry, sourcePresets) : null
  }, [scene, windowId, sourcePresets])

  const [rendererDef, setRendererDef] = useState<RendererDefinition | null>(null)
  useEffect(() => {
    if (!instance?.rendererType) { setRendererDef(null); return }
    resolveRenderer(instance.rendererType).then(setRendererDef)
  }, [instance?.rendererType])

  const Renderer = rendererDef?.component
  const bounds = instance ? instance.position : { x: 0, y: 0, width: 400, height: 300 }

  return (
    <DesktopWindow
      id={appId ?? 'window-widget'}
      title={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <AppGlyph icon={app?.icon ?? '🧩'} label={app?.label ?? 'Window Widget'} size={16} />
          <span>{app?.label ?? 'Window Widget'}</span>
        </span>
      )}
      width={420}
      height={320}
      defaultPosition={{ x: 320, y: 96 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--source"
      bodyClassName="desktop-window-body--source"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: 12 }}
    >
      {!sceneId || !windowId ? (
        <WindowWidgetPlaceholder
          icon="🧩"
          title="Window binding required"
          detail="Bind this widget to a scene window from the admin dashboard to render it here."
        />
      ) : !scene ? (
        <WindowWidgetPlaceholder
          icon="⚠"
          title="Scene not found"
          detail={`The configured scene "${sceneId}" is no longer available.`}
        />
      ) : !instance ? (
        <WindowWidgetPlaceholder
          icon="⚠"
          title="Window not found"
          detail={`The configured window "${windowId}" is no longer present in ${scene.label}.`}
        />
      ) : !Renderer ? (
        <WindowWidgetPlaceholder
          icon="⚠"
          title="Unsupported renderer"
          detail={`No renderer is registered for type "${instance.rendererType}".`}
        />
      ) : (
        <div className="widget-panel widget-source-canvas">
          <Renderer config={instance.config ?? {}} bounds={bounds} emit={NOOP_EMIT} onSignal={NOOP_SIGNAL} />
        </div>
      )}
    </DesktopWindow>
  )
}
