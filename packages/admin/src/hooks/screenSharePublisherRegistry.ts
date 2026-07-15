import { socket } from '../socket/client'

export interface ScreenSharePublisherSnapshot {
  active: boolean
  error: string | null
  /** Non-fatal: the share is live, but audio was requested and the browser
   *  didn't grant an audio track (e.g. sharing a Window, or "Entire Screen"
   *  on macOS — Chrome only supports audio capture when sharing a Tab). */
  warning: string | null
}

interface PublisherEntry {
  pc: RTCPeerConnection
  stream: MediaStream
  /** ICE candidates gathered so far — re-sent when the overlay requests a re-offer */
  gatheredCandidates: RTCIceCandidateInit[]
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
]

/**
 * Target video bitrate for the screen-share sender (bits/sec).
 * 8 Mbps is comfortable for 1080p30 screen content (slides, UI, games).
 * Loopback/localhost connections have essentially infinite bandwidth — the
 * WebRTC congestion controller's default slow-start ramp is the bottleneck,
 * not the link; forcing a high initial bitrate bypasses that.
 */
const VIDEO_MAX_BITRATE_BPS = 8_000_000

/**
 * Prefer H.264 hardware encoding when available (Electron / Chrome on Windows
 * and macOS). Falls back to VP9 → VP8 if H.264 isn't offered in the codec
 * list. Hardware encoding is ~5× more CPU-efficient than software VP8 and
 * produces better quality at the same bitrate for screen content.
 */
function preferredVideoCodecs(pc: RTCPeerConnection): RTCRtpCodec[] | null {
  try {
    const caps = RTCRtpSender.getCapabilities('video')
    if (!caps) return null
    const order = ['video/H264', 'video/VP9', 'video/VP8']
    return [
      ...order
        .flatMap((mime) =>
          caps.codecs.filter((c) => c.mimeType.toLowerCase() === mime.toLowerCase()),
        ),
      ...caps.codecs.filter(
        (c) => !order.some((m) => m.toLowerCase() === c.mimeType.toLowerCase()),
      ),
    ]
  } catch {
    return null
  }
}

/**
 * Apply high-bitrate encoding parameters to the video sender.
 * Must be called after setLocalDescription() so the sender/transceiver is
 * fully initialized.
 */
async function applyVideoEncoderParams(pc: RTCPeerConnection, widgetId: string): Promise<void> {
  const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
  if (!sender) return
  try {
    const params = sender.getParameters()
    if (params.encodings.length === 0) params.encodings.push({})
    for (const enc of params.encodings) {
      enc.maxBitrate    = VIDEO_MAX_BITRATE_BPS
      enc.maxFramerate  = 30
      // Priority hint: Chrome uses this for internal scheduling.
      enc.priority      = 'high'
      enc.networkPriority = 'high'
    }
    await sender.setParameters(params)
  } catch (err) {
    // Non-fatal — encoding params are best-effort; the share will still work.
    console.warn('[screen-share] setParameters failed for', widgetId, err)
  }
}

