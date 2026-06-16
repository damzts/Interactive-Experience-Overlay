import { useEffect, useRef } from 'react'
import { useRtcStream } from '../../rtc/RtcStreamContext'

/**
 * PovStreamRenderer — pure display component.
 * Reads the singleton WebRTC MediaStream from RtcStreamContext (provided at app
 * root) and renders it as a full-bounds video layer. No socket or peer connection
 * ownership — the stream lifecycle is managed by RtcStreamProvider.
 *
 * Config:
 *   objectFit  — 'cover' | 'contain', default 'cover'
 *   opacity    — 0.0–1.0, default 1
 *   muted      — true/false, default false (pass audio through to OBS)
 */
export function PovStreamRenderer({ config }: import('../registry').RendererProps) {
  const objectFit = String(config.objectFit ?? 'cover') as 'cover' | 'contain'
  const opacity = Number(config.opacity ?? 1)
  const shouldMute = Boolean(config.muted ?? true)

  const videoRef = useRef<HTMLVideoElement>(null)
  const stream = useRtcStream()

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (!stream) {
      el.srcObject = null
      return
    }

    // Only update srcObject if it actually changed
    if (el.srcObject !== stream) {
      el.srcObject = stream
    }

    console.log('[PovStream] stream set, tracks:', stream.getTracks().map(t => `${t.kind}:${t.readyState}:${t.muted}`))

    // Debounce play() — wait for stream to stabilize (audio + video arrive ~50ms apart)
    const playTimer = setTimeout(() => {
      el.muted = true
      el.play().then(() => {
        console.log('[PovStream] playing (muted)', 'paused:', el.paused, 'videoWidth:', el.videoWidth)
      }).catch((e) => {
        if (e.name !== 'AbortError') {
          console.warn('[PovStream] play() failed:', e.name, e.message)
        }
      })
    }, 50)

    // Unmute after REAL user interaction (click only, not keydown from refresh)
    if (!shouldMute) {
      const tryUnmute = () => {
        if (el) {
          el.muted = false
          // If Chrome paused it due to unmute, re-play muted as fallback
          if (el.paused) {
            el.muted = true
            el.play().catch(() => {})
          } else {
            console.log('[PovStream] unmuted after user interaction')
          }
        }
      }
      document.addEventListener('click', tryUnmute, { once: true })

      return () => {
        clearTimeout(playTimer)
        document.removeEventListener('click', tryUnmute)
      }
    }

    return () => clearTimeout(playTimer)
  }, [stream, shouldMute])

  // Separate effect for frame detection — doesn't depend on stream identity changes
  useEffect(() => {
    if (!stream) return
    const el = videoRef.current
    if (!el) return
    const checkVideo = setInterval(() => {
      if (el.videoWidth > 0 && el.videoHeight > 0) {
        console.log('[PovStream] video has frames:', el.videoWidth, 'x', el.videoHeight)
        clearInterval(checkVideo)
      }
    }, 500)
    return () => clearInterval(checkVideo)
  }, [stream])

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity }}>
      {!stream && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0a0a0f', color: '#444', fontFamily: 'monospace', fontSize: 12,
        }}>
          Waiting for stream…
        </div>
      )}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit,
          display: stream ? 'block' : 'none',
        }}
      />
    </div>
  )
}
