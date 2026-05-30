/**
 * Minimal WebRTC type declarations for use in server-side code.
 * These types are normally available in DOM lib but the server compiles
 * without DOM types. We declare the minimal interfaces needed for signaling.
 */

export interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback'
  sdp?: string
}

export interface RTCIceCandidateInit {
  candidate?: string
  sdpMid?: string | null
  sdpMLineIndex?: number | null
  usernameFragment?: string | null
}
