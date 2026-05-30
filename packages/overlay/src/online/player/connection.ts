/**
 * Player Client Socket.IO and WebRTC connection logic.
 * Framework-agnostic module managing the Socket.IO connection to the /online
 * namespace and WebRTC peer connections for media streaming.
 *
 * Requirements: 3.1, 3.2, 3.3, 4.1, 4.4, 4.5, 4.6, 5.2, 10.3, 10.4
 */

import { io, type Socket } from 'socket.io-client'
import type {
  OnlineClientToServerEvents,
  OnlineServerToClientEvents,
  OnlinePeerJoinedPayload,
  OnlinePeerLeftPayload,
  OnlineJoinedPayload,
  SignalingMessage,
} from '@ieom/shared'
import type { AudioLevelAnalyzer } from './audio-analyzer.js'

// ── Types ────────────────────────────────────────────────────────

export type ConnectionState = 'disconnected' | 'connecting' | 'connected'

export interface PeerInfo {
  participantId: string
  displayName: string
}

export interface PlayerConnectionConfig {
  /** Server URL (defaults to current origin) */
  serverUrl?: string
  /** Audio report interval in ms (default 100) */
  audioReportIntervalMs?: number
  /** WebRTC connection timeout in ms (default 15000) */
  connectionTimeoutMs?: number
  /** Max Socket.IO reconnection attempts (default 5) */
  maxReconnectAttempts?: number
}

export interface JoinResult {
  ok: true
  participantId: string
  participants: Array<{ id: string; displayName: string }>
}

export interface JoinError {
  ok: false
  error: string
  code?: 'room_not_found' | 'room_full' | 'invalid_name'
}

export type PlayerConnectionEvent =
  | { type: 'state-change'; state: ConnectionState }
  | { type: 'peer-joined'; peer: PeerInfo }
  | { type: 'peer-left'; participantId: string }
  | { type: 'room-closed'; roomCode: string }
  | { type: 'error'; message: string }
  | { type: 'reconnect-failed' }

type EventListener = (event: PlayerConnectionEvent) => void

// ── Video Constraints ────────────────────────────────────────────

/** Max 720p @ 30fps to conserve bandwidth (Requirement 4.4) */
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { max: 1280 },
  height: { max: 720 },
  frameRate: { max: 30 },
}

// ── ICE Configuration ────────────────────────────────────────────

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

// ── PlayerConnection Class ───────────────────────────────────────

/**
 * Manages the Socket.IO connection and WebRTC peer connections for a player.
 * This class is framework-agnostic and can be used by any UI component.
 */
export class PlayerConnection {
  private socket: Socket<OnlineServerToClientEvents, OnlineClientToServerEvents> | null = null
  private peerConnections: Map<string, RTCPeerConnection> = new Map()
  private localStream: MediaStream | null = null
  private audioAnalyzer: AudioLevelAnalyzer | null = null
  private audioLevelCleanup: (() => void) | null = null
  private listeners: EventListener[] = []
  private _state: ConnectionState = 'disconnected'
  private _participantId: string | null = null
  private _roomCode: string | null = null
  private config: Required<PlayerConnectionConfig>
  private connectionTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private retryAttempts: Map<string, number> = new Map()

  constructor(config: PlayerConnectionConfig = {}) {
    this.config = {
      serverUrl: config.serverUrl ?? '',
      audioReportIntervalMs: config.audioReportIntervalMs ?? 100,
      connectionTimeoutMs: config.connectionTimeoutMs ?? 15000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
    }
  }

  // ── Public Getters ───────────────────────────────────────────

  get state(): ConnectionState {
    return this._state
  }

  get participantId(): string | null {
    return this._participantId
  }

  get roomCode(): string | null {
    return this._roomCode
  }

  // ── Event Subscription ───────────────────────────────────────

