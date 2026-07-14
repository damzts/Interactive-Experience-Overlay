import { socket } from '../socket/client'

export interface ScreenSharePublisherSnapshot {
  active: boolean
  error: string | null
}

interface PublisherEntry {
  pc: RTCPeerConnection
  stream: MediaStream
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
]

/**
 * Module-level registry of active screen-share publishers, keyed by widgetId.
 *
 * This intentionally lives OUTSIDE React component state. The config panel
 * that starts a share (ScreenConfigSection) is not where the connection
 * should live — operators switch between widgets, close panels, navigate
 * the dashboard, all while a share should keep streaming to the overlay.
 * If the RTCPeerConnection/MediaStream were owned by a component-scoped
 * useRef, unmounting that component (e.g. selecting a different widget)
 * would tear down the connection for no reason related to the share itself.
 *
 * The connection's lifetime is now tied only to explicit stop() calls, the
 * browser's native "Stop sharing" action, or the track/connection failing —
 * never to a React component unmounting.
 */
class ScreenSharePublisherRegistry {
  private entries = new Map<string, PublisherEntry>()
  private errors = new Map<string, string | null>()
  private listeners = new Map<string, Set<() => void>>()
  private snapshots = new Map<string, ScreenSharePublisherSnapshot>()
  private wired = false

  private notify(widgetId: string) {
    // Drop the cached snapshot so getSnapshot() rebuilds a fresh (referentially
    // distinct) object — required for useSyncExternalStore to detect the change.
    this.snapshots.delete(widgetId)
    this.listeners.get(widgetId)?.forEach((cb) => cb())
  }

  private ensureWired() {
    if (this.wired) return
    this.wired = true

    socket.on('screen-share:answer', async (payload: { widgetId: string; sdp: string }) => {
      const entry = this.entries.get(payload.widgetId)
      if (!entry) return
      try {
        await entry.pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp })
      } catch {
        this.errors.set(payload.widgetId, 'Failed to establish screen share connection.')
        this.teardown(payload.widgetId, { emitStop: false })
      }
    })

    socket.on('screen-share:ice:overlay', (payload: { widgetId: string; candidate: RTCIceCandidateInit }) => {
      const entry = this.entries.get(payload.widgetId)
      entry?.pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {})
    })
  }

  subscribe(widgetId: string, callback: () => void): () => void {
    if (!this.listeners.has(widgetId)) this.listeners.set(widgetId, new Set())
    this.listeners.get(widgetId)!.add(callback)
    return () => {
      this.listeners.get(widgetId)?.delete(callback)
    }
  }

  getSnapshot(widgetId: string): ScreenSharePublisherSnapshot {
    const cached = this.snapshots.get(widgetId)
    if (cached) return cached
    const next: ScreenSharePublisherSnapshot = {
      active: this.entries.has(widgetId),
      error: this.errors.get(widgetId) ?? null,
    }
    this.snapshots.set(widgetId, next)
    return next
  }

  private teardown(widgetId: string, opts: { emitStop: boolean }) {
    const entry = this.entries.get(widgetId)
    if (entry) {
      entry.pc.close()
      entry.stream.getTracks().forEach((t) => t.stop())
      this.entries.delete(widgetId)
      if (opts.emitStop) socket.emit('screen-share:stop', { widgetId })
    }
    this.notify(widgetId)
  }

  stop(widgetId: string): void {
    this.teardown(widgetId, { emitStop: true })
  }

  async start(widgetId: string, audio: boolean): Promise<void> {
    this.ensureWired()
    this.teardown(widgetId, { emitStop: true })
    this.errors.set(widgetId, null)
    this.notify(widgetId)

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio,
      })

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      this.entries.set(widgetId, { pc, stream })

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream)
        track.addEventListener('ended', () => this.stop(widgetId))
      })

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('screen-share:ice:admin', { widgetId, candidate: event.candidate.toJSON() })
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          this.teardown(widgetId, { emitStop: false })
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('screen-share:offer', { widgetId, sdp: offer.sdp ?? '' })
      this.notify(widgetId)
    } catch (err) {
      this.entries.delete(widgetId)
      const msg = err instanceof Error ? err.message : 'Screen share unavailable'
      this.errors.set(widgetId, /NotAllowedError|permission|denied/i.test(msg) ? 'Screen share permission denied.' : msg)
      this.notify(widgetId)
    }
  }
}

export const screenSharePublisherRegistry = new ScreenSharePublisherRegistry()
