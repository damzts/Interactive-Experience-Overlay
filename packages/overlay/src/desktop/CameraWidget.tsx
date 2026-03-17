import { useEffect, useRef, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'

interface DesktopWidgetProps {
  appId?: string
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

type VideoDevice = { deviceId: string; label: string }

const SHAPES = ['rectangle', 'circle', 'rounded'] as const
type Shape = typeof SHAPES[number]

function isAdminPreviewFrame() {
  if (typeof window === 'undefined') return false
  if (window.top === window.self) return false
  try {
    const referrer = document.referrer
    if (!referrer) return false
    const refUrl = new URL(referrer)
    return refUrl.hostname === window.location.hostname && refUrl.port === '3002'
  } catch {
    return false
  }
}

function isLikelyObsBrowserSource() {
  if (typeof navigator === 'undefined') return false
  return /\bOBS\//i.test(navigator.userAgent)
}

function shouldBlockCameraCapture() {
  if (isAdminPreviewFrame()) return true
  if (typeof window === 'undefined') return false
  // Prevent local browser preview on runtime URL from grabbing the camera.
  if (window.location.port === '3000' && !isLikelyObsBrowserSource()) return true
  return false
}

function borderRadiusFor(shape: Shape) {
  if (shape === 'circle')  return '50%'
  if (shape === 'rounded') return '12px'
  return '0'
}

export function CameraWidget({ appId, onClose, onMinimize, onFocus, windowState = 'open', zIndex }: DesktopWidgetProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [devices, setDevices]     = useState<VideoDevice[]>([])
  const [deviceId, setDeviceId]   = useState<string>('')
  const [mirror, setMirror]       = useState(true)
  const [shape, setShape]         = useState<Shape>('rectangle')
  const [error, setError]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)

  // Enumerate video input devices once on mount
  useEffect(() => {
    if (shouldBlockCameraCapture()) {
      setError('Camara desactivada en vista previa para evitar conflicto de dispositivo.')
      setLoading(false)
      return
    }

    async function enumerate() {
      try {
        // Request permission first so labels are populated
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        tempStream.getTracks().forEach((t) => t.stop())

        const all = await navigator.mediaDevices.enumerateDevices()
        const video = all
          .filter((d) => d.kind === 'videoinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || d.deviceId }))
        setDevices(video)
        if (video.length > 0) setDeviceId(video[0].deviceId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Camera unavailable'
        setError(msg)
        setLoading(false)
      }
    }
    void enumerate()
  }, [])

  // Start/restart camera stream when deviceId changes
  useEffect(() => {
    if (!deviceId) return
    let cancelled = false

    async function startCamera() {
      // Stop previous stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      if (videoRef.current) videoRef.current.srcObject = null

      setLoading(true)
      setError(null)

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width:     { ideal: 1920 },
            height:    { ideal: 1080 },
            frameRate: { ideal: 60 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setError(null)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Camera unavailable'
        setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [deviceId])

  const borderRadius = borderRadiusFor(shape)

  return (
    <DesktopWindow
      id={appId ?? 'camera'}
      title="📷 Camera"
      width={400}
      defaultPosition={{ x: 260, y: 80 }}
      zIndex={zIndex}
      state={windowState}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: 8, color: '#202020' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Video preview */}
        <div
          style={{
            width:           '100%',
            aspectRatio:     '16 / 9',
            background:      '#111',
            border:          '1px solid #808080',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            overflow:        'hidden',
            borderRadius,
            position:        'relative',
          }}
        >
          {loading && !error && (
            <div style={{ color: '#d4d4d4', fontSize: 11 }}>Iniciando cámara...</div>
          )}
          {error && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 24 }}>📷</span>
              <div style={{ color: '#f87171', fontSize: 11, textAlign: 'center', padding: '0 8px' }}>{error}</div>
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
              transform: mirror ? 'scaleX(-1)' : 'none',
              display:   error ? 'none' : 'block',
            }}
          />
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

          {/* Device selector */}
          {devices.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <label style={{ minWidth: 54 }}>Cámara:</label>
              <select
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                style={{ flex: 1, fontSize: 11 }}
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Mirror + shape row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={mirror}
                onChange={(e) => setMirror(e.target.checked)}
              />
              Espejo
            </label>

            <span style={{ marginLeft: 'auto' }}>Forma:</span>
            {SHAPES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setShape(s)}
                style={{
                  fontWeight: shape === s ? 'bold' : 'normal',
                  textDecoration: shape === s ? 'underline' : 'none',
                }}
              >
                {s === 'rectangle' ? '▭' : s === 'circle' ? '○' : '▢'}
              </button>
            ))}
          </div>

        </div>
      </div>
    </DesktopWindow>
  )
}