  on(listener: EventListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private emit(event: PlayerConnectionEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  private setState(state: ConnectionState): void {
    if (this._state !== state) {
      this._state = state
      this.emit({ type: 'state-change', state })
    }
  }

  // ── Connection Lifecycle ─────────────────────────────────────

  /**
   * Join an online room. Establishes Socket.IO connection and emits join event.
   * @param roomCode - The 6-character room code
   * @param displayName - Player display name (1-32 chars)
   * @param stream - The local MediaStream (camera + mic)
   * @param analyzer - Optional AudioLevelAnalyzer instance for sending audio levels
   */
  async join(
    roomCode: string,
    displayName: string,
    stream: MediaStream,
    analyzer?: AudioLevelAnalyzer
  ): Promise<JoinResult | JoinError> {
    this.localStream = stream
    this.audioAnalyzer = analyzer ?? null
    this._roomCode = roomCode
    this.setState('connecting')

    // Create Socket.IO connection to /online namespace
    // Requirement 10.4: Socket.IO built-in reconnection, max 5 attempts
    this.socket = io(`${this.config.serverUrl}/online`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.config.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: {
        clientType: 'player',
      },
    }) as Socket<OnlineServerToClientEvents, OnlineClientToServerEvents>

    this.setupSocketListeners()

    // Wait for socket connection
    await this.waitForSocketConnect()

    // Emit join event with ack (Requirement 3.3)
    return new Promise<JoinResult | JoinError>((resolve) => {
      this.socket!.emit(
        'pov-online:join',
        { roomCode, displayName },
        (response) => {
          if (response.ok && response.participantId) {
            this._participantId = response.participantId
            this.setState('connected')
            this.startAudioLevelReporting()
            resolve({
              ok: true,
              participantId: response.participantId,
              participants: [],
            })
          } else {
            this.setState('disconnected')
            resolve({
              ok: false,
              error: response.error ?? 'Join failed',
              code: undefined,
            })
          }
        }
      )
    })
  }

  /**
   * Disconnect from the room and clean up all resources.
   */
  disconnect(): void {
    this.stopAudioLevelReporting()
    this.closeAllPeerConnections()
    this.clearAllTimeouts()

    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }

    this.localStream = null
    this.audioAnalyzer = null
    this._participantId = null
    this._roomCode = null
    this.setState('disconnected')
  }

  // ── Media Track Control ──────────────────────────────────────

  /**
   * Enable or disable the camera track.
   * When disabled, stops transmitting video but audio reports continue.
   * (Requirement 10.6)
   */
  setCameraEnabled(enabled: boolean): void {
    if (!this.localStream) return
    const videoTracks = this.localStream.getVideoTracks()
    for (const track of videoTracks) {
      track.enabled = enabled
    }
  }

  /**
   * Enable or disable the microphone track.
   * When muted, the AudioLevelAnalyzer will report 0.
   * (Requirement 10.5)
   */
  setMicrophoneEnabled(enabled: boolean): void {
    if (!this.localStream) return
    const audioTracks = this.localStream.getAudioTracks()
    for (const track of audioTracks) {
      track.enabled = enabled
    }
    if (this.audioAnalyzer) {
      this.audioAnalyzer.muted = !enabled
    }
  }

  // ── Peer Connection Management ───────────────────────────────

