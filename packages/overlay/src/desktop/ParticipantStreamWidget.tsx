import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { OnlineServerToAdminEvents, OnlineClientToServerEvents, AdminStreamOfferPayload, AdminStreamIceCandidatePayload } from '@ieomlabs/shared'
import { DesktopWindow } from './DesktopWindow'

type OnlineSocket = Socket<OnlineServerToAdminEvents, OnlineClientToServerEvents>

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
  const socketRef = useRef<OnlineSocket | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const sock: OnlineSocket = io(`${window.location.origin}/online`, {
      forceNew: false,
      auth: { clientType: 'overlay' },
    })
    socketRef.current = sock

    const cleanup = (userId?: string) => {
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
      if (videoRef.current) videoRef.current.srcObject = null
      if (!userId || !cancelled) setConnected(false)
    }

    const handleOffer = async (payload: AdminStreamOfferPayload) => {
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
        if (e.candidate) sock.emit('admin:ice-candidate', { userId: payload.userId, candidate: e.candidate.toJSON() })
      }

      try {
        await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp } as RTCSessionDescriptionInit)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        sock.emit('admin:answer', { userId: payload.userId, sdp: pc.localDescription!.sdp! })
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'WebRTC failed')
      }
    }

    const handleIce = ({ userId, candidate }: AdminStreamIceCandidatePayload) => {
      if (pcRef.current) {
        // Only handle if this matches our current participant
        pcRef.current.addIceCandidate(candidate as RTCIceCandidateInit).catch(() => {})
      }
    }

    const handleRemoved = ({ userId }: { userId: string }) => {
      cleanup()
      setDisplayName(null)
    }

    sock.on('admin:offer', handleOffer)
    sock.on('admin:ice-candidate', handleIce)
    sock.on('admin:stream-removed', handleRemoved as any)
    sock.on('connect_error', (e) => { if (!cancelled) setError(e.message) })

    return () => {
      cancelled = true
      sock.off('admin:offer', handleOffer)
      sock.off('admin:ice-candidate', handleIce)
      sock.off('admin:stream-removed', handleRemoved as any)
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
