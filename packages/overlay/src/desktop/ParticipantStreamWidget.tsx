import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { RoomServerToAdminEvents, RoomClientToServerEvents, RoomPreviewOfferPayload, RoomPreviewIcePayload } from '@ieomlabs/shared'
import { DesktopWindow } from './DesktopWindow'

type RoomSocket = Socket<RoomServerToAdminEvents, RoomClientToServerEvents>

interface DesktopWidgetProps {
  appId?: string
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

export function ParticipantStreamWidget({ appId, onClose, onMinimize, onFocus, windowState = 'open', zIndex }: DesktopWidgetProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const socketRef = useRef<RoomSocket | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const sock: RoomSocket = io(`${window.location.origin}/room`, {
      forceNew: false,
      auth: { clientType: 'admin' },
    })
    socketRef.current = sock

    const cleanup = (userId?: string) => {
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
      if (videoRef.current) videoRef.current.srcObject = null
      if (!userId || !cancelled) setConnected(false)
    }

    const handleOffer = async (payload: RoomPreviewOfferPayload) => {
      if (cancelled || !payload.hasVideo) return
      cleanup(payload.userId)

      const pc = new RTCPeerConnection(ICE_CONFIG)
      pcRef.current = pc

      pc.ontrack = (event) => {
        if (cancelled || !videoRef.current) return
        const existing = videoRef.current.srcObject as MediaStream | null
        if (existing) existing.addTrack(event.track)
        else videoRef.current.srcObject = new MediaStream([event.track])
        setConnected(true)
        setDisplayName(payload.displayName)
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) sock.emit('pov-online:preview:ice', { userId: payload.userId, candidate: e.candidate.toJSON() })
      }

      try {
        await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp } as RTCSessionDescriptionInit)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        sock.emit('pov-online:preview:answer', { userId: payload.userId, sdp: pc.localDescription!.sdp! })
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'WebRTC failed')
      }
    }

    const handleIce = ({ userId: _userId, candidate }: RoomPreviewIcePayload) => {
      if (pcRef.current) {
        pcRef.current.addIceCandidate(candidate as RTCIceCandidateInit).catch(() => {})
      }
    }

    const handleRemoved = ({ userId: _userId }: { userId: string }) => {
      cleanup()
      setDisplayName(null)
    }

    sock.on('pov-online:preview:offer', handleOffer)
    sock.on('pov-online:preview:ice', handleIce)
    sock.on('pov-online:preview:removed', handleRemoved as any)
    sock.on('connect_error', (e) => { if (!cancelled) setError(e.message) })

    return () => {
      cancelled = true
      sock.off('pov-online:preview:offer', handleOffer)
      sock.off('pov-online:preview:ice', handleIce)
      sock.off('pov-online:preview:removed', handleRemoved as any)
      sock.disconnect()
      socketRef.current = null
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
    }
  }, [])

  return (
    <DesktopWindow
      id={appId ?? 'participant-stream'}
      title={`📹 ${displayName ?? 'Participant Stream'}`}
      width={480}
      height={360}
      defaultPosition={{ x: 240, y: 100 }}
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
          <span className="widget-empty-state">Waiting for participant…</span>
        )}
        {error && (
          <div className="widget-camera-status">
            <span className="widget-camera-status-icon">📹</span>
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
