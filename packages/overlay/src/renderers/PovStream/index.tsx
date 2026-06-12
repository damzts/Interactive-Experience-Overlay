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
  const muted = Boolean(config.muted ?? false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const stream = useRtcStream()

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
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
        autoPlay
        playsInline
        muted={muted}
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
