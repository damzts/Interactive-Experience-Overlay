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
    el.srcObject = stream
    if (stream) {
      console.log('[PovStream] stream set, tracks:', stream.getTracks().map(t => `${t.kind}:${t.readyState}:${t.muted}`))
      // Start muted to satisfy autoplay policy, then unmute once playing
      el.muted = true
      el.play()
        .then(() => {
          el.muted = shouldMute
        })
        .catch(e => console.warn('[PovStream] play() rejected:', e))
      const checkVideo = setInterval(() => {
        if (el.videoWidth > 0 && el.videoHeight > 0) {
          console.log('[PovStream] video has frames:', el.videoWidth, 'x', el.videoHeight)
          clearInterval(checkVideo)
        }
      }, 500)
      return () => clearInterval(checkVideo)
    }
  }, [stream, shouldMute])

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
