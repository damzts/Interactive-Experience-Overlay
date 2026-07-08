/**
 * SceneCompositor — unified tier-based renderer.
 *
 * Renders four z-ordered tiers: background → particles → content → post.
 * Background, particles, and post-effects (CRT, vignette, etc.) are all
 * explicit builtin:background / builtin:particles / builtin:effects windows
 * in the scene's windows array — nothing is auto-injected here.
 */
import type { WindowInstance, TierName } from '@ieomlabs/shared'
import { SceneLayer } from './SceneLayer'

interface Props {
  windows: WindowInstance[]
  sceneAge?: number
  openWidgets?: string[]
  activeOverride?: string
}

export function SceneCompositor({ windows, sceneAge, openWidgets, activeOverride }: Props) {
  const tierBuckets: Record<TierName, WindowInstance[]> = {
    background: [], particles: [], content: [], post: [], transition: [],
  }
  for (const w of windows) {
    const tier: TierName = w.tier ?? 'content'
    tierBuckets[tier].push(w)
  }

  return (
    <>
      <SceneLayer tier="background" windows={tierBuckets.background} sceneAge={sceneAge} openWidgets={openWidgets} activeOverride={activeOverride} />
      <SceneLayer tier="particles"  windows={tierBuckets.particles}  sceneAge={sceneAge} openWidgets={openWidgets} activeOverride={activeOverride} />
      <SceneLayer tier="content"    windows={tierBuckets.content}    sceneAge={sceneAge} openWidgets={openWidgets} activeOverride={activeOverride} />
      <SceneLayer tier="post"       windows={tierBuckets.post}       sceneAge={sceneAge} openWidgets={openWidgets} activeOverride={activeOverride} />
    </>
  )
}
