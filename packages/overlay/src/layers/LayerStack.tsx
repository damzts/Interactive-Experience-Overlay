import type { SourceInstance } from '@ieom/shared'
import { pluginRegistry } from '../plugins/registry'

interface LayerStackProps {
  sources: SourceInstance[]
}

export function LayerStack({ sources }: LayerStackProps) {
  return (
    <>
      {sources.map((source) => {
        const plugin = pluginRegistry[source.pluginType ?? '']
        if (!plugin) {
          console.warn(`[LayerStack] Unknown plugin type: ${source.pluginType}`)
          return null
        }

        const { x, y, width, height } = source.position
        const { Renderer } = plugin

        return (
          <div
            key={source.id}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width,
              height,
              zIndex: source.zIndex,
              overflow: 'hidden',
            }}
          >
            <Renderer config={source.config ?? {}} />
          </div>
        )
      })}
    </>
  )
}
