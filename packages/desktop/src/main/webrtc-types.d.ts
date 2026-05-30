/**
 * WebRTC type declarations for the Electron main process.
 *
 * RTCPeerConnection and related APIs are not natively available in Node.js.
 * In production, WebRTC is handled in the renderer process or via the `wrtc` package.
 * These declarations allow the signaling and connection management logic to compile.
 */

/* eslint-disable @typescript-eslint/no-empty-interface */

interface RTCConfiguration {
  iceServers?: RTCIceServer[];
  iceTransportPolicy?: 'all' | 'relay';
  bundlePolicy?: 'balanced' | 'max-bundle' | 'max-compat';
}

interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface RTCSessionDescriptionInit {
  type: RTCSdpType;
  sdp?: string;
}

type RTCSdpType = 'answer' | 'offer' | 'pranswer' | 'rollback';

interface RTCIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

interface RTCIceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  toJSON(): RTCIceCandidateInit;
}

declare var RTCIceCandidate: {
  new (candidateInitDict?: RTCIceCandidateInit): RTCIceCandidate;
};

interface RTCSessionDescription {
  type: RTCSdpType;
  sdp: string;
}

declare var RTCSessionDescription: {
  new (descriptionInitDict: RTCSessionDescriptionInit): RTCSessionDescription;
};

type RTCPeerConnectionState =
  | 'closed'
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'failed'
  | 'new';

interface RTCTrackEvent {
  streams: readonly MediaStream[];
  track: MediaStreamTrack;
}

interface RTCPeerConnectionIceEvent {
  candidate: RTCIceCandidate | null;
}

interface MediaStream {
  id: string;
  getTracks(): MediaStreamTrack[];
}

interface MediaStreamTrack {
  id: string;
  kind: string;
  label: string;
}

interface RTCPeerConnection {
  connectionState: RTCPeerConnectionState;
  localDescription: RTCSessionDescription | null;
  remoteDescription: RTCSessionDescription | null;

  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null;
  ontrack: ((event: RTCTrackEvent) => void) | null;
  onconnectionstatechange: (() => void) | null;

  createOffer(): Promise<RTCSessionDescriptionInit>;
  createAnswer(): Promise<RTCSessionDescriptionInit>;
  setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>;
  setRemoteDescription(description: RTCSessionDescription): Promise<void>;
  addIceCandidate(candidate: RTCIceCandidate): Promise<void>;
  close(): void;
}

declare var RTCPeerConnection: {
  new (configuration?: RTCConfiguration): RTCPeerConnection;
};
