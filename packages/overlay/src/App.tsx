import React, { useEffect, useRef, useState } from 'react'
import { withPersonaDefaults } from '@ieomlabs/shared'
import { useAppStore } from './store/useAppStore'
import { useSocket } from './socket/useSocket'
import { onKernelSignal } from './socket/kernelSignals'
import { audioEngine } from './engine/AudioEngine'
import { startAudioReactivityMonitor } from './engine/audioReactivityMonitor'
import { startPerfMonitor } from './engine/perfMonitor'
import { TransitionEngine } from './engine/TransitionEngine'
import { SceneCompositor } from './layers/SceneCompositor'
import { TransitionLayer } from './layers/TransitionLayer'
import { Desktop } from './desktop/Desktop'
import { LayerErrorBoundary } from './components/LayerErrorBoundary'
import { resolveScene } from './services/SceneResolver.js'
import { RtcStreamProvider } from './rtc/RtcStreamContext'
import { runChatBubble } from './transitions/ChatBubble'

export default function App() {
  const visualState = useAppStore((s) => s.visualState)
  const config      = useAppStore((s) => s.config)

  const sceneStartRef = useRef(Date.now())
  const [sceneAge, setSceneAge] = useState(0)

  useEffect(() => {
    sceneStartRef.current = Date.now()
    setSceneAge(0)
    const id = setInterval(() => setSceneAge(Math.floor((Date.now() - sceneStartRef.current) / 1000)), 1000)
    return () => clearInterval(id)
  }, [visualState])

  useSocket()
  useEffect(() => { audioEngine.init() }, [])
  // Render-performance telemetry — always on; reports fps/long-frame
  // samples to kernel diagnostics every few seconds.
  useEffect(() => startPerfMonitor(), [])
  useEffect(() => {
    audioEngine.setMasterVolume(config.audio.masterVolume)
    audioEngine.setMusicVolume(config.audio.musicVolume)
    audioEngine.setAmbientVolume(config.audio.ambientVolume ?? 0.6)
  }, [config.audio.masterVolume, config.audio.musicVolume, config.audio.ambientVolume])

  // Audio reactivity: switch capture source and start/stop the beat/energy
  // monitor as the operator toggles it in the Admin Audio panel. Disabled by
  // default — no analyser polling, no getUserMedia/getDisplayMedia prompts.
  const reactivity = config.audio.reactivity
  useEffect(() => {
    if (!reactivity?.enabled) {
      audioEngine.stopReactiveSource()
      return
    }
    void audioEngine.setReactiveSource(reactivity.source)
    const stop = startAudioReactivityMonitor()
    return () => {
      stop()
      audioEngine.stopReactiveSource()
    }
  }, [reactivity?.enabled, reactivity?.source])

  // Persona: chat-to-voice companion. A spoken line is independent of any
  // open widget, so it's wired globally here rather than in ChatWidget.
  useEffect(() => {
    return onKernelSignal('persona:speak', ({ user, text, audioUrl }) => {
      const voice = withPersonaDefaults(useAppStore.getState().config.persona).voice
      void audioEngine.playPersonaLine(audioUrl, voice)
      runChatBubble({ author: user, text, duration: 5, position: 'bottom' })
    })
  }, [])

  const { scene, visibleWindows, overlayStyle, showDesktop } = resolveScene(config, visualState)

  // Scene-level track overrides the global one; playAmbient no-ops when the URL is unchanged.
  const ambientTrack = scene?.ambientTrack || config.audio.ambientTrack || null
  useEffect(() => {
    audioEngine.playAmbient(ambientTrack)
  }, [visualState, ambientTrack]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <RtcStreamProvider>
      <div
        id="overlay-root"
        className={`state-${visualState.toLowerCase()}`}
        data-desktop={String(showDesktop)}
      >
        <LayerErrorBoundary name="scene">
          <SceneCompositor
            windows={visibleWindows}
            sceneAge={sceneAge}
          />
        </LayerErrorBoundary>

        <div id="desktop-layer">
          <LayerErrorBoundary name="desktop">
            <Desktop apps={config.applications} overlayStyle={overlayStyle} />
          </LayerErrorBoundary>
        </div>

        <div id="transition-layer">
          <TransitionLayer />
        </div>

        <TransitionEngine />
      </div>
    </RtcStreamProvider>
  )
}
