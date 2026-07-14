import { useEffect, useRef, useState } from 'react'

export interface MediaCaptureOptions {
  /** Preferred camera device label (partial, case-insensitive match). */
  deviceLabel?: string
  /** Capture audio alongside video. Default: false. */
  audio?: boolean
  /** Ideal capture resolution/frame rate. */
  quality?: { width?: number; height?: number; frameRate?: number }
  /** Auto-restart the capture if the track ends/goes inactive. Default: true. */
  autoRestart?: boolean
  /** Disables capture entirely (e.g. blocked preview contexts). When true, no getUserMedia call is made. */
  disabled?: boolean
  /** Interval in ms for the stream health check. Default: 2000. */
  healthCheckIntervalMs?: number
}

export interface MediaCaptureState {
  stream: MediaStream | null
  loading: boolean
  error: string | null
  /** True once permission for the camera has been confirmed granted. */
  permissionGranted: boolean
}

const DEFAULT_QUALITY = { width: 1920, height: 1080, frameRate: 60 }

async function enumerateVideoDevices(): Promise<{ deviceId: string; label: string }[]> {
  const all = await navigator.mediaDevices.enumerateDevices()
  return all
    .filter((d) => d.kind === 'videoinput')
    .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Camera input' }))
}

function resolveDeviceId(devices: { deviceId: string; label: string }[], preferredLabel: string): string {
  if (!preferredLabel) return devices[0]?.deviceId ?? ''
  const needle = preferredLabel.trim().toLowerCase()
  const exact = devices.find((d) => d.label.trim().toLowerCase() === needle)
  if (exact) return exact.deviceId
  const partial = devices.find((d) => d.label.trim().toLowerCase().includes(needle))
  return partial?.deviceId ?? devices[0]?.deviceId ?? ''
}

function isPermissionError(message: string): boolean {
  return /NotAllowedError|permission|denied/i.test(message)
}

/**
 * Shared camera capture engine for the Camera widget/renderer.
 *
 * Handles device resolution by label, getUserMedia acquisition, automatic
 * reconnect with backoff on track loss, and stream health polling.
 * Consumers just attach `stream` to a <video> element.
 *
 * Screen/window/tab capture (getDisplayMedia) is NOT handled here — it
 * requires a genuine user gesture and is published from the admin app,
 * then relayed to the overlay over WebRTC. See useScreenSharePublisher
 * (admin) and useRemoteScreenShare (overlay).
 */
export function useMediaCaptureSource(options: MediaCaptureOptions): MediaCaptureState {
  const {
    deviceLabel = '',
    audio = false,
    quality = DEFAULT_QUALITY,
    autoRestart = true,
    disabled = false,
    healthCheckIntervalMs = 2000,
  } = options

  const streamRef = useRef<MediaStream | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const healthTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const restartAttemptsRef = useRef(0)
  const [restartToken, setRestartToken] = useState(0)

  const [state, setState] = useState<MediaCaptureState>({
    stream: null,
    loading: !disabled,
    error: null,
    permissionGranted: false,
  })

  const clearRetryTimer = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }

  const clearHealthTimer = () => {
    if (healthTimerRef.current) {
      clearInterval(healthTimerRef.current)
      healthTimerRef.current = null
    }
  }

  const stopCurrentStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => () => {
    clearRetryTimer()
    clearHealthTimer()
    stopCurrentStream()
  }, [])

  useEffect(() => {
    clearRetryTimer()
    clearHealthTimer()
    stopCurrentStream()

    if (disabled) {
      setState({ stream: null, loading: false, error: null, permissionGranted: false })
      return
    }

    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))

    const queueRestart = (message?: string) => {
      if (cancelled || retryTimerRef.current || !autoRestart) return
      const nextAttempt = Math.min(restartAttemptsRef.current + 1, 6)
      restartAttemptsRef.current = nextAttempt
      const delayMs = Math.min(1000 * (2 ** (nextAttempt - 1)), 8000)
      stopCurrentStream()
      setState((s) => ({ ...s, stream: null, loading: true, error: message ?? 'Signal lost. Retrying…' }))
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null
        if (!cancelled) setRestartToken((v) => v + 1)
      }, delayMs)
    }

    async function acquireCameraStream(): Promise<MediaStream> {
      // First pass: request permission so device labels become visible for matching.
      const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      probe.getTracks().forEach((t) => t.stop())

      let deviceId: string | undefined
      if (deviceLabel) {
        const devices = await enumerateVideoDevices()
        deviceId = resolveDeviceId(devices, deviceLabel) || undefined
      }

      return navigator.mediaDevices.getUserMedia({
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          width: { ideal: quality.width ?? DEFAULT_QUALITY.width },
          height: { ideal: quality.height ?? DEFAULT_QUALITY.height },
          frameRate: { ideal: quality.frameRate ?? DEFAULT_QUALITY.frameRate },
        },
        audio,
      })
    }

    async function beginCapture() {
      try {
        const stream = await acquireCameraStream()

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        restartAttemptsRef.current = 0
        streamRef.current = stream

        const handleTrackEnded = () => queueRestart()
        stream.getTracks().forEach((track) => track.addEventListener('ended', handleTrackEnded))
        stream.addEventListener('inactive', handleTrackEnded)

        setState({ stream, loading: false, error: null, permissionGranted: true })

        healthTimerRef.current = setInterval(() => {
          const currentStream = streamRef.current
          if (!currentStream) { queueRestart(); return }
          const tracks = currentStream.getVideoTracks()
          if (tracks.length === 0 || tracks.every((t) => t.readyState === 'ended')) {
            queueRestart()
          }
        }, healthCheckIntervalMs)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Camera unavailable'
        if (isPermissionError(msg)) {
          restartAttemptsRef.current = 0
          setState({ stream: null, loading: false, error: 'Camera permission denied.', permissionGranted: false })
          return
        }
        setState((s) => ({ ...s, loading: false, error: msg }))
        queueRestart(msg)
      }
    }

    void beginCapture()

    return () => {
      cancelled = true
      clearRetryTimer()
      clearHealthTimer()
      stopCurrentStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceLabel, audio, disabled, restartToken])

  return state
}
