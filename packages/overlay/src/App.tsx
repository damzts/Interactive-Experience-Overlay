import { useEffect } from 'react'
import { STATE, resolveSourceInstance } from '@ieom/shared'
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

const CONFIG_PREVIEW_MESSAGE_TYPE = 'ieom:config-preview'

export default function App() {
  const visualState   = useAppStore((s) => s.visualState)
  const config        = useAppStore((s) => s.config)
  const applyPreviewConfig = useAppStore((s) => s.applyPreviewConfig)
  const clearPreviewConfig = useAppStore((s) => s.clearPreviewConfig)

  // Wire socket events to the store
  useSocket()

  useEffect(() => {
    const handlePreviewMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object' || data.type !== CONFIG_PREVIEW_MESSAGE_TYPE) return
      if (data.clear) {
        clearPreviewConfig()
        return
      }
      if (data.patch) applyPreviewConfig(data.patch)
    }

    window.addEventListener('message', handlePreviewMessage)
    return () => window.removeEventListener('message', handlePreviewMessage)
  }, [applyPreviewConfig, clearPreviewConfig])

  useEffect(() => { audioEngine.init() }, [])

  useEffect(() => {
    audioEngine.setMasterVolume(config.audio.masterVolume)
    audioEngine.setMusicVolume(config.audio.musicVolume)
  }, [config.audio.masterVolume, config.audio.musicVolume])

  const currentScene = config.scenes[visualState] ?? config.scenes[STATE.DESKTOP]
  const visibleSources = (currentScene?.sources ?? [])
    .filter((source) => source.visible)
    .map((source) => resolveSourceInstance(source, config.sourcePresets))
    .filter((source): source is NonNullable<typeof source> => source !== null)
  // Each scene owns its own visual style; fall back to root overlayStyle if absent
  const overlayStyle = currentScene?.style ?? config.overlayStyle
  const effectiveEffects = visualState === STATE.DESKTOP && overlayStyle.background.type === 'none'
    ? {
        ...overlayStyle.effects,
        crt: false,
        noise: false,
        vignette: false,
        flicker: false,
        chromatic: false,
        scanlineOpacity: 0,
        noiseOpacity: 0,
        vignetteStrength: 0,
      }
    : overlayStyle.effects

  // Play per-scene background music track (null = silence)
  useEffect(() => {
    audioEngine.playMusic(currentScene?.musicTrack ?? null)
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
