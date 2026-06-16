/**
 * RTC Stream Context — P2P direct connections to all guests.
 *
 * Each guest connects directly to the overlay via WebRTC P2P.
 * The server only relays signaling (SDP offers/answers/ICE candidates)
 * and decides which guest to show (POV switch).
 *
 * Switch = instant CSS swap between video elements. No media re-negotiation.
 *
 * Protocol (Socket.IO events):
 *   overlay → server: 'pov-online:relay:subscribe'
 *   server → overlay: 'pov-online:p2p:offer' { userId, sdp }
 *   overlay → server: 'pov-online:p2p:answer' { userId, sdp }
 *   server → overlay: 'pov-online:p2p:ice' { userId, candidate }
 *   overlay → server: 'pov-online:p2p:ice' { userId, candidate }
 *   server → overlay: 'pov-online:p2p:switch' { userId }
 *   server → overlay: 'pov-online:p2p:remove' { userId }
 */

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { socket } from '../socket/client'

// ── Types ────────────────────────────────────────────────────────

interface PeerStream {
  userId: string
  stream: MediaStream
  pc: RTCPeerConnection
}

interface RtcStreamState {
  /** The currently active (visible) stream */
  activeStream: MediaStream | null
  /** All connected peer streams (for debugging) */
  peers: Map<string, PeerStream>
}

// ── Context ──────────────────────────────────────────────────────

const RtcStreamContext = createContext<MediaStream | null>(null)

export function useRtcStream(): MediaStream | null {
  return useContext(RtcStreamContext)
}

// ── Provider ─────────────────────────────────────────────────────

export function RtcStreamProvider({ children }: { children: React.ReactNode }) {
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null)
  const peersRef = useRef<Map<string, PeerStream>>(new Map())
  const activeUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const subscribe = () => {
      console.info('[rtc-p2p] subscribing')
      socket.emit('pov-online:relay:subscribe' as any)
    }

    // ── Handle new P2P offer from a guest (relayed via server) ──
    const handleOffer = async (payload: { userId: string; sdp: string }) => {
      if (cancelled) return
      const { userId, sdp } = payload
      console.info(`[rtc-p2p] offer from ${userId}`)

      // Close existing PC for this user (re-offer)
      const existing = peersRef.current.get(userId)
      if (existing) {
        existing.pc.close()
        peersRef.current.delete(userId)
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      })

      const ms = new MediaStream()
      let streamReady = false

      pc.ontrack = (event) => {
        ms.addTrack(event.track)
        if (!streamReady && event.track.kind === 'video') {
          streamReady = true
          const peer: PeerStream = { userId, stream: ms, pc }
          peersRef.current.set(userId, peer)
          console.info(`[rtc-p2p] ${userId} stream ready (${ms.getTracks().length} tracks)`)

          // If this is the active user or no active user yet, show this stream
          if (!activeUserIdRef.current || activeUserIdRef.current === userId) {
            activeUserIdRef.current = userId
            if (!cancelled) setActiveStream(ms)
          }
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('pov-online:p2p:ice' as any, {
            userId,
            candidate: event.candidate.toJSON(),
          })
        }
      }

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState
        console.info(`[rtc-p2p] ${userId} connection: ${state}`)
        if (state === 'failed' || state === 'closed') {
          peersRef.current.delete(userId)
          if (activeUserIdRef.current === userId) {
            // Switch to another available peer
            const nextPeer = peersRef.current.values().next().value
            activeUserIdRef.current = nextPeer?.userId ?? null
            if (!cancelled) setActiveStream(nextPeer?.stream ?? null)
          }
        }
      }

      try {
        await pc.setRemoteDescription({ type: 'offer', sdp })
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        socket.emit('pov-online:p2p:answer' as any, {
          userId,
          sdp: answer.sdp,
        })

        // Store PC even before tracks arrive (for ICE candidates)
        if (!peersRef.current.has(userId)) {
          peersRef.current.set(userId, { userId, stream: ms, pc })
        }
      } catch (e) {
        console.error(`[rtc-p2p] offer handling failed for ${userId}:`, e)
        pc.close()
      }
    }

    // ── Handle ICE candidate from guest ──
    const handleIce = (payload: { userId: string; candidate: RTCIceCandidateInit }) => {
      const peer = peersRef.current.get(payload.userId)
      if (peer) {
        peer.pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {})
      }
    }

    // ── Handle switch command from server ──
    const handleSwitch = (payload: { userId: string }) => {
      const peer = peersRef.current.get(payload.userId)
      if (peer) {
        console.info(`[rtc-p2p] switching to ${payload.userId}`)
        activeUserIdRef.current = payload.userId
        if (!cancelled) setActiveStream(peer.stream)
      } else {
        console.warn(`[rtc-p2p] switch to ${payload.userId} but no peer found`)
        activeUserIdRef.current = payload.userId
      }
    }

    // ── Handle participant removal ──
    const handleRemove = (payload: { userId: string }) => {
      const peer = peersRef.current.get(payload.userId)
      if (peer) {
        peer.pc.close()
        peersRef.current.delete(payload.userId)
        console.info(`[rtc-p2p] removed ${payload.userId}`)

        if (activeUserIdRef.current === payload.userId) {
          const nextPeer = peersRef.current.values().next().value
          activeUserIdRef.current = nextPeer?.userId ?? null
          if (!cancelled) setActiveStream(nextPeer?.stream ?? null)
        }
      }
    }

    // ── Legacy support: handle old mediasoup offer format ──
    // If server sends the old format, ignore it gracefully
    const handleLegacyOffer = (payload: any) => {
      if (payload.transportOptions) {
        console.info('[rtc-p2p] ignoring legacy mediasoup offer')
        return
      }
      // Not legacy — might be P2P format
      if (payload.userId && payload.sdp) {
        handleOffer(payload)
      }
    }

    socket.on('pov-online:p2p:offer' as any, handleOffer)
    socket.on('pov-online:p2p:ice' as any, handleIce)
    socket.on('pov-online:p2p:switch' as any, handleSwitch)
    socket.on('pov-online:p2p:remove' as any, handleRemove)
    // Keep listening to old event for backward compat during transition
    socket.on('pov-online:relay:offer' as any, handleLegacyOffer)
    socket.on('connect', subscribe)

    if (socket.connected) subscribe()

    return () => {
      cancelled = true
      socket.off('pov-online:p2p:offer' as any, handleOffer)
      socket.off('pov-online:p2p:ice' as any, handleIce)
      socket.off('pov-online:p2p:switch' as any, handleSwitch)
      socket.off('pov-online:p2p:remove' as any, handleRemove)
      socket.off('pov-online:relay:offer' as any, handleLegacyOffer)
      socket.off('connect', subscribe)

      // Close all peer connections
      for (const peer of peersRef.current.values()) {
        peer.pc.close()
      }
      peersRef.current.clear()
    }
  }, [])

  return (
    <RtcStreamContext.Provider value={activeStream}>
      {children}
    </RtcStreamContext.Provider>
  )
}
