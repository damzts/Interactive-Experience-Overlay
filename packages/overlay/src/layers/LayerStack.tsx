/**
 * @deprecated Use SceneLayer + WindowHost instead.
 * Kept for reference; no longer imported by App.tsx.
 */
import type { WindowInstance } from '@ieomlabs/shared'
import { WindowHost } from './WindowHost'

interface LayerStackProps {
  windows: WindowInstance[]
}

export function LayerStack({ windows }: LayerStackProps) {
  return (
    <>
      {windows.map((instance) => (
        <WindowHost key={instance.id} instance={instance} />
      ))}
    </>
  )
}
