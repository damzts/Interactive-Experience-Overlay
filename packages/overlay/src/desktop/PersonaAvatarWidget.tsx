import { useEffect, useRef, useState } from 'react'
import { AVATAR_EMOTIONS, type AvatarEmotion } from '@ieomlabs/shared'
import { audioEngine } from '../engine/AudioEngine'
import { onKernelSignal } from '../socket/kernelSignals'
import { DesktopWindow } from './DesktopWindow'
import { addWidgetSimulationIntentListener, addWidgetChainActionListener, dispatchWidgetSignal } from './widgetSimulationEvents'

const EMOTION_STYLE: Record<AvatarEmotion, { face: string; glow: string; blush: boolean }> = {
  neutral: { face: '#7dd7f2', glow: '#3aa6c9', blush: false },
  happy:   { face: '#8ee6a8', glow: '#3fbf6f', blush: true },
  excited: { face: '#ffb26b', glow: '#ff7a3c', blush: true },
  sleepy:  { face: '#b7a8f2', glow: '#7d6bd9', blush: false },
}

function isEmotion(value: unknown): value is AvatarEmotion {
  return typeof value === 'string' && (AVATAR_EMOTIONS as readonly string[]).includes(value)
}

interface PersonaAvatarWidgetProps {
  appId?: string
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

export function PersonaAvatarWidget({
  appId = 'persona-avatar',
  onClose,
  onMinimize,
  onFocus,
  windowState = 'open',
  zIndex,
}: PersonaAvatarWidgetProps) {
  const [emotion, setEmotion] = useState<AvatarEmotion>('neutral')
  const [mouth, setMouth] = useState(0)          // 0 closed … 1 wide open
  const [blink, setBlink] = useState(false)
  const [caption, setCaption] = useState<string | null>(null)
  const captionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const smoothedRef = useRef(0)

  const applyEmotion = (next: AvatarEmotion) => {
    setEmotion(next)
    dispatchWidgetSignal({ source: appId, event: 'avatar:emotion-changed', payload: { emotion: next } })
  }

  // Mouth flap — time-domain RMS of the persona speech analyser.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const analyser = audioEngine.getPersonaAnalyser()
      if (analyser) {
        if (!dataRef.current || dataRef.current.length !== analyser.fftSize) {
          dataRef.current = new Uint8Array(analyser.fftSize)
        }
        analyser.getByteTimeDomainData(dataRef.current)
        let sum = 0
        for (let i = 0; i < dataRef.current.length; i++) {
          const v = (dataRef.current[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / dataRef.current.length)
        const target = Math.min(1, rms * 6)
        // Fast attack, slower release — reads as talking, not vibrating.
        const smoothing = target > smoothedRef.current ? 0.4 : 0.82
        smoothedRef.current = smoothedRef.current * smoothing + target * (1 - smoothing)
        setMouth(smoothedRef.current < 0.02 ? 0 : smoothedRef.current)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Blink every few seconds.
  useEffect(() => {
    let open: ReturnType<typeof setTimeout> | null = null
    const interval = setInterval(() => {
      setBlink(true)
      open = setTimeout(() => setBlink(false), 140)
    }, 3200 + Math.random() * 1800)
    return () => { clearInterval(interval); if (open) clearTimeout(open) }
  }, [])

  // Captions from spoken lines.
  useEffect(() => {
    return onKernelSignal('persona:speak', ({ text }) => {
      setCaption(text)
      if (captionTimer.current) clearTimeout(captionTimer.current)
      captionTimer.current = setTimeout(() => setCaption(null), 6000)
    })
  }, [])
  useEffect(() => () => { if (captionTimer.current) clearTimeout(captionTimer.current) }, [])

  // Emotion puppeting — ambiance simulation intents + automation chain actions.
  useEffect(() => {
    return addWidgetSimulationIntentListener((payload) => {
      if (payload.widgetId !== appId || payload.kind !== 'avatar:set-emotion') return
      const next = payload.params?.['emotion']
      applyEmotion(isEmotion(next) ? next : AVATAR_EMOTIONS[(AVATAR_EMOTIONS.indexOf(emotion) + 1) % AVATAR_EMOTIONS.length])
    })
  }, [appId, emotion])

  useEffect(() => {
    return addWidgetChainActionListener(({ targetWidgetId, action }) => {
      if (targetWidgetId !== appId || action !== 'avatar:set-emotion') return
      // chain carries no params — cycle emotions
      applyEmotion(AVATAR_EMOTIONS[(AVATAR_EMOTIONS.indexOf(emotion) + 1) % AVATAR_EMOTIONS.length])
    })
  }, [appId, emotion])

  const style = EMOTION_STYLE[emotion]
  const speaking = mouth > 0.03
  const eyesClosed = blink || emotion === 'sleepy'
  const mouthRy = 2 + mouth * 16
  const mouthWidth = 16 + mouth * 10

  return (
    <DesktopWindow
      id="persona-avatar"
      title="✦ Persona"
      width={240}
      defaultPosition={{ x: 1300, y: 420 }}
      zIndex={zIndex}
      state={windowState}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
    >
      <svg viewBox="0 0 120 120" width="100%" style={{ maxHeight: 170 }} data-sim-action="avatar-face">
        {/* aura */}
        <circle cx="60" cy="60" r="52" fill={style.glow} opacity={speaking ? 0.35 : 0.18}>
          {speaking && <animate attributeName="r" values="52;55;52" dur="0.6s" repeatCount="indefinite" />}
        </circle>
        {/* face */}
        <circle cx="60" cy="60" r="44" fill={style.face} stroke={style.glow} strokeWidth="2.5" />
        {/* eyes */}
        {eyesClosed ? (
          <>
            <path d="M 36 54 Q 44 60 52 54" stroke="#1c2733" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 68 54 Q 76 60 84 54" stroke="#1c2733" strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        ) : emotion === 'happy' ? (
          <>
            <path d="M 36 56 Q 44 48 52 56" stroke="#1c2733" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M 68 56 Q 76 48 84 56" stroke="#1c2733" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="44" cy="54" r={emotion === 'excited' ? 6 : 4.5} fill="#1c2733" />
            <circle cx="76" cy="54" r={emotion === 'excited' ? 6 : 4.5} fill="#1c2733" />
            <circle cx="46" cy="52" r="1.6" fill="#ffffff" />
            <circle cx="78" cy="52" r="1.6" fill="#ffffff" />
          </>
        )}
        {/* blush */}
        {style.blush && (
          <>
            <ellipse cx="34" cy="68" rx="7" ry="4" fill="#ff8ba0" opacity="0.55" />
            <ellipse cx="86" cy="68" rx="7" ry="4" fill="#ff8ba0" opacity="0.55" />
          </>
        )}
        {/* mouth — amplitude-driven */}
        <ellipse cx="60" cy="80" rx={mouthWidth / 2} ry={mouthRy / 2} fill="#1c2733" />
        {mouth > 0.25 && <ellipse cx="60" cy={80 + mouthRy / 4} rx={mouthWidth / 3.2} ry={mouthRy / 4} fill="#ff8ba0" />}
      </svg>

      <div style={{ display: 'flex', gap: 4 }}>
        {AVATAR_EMOTIONS.map((e) => (
          <button
            key={e}
            data-sim-action={`avatar-emotion-${e}`}
            onClick={() => applyEmotion(e)}
            title={e}
            style={{
              fontSize: 10, padding: '2px 6px', cursor: 'pointer',
              border: emotion === e ? `1.5px solid ${EMOTION_STYLE[e].glow}` : '1px solid #8886',
              background: emotion === e ? EMOTION_STYLE[e].face : 'transparent',
              borderRadius: 4,
            }}
          >
            {e}
          </button>
        ))}
      </div>

      {caption && (
        <div style={{
          fontSize: 11, lineHeight: 1.3, textAlign: 'center', padding: '4px 8px',
          borderRadius: 6, background: '#00000022', maxWidth: '100%',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {caption}
        </div>
      )}
    </DesktopWindow>
  )
}
