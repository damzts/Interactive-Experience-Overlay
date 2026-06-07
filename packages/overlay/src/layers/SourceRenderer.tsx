/**
 * SourceRenderer — renders a single SourceInstance.
 * Handles: lazy plugin resolution, conditions, blend modes, opacity, masks, transitions.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import type { SourceInstance } from '@ieom/shared'
import { resolvePlugin, type PluginDefinition } from '../plugins/registry'

/** Stable no-op emit/onSignal for sources that don't use the event bus */
const BUS_EMIT = (event: string, data: unknown) => {
  window.dispatchEvent(new CustomEvent(`plugin:${event}`, { detail: data }))
}
const BUS_SIGNAL = (event: string, handler: (data: unknown) => void) => {
  const listener = (e: Event) => handler((e as CustomEvent).detail)
  window.addEventListener(`plugin:${event}`, listener)
  return () => window.removeEventListener(`plugin:${event}`, listener)
}

interface Props {
  source: SourceInstance
  /** Other sources in this tier — used for mask resolution */
  tierSources?: SourceInstance[]
  /** Seconds elapsed since this tier became active (for afterSeconds condition) */
  sceneAge?: number
  /** Active widget IDs (for whenWidgetsOpen condition) */
  openWidgets?: string[]
  /** Active override key (for whenOverride condition) */
  activeOverride?: string
}

function evaluateConditions(source: SourceInstance, sceneAge: number, openWidgets: string[], activeOverride: string): boolean {
  const c = source.conditions
  if (!c) return true
  if (c.whenWidgetsOpen?.length) {
    if (!c.whenWidgetsOpen.some((w) => openWidgets.includes(w))) return false
  }
  if (c.whenOverride !== undefined && c.whenOverride !== activeOverride) return false
  if (c.afterSeconds !== undefined && sceneAge < c.afterSeconds) return false
  return true
}

export function SourceRenderer({ source, sceneAge = 0, openWidgets = [], activeOverride = '' }: Props) {
  const [def, setDef] = useState<PluginDefinition | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const pluginId = source.pluginType ?? ''
    resolvePlugin(pluginId).then((resolved) => {
      if (mounted.current) setDef(resolved)
    })
    return () => { mounted.current = false }
  }, [source.pluginType])

  const emit = useCallback(BUS_EMIT, [])
  const onSignal = useCallback(BUS_SIGNAL, [])

  if (!source.visible) return null
  if (!evaluateConditions(source, sceneAge, openWidgets, activeOverride)) return null
  if (!def) return null

  const { x, y, width, height } = source.position
  const { Renderer } = def

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        zIndex: source.zIndex,
        overflow: 'hidden',
        opacity: source.opacity ?? 1,
        mixBlendMode: (source.blendMode ?? 'normal') as React.CSSProperties['mixBlendMode'],
        ...(source.transition ? {
          transition: `opacity ${source.transition.duration}s ease`,
        } : {}),
      }}
    >
      <Renderer
        config={source.config ?? {}}
        bounds={{ x, y, width, height }}
        emit={emit}
        onSignal={onSignal}
      />
    </div>
  )
}
