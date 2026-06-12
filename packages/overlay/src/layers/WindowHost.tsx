/**
 * WindowHost — renders a single WindowInstance.
 * Handles: lazy renderer resolution, conditions, blend modes, opacity, masks, transitions.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import type { WindowInstance } from '@ieomlabs/shared'
import { resolveRenderer, type RendererDefinition } from '../renderers/registry'

/** Stable no-op emit/onSignal for windows that don't use the event bus */
const BUS_EMIT = (event: string, data: unknown) => {
  window.dispatchEvent(new CustomEvent(`renderer:${event}`, { detail: data }))
}
const BUS_SIGNAL = (event: string, handler: (data: unknown) => void) => {
  const listener = (e: Event) => handler((e as CustomEvent).detail)
  window.addEventListener(`renderer:${event}`, listener)
  return () => window.removeEventListener(`renderer:${event}`, listener)
}

interface Props {
  instance: WindowInstance
  /** Other windows in this tier — used for mask resolution */
  tierWindows?: WindowInstance[]
  /** Seconds elapsed since this tier became active (for afterSeconds condition) */
  sceneAge?: number
  /** Active widget IDs (for whenWidgetsOpen condition) */
  openWidgets?: string[]
  /** Active override key (for whenOverride condition) */
  activeOverride?: string
}

function evaluateConditions(instance: WindowInstance, sceneAge: number, openWidgets: string[], activeOverride: string): boolean {
  const c = instance.conditions
  if (!c) return true
  if (c.whenWidgetsOpen?.length) {
    if (!c.whenWidgetsOpen.some((w) => openWidgets.includes(w))) return false
  }
  if (c.whenOverride !== undefined && c.whenOverride !== activeOverride) return false
  if (c.afterSeconds !== undefined && sceneAge < c.afterSeconds) return false
  return true
}

export function WindowHost({ instance, sceneAge = 0, openWidgets = [], activeOverride = '' }: Props) {
  const [def, setDef] = useState<RendererDefinition | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const rendererId = instance.rendererType ?? ''
    resolveRenderer(rendererId).then((resolved) => {
      if (mounted.current) setDef(resolved)
    })
    return () => { mounted.current = false }
  }, [instance.rendererType])

  const emit = useCallback(BUS_EMIT, [])
  const onSignal = useCallback(BUS_SIGNAL, [])

  if (!instance.visible) return null
  if (!evaluateConditions(instance, sceneAge, openWidgets, activeOverride)) return null
  if (!def) return null

  const { x, y, width, height } = instance.position
  const Renderer = def.component

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        zIndex: instance.zIndex,
        overflow: 'hidden',
        opacity: instance.opacity ?? 1,
        mixBlendMode: (instance.blendMode ?? 'normal') as React.CSSProperties['mixBlendMode'],
        ...(instance.transition ? {
          transition: `opacity ${instance.transition.duration}s ease`,
        } : {}),
      }}
    >
      <Renderer
        config={instance.config ?? {}}
        bounds={{ x, y, width, height }}
        emit={emit}
        onSignal={onSignal}
      />
    </div>
  )
}
