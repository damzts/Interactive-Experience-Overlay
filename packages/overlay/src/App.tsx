import React, { useEffect, useRef, useState } from 'react'
import { withPersonaDefaults } from '@ieomlabs/shared'
import { useAppStore } from './store/useAppStore'
import { useSocket } from './socket/useSocket'
import { onKernelSignal } from './socket/kernelSignals'
import { audioEngine } from './engine/AudioEngine'
import { startAudioReactivityMonitor } from './engine/audioReactivityMonitor'
import { startAudioLevelMeter } from './engine/audioLevelMeter'
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

/**
 * Scene sources are authored (positioned/sized) against a fixed 1920x1080
 * design canvas — same convention as the WindowWidget "TV" scene-embed.
 * The stage below scales that canvas to fully cover whatever the real OBS
 * Browser Source resolution is (any aspect ratio, e.g. vertical/mobile),
 * cropping overflow instead of leaving unfilled space. Existing 16:9 setups
 * are unaffected: at a 1920x1080 output the scale factor is exactly 1.
 */
const STAGE_W = 1920
const STAGE_H = 1080

function useStageScale() {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width > 0 && height > 0) {
        setScale(Math.max(width / STAGE_W, height / STAGE_H))
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, scale }
}

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
  // Live VU meter feed for the Admin Audio panel — always on, independent of
  // the reactivity enabled/disabled toggle, so operators can verify a source
  // (mic, or a screen-share widget's audio routed into 'internal') is
  // actually reaching the analyser before enabling reactivity/automation.
  useEffect(() => startAudioLevelMeter(), [])
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
  // 'internal' automatically includes the audio of any currently-open
  // screen-share widget — see AudioEngine.registerExternalAudioSource(),
  // wired from ScreenWidget.tsx / renderers/ScreenShare — no separate
  // capture or permission prompt needed for that case.
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
  const { ref: stageContainerRef, scale: stageScale } = useStageScale()

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
        <div ref={stageContainerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          {stageScale > 0 ? (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: STAGE_W,
                height: STAGE_H,
                transform: `translate(-50%, -50%) scale(${stageScale})`,
              }}
            >
              <LayerErrorBoundary name="scene">
                <SceneCompositor
                  windows={visibleWindows}
                  sceneAge={sceneAge}
                />
              </LayerErrorBoundary>
            </div>
          ) : null}
        </div>

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
