import { useEffect, useState } from 'react'
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
import { LayerErrorBoundary } from './components/LayerErrorBoundary'
import { resolveScene } from './services/SceneResolver.js'
import { socket } from './socket/client'

export default function App() {
  const visualState   = useAppStore((s) => s.visualState)
  const config        = useAppStore((s) => s.config)
  const [rejected, setRejected] = useState(false)

  // Wire socket events to the store
  useSocket()

  // Listen for server rejection (single overlay gate)
  useEffect(() => {
    const onRejected = () => setRejected(true)
    socket.on('overlay:rejected' as any, onRejected)
    return () => { socket.off('overlay:rejected' as any, onRejected) }
  }, [])

  useEffect(() => { audioEngine.init() }, [])

  useEffect(() => {
    audioEngine.setMasterVolume(config.audio.masterVolume)
    audioEngine.setMusicVolume(config.audio.musicVolume)
  }, [config.audio.masterVolume, config.audio.musicVolume])

  if (rejected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#e4e4e7', fontFamily: 'system-ui, sans-serif', padding: 32 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <p style={{ fontSize: 18, marginBottom: 12 }}>Overlay is already open in another window.</p>
          <p style={{ fontSize: 14, color: '#a1a1aa' }}>Close that window before opening a new one.</p>
          <button
            onClick={() => { setRejected(false); socket.connect() }}
            style={{ marginTop: 24, padding: '8px 20px', borderRadius: 6, border: '1px solid #3f3f46', background: '#18181b', color: '#e4e4e7', cursor: 'pointer', fontSize: 13 }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { scene, visibleSources, overlayStyle, effectiveEffects } = resolveScene(config, visualState)

  // Play per-scene background music track (null = silence)
  useEffect(() => {
    audioEngine.playMusic(scene?.musicTrack ?? null)
  }, [visualState]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div id="overlay-root" className={`state-${visualState.toLowerCase()}`}>
      {/* Configurable background (gradient / image / video / pattern) */}
      <div id="background-layer">
        <LayerErrorBoundary name="background">
          <BackgroundLayer style={overlayStyle} />
        </LayerErrorBoundary>
      </div>

      {/* Particle system on top of background */}
      <div id="particles-layer">
        <LayerErrorBoundary name="particles">
          <ParticlesLayer {...overlayStyle.particles} />
        </LayerErrorBoundary>
      </div>

      {/* All plugin sources (backgrounds, effects, overlays) */}
      <div id="sources-layer">
        <LayerErrorBoundary name="sources">
          <LayerStack sources={visibleSources} />
        </LayerErrorBoundary>
      </div>

      {/* 3D lobby room — only mounted when in LOBBY state (no wasted render otherwise) */}
      <div id="lobby-layer">
        <LayerErrorBoundary name="lobby">
          {visualState === STATE.LOBBY && <LobbyScene />}
        </LayerErrorBoundary>
      </div>

      {/* Win98 OS desktop */}
      <div id="desktop-layer">
        <LayerErrorBoundary name="desktop">
          <Desktop apps={config.applications} />
        </LayerErrorBoundary>
      </div>

      {/* Global CSS effects — CRT, vignette, grain, flicker, chromatic */}
      <div id="effects-layer">
        <LayerErrorBoundary name="effects">
          <CSSEffectsLayer effects={effectiveEffects} />
        </LayerErrorBoundary>
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
