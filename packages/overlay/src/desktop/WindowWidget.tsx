import { useEffect, useMemo, useRef, useState } from 'react'
import { resolveWindowInstance } from '@ieomlabs/shared'
import type { Scene, WindowPreset } from '@ieomlabs/shared'
import { useAppStore } from '../store/useAppStore'
import { resolveRenderer, type RendererDefinition } from '../renderers/registry'
import { WindowHost } from '../layers/WindowHost'
import { DesktopWindow } from './DesktopWindow'
import { AppGlyph } from './AppGlyph'

/** Scene stage size — matches the OBS canvas the overlay renders at. */
const STAGE_W = 1920
const STAGE_H = 1080

// Same renderer:* DOM bus WindowHost provides, so desktop-hosted renderers
// participate in signals/actions like scene-hosted ones.
const BUS_EMIT = (event: string, data: unknown) => {
  window.dispatchEvent(new CustomEvent(`renderer:${event}`, { detail: data }))
}
const BUS_SIGNAL = (event: string, handler: (data: unknown) => void) => {
  const listener = (e: Event) => handler((e as CustomEvent).detail)
  window.addEventListener(`renderer:${event}`, listener)
  return () => window.removeEventListener(`renderer:${event}`, listener)
}

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

function useElementSize() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, size }
}

/** Renders one renderer directly into the widget body, sized to fit it. */
function RendererSource({ rendererType, instanceId }: { rendererType: string; instanceId: string }) {
  const { ref, size } = useElementSize()
  const [rendererDef, setRendererDef] = useState<RendererDefinition | null>(null)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    let mounted = true
    setResolved(false)
    resolveRenderer(rendererType).then((def) => {
      if (!mounted) return
      setRendererDef(def)
      setResolved(true)
    })
    return () => { mounted = false }
  }, [rendererType])

  const config = useMemo(
    () => structuredClone(rendererDef?.catalog?.defaultConfig ?? {}),
    [rendererDef],
  )

  const Renderer = rendererDef?.component
  return (
    <div ref={ref} className="widget-panel widget-source-canvas" style={{ position: 'relative', overflow: 'hidden' }}>
      {resolved && !Renderer ? (
        <WindowWidgetPlaceholder
          icon="⚠"
          title="Unsupported renderer"
          detail={`No renderer is registered for type "${rendererType}".`}
        />
      ) : Renderer && size.width > 0 ? (
        <Renderer
          config={config}
          bounds={{ x: 0, y: 0, width: size.width, height: size.height }}
          emit={BUS_EMIT}
          onSignal={BUS_SIGNAL}
          instanceId={instanceId}
        />
      ) : null}
    </div>
  )
}

/** Renders a whole scene scaled (letterboxed) into the widget body. */
function SceneSource({ scene, windowPresets }: { scene: Scene; windowPresets?: WindowPreset[] | null }) {
  const { ref, size } = useElementSize()
  const scale = size.width > 0 && size.height > 0
    ? Math.min(size.width / STAGE_W, size.height / STAGE_H)
    : 0

  const instances = useMemo(
    () => scene.windows
      .map((entry) => resolveWindowInstance(entry, windowPresets))
      .filter((instance): instance is NonNullable<typeof instance> => instance !== null),
    [scene, windowPresets],
  )

  return (
    <div ref={ref} className="widget-panel widget-source-canvas" style={{ position: 'relative', overflow: 'hidden', background: '#000' }}>
      {scale > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: STAGE_W,
            height: STAGE_H,
            transform: `translate(-50%, -50%) scale(${scale})`,
            background: '#000',
            overflow: 'hidden',
          }}
        >
          {instances.map((instance) => (
            <WindowHost key={instance.id} instance={instance} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function WindowWidget({ appId, onClose, onMinimize, onFocus, windowState = 'open', zIndex }: DesktopWidgetProps) {
  const applications = useAppStore((s) => s.config.applications)
  const scenes = useAppStore((s) => s.config.scenes)
  const windowPresets = useAppStore((s) => s.config.windowPresets)

  const app = useMemo(
    () => applications.find((entry) => entry.id === appId),
    [applications, appId],
  )
  const settings = app?.windowWidgetSettings
  const mode = settings?.mode ?? (settings?.rendererType ? 'renderer' : settings?.sceneId ? 'scene' : undefined)
  const scene = mode === 'scene' && settings?.sceneId ? scenes[settings.sceneId] : undefined

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
      {!mode ? (
        <WindowWidgetPlaceholder
          icon="🧩"
          title="Source required"
          detail="Pick a renderer or a scene for this widget from the admin dashboard."
        />
      ) : mode === 'renderer' ? (
        <RendererSource rendererType={settings!.rendererType!} instanceId={appId ?? 'window-widget'} />
      ) : !scene ? (
        <WindowWidgetPlaceholder
          icon="⚠"
          title="Scene not found"
          detail={`The configured scene "${settings?.sceneId}" is no longer available.`}
        />
      ) : (
        <SceneSource scene={scene} windowPresets={windowPresets} />
      )}
    </DesktopWindow>
  )
}
