/**
 * WebRTC room client for stream rooms integration.
 * Manages signaling WebSocket connections and WebRTC peer connections
 * for collaborative streaming with other IEOM users.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

import { BrowserWindow, Notification } from 'electron';
import { loadToken } from './token-storage.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIGNALING_BASE_URL =
  process.env.IEOM_SIGNALING_URL || 'wss://app.ieom.gg/rooms/signal';

/** Maximum number of concurrent peer connections allowed. */
const MAX_PEERS = 8;

/** Timeout for establishing a single peer connection (ms). */
const PEER_CONNECTION_TIMEOUT_MS = 15_000;

/** Initial backoff delay for reconnection (ms). */
const BACKOFF_START_MS = 1_000;

/** Maximum backoff delay cap (ms). */
const BACKOFF_CAP_MS = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PeerState {
  id: string;
  connection: RTCPeerConnection | null;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
  connected: boolean;
}

export type RoomStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

interface SignalingMessage {
  type: string;
  peerId?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  participants?: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let signalingSocket: WebSocket | null = null;
let currentRoomId: string | null = null;
let roomStatus: RoomStatus = 'disconnected';
let consecutiveFailures = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let intentionalDisconnect = false;

/** Map of peer ID → PeerState for active peer connections. */
const peers: Map<string, PeerState> = new Map();

// ---------------------------------------------------------------------------
// Pure utility functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Calculate exponential backoff delay for a given attempt number.
 * Formula: min(2^(attempt-1) * 1000, 30000)
 *
 * @param attempt - The consecutive failure count (starts at 1)
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number): number {
  if (attempt < 1) return BACKOFF_START_MS;
  const delay = Math.pow(2, attempt - 1) * BACKOFF_START_MS;
  return Math.min(delay, BACKOFF_CAP_MS);
}

// ---------------------------------------------------------------------------
// IPC / Notification helpers
// ---------------------------------------------------------------------------

/**
 * Send a message to all admin windows via IPC.
 */
function notifyAdminWindow(channel: string, data: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

/**
 * Emit room status change to admin windows.
 */
function emitRoomStatus(status: RoomStatus, detail?: string): void {
  roomStatus = status;
  notifyAdminWindow('room:status', { status, detail });
}

/**
 * Notify admin window of a peer connection failure.
 */
function notifyPeerFailure(peerId: string, reason: string): void {
  notifyAdminWindow('room:peer-failed', { peerId, reason });
}

/**
 * Show a system notification to the user.
 */
function showNotification(title: string, body: string): void {
  if (Notification.isSupported()) {
    const notification = new Notification({ title, body });
    notification.show();
  }
}

// ---------------------------------------------------------------------------
// Peer connection management
// ---------------------------------------------------------------------------

/**
 * Create and configure a new RTCPeerConnection for a given peer.
 * Sets up event handlers for ICE candidates, tracks, and connection state.
 */
function createPeerConnection(peerId: string): RTCPeerConnection | null {
  // Enforce max peer limit
  if (peers.size >= MAX_PEERS) {
    console.warn(
      `[room-service] Max peer limit (${MAX_PEERS}) reached. Rejecting peer: ${peerId}`,
    );
    notifyPeerFailure(peerId, 'Maximum peer connection limit reached');
    return null;
  }

  // RTCPeerConnection may not be available in the main process.
  // In production, WebRTC is handled in the renderer. This provides
  // the signaling and connection management logic with the interface stubbed.
  const config: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
    ],
  };

  let pc: RTCPeerConnection;
  try {
    // Use globalThis.RTCPeerConnection which may be provided by wrtc package
    // or available in Electron's renderer context
    pc = new (globalThis as any).RTCPeerConnection(config);
  } catch {
    console.error(
      `[room-service] RTCPeerConnection not available. Peer ${peerId} cannot be connected.`,
    );
    notifyPeerFailure(peerId, 'WebRTC not available in this context');
    return null;
  }

  // Set up 15-second timeout for connection establishment
  const timeoutHandle = setTimeout(() => {
    handlePeerTimeout(peerId);
  }, PEER_CONNECTION_TIMEOUT_MS);

  const peerState: PeerState = {
    id: peerId,
    connection: pc,
    timeoutHandle,
    connected: false,
  };

  peers.set(peerId, peerState);

  // Handle ICE candidates — send to remote peer via signaling
  pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate && signalingSocket?.readyState === WebSocket.OPEN) {
      signalingSocket.send(
        JSON.stringify({
          type: 'ice-candidate',
          peerId,
          candidate: event.candidate.toJSON(),
        }),
      );
    }
  };

  // Handle incoming media tracks — relay to overlay server
  pc.ontrack = (event: RTCTrackEvent) => {
    relayStreamToOverlay(peerId, event.streams);
  };

  // Handle connection state changes
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;

    if (state === 'connected') {
      // Clear timeout on successful connection
      if (peerState.timeoutHandle) {
        clearTimeout(peerState.timeoutHandle);
        peerState.timeoutHandle = null;
      }
      peerState.connected = true;
      notifyAdminWindow('room:peer-connected', { peerId });
    } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
      cleanupPeer(peerId);
    }
  };

  return pc;
}

