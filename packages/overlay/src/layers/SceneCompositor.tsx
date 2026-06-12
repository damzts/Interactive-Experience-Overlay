/**
 * SceneCompositor — unified tier-based renderer.
 *
 * Renders four z-ordered tiers: background → particles → content → post.
 * Background and particles are injected as builtin windows from OverlayStyle.
 * Post-effects (CRT, vignette, etc.) are explicit builtin:effects windows in
 * the scene's windows array — not auto-injected here.
 */
import type { OverlayStyle, WindowInstance, TierName } from '@ieomlabs/shared'
import { SceneLayer } from './SceneLayer'

interface Props {
  windows: WindowInstance[]
  overlayStyle: OverlayStyle
  sceneAge?: number
  openWidgets?: string[]
  activeOverride?: string
}

function builtinWindow(id: string, rendererType: string, config: Record<string, unknown>, zIndex = 0): WindowInstance {
  return {
    id,
    rendererType,
    config,
    position: { x: 0, y: 0, width: 1920, height: 1080 },
    zIndex,
    visible: true,
  }
}

export function SceneCompositor({ windows, overlayStyle, sceneAge, openWidgets, activeOverride }: Props) {
  const bg = overlayStyle.background
  const pt = overlayStyle.particles

  const backgroundWindows: WindowInstance[] = bg.type !== 'none'
    ? [builtinWindow('__bg', 'builtin:background', bg as unknown as Record<string, unknown>)]
    : []

  const particleWindows: WindowInstance[] = pt.enabled && pt.preset !== 'none'
    ? [builtinWindow('__particles', 'builtin:particles', pt as unknown as Record<string, unknown>)]
    : []

  const tierBuckets: Record<TierName, WindowInstance[]> = {
    background: [], particles: [], content: [], post: [], transition: [],
  }
  for (const w of windows) {
    const tier: TierName = w.tier ?? 'content'
    tierBuckets[tier].push(w)
  }

  return (
    <>
      <SceneLayer tier="background" windows={[...backgroundWindows, ...tierBuckets.background]} sceneAge={sceneAge} openWidgets={openWidgets} activeOverride={activeOverride} />
      <SceneLayer tier="particles"  windows={[...particleWindows,  ...tierBuckets.particles]}  sceneAge={sceneAge} openWidgets={openWidgets} activeOverride={activeOverride} />
      <SceneLayer tier="content"    windows={tierBuckets.content}                               sceneAge={sceneAge} openWidgets={openWidgets} activeOverride={activeOverride} />
      <SceneLayer tier="post"       windows={tierBuckets.post}                                  sceneAge={sceneAge} openWidgets={openWidgets} activeOverride={activeOverride} />
    </>
  )
}
