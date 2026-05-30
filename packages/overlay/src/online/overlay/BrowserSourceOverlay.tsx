/**
 * Browser Source Overlay for OBS — renders the active player's video full-screen.
 *
 * This component is designed to be loaded as an OBS Browser Source. It:
 * - Connects to the /online Socket.IO namespace and subscribes to room events
 * - Establishes WebRTC peer connections with all players to receive video streams
 * - Displays only the active player's stream full-screen with no UI chrome
 * - Supports 'cut' (instant) and 'fade' (CSS opacity) transitions between players
 * - Shows a black frame when no active stream is available
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  OnlineServerToOverlayEvents,
  OnlineClientToServerEvents,
  OnlineOverlaySwitchPayload,
  OnlinePeerJoinedPayload,
  OnlinePeerLeftPayload,
  SignalingMessage,
} from '@ieom/shared'

type OverlaySocket = Socket<OnlineServerToOverlayEvents, OnlineClientToServerEvents>

interface PeerState {
  connection: RTCPeerConnection
  stream: MediaStream | null
  displayName: string
}

export interface BrowserSourceOverlayProps {
  roomCode: string
}

/** ICE servers for WebRTC peer connections */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
]

/** Fade transition duration in milliseconds */
const FADE_DURATION_MS = 300

export function BrowserSourceOverlay({ roomCode }: BrowserSourceOverlayProps) {
  const socketRef = useRef<OverlaySocket | null>(null)
  const peersRef = useRef<Map<string, PeerState>>(new Map())
  const activeVideoRef = useRef<HTMLVideoElement | null>(null)
  const fadingVideoRef = useRef<HTMLVideoElement | null>(null)

  const [activePlayerId, setActivePlayerId] = useState<string | null>(null)
  const [transitionType, setTransitionType] = useState<'cut' | 'fade'>('cut')
  const [isFading, setIsFading] = useState(false)

  /**
   * Create a new RTCPeerConnection for a participant and set up event handlers.
   * The overlay acts as the receiver — it waits for offers from players.
   */
  const createPeerConnection = useCallback((participantId: string, displayName: string) => {
    const socket = socketRef.current
    if (!socket) return

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    // Add transceiver to receive video
    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addTransceiver('audio', { direction: 'recvonly' })

    const peerState: PeerState = {
      connection: pc,
      stream: null,
      displayName,
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track])
      peerState.stream = stream
      peersRef.current.set(participantId, peerState)

      // If this is the active player, attach stream to video element
      setActivePlayerId((currentActive) => {
        if (currentActive === participantId && activeVideoRef.current) {
          activeVideoRef.current.srcObject = stream
        }
        return currentActive
      })
    }

    // Send ICE candidates to the remote peer via signaling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const signal: SignalingMessage = {
          type: 'ice-candidate',
          from: 'overlay',
          to: participantId,
          roomCode,
          payload: event.candidate.toJSON(),
        }
        socket.emit('pov-online:signal', signal)
      }
    }

    peersRef.current.set(participantId, peerState)
    return pc
  }, [roomCode])

  /**
   * Clean up a peer connection and remove from state.
   */
  const cleanupPeer = useCallback((participantId: string) => {
    const peer = peersRef.current.get(participantId)
    if (peer) {
      peer.connection.close()
      peersRef.current.delete(participantId)
    }
  }, [])

  /**
   * Handle incoming signaling messages (SDP offers from players, ICE candidates).
   */
  const handleSignal = useCallback(async (message: SignalingMessage) => {
    const { from, type, payload } = message

    // Only process messages addressed to the overlay
    if (message.to !== 'overlay') return

    let peer = peersRef.current.get(from)

    if (type === 'offer') {
      // If we don't have a peer connection for this participant yet, create one
      if (!peer) {
        createPeerConnection(from, from)
        peer = peersRef.current.get(from)
      }
      if (!peer) return

      const pc = peer.connection
      await pc.setRemoteDescription(payload as RTCSessionDescriptionInit)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      const socket = socketRef.current
      if (socket) {
        const signal: SignalingMessage = {
          type: 'answer',
          from: 'overlay',
          to: from,
          roomCode,
          payload: answer,
        }
        socket.emit('pov-online:signal', signal)
      }
    } else if (type === 'ice-candidate') {
      if (peer) {
        await peer.connection.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit))
      }
    }
  }, [roomCode, createPeerConnection])

  /**
   * Handle switch events — transition from previous to new active player.
   */
  const handleSwitch = useCallback((payload: OnlineOverlaySwitchPayload) => {
    const { newId } = payload
    const peer = peersRef.current.get(newId)
    const newStream = peer?.stream ?? null

    setActivePlayerId((prevActiveId) => {
      if (transitionType === 'fade' && prevActiveId && prevActiveId !== newId) {
        // Fade transition: show fading-out video, then swap
        if (fadingVideoRef.current && activeVideoRef.current) {
          // Copy current stream to fading element
          fadingVideoRef.current.srcObject = activeVideoRef.current.srcObject
          fadingVideoRef.current.style.opacity = '1'

          // Set new stream on active element (starts transparent)
          activeVideoRef.current.srcObject = newStream
          activeVideoRef.current.style.opacity = '0'

          setIsFading(true)

          // After fade duration, complete the transition
          setTimeout(() => {
            if (fadingVideoRef.current) {
              fadingVideoRef.current.style.opacity = '0'
              fadingVideoRef.current.srcObject = null
            }
            if (activeVideoRef.current) {
              activeVideoRef.current.style.opacity = '1'
            }
            setIsFading(false)
          }, FADE_DURATION_MS)
        }
      } else {
        // Cut transition: instant swap
        if (activeVideoRef.current) {
          activeVideoRef.current.srcObject = newStream
        }
      }
      return newId
    })
  }, [transitionType])

  /**
   * Handle peer joined — create a new peer connection to receive their stream.
   */
  const handlePeerJoined = useCallback((payload: OnlinePeerJoinedPayload) => {
    const { participantId, displayName } = payload
    createPeerConnection(participantId, displayName)
  }, [createPeerConnection])

  /**
   * Handle peer left — clean up peer connection.
   */
  const handlePeerLeft = useCallback((payload: OnlinePeerLeftPayload) => {
    const { participantId } = payload

    cleanupPeer(participantId)

    // If the active player left, clear the video
    setActivePlayerId((current) => {
      if (current === participantId) {
        if (activeVideoRef.current) {
          activeVideoRef.current.srcObject = null
        }
        return null
      }
      return current
    })
  }, [cleanupPeer])

  /**
   * Main effect: establish Socket.IO connection and wire up event handlers.
   */
  useEffect(() => {
    const socket: OverlaySocket = io('/online', {
      autoConnect: true,
      auth: {
        clientType: 'overlay',
        roomCode,
      },
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      // Subscribe to room events
      socket.emit('pov-online:overlay:subscribe', { roomCode })
    })

    // Listen for switch events
    socket.on('pov-online:switch', handleSwitch)

    // Listen for peer joined/left
    socket.on('pov-online:peer:joined', handlePeerJoined)
    socket.on('pov-online:peer:left', handlePeerLeft)

    // Listen for signaling messages (offers from players, ICE candidates)
    // The server relays these to us via the same event
    ;(socket as any).on('pov-online:signal', handleSignal)

    // On reconnect, re-subscribe
    socket.on('connect', () => {
      socket.emit('pov-online:overlay:subscribe', { roomCode })
    })

    return () => {
      // Clean up all peer connections
      for (const [id] of peersRef.current) {
        cleanupPeer(id)
      }
      peersRef.current.clear()

      // Disconnect socket
      socket.off('pov-online:switch', handleSwitch)
      socket.off('pov-online:peer:joined', handlePeerJoined)
      socket.off('pov-online:peer:left', handlePeerLeft)
      ;(socket as any).off('pov-online:signal', handleSignal)
      socket.disconnect()
      socketRef.current = null
    }
  }, [roomCode, handleSwitch, handlePeerJoined, handlePeerLeft, handleSignal, cleanupPeer])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000',
        overflow: 'hidden',
        margin: 0,
        padding: 0,
      }}
    >
      {/* Active player video — fills viewport */}
      <video
        ref={activeVideoRef}
        autoPlay
        playsInline
        muted={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: '#000',
          transition: transitionType === 'fade' ? `opacity ${FADE_DURATION_MS}ms ease-in-out` : 'none',
          opacity: 1,
        }}
      />

      {/* Fading-out video element (used during fade transitions) */}
      <video
        ref={fadingVideoRef}
        autoPlay
        playsInline
        muted={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: 'transparent',
          transition: `opacity ${FADE_DURATION_MS}ms ease-in-out`,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
