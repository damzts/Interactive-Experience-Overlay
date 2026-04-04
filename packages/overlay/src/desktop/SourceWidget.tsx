import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { pluginRegistry } from '../plugins/registry'
import { DesktopWindow } from './DesktopWindow'
import { AppGlyph } from './AppGlyph'

interface DesktopWidgetProps {
  appId?: string
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

function SourceWidgetPlaceholder({
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

export function SourceWidget({ appId, onClose, onMinimize, onFocus, windowState = 'open', zIndex }: DesktopWidgetProps) {
  const applications = useAppStore((s) => s.config.applications)
  const scenes = useAppStore((s) => s.config.scenes)

  const app = useMemo(
    () => applications.find((entry) => entry.id === appId),
    [applications, appId],
  )
  const sceneId = app?.sourceWidgetSettings?.sceneId ?? ''
  const sourceId = app?.sourceWidgetSettings?.sourceId ?? ''
  const scene = sceneId ? scenes[sceneId] : undefined
  const source = scene?.sources.find((entry) => entry.id === sourceId)
  const plugin = source ? pluginRegistry[source.pluginType] : null
  const Renderer = plugin?.Renderer

  return (
    <DesktopWindow
      id={appId ?? 'source-widget'}
      title={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <AppGlyph icon={app?.icon ?? '🧩'} label={app?.label ?? 'Source Widget'} size={16} />
          <span>{app?.label ?? 'Source Widget'}</span>
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
      {!sceneId || !sourceId ? (
        <SourceWidgetPlaceholder
          icon="🧩"
          title="Source binding required"
          detail="Bind this widget to a scene source from the admin dashboard to render it here."
        />
      ) : !scene ? (
        <SourceWidgetPlaceholder
          icon="⚠"
          title="Scene not found"
          detail={`The configured scene \"${sceneId}\" is no longer available.`}
        />
      ) : !source ? (
        <SourceWidgetPlaceholder
          icon="⚠"
          title="Source not found"
          detail={`The configured source \"${sourceId}\" is no longer present in ${scene.label}.`}
        />
      ) : !Renderer ? (
        <SourceWidgetPlaceholder
          icon="⚠"
          title="Unsupported source"
          detail={`No renderer is registered for plugin type \"${source.pluginType}\".`}
        />
      ) : (
        <div className="widget-panel widget-source-canvas">
          <Renderer config={source.config} />
        </div>
      )}
    </DesktopWindow>
  )
}
