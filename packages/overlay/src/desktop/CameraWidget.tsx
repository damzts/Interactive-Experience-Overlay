import { useEffect, useRef, useState } from 'react'
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

  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const roleLabel = getCameraRoleLabel(appId)
  const isObs     = isLikelyObsBrowserSource()

  // Stop stream on unmount
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  // Start camera (OBS only)
  useEffect(() => {
    if (!isObs) {
      setError('Configura el dispositivo en el admin (Preferred device label) y abre OBS con la URL del overlay para ver la cámara.')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    async function start() {
      try {
        // First: get permission so labels are visible
        const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        probe.getTracks().forEach((t) => t.stop())

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
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Camera unavailable'
        setError(/NotAllowedError|permission|denied/i.test(msg)
          ? 'Permiso de cámara denegado. Verifica los permisos del Browser Source en OBS.'
          : msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void start()
    return () => { cancelled = true }
  }, [isObs, defaultCameraLabel])

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