  /**
   * Create a WebRTC peer connection to a remote peer and send an SDP offer.
   * Implements 15s timeout with one retry (Requirement 4.6).
   */
  async createPeerConnection(targetId: string): Promise<void> {
    if (this.peerConnections.has(targetId)) {
      this.closePeerConnection(targetId)
    }

    const pc = new RTCPeerConnection(RTC_CONFIG)
    this.peerConnections.set(targetId, pc)

    // Add local tracks to the peer connection
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream)
      }
    }

    // Apply video constraints via sender parameters
    this.applyVideoConstraints(pc)

    // Handle ICE candidates — send to remote peer via signaling
    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket && this._participantId && this._roomCode) {
        const message: SignalingMessage = {
          type: 'ice-candidate',
          from: this._participantId,
          to: targetId,
          roomCode: this._roomCode,
          payload: event.candidate.toJSON(),
        }
        this.socket.emit('pov-online:signal', message)
      }
    }

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        this.handleConnectionFailure(targetId)
      }
    }

    // Create and send SDP offer (Requirement 4.1)
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      if (this.socket && this._participantId && this._roomCode) {
        const message: SignalingMessage = {
          type: 'offer',
          from: this._participantId,
          to: targetId,
          roomCode: this._roomCode,
          payload: offer,
        }
        this.socket.emit('pov-online:signal', message)
      }

      // Start connection timeout (15s) — Requirement 4.6
      this.startConnectionTimeout(targetId)
    } catch (err) {
      this.emit({
        type: 'error',
        message: `Failed to create offer for peer ${targetId}: ${err}`,
      })
    }
  }

  // ── Private: Socket.IO Event Handlers ────────────────────────

  private setupSocketListeners(): void {
    if (!this.socket) return

    // Handle joined response with participant list
    this.socket.on('pov-online:joined', (payload: OnlineJoinedPayload) => {
      this._participantId = payload.participantId
      // Establish peer connections with existing participants
      for (const participant of payload.participants) {
        if (participant.id !== this._participantId) {
          this.createPeerConnection(participant.id)
        }
      }
    })

    // Handle new peer joining (Requirement 4.3)
    this.socket.on('pov-online:peer:joined', (payload: OnlinePeerJoinedPayload) => {
      this.emit({
        type: 'peer-joined',
        peer: { participantId: payload.participantId, displayName: payload.displayName },
      })
      // Create peer connection to the new participant
      this.createPeerConnection(payload.participantId)
    })

    // Handle peer leaving
    this.socket.on('pov-online:peer:left', (payload: OnlinePeerLeftPayload) => {
      this.emit({ type: 'peer-left', participantId: payload.participantId })
      this.closePeerConnection(payload.participantId)
    })

    // Handle room closed
    this.socket.on('pov-online:room:closed', (payload) => {
      this.emit({ type: 'room-closed', roomCode: payload.roomCode })
      this.disconnect()
    })

    // Handle incoming signaling messages (SDP answers, ICE candidates)
    this.socket.on('pov-online:signal' as any, (message: SignalingMessage) => {
      this.handleSignalingMessage(message)
    })

    // Handle Socket.IO reconnection events (Requirement 10.3)
    this.socket.on('disconnect', () => {
      this.setState('connecting')
    })

    this.socket.on('connect', () => {
      if (this._participantId) {
        this.setState('connected')
      }
    })

    // Handle reconnection failure (Requirement 10.4)
    this.socket.io.on('reconnect_failed', () => {
      this.setState('disconnected')
      this.emit({ type: 'reconnect-failed' })
    })
  }

  private async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    const pc = this.peerConnections.get(message.from)

    if (message.type === 'answer' && pc) {
      try {
        await pc.setRemoteDescription(
          new RTCSessionDescription(message.payload as RTCSessionDescriptionInit)
        )
        // Connection established — clear timeout
        this.clearConnectionTimeout(message.from)
      } catch (err) {
        this.emit({
          type: 'error',
          message: `Failed to set remote description from ${message.from}: ${err}`,
        })
      }
    } else if (message.type === 'ice-candidate' && pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(message.payload as RTCIceCandidateInit))
      } catch (err) {
        // ICE candidate errors are non-fatal
      }
    } else if (message.type === 'offer') {
      // We received an offer — create answer
      await this.handleIncomingOffer(message)
    }
  }

  private async handleIncomingOffer(message: SignalingMessage): Promise<void> {
    let pc = this.peerConnections.get(message.from)

    if (!pc) {
      // Create a new peer connection for this peer
      pc = new RTCPeerConnection(RTC_CONFIG)
      this.peerConnections.set(message.from, pc)

      if (this.localStream) {
        for (const track of this.localStream.getTracks()) {
          pc.addTrack(track, this.localStream)
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && this.socket && this._participantId && this._roomCode) {
          const sig: SignalingMessage = {
            type: 'ice-candidate',
            from: this._participantId,
            to: message.from,
            roomCode: this._roomCode,
            payload: event.candidate.toJSON(),
          }
          this.socket.emit('pov-online:signal', sig)
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc!.connectionState === 'failed') {
          this.handleConnectionFailure(message.from)
        }
      }
    }

    try {
      await pc.setRemoteDescription(
        new RTCSessionDescription(message.payload as RTCSessionDescriptionInit)
      )
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      if (this.socket && this._participantId && this._roomCode) {
        const sig: SignalingMessage = {
          type: 'answer',
          from: this._participantId,
          to: message.from,
          roomCode: this._roomCode,
          payload: answer,
        }
        this.socket.emit('pov-online:signal', sig)
      }
    } catch (err) {
      this.emit({
        type: 'error',
        message: `Failed to handle offer from ${message.from}: ${err}`,
      })
    }
  }

  // ── Private: Connection Timeout (15s with 1 retry) ───────────

  private startConnectionTimeout(targetId: string): void {
    this.clearConnectionTimeout(targetId)

    const timeout = setTimeout(() => {
      this.handleConnectionTimeout(targetId)
    }, this.config.connectionTimeoutMs)

    this.connectionTimeouts.set(targetId, timeout)
  }

  private clearConnectionTimeout(targetId: string): void {
    const timeout = this.connectionTimeouts.get(targetId)
    if (timeout) {
      clearTimeout(timeout)
      this.connectionTimeouts.delete(targetId)
    }
  }

  private handleConnectionTimeout(targetId: string): void {
    const attempts = this.retryAttempts.get(targetId) ?? 0

    if (attempts < 1) {
      // Retry once (Requirement 4.6)
      this.retryAttempts.set(targetId, attempts + 1)
      this.closePeerConnection(targetId)
      this.createPeerConnection(targetId)
    } else {
      // Retry exhausted — report error
      this.retryAttempts.delete(targetId)
      this.clearConnectionTimeout(targetId)
      this.emit({
        type: 'error',
        message: `WebRTC connection to peer ${targetId} failed after retry`,
      })
    }
  }

  private handleConnectionFailure(targetId: string): void {
    const attempts = this.retryAttempts.get(targetId) ?? 0

    if (attempts < 1) {
      this.retryAttempts.set(targetId, attempts + 1)
      this.closePeerConnection(targetId)
      this.createPeerConnection(targetId)
    } else {
      this.retryAttempts.delete(targetId)
      this.emit({
        type: 'error',
        message: `WebRTC connection to peer ${targetId} failed after retry`,
      })
    }
  }

  private clearAllTimeouts(): void {
    for (const [, timeout] of this.connectionTimeouts) {
      clearTimeout(timeout)
    }
    this.connectionTimeouts.clear()
    this.retryAttempts.clear()
  }

  // ── Private: Audio Level Reporting ───────────────────────────

  /**
   * Wire the AudioLevelAnalyzer to send pov-online:audio-level events
   * at the configured interval (Requirement 5.2).
   */
  private startAudioLevelReporting(): void {
    if (!this.audioAnalyzer || !this.socket) return

    const callback = (level: number) => {
      if (this.socket?.connected) {
        this.socket.emit('pov-online:audio-level', { level })
      }
    }

    this.audioAnalyzer.onLevel(callback)
    this.audioLevelCleanup = () => {
      this.audioAnalyzer?.offLevel(callback)
    }
  }

  private stopAudioLevelReporting(): void {
    if (this.audioLevelCleanup) {
      this.audioLevelCleanup()
      this.audioLevelCleanup = null
    }
  }

  // ── Private: Peer Connection Helpers ─────────────────────────

  private closePeerConnection(targetId: string): void {
    const pc = this.peerConnections.get(targetId)
    if (pc) {
      pc.onicecandidate = null
      pc.onconnectionstatechange = null
      pc.close()
      this.peerConnections.delete(targetId)
    }
    this.clearConnectionTimeout(targetId)
  }

  private closeAllPeerConnections(): void {
    for (const [id] of this.peerConnections) {
      this.closePeerConnection(id)
    }
  }

  /**
   * Apply video constraints to the sender (Requirement 4.4: max 720p @ 30fps).
   * WebRTC's built-in adaptive bitrate handles degradation (Requirement 4.5).
   */
  private applyVideoConstraints(pc: RTCPeerConnection): void {
    const senders = pc.getSenders()
    for (const sender of senders) {
      if (sender.track?.kind === 'video') {
        const params = sender.getParameters()
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}]
        }
        params.encodings[0].maxBitrate = 2_500_000 // 2.5 Mbps max for 720p
        params.encodings[0].maxFramerate = 30
        sender.setParameters(params).catch(() => {
          // Non-fatal: browser may not support all encoding params
        })
      }
    }
  }

  // ── Private: Socket Connection Helper ────────────────────────

  private waitForSocketConnect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'))
        return
      }

      if (this.socket.connected) {
        resolve()
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error('Socket connection timeout'))
      }, 10_000)

      this.socket.once('connect', () => {
        clearTimeout(timeout)
        resolve()
      })

      this.socket.once('connect_error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })
  }
}

// ── Factory Function ─────────────────────────────────────────────

/**
 * Create a PlayerConnection instance with the given configuration.
 * Convenience factory for use in UI components.
 */
export function createPlayerConnection(config?: PlayerConnectionConfig): PlayerConnection {
  return new PlayerConnection(config)
}

// ── Media Helpers ────────────────────────────────────────────────

/**
 * Request camera and microphone permissions and return the MediaStream.
 * Applies video constraints (max 720p @ 30fps) per Requirement 4.4.
 */
export async function requestMediaStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: VIDEO_CONSTRAINTS,
    audio: true,
  })
}
