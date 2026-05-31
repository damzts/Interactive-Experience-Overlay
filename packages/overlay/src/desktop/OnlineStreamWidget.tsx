import { useEffect, useRef, useState } from 'react'
import { socket } from '../socket/client'
import { DesktopWindow } from './DesktopWindow'

interface DesktopWidgetProps {
  appId?: string
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

export function OnlineStreamWidget({ appId, onClose, onMinimize, onFocus, windowState = 'open', zIndex }: DesktopWidgetProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const handleOffer = async (payload: { sdp: string }) => {
      if (cancelled) return
      // Close previous connection if renegotiating
      if (pcRef.current) {
        pcRef.current.close()
        pcRef.current = null
        if (videoRef.current) videoRef.current.srcObject = null
      }
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        })
        pcRef.current = pc

        pc.ontrack = (event) => {
          if (videoRef.current) {
            const existing = videoRef.current.srcObject as MediaStream | null
            if (existing) {
              existing.addTrack(event.track)
            } else {
              videoRef.current.srcObject = new MediaStream([event.track])
            }
            setConnected(true)
          }
        }

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('pov:ice-candidate' as any, event.candidate.toJSON())
          }
        }

        await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp })
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('pov:answer' as any, { sdp: answer.sdp })
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'WebRTC connection failed')
      }
    }

    const handleIceCandidate = (candidate: RTCIceCandidateInit) => {
      pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
    }

    socket.on('pov:offer' as any, handleOffer)
    socket.on('pov:ice-candidate' as any, handleIceCandidate)
    socket.emit('pov:subscribe' as any)

    return () => {
      cancelled = true
      socket.off('pov:offer' as any, handleOffer)
      socket.off('pov:ice-candidate' as any, handleIceCandidate)
      pcRef.current?.close()
      pcRef.current = null
    }
  }, [])

  return (
    <DesktopWindow
      id={appId ?? 'online-stream'}
      title="📡 Online Stream"
      width={480}
      height={360}
      defaultPosition={{ x: 200, y: 80 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--camera"
      bodyClassName="desktop-window-body--camera"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: 0 }}
    >
      <div className="widget-panel widget-camera-frame">
        {!connected && !error && (
          <span className="widget-empty-state">Waiting for stream…</span>
        )}
        {error && (
          <div className="widget-camera-status">
            <span className="widget-camera-status-icon">📡</span>
            <span className="widget-empty-state widget-empty-state--error">{error}</span>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: connected ? 'block' : 'none',
          }}
        />
      </div>
    </DesktopWindow>
  )
}
