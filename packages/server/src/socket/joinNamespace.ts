/**
 * LAN /join namespace — local WebRTC signaling without cloud dependency.
 *
 * Guests on the same network open http://<host-ip>:3000/join in a browser,
 * grant camera/mic, and connect directly to the WebRTC hub via this namespace.
 *
 * No auth, no room codes, no STUN/TURN needed (host candidates work on LAN).
 * Guest video/audio enters the same POV pipeline as cloud participants.
 *
 * See FEATURES.md §LAN WebRTC via /join for the design spec.
 */

import type { Server, Socket } from 'socket.io'
import type { RTCIceCandidateInit } from 'werift'
import type { HubConnection } from '../room/hub-connection.js'
import type { POVOrchestrator } from '../pov/index.js'

/** Unique participant ID derived from the socket ID. */
function participantId(socketId: string): string {
  return `lan-${socketId.slice(0, 8)}`
}

export function registerJoinNamespace(
  io: Server,
  hubConnection: HubConnection,
  povOrchestrator: POVOrchestrator,
): void {
  const nsp = io.of('/join')

  nsp.on('connection', (socket: Socket) => {
    const userId = participantId(socket.id)
    let addedToPov = false
    // Track pending ICE candidates for the current offer cycle
    let pendingAnswer = false
    let buffered: any[] = []

    console.log(`[join] LAN participant connected: ${userId} (${socket.id})`)

    // Register per-participant ICE candidate listener once
    hubConnection.onIceCandidate((id, candidate) => {
      if (id !== userId) return
      if (pendingAnswer) {
        buffered.push(candidate)
      } else {
        socket.emit('ice-candidate', candidate)
      }
    })

    // Guest sends their SDP offer
    socket.on('offer', async (sdp: string) => {
      pendingAnswer = true
      buffered = []

      try {
        const answerSdp = await hubConnection.handleOffer(userId, sdp)

        socket.emit('answer', answerSdp)
        pendingAnswer = false

        // Flush buffered candidates that arrived before answer was sent
        for (const c of buffered) socket.emit('ice-candidate', c)
        buffered = []

        // Register with POV pipeline (idempotent — ignore if already added)
        if (!addedToPov) {
          povOrchestrator.addParticipant(userId, `LAN Guest (${socket.id.slice(0, 6)})`)
          addedToPov = true
          console.log(`[join] ${userId} added to POV pipeline`)
        }
      } catch (err: any) {
        pendingAnswer = false
        buffered = []
        console.error(`[join] offer handling failed for ${userId}:`, err.message)
        socket.emit('error', { message: 'Offer processing failed' })
      }
    })

    // Guest ICE candidates → hub
    socket.on('ice-candidate', async (candidate: RTCIceCandidateInit) => {
      try {
        await hubConnection.handleIceCandidate(userId, candidate)
      } catch {
        // ICE candidate timing issues are normal — silently drop
      }
    })

    socket.on('disconnect', () => {
      console.log(`[join] LAN participant disconnected: ${userId}`)
      void hubConnection.removeParticipant(userId)
      if (addedToPov) povOrchestrator.removeParticipant(userId)
    })
  })
}