/**
 * Handle peer connection timeout (15 seconds).
 * Abandons the peer, notifies admin, continues with others.
 */
function handlePeerTimeout(peerId: string): void {
  console.warn(`[room-service] Peer connection timeout (15s) for peer: ${peerId}`);
  notifyPeerFailure(peerId, 'Connection timed out after 15 seconds');
  cleanupPeer(peerId);
}

/**
 * Clean up a single peer connection and remove from the peers map.
 */
function cleanupPeer(peerId: string): void {
  const peerState = peers.get(peerId);
  if (!peerState) return;

  if (peerState.timeoutHandle) {
    clearTimeout(peerState.timeoutHandle);
    peerState.timeoutHandle = null;
  }

  if (peerState.connection) {
    try {
      peerState.connection.close();
    } catch {
      // Ignore errors during close
    }
    peerState.connection = null;
  }

  peers.delete(peerId);
}

/**
 * Close all active peer connections.
 */
function closeAllPeers(): void {
  for (const [peerId] of peers) {
    cleanupPeer(peerId);
  }
  peers.clear();
}

// ---------------------------------------------------------------------------
// Stream relay
// ---------------------------------------------------------------------------

/**
 * Relay incoming media streams from a peer to the Overlay Server for rendering.
 * Sends stream metadata to the overlay via IPC so it can render the video/audio.
 */
function relayStreamToOverlay(peerId: string, streams: readonly MediaStream[]): void {
  // Notify the overlay server about incoming streams.
  // The actual media rendering happens in the overlay renderer process.
  // We send stream info via IPC so the overlay knows about new participants.
  notifyAdminWindow('room:stream-available', {
    peerId,
    streamCount: streams.length,
    tracks: streams.flatMap((s: MediaStream) =>
      s.getTracks().map((t: MediaStreamTrack) => ({ kind: t.kind, id: t.id })),
    ),
  });
}

// ---------------------------------------------------------------------------
// Signaling WebSocket
// ---------------------------------------------------------------------------

/**
 * Handle incoming signaling messages from the WebSocket.
 */