/**
 * Module-level registry of active screen-share publishers.
 *
 * Registry key semantics
 * ----------------------
 * The registry is keyed by an arbitrary string whose meaning depends on the
 * call site:
 *
 * - **New Sources-panel flow**: the key is a `sourceId` — the `id` field of a
 *   `CaptureSource` object chosen in the Sources panel. This decouples the
 *   share from any particular widget; multiple widgets can subscribe to the
 *   same source stream using the same key.
 *
 * - **Legacy per-widget flow** (no sourceId configured): callers pass the
 *   widget's `appId` as the key. Backward compatibility is implicit — the
 *   registry treats the key as an opaque string in both cases.
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
  private warnings = new Map<string, string | null>()
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
      if (!entry) {
        console.warn('[screen-share] answer for', payload.widgetId, 'but no entry in registry')
        return
      }
      console.log('[screen-share] answer received for', payload.widgetId, 'pc signalingState:', entry.pc.signalingState)
      try {
        await entry.pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp })
        console.log('[screen-share] setRemoteDescription(answer) ok, signalingState:', entry.pc.signalingState)
      } catch (err) {
        console.error('[screen-share] setRemoteDescription(answer) failed:', err)
        this.errors.set(payload.widgetId, 'Failed to establish screen share connection.')
        this.teardown(payload.widgetId, { emitStop: false })
      }
    })

    socket.on('screen-share:ice:overlay', (payload: { widgetId: string; candidate: RTCIceCandidateInit }) => {
      const entry = this.entries.get(payload.widgetId)
      entry?.pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {})
    })

    // Overlay subscriber mounted (or changed its watched key) and is ready to
    // receive an offer. Re-send the existing local SDP offer so the overlay
    // can answer it — no new negotiation or getDisplayMedia call needed.
    // We simply re-emit whatever offer we already set as localDescription,
    // plus all ICE candidates gathered so far (the overlay missed them).
    // This handles the case where start() was called before the overlay widget
    // was open (or before sourceId was saved to the widget config), leaving
    // the admin PC stuck in have-local-offer with no one to answer it.
    socket.on('screen-share:request-offer', async (payload: { widgetId: string }) => {
      const entry = this.entries.get(payload.widgetId)
      if (!entry) {
        console.log('[screen-share] request-offer for', payload.widgetId, '— no active entry, ignoring')
        return
      }

      const signalingState = entry.pc.signalingState
      console.log('[screen-share] request-offer for', payload.widgetId, 'signalingState:', signalingState)

      // If the PC is in have-local-offer (offer sent, no answer received yet),
      // the offer SDP is still valid — just re-send it plus any gathered ICE
      // candidates the overlay missed.
      if (signalingState === 'have-local-offer') {
        const sdp = entry.pc.localDescription?.sdp
        if (!sdp) return
        console.log('[screen-share] re-sending existing offer, candidates:', entry.gatheredCandidates.length)
        socket.emit('screen-share:offer', { widgetId: payload.widgetId, sdp })
        for (const candidate of entry.gatheredCandidates) {
          socket.emit('screen-share:ice:admin', { widgetId: payload.widgetId, candidate })
        }
        return
      }

      // In any other state (stable = was connected, failed, closed, etc.) the
      // old PC can't be re-offered cleanly. Create a fresh PC reusing the same
      // MediaStream tracks — no getDisplayMedia call, no picker shown.
      console.log('[screen-share] rebuilding PC for', payload.widgetId, '(reusing existing stream)')
      entry.pc.close()

      const { stream } = entry
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      const freshEntry = { pc, stream, gatheredCandidates: [] as RTCIceCandidateInit[] }
      this.entries.set(payload.widgetId, freshEntry)

      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      // Prefer H.264 hardware encoding for re-offers as well.
      const videoTransceiver = pc.getTransceivers().find((t) => t.sender.track?.kind === 'video')
      if (videoTransceiver) {
        const codecs = preferredVideoCodecs(pc)
        if (codecs) {
          try {
            videoTransceiver.setCodecPreferences(codecs)
          } catch {
            // Non-fatal.
          }
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.toJSON()
          freshEntry.gatheredCandidates.push(candidate)
          socket.emit('screen-share:ice:admin', { widgetId: payload.widgetId, candidate })
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          if (this.entries.get(payload.widgetId)?.pc === pc) {
            this.teardown(payload.widgetId, { emitStop: false })
          }
        }
      }

      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        // Apply high-bitrate encoding after setLocalDescription.
        await applyVideoEncoderParams(pc, payload.widgetId)
        console.log('[screen-share] new offer created and sent for', payload.widgetId)
        socket.emit('screen-share:offer', { widgetId: payload.widgetId, sdp: offer.sdp ?? '' })
      } catch (err) {
        console.error('[screen-share] failed to create re-offer:', err)
        this.teardown(payload.widgetId, { emitStop: false })
      }
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
      warning: this.warnings.get(widgetId) ?? null,
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
      this.warnings.set(widgetId, null)
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
    this.warnings.set(widgetId, null)
    this.notify(widgetId)

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width:     { ideal: 1920 },
          height:    { ideal: 1080 },
          // ideal sets the target; max caps it to avoid Chrome silently
          // downgrading to a lower refresh when the system is under load.
          frameRate: { ideal: 30, max: 60 },
        },
        audio,
      })

      if (audio && stream.getAudioTracks().length === 0) {
        // getDisplayMedia() doesn't throw here — it silently returns a stream
        // with no audio track. In the desktop app this is normally handled
        // by the Electron main process (see desktop-audio-capture.ts, which
        // forces system-audio loopback) — if it's still missing there, the
        // platform doesn't support it (macOS 12 and earlier cannot capture
        // desktop audio at all; macOS 14.2+ needs the app's audio-capture
        // permission granted). In a plain browser tab (no Electron shell),
        // Chrome only captures audio when "Chrome Tab" is picked in the
        // share dialog — a Window, or "Entire Screen" on macOS, drops audio
        // regardless of this setting.
        this.warnings.set(
          widgetId,
          'No audio track was captured. If a share picker appeared, Chrome only captures audio when you choose "Chrome Tab" (not a Window, and not "Entire Screen" on macOS). In the desktop app, this usually means system audio capture isn\'t supported on this OS version (macOS 12 and earlier can\'t capture desktop audio at all).',
        )
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      this.entries.set(widgetId, { pc, stream, gatheredCandidates: [] })

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream)
        track.addEventListener('ended', () => this.stop(widgetId))
      })

      // Prefer H.264 hardware encoding → VP9 → VP8. Must be set on the
      // transceiver before createOffer() so codec preference is reflected in
      // the SDP. Falls back gracefully if the API isn't available.
      const videoTransceiver = pc.getTransceivers().find((t) => t.sender.track?.kind === 'video')
      if (videoTransceiver) {
        const codecs = preferredVideoCodecs(pc)
        if (codecs) {
          try {
            videoTransceiver.setCodecPreferences(codecs)
          } catch {
            // Non-fatal — older browsers may not support setCodecPreferences.
          }
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.toJSON()
          const entry = this.entries.get(widgetId)
          if (entry) entry.gatheredCandidates.push(candidate)
          socket.emit('screen-share:ice:admin', { widgetId, candidate })
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          this.teardown(widgetId, { emitStop: false })
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      // Apply high-bitrate encoding after setLocalDescription — the sender is
      // not fully initialized until after the offer is set.
      await applyVideoEncoderParams(pc, widgetId)
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
