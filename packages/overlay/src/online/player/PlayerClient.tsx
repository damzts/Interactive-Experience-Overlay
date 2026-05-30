/**
 * Player Client UI component for remote players.
 *
 * This component manages the full player lifecycle:
 * - Join interface: display name input, join button
 * - Permission request: camera and microphone
 * - Connected state: camera preview, audio level meter, connection status
 * - Controls: mute/unmute mic, enable/disable camera
 * - Error handling: room not found, room full, invalid name, permissions denied
 * - Reconnection: "Reconnecting..." during attempts, "Disconnected" + Rejoin after 5 failures
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  createPlayerConnection,
  requestMediaStream,
  type PlayerConnection,
  type ConnectionState,
  type PlayerConnectionEvent,
} from './connection.js'
import { AudioLevelAnalyzer } from './audio-analyzer.js'

export interface PlayerClientProps {
  /** The room code extracted from the URL path */
  roomCode: string
}

type Phase = 'join' | 'connecting' | 'connected'

export function PlayerClient({ roomCode }: PlayerClientProps) {
  const [phase, setPhase] = useState<Phase>('join')
  const [displayName, setDisplayName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [audioLevel, setAudioLevel] = useState(0)
  const [micMuted, setMicMuted] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [participantCount, setParticipantCount] = useState(0)
  const [reconnectFailed, setReconnectFailed] = useState(false)

  const connectionRef = useRef<PlayerConnection | null>(null)
  const analyzerRef = useRef<AudioLevelAnalyzer | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const levelFrameRef = useRef<number>(0)
  const peerCountRef = useRef(0)

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(levelFrameRef.current)
      connectionRef.current?.disconnect()
      analyzerRef.current?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Animate audio level meter when connected
  useEffect(() => {
    if (phase !== 'connected') return

    const tick = () => {
      if (analyzerRef.current) {
        setAudioLevel(analyzerRef.current.getCurrentLevel())
      }
      levelFrameRef.current = requestAnimationFrame(tick)
    }
    levelFrameRef.current = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(levelFrameRef.current)
  }, [phase])

  // Attach stream to video element when phase becomes connected
  useEffect(() => {
    if (phase === 'connected' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [phase])

  const handleJoin = useCallback(async () => {
    // Validate display name (Requirement 3.1: 1-32 characters)
    const trimmed = displayName.trim()
    if (trimmed.length < 1 || trimmed.length > 32) {
      setErrorMessage('Display name must be between 1 and 32 characters.')
      return
    }

    setPhase('connecting')
    setErrorMessage(null)

    // Request camera and microphone permissions (Requirement 3.2)
    let stream: MediaStream
    try {
      stream = await requestMediaStream()
    } catch {
      setErrorMessage(
        'Camera and microphone access are required to participate. Please grant permissions and try again.'
      )
      setPhase('join')
      return
    }

    streamRef.current = stream

    // Start audio analysis
    const analyzer = new AudioLevelAnalyzer()
    analyzer.start(stream, 100)
    analyzerRef.current = analyzer

    // Create connection and join room (Requirement 3.3)
    const connection = createPlayerConnection()
    connectionRef.current = connection

    // Listen for connection events
    connection.on((event: PlayerConnectionEvent) => {
      switch (event.type) {
        case 'state-change':
          setConnectionState(event.state)
          if (event.state === 'connected') {
            setReconnectFailed(false)
          }
          break
        case 'peer-joined':
          peerCountRef.current++
          setParticipantCount(peerCountRef.current)
          break
        case 'peer-left':
          peerCountRef.current = Math.max(0, peerCountRef.current - 1)
          setParticipantCount(peerCountRef.current)
          break
        case 'room-closed':
          setErrorMessage('The room has been closed by the host.')
          setPhase('join')
          break
        case 'reconnect-failed':
          // Requirement 10.4: show "Disconnected" with Rejoin after 5 failed attempts
          setReconnectFailed(true)
          break
        case 'error':
          console.warn('[PlayerClient]', event.message)
          break
      }
    })

    const result = await connection.join(roomCode, trimmed, stream, analyzer)

    if (result.ok) {
      setPhase('connected')
      peerCountRef.current = result.participants.length
      setParticipantCount(peerCountRef.current)
    } else {
      // Map error codes to user-friendly messages (Requirements 3.4, 3.5, 3.7)
      let message: string
      switch (result.code) {
        case 'room_not_found':
          message = 'Room not found. Please check the room code and try again.'
          break
        case 'room_full':
          message = 'This room is full. Please try again later.'
          break
        case 'invalid_name':
          message = 'Invalid display name. Please use 1-32 characters.'
          break
        default:
          message = result.error || 'Failed to join room. Please try again.'
      }
      setErrorMessage(message)
      setPhase('join')
      // Clean up stream since we failed to join
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      analyzer.stop()
      analyzerRef.current = null
      connection.disconnect()
      connectionRef.current = null
    }
  }, [displayName, roomCode])

  // Mute/unmute microphone (Requirement 10.5)
  const handleToggleMic = useCallback(() => {
    const next = !micMuted
    setMicMuted(next)
    connectionRef.current?.setMicrophoneEnabled(!next)
  }, [micMuted])

  // Enable/disable camera (Requirement 10.6)
  const handleToggleCamera = useCallback(() => {
    const next = !cameraEnabled
    setCameraEnabled(next)
    connectionRef.current?.setCameraEnabled(next)
  }, [cameraEnabled])

  // Rejoin after disconnect (Requirement 10.4)
  const handleRejoin = useCallback(() => {
    connectionRef.current?.disconnect()
    connectionRef.current = null
    analyzerRef.current?.stop()
    analyzerRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    peerCountRef.current = 0
    setPhase('join')
    setErrorMessage(null)
    setReconnectFailed(false)
    setConnectionState('disconnected')
    setParticipantCount(0)
    setMicMuted(false)
    setCameraEnabled(true)
    setAudioLevel(0)
  }, [])

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      {/* Room code always visible */}
      <div style={styles.roomBadge}>
        Room: <strong>{roomCode}</strong>
      </div>

      {/* Join Phase */}
      {phase === 'join' && (
        <div style={styles.joinCard}>
          <h1 style={styles.heading}>Join Room</h1>

          <label htmlFor="player-name" style={styles.label}>
            Display Name
          </label>
          <input
            id="player-name"
            type="text"
            placeholder="Your display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={32}
            aria-describedby={errorMessage ? 'join-error' : undefined}
            style={styles.input}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            autoFocus
          />

          {errorMessage && (
            <p id="join-error" role="alert" style={styles.error}>
              {errorMessage}
            </p>
          )}

          <button onClick={handleJoin} style={styles.primaryBtn}>
            Join
          </button>
        </div>
      )}

      {/* Connecting Phase */}
      {phase === 'connecting' && (
        <div style={styles.joinCard}>
          <p style={styles.connectingText}>Connecting...</p>
          <p style={styles.subText}>Setting up camera and microphone</p>
        </div>
      )}

      {/* Connected Phase (Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6) */}
      {phase === 'connected' && (
        <div style={styles.connectedContainer}>
          {/* Connection status indicator */}
          <div style={styles.statusBar}>
            <span
              style={{
                ...styles.statusDot,
                backgroundColor:
                  reconnectFailed || connectionState === 'disconnected'
                    ? '#ef4444'
                    : connectionState === 'connecting'
                      ? '#facc15'
                      : '#22c55e',
              }}
              aria-hidden="true"
            />
            <span style={styles.statusLabel}>
              {reconnectFailed
                ? 'Disconnected'
                : connectionState === 'connecting'
                  ? 'Reconnecting...'
                  : connectionState === 'connected'
                    ? 'Connected'
                    : 'Disconnected'}
            </span>
            <span style={styles.separator}>·</span>
            <span style={styles.participantLabel}>
              {participantCount} participant{participantCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Camera preview */}
          <div style={styles.videoWrapper}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                ...styles.video,
                opacity: cameraEnabled ? 1 : 0.3,
              }}
            />
            {!cameraEnabled && <div style={styles.cameraOffLabel}>Camera Off</div>}
          </div>

          {/* Audio level meter (Requirement 10.1) */}
          <div style={styles.meterRow}>
            <span style={styles.meterLabel}>
              {micMuted ? '🔇' : '🎤'}
            </span>
            <div style={styles.meterTrack} role="meter" aria-valuenow={Math.round(audioLevel * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Audio level">
              <div
                style={{
                  ...styles.meterFill,
                  width: `${Math.round(audioLevel * 100)}%`,
                  backgroundColor: micMuted
                    ? '#6b7280'
                    : audioLevel > 0.6
                      ? '#f59e0b'
                      : '#22c55e',
                }}
              />
            </div>
            {micMuted && <span style={styles.mutedBadge}>MUTED</span>}
          </div>

          {/* Controls */}
          <div style={styles.controlRow}>
            <button
              onClick={handleToggleMic}
              style={{
                ...styles.controlBtn,
                backgroundColor: micMuted ? '#dc2626' : '#333',
              }}
              aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {micMuted ? '🔇 Unmute' : '🎤 Mute'}
            </button>
            <button
              onClick={handleToggleCamera}
              style={{
                ...styles.controlBtn,
                backgroundColor: !cameraEnabled ? '#dc2626' : '#333',
              }}
              aria-label={cameraEnabled ? 'Disable camera' : 'Enable camera'}
            >
              {cameraEnabled ? '📷 Disable Camera' : '📷 Enable Camera'}
            </button>
          </div>

          {/* Rejoin button after reconnection failure (Requirement 10.4) */}
          {reconnectFailed && (
            <div style={styles.reconnectBox}>
              <p style={styles.reconnectText}>
                Connection lost. Reconnection failed after 5 attempts.
              </p>
              <button onClick={handleRejoin} style={styles.primaryBtn}>
                Rejoin
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Inline Styles ────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#111',
    color: '#fff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    position: 'relative',
  },
  roomBadge: {
    position: 'absolute',
    top: '1rem',
    left: '1rem',
    fontSize: '0.875rem',
    opacity: 0.7,
  },
  joinCard: {
    textAlign: 'center',
    maxWidth: 360,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  heading: {
    fontSize: '1.5rem',
    margin: '0 0 0.5rem 0',
    fontWeight: 600,
  },
  label: {
    fontSize: '0.875rem',
    textAlign: 'left',
    color: '#ccc',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    fontSize: '1rem',
    borderRadius: 6,
    border: '1px solid #444',
    backgroundColor: '#222',
    color: '#fff',
    boxSizing: 'border-box',
  },
  error: {
    color: '#f87171',
    fontSize: '0.875rem',
    margin: 0,
  },
  primaryBtn: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 600,
    borderRadius: 6,
    border: 'none',
    backgroundColor: '#2563eb',
    color: '#fff',
    cursor: 'pointer',
  },
  connectingText: {
    fontSize: '1.125rem',
    margin: 0,
  },
  subText: {
    fontSize: '0.875rem',
    color: '#999',
    margin: 0,
  },
  connectedContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    width: '100%',
    maxWidth: 480,
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: '#ccc',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  statusLabel: {
    fontWeight: 500,
  },
  separator: {
    opacity: 0.5,
  },
  participantLabel: {
    opacity: 0.7,
  },
  videoWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16 / 9',
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    transition: 'opacity 200ms ease',
  },
  cameraOffLabel: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999',
    fontSize: '1rem',
    fontWeight: 500,
    pointerEvents: 'none',
  },
  meterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
  },
  meterLabel: {
    fontSize: '1rem',
    width: 24,
    textAlign: 'center',
    flexShrink: 0,
  },
  meterTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 80ms linear',
  },
  mutedBadge: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: '#ef4444',
    letterSpacing: 1,
    flexShrink: 0,
  },
  controlRow: {
    display: 'flex',
    gap: '0.75rem',
    width: '100%',
  },
  controlBtn: {
    flex: 1,
    padding: '0.625rem 1rem',
    borderRadius: 6,
    border: '1px solid #444',
    color: '#fff',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  reconnectBox: {
    marginTop: '0.5rem',
    padding: '1rem',
    backgroundColor: '#1c1917',
    border: '1px solid #dc2626',
    borderRadius: 8,
    textAlign: 'center',
    width: '100%',
  },
  reconnectText: {
    margin: '0 0 0.75rem 0',
    fontSize: '0.875rem',
    color: '#fca5a5',
  },
}
