/**
 * AdminStreamGrid — renders a grid of participant video streams received
 * via WebRTC relay from the hub server.
 *
 * Each participant with a video track gets a sendonly PC on the server.
 * The server signals the offer via Socket.IO (admin:offer).
 * This component creates answer PCs per participant and renders the stream.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  OnlineServerToAdminEvents,
  OnlineClientToServerEvents,
  AdminStreamOfferPayload,
  AdminStreamRemovedPayload,
  AdminStreamInfo,
  AdminStreamIceCandidatePayload,
} from '@ieom/shared'

// ── Types ──────────────────────────────────────────────────────────

type OnlineSocket = Socket<OnlineServerToAdminEvents, OnlineClientToServerEvents>

interface StreamState {
  userId: string
  displayName: string
  stream: MediaStream | null
  hasAudio: boolean
  /** ICE connection state for debugging */
  iceState: string
}

// ── Constants ──────────────────────────────────────────────────────

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

// ── Component ──────────────────────────────────────────────────────

export function AdminStreamGrid({ socket }: { socket: OnlineSocket | null }) {
  const [streams, setStreams] = useState<Map<string, StreamState>>(new Map())
  /** Store peer connections by userId so we can close them */
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const mountedRef = useRef(true)

  // ── Clean up a single stream ───────────────────────────────────

  const removeStream = useCallback((userId: string) => {
    setStreams((prev) => {
      const next = new Map(prev)
      next.delete(userId)
      return next
    })
    const pc = pcsRef.current.get(userId)
    if (pc) {
      pc.close()
      pcsRef.current.delete(userId)
    }
  }, [])

  // ── Handle a new WebRTC offer from the server ──────────────────

  const handleOffer = useCallback(async (payload: AdminStreamOfferPayload) => {
    const { userId, sdp, displayName, hasAudio, hasVideo } = payload
    if (!hasVideo) return // Only render video streams
    if (!mountedRef.current) return

    // Close existing PC for this user if any
    const existing = pcsRef.current.get(userId)
    if (existing) {
      existing.close()
      pcsRef.current.delete(userId)
    }

    const pc = new RTCPeerConnection(ICE_CONFIG)
    pcsRef.current.set(userId, pc)

    // Track ICE state changes
    pc.oniceconnectionstatechange = () => {
      setStreams((prev) => {
        const entry = prev.get(userId)
        if (!entry) return prev
        const updated = new Map(prev)
        updated.set(userId, { ...entry, iceState: pc.iceConnectionState })
        return updated
      })
    }

    // When a track arrives, attach it to the stream
    pc.ontrack = (event) => {
      if (!mountedRef.current) return
      setStreams((prev) => {
        const updated = new Map(prev)
        const existing = updated.get(userId)
        updated.set(userId, {
          userId,
          displayName,
          stream: event.streams[0] ?? null,
          hasAudio,
          iceState: pc.iceConnectionState,
        })
        return updated
      })
    }

    // Forward ICE candidates to the server
    pc.onicecandidate = (event) => {
      if (!event.candidate || !mountedRef.current) return
      const sock = socket
      if (sock?.connected) {
        sock.emit('admin:ice-candidate', {
          userId,
          candidate: event.candidate.toJSON(),
        })
      }
    }

    // Create initial entry
    setStreams((prev) => {
      const updated = new Map(prev)
      if (!updated.has(userId)) {
        updated.set(userId, {
          userId,
          displayName,
          stream: null,
          hasAudio,
          iceState: 'new',
        })
      }
      return updated
    })

    try {
      await pc.setRemoteDescription({ type: 'offer', sdp } as RTCSessionDescriptionInit)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      if (mountedRef.current && socket?.connected) {
        socket.emit('admin:answer', { userId, sdp: pc.localDescription!.sdp! })
      }
    } catch (err) {
      console.error(`[AdminStreamGrid] Failed to handle offer for ${userId}:`, err)
      removeStream(userId)
    }
  }, [socket, removeStream])

  // ── Handle ICE candidates from the server ──────────────────────

  const handleIceCandidate = useCallback((payload: AdminStreamIceCandidatePayload) => {
    const { userId, candidate } = payload
    const pc = pcsRef.current.get(userId)
    if (!pc) return
    pc.addIceCandidate(candidate as RTCIceCandidateInit).catch(() => {
      // Stale candidates are fine
    })
  }, [])

  // ── Wire socket events ─────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true
    if (!socket) return

    socket.on('admin:offer', handleOffer)
    socket.on('admin:ice-candidate', handleIceCandidate)
    socket.on('admin:stream-removed', (payload: AdminStreamRemovedPayload) => {
      removeStream(payload.userId)
    })
    socket.on('admin:stream-status', (payload: AdminStreamInfo[]) => {
      // Remove streams no longer present in status
      const activeIds = new Set(payload.map((s) => s.userId))
      setStreams((prev) => {
        let changed = false
        const next = new Map(prev)
        for (const userId of next.keys()) {
          if (!activeIds.has(userId)) {
            next.delete(userId)
            changed = true
            const pc = pcsRef.current.get(userId)
            if (pc) { pc.close(); pcsRef.current.delete(userId) }
          }
        }
        return changed ? next : prev
      })
    })

    return () => {
      mountedRef.current = false
      if (!socket) return
      socket.off('admin:offer', handleOffer)
      socket.off('admin:ice-candidate', handleIceCandidate)
      socket.off('admin:stream-removed')
      socket.off('admin:stream-status')
    }
  }, [socket, handleOffer, handleIceCandidate, removeStream])

  // ── Cleanup on unmount ─────────────────────────────────────────

  useEffect(() => {
    return () => {
      for (const [userId, pc] of pcsRef.current) {
        pc.close()
      }
      pcsRef.current.clear()
    }
  }, [socket])

  // ── Render ─────────────────────────────────────────────────────

  const streamArray = Array.from(streams.values())

  if (streamArray.length === 0) {
    return null
  }

  return (
    <div className="mt-3 border-t border-[var(--color-border-default)] pt-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] px-2 mb-2">
        Video Streams ({streamArray.length})
      </div>
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(240px, 1fr))`,
        }}
      >
        {streamArray.map((s) => (
          <StreamTile key={s.userId} stream={s} />
        ))}
      </div>
    </div>
  )
}

// ── StreamTile ─────────────────────────────────────────────────────

function StreamTile({ stream }: { stream: StreamState }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (stream.stream) {
      el.srcObject = stream.stream
      el.play().catch(() => {
        // Autoplay may be blocked — user interaction needed
      })
    } else {
      el.srcObject = null
    }
  }, [stream.stream])

  const connecting = stream.iceState !== 'connected' && stream.iceState !== 'completed'

  return (
    <div className="relative aspect-video rounded-lg overflow-hidden bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] group">
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover ${connecting ? 'opacity-60' : ''}`}
      />

      {/* Overlay: name + status */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          {/* ICE state indicator */}
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${
              stream.iceState === 'connected' || stream.iceState === 'completed'
                ? 'bg-[var(--color-success-400)]'
                : stream.iceState === 'failed' || stream.iceState === 'disconnected'
                  ? 'bg-[var(--color-danger-400)]'
                  : stream.iceState === 'checking'
                    ? 'bg-[var(--color-accent-400)]'
                    : 'bg-[var(--color-text-muted)]'
            }`}
            title={`ICE: ${stream.iceState}`}
          />
          <span className="text-xs text-white font-medium truncate">{stream.displayName}</span>
          {!stream.stream && (
            <span className="ml-auto text-[10px] text-white/50 animate-pulse">
              connecting…
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
