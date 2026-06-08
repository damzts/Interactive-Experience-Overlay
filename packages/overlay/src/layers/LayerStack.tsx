/**
 * @deprecated Use SceneLayer + SourceRenderer instead.
 * Kept for reference; no longer imported by App.tsx.
 */
import type { SourceInstance } from '@ieomlabs/shared'
import { SourceRenderer } from './SourceRenderer'

interface LayerStackProps {
  sources: SourceInstance[]
}

export function LayerStack({ sources }: LayerStackProps) {
  return (
    <>
      {sources.map((source) => (
        <SourceRenderer key={source.id} source={source} />
      ))}
    </>
  )
}
