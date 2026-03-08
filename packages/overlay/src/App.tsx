import { useEffect, useRef } from 'react'
import { STATE } from '@ieom/shared'
import { useAppStore } from './store/useAppStore'
import { useSocket } from './socket/useSocket'
import { audioEngine } from './engine/AudioEngine'
import { TransitionEngine } from './engine/TransitionEngine'
import { LayerStack } from './layers/LayerStack'
import { BackgroundLayer } from './layers/BackgroundLayer'
import { ParticlesLayer } from './layers/ParticlesLayer'
import { CSSEffectsLayer } from './layers/CSSEffectsLayer'
import { TransitionLayer } from './layers/TransitionLayer'
import { Desktop } from './desktop/Desktop'
import { LobbyScene } from './lobby/LobbyScene'
import { playBootSequence } from './transitions/BootSequence'

export default function App() {
  const visualState = useAppStore((s) => s.visualState)
  const config = useAppStore((s) => s.config)
  const hasBooted = useRef(false)

  // Wire socket events to the store
  useSocket()

  useEffect(() => {
    audioEngine.init()
    if (!hasBooted.current) {
      hasBooted.current = true
      playBootSequence(() => {
        audioEngine.play('startup')
      })
    }
  }, [])

  const currentScene = config.scenes[visualState] ?? config.scenes[STATE.DESKTOP]
  const visibleSources = currentScene?.sources.filter((s) => s.visible) ?? []

  return (
    <div id="overlay-root" className={`state-${visualState.toLowerCase()}`}>
      {/* Configurable background (gradient / image / video / pattern) */}
      <div id="background-layer">
        <BackgroundLayer style={config.overlayStyle} />
      </div>

      {/* Particle system on top of background */}
      <div id="particles-layer">
        <ParticlesLayer {...config.overlayStyle.particles} />
      </div>

      {/* All plugin sources (backgrounds, effects, overlays) */}
      <div id="sources-layer">
        <LayerStack sources={visibleSources} />
      </div>

      {/* 3D lobby room — only mounted when in LOBBY state (no wasted render otherwise) */}
      <div id="lobby-layer">
        {visualState === STATE.LOBBY && <LobbyScene />}
      </div>

      {/* Win98 OS desktop */}
      <div id="desktop-layer">
        <Desktop apps={config.applications} />
      </div>

      {/* Global CSS effects — CRT, vignette, grain, flicker, chromatic */}
      <div id="effects-layer">
        <CSSEffectsLayer effects={config.overlayStyle.effects} />
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
