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
import { MusicWidget } from './desktop/MusicWidget'
import { ArchiveWidget } from './desktop/ArchiveWidget'
import { LobbyScene } from './lobby/LobbyScene'
import { playBootSequence } from './transitions/BootSequence'

export default function App() {
  const visualState   = useAppStore((s) => s.visualState)
  const config        = useAppStore((s) => s.config)
  const hasBooted     = useRef(false)

  // Wire socket events to the store
  useSocket()

  useEffect(() => { audioEngine.init() }, [])

  // Play boot sequence once per browser session.
  // sessionStorage key is cleared when the browser tab closes.
  useEffect(() => {
    if (hasBooted.current) return
    if (sessionStorage.getItem('ieom-booted')) return
    hasBooted.current = true
    sessionStorage.setItem('ieom-booted', '1')
    playBootSequence(() => audioEngine.play('startup'))
  }, [])

  const currentScene = config.scenes[visualState] ?? config.scenes[STATE.DESKTOP]
  const visibleSources = currentScene?.sources.filter((s) => s.visible) ?? []
  // Desktop scene owns the visual style; fall back to root overlayStyle for compat
  const overlayStyle = config.scenes[STATE.DESKTOP]?.style ?? config.overlayStyle

  return (
    <div id="overlay-root" className={`state-${visualState.toLowerCase()}`}>
      {/* Configurable background (gradient / image / video / pattern) */}
      <div id="background-layer">
        <BackgroundLayer style={overlayStyle} />
      </div>

      {/* Particle system on top of background */}
      <div id="particles-layer">
        <ParticlesLayer {...overlayStyle.particles} />
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

      {/* Stacking widget windows (MUSIC, ARCHIVE) — above desktop */}
      <div id="widget-layer">
        {visualState === STATE.MUSIC   && <MusicWidget />}
        {visualState === STATE.ARCHIVE && <ArchiveWidget />}
      </div>

      {/* Global CSS effects — CRT, vignette, grain, flicker, chromatic */}
      <div id="effects-layer">
        <CSSEffectsLayer effects={overlayStyle.effects} />
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
