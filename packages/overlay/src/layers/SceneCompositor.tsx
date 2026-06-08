/**
 * SceneCompositor — unified tier-based renderer.
 *
 * Renders four z-ordered tiers: background → particles → content → post.
 * Background and particles are injected as builtin sources from OverlayStyle.
 * Post-effects (CRT, vignette, etc.) are explicit builtin:effects sources in
 * the scene's sources array — not auto-injected here.
 */
import type { OverlayStyle, SourceInstance, TierName } from '@ieomlabs/shared'
import { SceneLayer } from './SceneLayer'

interface Props {
  sources: SourceInstance[]
  overlayStyle: OverlayStyle
  sceneAge?: number
  openWidgets?: string[]
  activeOverride?: string
}

function builtinSource(id: string, pluginType: string, config: Record<string, unknown>, zIndex = 0): SourceInstance {
  return {
    id,
    pluginType,
    config,
    position: { x: 0, y: 0, width: 1920, height: 1080 },
    zIndex,
    visible: true,
  }
}

export function SceneCompositor({ sources, overlayStyle, sceneAge, openWidgets, activeOverride }: Props) {
  const bg = overlayStyle.background
  const pt = overlayStyle.particles

  const backgroundSources: SourceInstance[] = bg.type !== 'none'
    ? [builtinSource('__bg', 'builtin:background', bg as unknown as Record<string, unknown>)]
    : []

  const particlesSources: SourceInstance[] = pt.enabled && pt.preset !== 'none'
    ? [builtinSource('__particles', 'builtin:particles', pt as unknown as Record<string, unknown>)]
    : []

  const tierBuckets: Record<TierName, SourceInstance[]> = {
    background: [], particles: [], content: [], post: [], transition: [],
  }
  for (const s of sources) {
    const tier = ((s as SourceInstance & { tier?: TierName }).tier ?? 'content') as TierName
    tierBuckets[tier].push(s)
  }

  return (
    <>
      <SceneLayer tier="background" sources={[...backgroundSources, ...tierBuckets.background]} sceneAge={sceneAge} openWidgets={openWidgets} activeOverride={activeOverride} />
      <SceneLayer tier="particles"  sources={[...particlesSources,  ...tierBuckets.particles]}  sceneAge={sceneAge} openWidgets={openWidgets} activeOverride={activeOverride} />
      <SceneLayer tier="content"    sources={tierBuckets.content}                                sceneAge={sceneAge} openWidgets={openWidgets} activeOverride={activeOverride} />
      <SceneLayer tier="post"       sources={tierBuckets.post}                                   sceneAge={sceneAge} openWidgets={openWidgets} activeOverride={activeOverride} />
    </>
  )
}
