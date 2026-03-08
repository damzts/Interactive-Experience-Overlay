import { useEffect } from 'react'
import { STATE } from '@ieom/shared'
import { useAppStore } from './store/useAppStore'
import { useSocket } from './socket/useSocket'
import { audioEngine } from './engine/AudioEngine'
import { TransitionEngine } from './engine/TransitionEngine'
import { LayerStack } from './layers/LayerStack'
import { EffectsLayer } from './layers/EffectsLayer'
import { TransitionLayer } from './layers/TransitionLayer'
import { Desktop } from './desktop/Desktop'

export default function App() {
  const visualState = useAppStore((s) => s.visualState)
  const config = useAppStore((s) => s.config)

  // Wire socket events to the store
  useSocket()

  useEffect(() => {
    audioEngine.init()
    audioEngine.play('startup')
  }, [])

  const currentScene = config.scenes[visualState] ?? config.scenes[STATE.LOBBY]
  const visibleSources = currentScene?.sources.filter((s) => s.visible) ?? []

  return (
    <div id="overlay-root" className={`state-${visualState.toLowerCase()}`}>
      {/* All plugin sources (backgrounds, effects, overlays) */}
      <div id="sources-layer">
        <LayerStack sources={visibleSources} />
      </div>

      {/* Win98 OS desktop */}
      <div id="desktop-layer">
        <Desktop apps={config.applications} />
      </div>

      {/* Global effects (reserved — scene-level effects use LayerStack) */}
      <div id="effects-layer">
        <EffectsLayer />
      </div>

      {/* GSAP transition effect elements (loading window, flash, static, etc.) */}
      <div id="transition-layer">
        <TransitionLayer />
      </div>

      {/* Invisible engine — watches pendingTransition, runs GSAP */}
      <TransitionEngine />
    </div>
  )
}
