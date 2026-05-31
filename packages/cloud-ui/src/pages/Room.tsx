import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'

type Phase = 'join' | 'connecting' | 'waiting-hub' | 'connected'

export function Room() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const [phase, setPhase] = useState<Phase>('join')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [micMuted, setMicMuted] = useState(false)
  const [cameraOn, setCameraOn] = useState(true)

  const socketRef = useRef<Socket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    pcRef.current?.close()
    socketRef.current?.disconnect()
  }, [])

  useEffect(() => cleanup, [cleanup])

  const createPeerConnection = (socket: Socket, stream: MediaStream) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })
    pcRef.current = pc

    // Add local tracks
    stream.getTracks().forEach(track => pc.addTrack(track, stream))

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        })
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setPhase('connected')
      if (pc.connectionState === 'failed') setError('Connection failed')
    }

    return pc
  }

  const sendOffer = async (socket: Socket, pc: RTCPeerConnection) => {
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    socket.emit('offer', { sdp: offer.sdp })
  }

  const handleJoin = async () => {
    if (!displayName.trim() || !roomCode) return
    setPhase('connecting')
    setError(null)

    try {
      // 1. Get media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream

      // 2. Connect socket to /rooms namespace
      const socket = io('/rooms', {
        auth: { role: 'participant', roomId: roomCode },
        transports: ['websocket'],
      })
      socketRef.current = socket

      await new Promise<void>((resolve, reject) => {
        socket.on('connect', resolve)
        socket.on('connect_error', (e) => reject(e))
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      })

      // 3. Join as participant
      const userId = crypto.randomUUID()
      socket.emit('join-as-participant', { roomId: roomCode, displayName: displayName.trim(), userId })

      // 4. Handle hub-info (hub is ready, send offer)
      socket.on('hub-info', async () => {
        const pc = createPeerConnection(socket, stream)
        await sendOffer(socket, pc)
        setPhase('waiting-hub')
      })

      // 5. Handle answer from hub
      socket.on('answer', async (payload: { sdp: string }) => {
        const pc = pcRef.current
        if (pc) await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp })
      })

      // 6. Handle ICE candidates from hub
      socket.on('ice-candidate', (payload: { candidate: string; sdpMid?: string; sdpMLineIndex?: number }) => {
        pcRef.current?.addIceCandidate(new RTCIceCandidate({
          candidate: payload.candidate,
          sdpMid: payload.sdpMid ?? undefined,
          sdpMLineIndex: payload.sdpMLineIndex ?? undefined,
        }))
      })

      // 7. Handle hub disconnect
      socket.on('hub-disconnected', () => {
        pcRef.current?.close()
        pcRef.current = null
        setPhase('waiting-hub')
        setError('Hub disconnected. Waiting for reconnection...')
      })

      socket.on('error', (payload: { message: string }) => {
        setError(payload.message)
        setPhase('join')
        cleanup()
      })

      // If hub is already connected, we'll get hub-info immediately
      // Otherwise wait in connecting state
      setPhase('waiting-hub')
    } catch (e: any) {
      setError(e.message || 'Connection failed')
      setPhase('join')
      cleanup()
    }
  }

  const toggleMic = () => {
    const audioTrack = streamRef.current?.getAudioTracks()[0]
    if (!audioTrack) return
    audioTrack.enabled = !audioTrack.enabled
    setMicMuted(!audioTrack.enabled)
  }

  const toggleCamera = () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0]
    if (!videoTrack) return
    videoTrack.enabled = !videoTrack.enabled
    setCameraOn(videoTrack.enabled)
  }

  if (phase === 'join') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui', background: '#111', color: '#fff' }}>
        <h2>Join Room: {roomCode}</h2>
        {error && <p style={{ color: '#f44' }}>{error}</p>}
        <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" maxLength={32}
          style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #555', background: '#222', color: '#fff' }}
          onKeyDown={e => e.key === 'Enter' && handleJoin()} />
        <button onClick={handleJoin} disabled={!displayName.trim()}
          style={{ marginTop: '1rem', padding: '0.75rem 2rem', fontSize: '1rem', borderRadius: '4px', background: '#4285f4', color: '#fff', border: 'none', cursor: 'pointer' }}>
          Join
        </button>
      </div>
    )
  }

  if (phase === 'connecting' || phase === 'waiting-hub') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui', background: '#111', color: '#fff' }}>
        <p>{phase === 'connecting' ? 'Connecting...' : 'Waiting for host to connect...'}</p>
        {error && <p style={{ color: '#f44' }}>{error}</p>}
        <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', maxWidth: '320px', borderRadius: '8px', background: '#000', marginTop: '1rem' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', fontFamily: 'system-ui', background: '#111', color: '#fff', padding: '1rem' }}>
      <h3>Connected to {roomCode}</h3>
      <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', maxWidth: '480px', borderRadius: '8px', background: '#000', marginTop: '1rem' }} />
      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
        <button onClick={toggleMic} style={{ padding: '0.5rem 1.5rem', borderRadius: '4px', border: 'none', background: micMuted ? '#f44' : '#4caf50', color: '#fff', cursor: 'pointer' }}>
          {micMuted ? 'Unmute' : 'Mute'}
        </button>
        <button onClick={toggleCamera} style={{ padding: '0.5rem 1.5rem', borderRadius: '4px', border: 'none', background: cameraOn ? '#4caf50' : '#f44', color: '#fff', cursor: 'pointer' }}>
          {cameraOn ? 'Camera Off' : 'Camera On'}
        </button>
      </div>
    </div>
  )
}
