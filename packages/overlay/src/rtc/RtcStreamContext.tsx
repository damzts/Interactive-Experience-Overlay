import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { socket } from '../socket/client'

const RtcStreamContext = createContext<MediaStream | null>(null)

export function useRtcStream(): MediaStream | null {
  return useContext(RtcStreamContext)
}

export function RtcStreamProvider({ children }: { children: React.ReactNode }) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)

  useEffect(() => {
    let cancelled = false

    const cleanup = (clearStream = true) => {
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
      if (clearStream && !cancelled) setStream(null)
    }

    const subscribe = () => {
      // Close old PeerConnection but DON'T clear the stream yet —
      // keep showing the last frame until the new stream arrives.
      cleanup(false)
      socket.emit('pov-online:relay:subscribe' as any)
    }

    const handleOffer = async (payload: { sdp: string }) => {
      if (cancelled) return
      // Close old PC without clearing stream (avoid freeze flash)
      cleanup(false)
      try {
        const pc = new RTCPeerConnection({ iceServers: [] })
        pcRef.current = pc

        const ms = new MediaStream()
        let streamSet = false
        pc.ontrack = (event) => {
          ms.addTrack(event.track)
          // Only set the stream if at least one track is live
          // Reject streams where all tracks are already ended
          if (!streamSet && !cancelled && event.track.readyState === 'live') {
            streamSet = true
            setStream(ms)
          }
        }

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('pov-online:relay:ice' as any, event.candidate.toJSON())
          }
        }

        let reconnectAttempt = 0;
        const RECONNECT_MAX_DELAY = 10000;

        pc.onconnectionstatechange = () => {
          if (pcRef.current?.connectionState === 'connected') {
            reconnectAttempt = 0;
          }
          if (pcRef.current?.connectionState === 'failed' && !cancelled) {
            reconnectAttempt++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempt - 1), RECONNECT_MAX_DELAY);
            setTimeout(() => {
              if (!cancelled) {
                subscribe();
              }
            }, delay);
          }
        };

        await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp })
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('pov-online:relay:answer' as any, { sdp: answer.sdp })
      } catch (e) {
        console.warn('[rtc-stream] offer error:', e)
      }
    }

    const handleIce = (candidate: RTCIceCandidateInit) => {
      pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
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
      cleanup(true)
    }
  }, [])

  return (
    <RtcStreamContext.Provider value={stream}>
      {children}
    </RtcStreamContext.Provider>
  )
}
