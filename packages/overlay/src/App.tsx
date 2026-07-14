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
import { runPersonaAvatar, ensurePersonaAvatar, retirePersistentAvatar } from './transitions/PersonaAvatar'
import { useRemoteSystemAudio } from './services/useRemoteSystemAudio'

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
  // default — no analyser polling, no getUserMedia prompts.
  //
  // 'system' is special: getDisplayMedia() requires a real user gesture,
  // which only exists in the admin app (this overlay is a passive OBS render
  // target). System audio is captured in admin and relayed here over WebRTC
  // (see useRemoteSystemAudio) — the hook runs unconditionally (React rules)
  // but only actually subscribes/negotiates once 'system' + enabled below
  // hands its stream to the engine.
  const reactivity = config.audio.reactivity
  const systemAudio = useRemoteSystemAudio(!!reactivity?.enabled && reactivity.source === 'system')

  useEffect(() => {
    if (!reactivity?.enabled) {
      audioEngine.stopReactiveSource()
      audioEngine.setReactiveStream(null)
      return
    }
    if (reactivity.source === 'system') {
      audioEngine.setReactiveStream(systemAudio.stream)
    } else {
      void audioEngine.setReactiveSource(reactivity.source)
    }
    const stop = startAudioReactivityMonitor()
    return () => {
      stop()
      audioEngine.stopReactiveSource()
      audioEngine.setReactiveStream(null)
    }
  }, [reactivity?.enabled, reactivity?.source, systemAudio.stream])

  // Persona: chat-to-voice companion. A spoken line is independent of any
  // open widget, so it's wired globally here rather than in ChatWidget.
  useEffect(() => {
    return onKernelSignal('persona:speak', ({ user, text, audioUrl }) => {
      const { persona: rawPersona, avatarPresets } = useAppStore.getState().config
      const persona = withPersonaDefaults(rawPersona, avatarPresets)
      void audioEngine.playPersonaLine(audioUrl, persona.voice, persona.duckAmount)
      runChatBubble({ author: user, text, duration: 5, position: 'bottom' })
      runPersonaAvatar({ duration: 8, ...persona.avatar })
    })
  }, [])

  // Persona avatar in persistent mode lives on screen independent of speech.
  const personaAvatar = withPersonaDefaults(config.persona, config.avatarPresets).avatar
  const personaAvatarKey = JSON.stringify(personaAvatar)
  useEffect(() => {
    if (personaAvatar.mode === 'persistent' && personaAvatar.images.length) {
      ensurePersonaAvatar(personaAvatar)
    } else {
      retirePersistentAvatar()
    }
  }, [personaAvatarKey]) // eslint-disable-line react-hooks/exhaustive-deps

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
