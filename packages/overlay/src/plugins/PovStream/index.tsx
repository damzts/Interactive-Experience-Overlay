import { useEffect, useRef, useState } from 'react'
import { socket } from '../../socket/client'

/**
 * PovStreamRenderer — Overlay scene plugin that receives the auto-switched POV
 * stream from the server via WebRTC (pov-online:relay:* events) and renders it
 * as a full-bounds video layer.
 *
 * Config:
 *   objectFit  — 'cover' | 'contain', default 'cover'
 *   opacity    — 0.0–1.0, default 1
 *   muted      — true/false, default false (pass audio through to OBS)
 */
export function PovStreamRenderer({ config }: import('../registry').PluginProps) {
  const objectFit = String(config.objectFit ?? 'cover') as 'cover' | 'contain'
  const opacity = Number(config.opacity ?? 1)
  const muted = Boolean(config.muted ?? false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let cancelled = false

    const cleanup = () => {
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
      if (videoRef.current) videoRef.current.srcObject = null
      setConnected(false)
    }

    const handleOffer = async (payload: { sdp: string }) => {
      if (cancelled) return
      cleanup()
      try {
        const pc = new RTCPeerConnection({ iceServers: [] })
        pcRef.current = pc

        pc.ontrack = (event) => {
          if (!videoRef.current || cancelled) return
          const existing = videoRef.current.srcObject as MediaStream | null
          if (existing) {
            existing.addTrack(event.track)
          } else {
            videoRef.current.srcObject = new MediaStream([event.track])
          }
          setConnected(true)
        }

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('pov-online:relay:ice' as any, event.candidate.toJSON())
          }
        }

        await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp })
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('pov-online:relay:answer' as any, { sdp: answer.sdp })
      } catch (e) {
        console.warn('[pov-stream-plugin] offer error:', e)
      }
    }

    const handleIce = (candidate: RTCIceCandidateInit) => {
      pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
    }

    const subscribe = () => {
      cleanup()
      socket.emit('pov-online:relay:subscribe' as any)
    }

    socket.on('pov-online:relay:offer' as any, handleOffer)
    socket.on('pov-online:relay:ice' as any, handleIce)
    socket.on('connect', subscribe)

    if (socket.connected) subscribe()

    return () => {
      cancelled = true
      socket.off('pov-online:relay:offer' as any, handleOffer)
      socket.off('pov-online:relay:ice' as any, handleIce)
      socket.off('connect', subscribe)
      cleanup()
    }
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity }}>
      {!connected && (
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
          display: connected ? 'block' : 'none',
        }}
      />
    </div>
  )
}