async function handleSignalingMessage(data: string): Promise<void> {
  let message: SignalingMessage;
  try {
    message = JSON.parse(data) as SignalingMessage;
  } catch {
    console.error('[room-service] Failed to parse signaling message');
    return;
  }

  switch (message.type) {
    case 'participants': {
      // Initial list of participants in the room — initiate connections
      const participants = message.participants ?? [];
      for (const peerId of participants) {
        if (!peers.has(peerId) && peers.size < MAX_PEERS) {
          await initiateOffer(peerId);
        }
      }
      break;
    }

    case 'peer-joined': {
      // A new peer joined — create connection if under limit
      const peerId = message.peerId;
      if (peerId && !peers.has(peerId) && peers.size < MAX_PEERS) {
        await initiateOffer(peerId);
      }
      break;
    }

    case 'peer-left': {
      // A peer left — clean up their connection
      const peerId = message.peerId;
      if (peerId) {
        cleanupPeer(peerId);
        notifyAdminWindow('room:peer-disconnected', { peerId });
      }
      break;
    }

    case 'offer': {
      // Received an offer from a remote peer
      const peerId = message.peerId;
      if (!peerId || !message.sdp) break;

      if (peers.size >= MAX_PEERS && !peers.has(peerId)) {
        // At capacity — reject
        console.warn(`[room-service] Rejecting offer from ${peerId}: at max capacity`);
        break;
      }

      let pc = peers.get(peerId)?.connection;
      if (!pc) {
        pc = createPeerConnection(peerId);
        if (!pc) break;
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (signalingSocket?.readyState === WebSocket.OPEN) {
          signalingSocket.send(
            JSON.stringify({
              type: 'answer',
              peerId,
              sdp: pc.localDescription,
            }),
          );
        }
      } catch (err) {
        console.error(`[room-service] Error handling offer from ${peerId}:`, err);
        cleanupPeer(peerId);
      }
      break;
    }

    case 'answer': {
      // Received an answer to our offer
      const peerId = message.peerId;
      if (!peerId || !message.sdp) break;

      const peerState = peers.get(peerId);
      if (!peerState?.connection) break;

      try {
        await peerState.connection.setRemoteDescription(
          new RTCSessionDescription(message.sdp),
        );
      } catch (err) {
        console.error(`[room-service] Error handling answer from ${peerId}:`, err);
        cleanupPeer(peerId);
      }
      break;
    }

    case 'ice-candidate': {
      // Received an ICE candidate from a remote peer
      const peerId = message.peerId;
      if (!peerId || !message.candidate) break;

      const peerState = peers.get(peerId);
      if (!peerState?.connection) break;

      try {
        await peerState.connection.addIceCandidate(
          new RTCIceCandidate(message.candidate),
        );
      } catch (err) {
        console.error(`[room-service] Error adding ICE candidate from ${peerId}:`, err);
      }
      break;
    }

    default:
      console.warn(`[room-service] Unknown signaling message type: ${message.type}`);
  }
}

/**
 * Initiate a WebRTC offer to a remote peer.
 */
async function initiateOffer(peerId: string): Promise<void> {
  const pc = createPeerConnection(peerId);
  if (!pc) return;

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (signalingSocket?.readyState === WebSocket.OPEN) {
      signalingSocket.send(
        JSON.stringify({
          type: 'offer',
          peerId,
          sdp: pc.localDescription,
        }),
      );
    }
  } catch (err) {
    console.error(`[room-service] Error creating offer for ${peerId}:`, err);
    cleanupPeer(peerId);
  }
}

// ---------------------------------------------------------------------------
// Signaling connection management
// ---------------------------------------------------------------------------

/**
 * Connect to the signaling WebSocket server.
 */
