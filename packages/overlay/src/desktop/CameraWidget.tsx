import { useEffect, useRef, useState } from 'react'
import { socket } from '../socket/client'
import { useAppStore } from '../store/useAppStore'
import { DesktopWindow } from './DesktopWindow'

interface DesktopWidgetProps {
  appId?: string
  defaultCameraLabel?: string
  defaultMirror?: boolean
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

type VideoDevice = { deviceId: string; label: string }

function isLikelyObsBrowserSource() {
  if (typeof window === 'undefined') return false
  const check = (name: string) => {
    const v = new URLSearchParams(window.location.search).get(name)
    if (v != null) return ['1', 'true', 'on', 'yes'].includes(v.trim().toLowerCase())
    return false
  }
  if (check('obs') || check('browserSource') || check('camera') || check('cam')) return true
  const obsWindow = window as Window & { obsstudio?: unknown }
  if (typeof obsWindow.obsstudio !== 'undefined') return true
  return /\bOBS\/|obs[-\s]?studio|obsbrowser|obsproject/i.test(navigator.userAgent ?? '')
}

function getCameraRoleLabel(appId?: string) {
  if (!appId || appId === 'camera') return 'Host'
  const match = appId.match(/^camera[-:_](.+)$/i)
  if (!match) return 'Camera'
  const token = match[1].trim().toLowerCase()
  if (token === '2' || token === 'a' || token === 'source-a' || token === 'sourcea') return 'Source A'
  if (token === '3' || token === 'b' || token === 'source-b' || token === 'sourceb') return 'Source B'
  return token.split(/[-_\s]+/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

async function enumerateVideoDevices(): Promise<VideoDevice[]> {
  const all = await navigator.mediaDevices.enumerateDevices()
  return all
    .filter((d) => d.kind === 'videoinput')
    .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Camera input' }))
}

function findDeviceId(devices: VideoDevice[], preferredLabel: string): string {
  if (!preferredLabel) return devices[0]?.deviceId ?? ''
  const needle = preferredLabel.trim().toLowerCase()
  const exact = devices.find((d) => d.label.trim().toLowerCase() === needle)
  if (exact) return exact.deviceId
  const partial = devices.find((d) => d.label.trim().toLowerCase().includes(needle))
  return partial?.deviceId ?? devices[0]?.deviceId ?? ''
}

export function CameraWidget({ appId, defaultCameraLabel, defaultMirror = false, onClose, onMinimize, onFocus, windowState = 'open', zIndex }: DesktopWidgetProps) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const healthTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const restartAttemptsRef = useRef(0)

  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [restartToken, setRestartToken] = useState(0)

  const cameraOwnerSocketId = useAppStore((s) => s.cameraOwnerSocketId)
  const setCameraPermissionState = useAppStore((s) => s.setCameraPermissionState)
  const roleLabel = getCameraRoleLabel(appId)
  const isObs     = isLikelyObsBrowserSource()
  const isExplicitCameraOwner = cameraOwnerSocketId === socket.id
  const isCameraAssignedElsewhere = !!cameraOwnerSocketId && !isExplicitCameraOwner
  const canCaptureInThisClient = isObs || isExplicitCameraOwner

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
    if (videoRef.current) videoRef.current.srcObject = null
  }

  // Stop stream on unmount
  useEffect(() => () => {
    clearRetryTimer()
    clearHealthTimer()
    stopCurrentStream()
  }, [])

  // Start camera (OBS only)
  useEffect(() => {
    clearRetryTimer()
    clearHealthTimer()
    stopCurrentStream()

    if (isCameraAssignedElsewhere) {
      restartAttemptsRef.current = 0
      setError(`La cámara está asignada a otro overlay (${cameraOwnerSocketId?.slice(0, 8)}).`)
      setLoading(false)
      return
    }

    if (!canCaptureInThisClient) {
      restartAttemptsRef.current = 0
      setError('Selecciona este overlay client en Settings o abre OBS con la URL del overlay para permitir la captura de cámara aquí.')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const queueRestart = (message?: string) => {
      if (cancelled || retryTimerRef.current) return
      const nextAttempt = Math.min(restartAttemptsRef.current + 1, 6)
      restartAttemptsRef.current = nextAttempt
      const delayMs = Math.min(1000 * (2 ** (nextAttempt - 1)), 8000)
      stopCurrentStream()
      setLoading(true)
      setError(message ?? 'La señal de cámara se perdió. Reintentando…')
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null
        if (!cancelled) setRestartToken((value) => value + 1)
      }, delayMs)
    }

    async function start() {
      try {
        // First: get permission so labels are visible
        const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        probe.getTracks().forEach((t) => t.stop())
        setCameraPermissionState('granted')

        const devices  = await enumerateVideoDevices()
        const deviceId = findDeviceId(devices, defaultCameraLabel ?? '')

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
            width:     { ideal: 1920 },
            height:    { ideal: 1080 },
            frameRate: { ideal: 60 },
          },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        restartAttemptsRef.current = 0
        streamRef.current = stream
        const handleTrackEnded = () => {
          queueRestart()
        }
        stream.getTracks().forEach((track) => {
          track.addEventListener('ended', handleTrackEnded)
        })
        stream.addEventListener('inactive', handleTrackEnded)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play().catch(() => {})
        }
        healthTimerRef.current = setInterval(() => {
          const currentStream = streamRef.current
          const currentVideo = videoRef.current
          if (!currentStream) {
            queueRestart()
            return
          }
          const tracks = currentStream.getVideoTracks()
          if (tracks.length === 0 || tracks.every((track) => track.readyState === 'ended')) {
            queueRestart()
            return
          }
          if (currentVideo && currentVideo.srcObject !== currentStream) {
            queueRestart()
          }
        }, 2000)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Camera unavailable'
        if (/NotAllowedError|permission|denied/i.test(msg)) {
          setCameraPermissionState('denied')
          restartAttemptsRef.current = 0
        }
        if (/NotAllowedError|permission|denied/i.test(msg)) {
          setError('Permiso de cámara denegado. Concede acceso en este overlay client o selecciona otro client con permiso concedido.')
          return
        }
        queueRestart(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void start()
    return () => {
      cancelled = true
      clearRetryTimer()
      clearHealthTimer()
      stopCurrentStream()
    }
  }, [cameraOwnerSocketId, canCaptureInThisClient, defaultCameraLabel, isCameraAssignedElsewhere, restartToken])

  return (
    <DesktopWindow
      id={appId ?? 'camera'}
      title={`📷 Camera - ${roleLabel}`}
      width={400}
      height={300}
      defaultPosition={{ x: 260, y: 80 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--camera"
      bodyClassName="desktop-window-body--camera"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: 12 }}
    >
      <div
        className="widget-panel widget-camera-frame"
      >
        {loading && !error && (
          <span className="widget-empty-state">Iniciando cámara...</span>
        )}
        {error && (
          <div className="widget-camera-status">
            <span className="widget-camera-status-icon">📷</span>
            <span className="widget-empty-state widget-empty-state--error">{error}</span>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position:  'absolute',
            inset:     0,
            width:     '100%',
            height:    '100%',
            objectFit: 'cover',
            transform: defaultMirror ? 'scaleX(-1)' : 'none',
            display:   error ? 'none' : 'block',
          }}
        />
      </div>
    </DesktopWindow>
  )
}

