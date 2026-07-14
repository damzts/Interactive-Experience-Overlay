import { useEffect, useRef, useState } from 'react'
import { socket } from '../socket/client'

export interface RemoteScreenShareState {
  stream: MediaStream | null
  /** True once an offer for this widgetId has been received and we're negotiating/connected. */
  connecting: boolean
  error: string | null
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
]

/**
 * Subscribes to a screen share published by the admin app for a given
 * widgetId, relayed through the server's local screen-share signaling
 * (see packages/server/src/transport/webrtc/screen-share-relay.ts).
 *
 * The overlay never calls getDisplayMedia() itself — it's a passive OBS
 * render target with no user gesture available. It only answers WebRTC
 * offers relayed from whichever admin tab is currently publishing this
 * widgetId's screen share.
 *
 * Pass enabled=false to skip subscribing entirely (no listeners registered,
 * no PeerConnection created even if an offer arrives) — used when the
 * consumer's feature is toggled off (e.g. audio reactivity disabled).
 */
export function useRemoteScreenShare(widgetId: string, enabled = true): RemoteScreenShareState {
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setStream(null)
      setConnecting(false)
      setError(null)
      return
    }

    let cancelled = false

    const teardown = () => {
      pcRef.current?.close()
      pcRef.current = null
      if (!cancelled) {
        setStream(null)
        setConnecting(false)
      }
    }

    const handleOffer = async (payload: { widgetId: string; sdp: string }) => {
      if (payload.widgetId !== widgetId || cancelled) return
      console.log('[screen-share] offer received for', widgetId, 'pcRef state:', pcRef.current?.signalingState ?? 'none')

      // Re-offer (publisher restarted) — tear down any existing PC first.
      pcRef.current?.close()
      setError(null)
      setConnecting(true)

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      pcRef.current = pc

      const remoteStream = new MediaStream()
      pc.ontrack = (event) => {
        console.log('[screen-share] ontrack', event.track.kind)
        remoteStream.addTrack(event.track)
        if (!cancelled) setStream(remoteStream)
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('screen-share:ice:overlay', { widgetId, candidate: event.candidate.toJSON() })
        }
      }

      pc.onconnectionstatechange = () => {
        console.log('[screen-share] connectionState:', pc.connectionState)
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          if (pcRef.current === pc) teardown()
        }
      }

      pc.onsignalingstatechange = () => {
        console.log('[screen-share] signalingState:', pc.signalingState)
      }

      pc.onicegatheringstatechange = () => {
        console.log('[screen-share] iceGatheringState:', pc.iceGatheringState)
      }

      pc.oniceconnectionstatechange = () => {
        console.log('[screen-share] iceConnectionState:', pc.iceConnectionState)
      }

      try {
        await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp })
        console.log('[screen-share] setRemoteDescription ok, creating answer...')
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        console.log('[screen-share] answer sent')
        socket.emit('screen-share:answer', { widgetId, sdp: answer.sdp ?? '' })
        if (!cancelled) setConnecting(false)
      } catch (err) {
        console.error('[screen-share] handleOffer failed:', err)
        if (!cancelled) setError('Failed to establish screen share connection.')
        teardown()
      }
    }

    const handleIce = (payload: { widgetId: string; candidate: RTCIceCandidateInit }) => {
      if (payload.widgetId !== widgetId) return
      pcRef.current?.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {})
    }

    const handleStop = (payload: { widgetId: string }) => {
      if (payload.widgetId !== widgetId) return
      teardown()
    }

    socket.on('screen-share:offer', handleOffer)
    socket.on('screen-share:ice:admin', handleIce)
    socket.on('screen-share:stop', handleStop)

    // Tell the admin publisher we're ready. If a share is already active for
    // this widgetId (e.g. the source was started before this widget opened, or
    // the widget's sourceId was just changed), the publisher will re-send its
    // offer so we can complete the WebRTC handshake without the user having to
    // stop and restart the share manually.
    console.log('[screen-share] subscribing and requesting offer for', widgetId)
    socket.emit('screen-share:request-offer', { widgetId })

    return () => {
      cancelled = true
      socket.off('screen-share:offer', handleOffer)
      socket.off('screen-share:ice:admin', handleIce)
      socket.off('screen-share:stop', handleStop)
      pcRef.current?.close()
      pcRef.current = null
    }
  }, [widgetId, enabled])

  return { stream, connecting, error }
}