function connectSignaling(roomId: string, token: string): void {
  const url = `${SIGNALING_BASE_URL}?token=${encodeURIComponent(token)}&room=${encodeURIComponent(roomId)}`;

  emitRoomStatus('connecting');

  try {
    signalingSocket = new WebSocket(url);
  } catch (err) {
    console.error('[room-service] Failed to create WebSocket:', err);
    emitRoomStatus('error', 'Failed to create signaling connection');
    scheduleReconnect(roomId);
    return;
  }

  signalingSocket.onopen = () => {
    console.log(`[room-service] Signaling connected to room: ${roomId}`);
    consecutiveFailures = 0;
    emitRoomStatus('connected');
  };

  signalingSocket.onmessage = (event) => {
    const data = typeof event.data === 'string' ? event.data : String(event.data);
    handleSignalingMessage(data).catch((err) => {
      console.error('[room-service] Error handling signaling message:', err);
    });
  };

  signalingSocket.onerror = (_event: Event) => {
    console.error('[room-service] Signaling WebSocket error');
  };

  signalingSocket.onclose = (event) => {
    signalingSocket = null;

    // Handle 401 — authentication rejected
    if (event.code === 4001 || event.code === 1008) {
      emitRoomStatus('error', 'Authentication rejected');
      showNotification(
        'IEOM Room',
        'Authentication failed. Please log in again to join rooms.',
      );
      // Do not reconnect on auth failure
      closeAllPeers();
      currentRoomId = null;
      return;
    }

    // If this was an intentional disconnect (leaveRoom), don't reconnect
    if (intentionalDisconnect) {
      emitRoomStatus('disconnected');
      return;
    }

    // Unexpected disconnect — attempt reconnection with backoff
    emitRoomStatus('reconnecting');
    scheduleReconnect(roomId);
  };
}

/**
 * Schedule a reconnection attempt with exponential backoff.
 */
function scheduleReconnect(roomId: string): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

  consecutiveFailures++;
  const delay = calculateBackoffDelay(consecutiveFailures);

  console.log(
    `[room-service] Scheduling reconnect attempt ${consecutiveFailures} in ${delay}ms`,
  );

  notifyAdminWindow('room:reconnecting', {
    attempt: consecutiveFailures,
    delayMs: delay,
  });

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;

    // Load fresh token for reconnection
    const token = loadToken();
    if (!token) {
      emitRoomStatus('error', 'No authentication token available');
      showNotification(
        'IEOM Room',
        'Cannot reconnect: no authentication token. Please log in again.',
      );
      currentRoomId = null;
      return;
    }

    connectSignaling(roomId, token);
  }, delay);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Join a stream room.
 *
 * Loads the stored auth token, connects to the signaling WebSocket,
 * and begins peer negotiation with room participants.
 *
 * @param roomId - The room identifier to join
 * @throws If no auth token is available (notifies user to re-authenticate)
 */
export function joinRoom(roomId: string): void {
  // If already in a room, leave first
  if (currentRoomId) {
    leaveRoom();
  }

  // Load authentication token
  const token = loadToken();
  if (!token) {
    emitRoomStatus('error', 'No authentication token');
    showNotification(
      'IEOM Room',
      'Please log in before joining a room.',
    );
    return;
  }

  // Reset state
  intentionalDisconnect = false;
  consecutiveFailures = 0;
  currentRoomId = roomId;

  // Connect to signaling
  connectSignaling(roomId, token);
}

/**
 * Leave the current room.
 *
 * Closes all peer connections and disconnects from the signaling WebSocket.
 */
export function leaveRoom(): void {
  intentionalDisconnect = true;

  // Cancel any pending reconnection
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // Close all peer connections
  closeAllPeers();

  // Disconnect signaling WebSocket
  if (signalingSocket) {
    try {
      signalingSocket.close(1000, 'User left room');
    } catch {
      // Ignore errors during close
    }
    signalingSocket = null;
  }

  // Reset state
  currentRoomId = null;
  consecutiveFailures = 0;
  emitRoomStatus('disconnected');
}

/**
 * Get the current room status.
 */
export function getRoomStatus(): { status: RoomStatus; roomId: string | null; peerCount: number } {
  return {
    status: roomStatus,
    roomId: currentRoomId,
    peerCount: peers.size,
  };
}

/**
 * Get the current number of active peer connections.
 */
export function getPeerCount(): number {
  return peers.size;
}

/**
 * Get the maximum allowed peer connections.
 */
export function getMaxPeers(): number {
  return MAX_PEERS;
}
