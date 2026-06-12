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

    const cleanup = () => {
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
      if (!cancelled) setStream(null)
    }

    const subscribe = () => {
      cleanup()
      socket.emit('pov-online:relay:subscribe' as any)
    }

    const handleOffer = async (payload: { sdp: string }) => {
      if (cancelled) return
      cleanup()
      try {
        const pc = new RTCPeerConnection({ iceServers: [] })
        pcRef.current = pc

        const ms = new MediaStream()
        let streamSet = false
        pc.ontrack = (event) => {
          ms.addTrack(event.track)
          if (!streamSet && !cancelled) {
            streamSet = true
            setStream(ms)
          }
        }

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('pov-online:relay:ice' as any, event.candidate.toJSON())
          }
        }

        pc.onconnectionstatechange = () => {
          if (pcRef.current?.connectionState === 'failed' && !cancelled) {
            subscribe()
          }
        }

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
      cleanup()
    }
  }, [])

  return (
    <RtcStreamContext.Provider value={stream}>
      {children}
    </RtcStreamContext.Provider>
  )
}
