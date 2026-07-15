import { useEffect, useRef } from 'react'
import { useMediaCaptureSource } from '../../services/useMediaCaptureSource'

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

/**
 * CameraRenderer — Plugin que captura un dispositivo de video (cámara física o
 * virtual como NVIDIA Broadcast) via getUserMedia y lo renderiza en la escena.
 *
 * Configuración:
 *   deviceLabel  — Nombre parcial del dispositivo (ej. "NVIDIA Broadcast", "OBS Virtual Camera").
 *                  Usa "default" para tomar el primer dispositivo disponible.
 *   mirror       — Espeja horizontalmente (útil para webcam frontal). Default: true.
 *   shape        — 'rectangle' | 'circle' | 'rounded'. Default: 'rectangle'.
 *   brightness   — 0.0–2.0, default 1.
 *   contrast     — 0.0–2.0, default 1.
 *   saturation   — 0.0–2.0, default 1.
 *   opacity      — 0.0–1.0, default 1.
 *   objectFit    — 'cover' | 'contain', default 'cover'.
 */
export function CameraRenderer({ config }: import('../registry').RendererProps) {
  const deviceLabel = String(config.deviceLabel ?? 'default')
  const mirror      = config.mirror !== false
  const shape       = String(config.shape ?? 'rectangle')
  const brightness  = Number(config.brightness ?? 1)
  const contrast    = Number(config.contrast ?? 1)
  const saturation  = Number(config.saturation ?? 1)
  const opacity     = Number(config.opacity ?? 1)
  const objectFit   = String(config.objectFit ?? 'cover') as 'cover' | 'contain'

  const videoRef = useRef<HTMLVideoElement>(null)
  const blocked = shouldBlockCameraCapture()

  const { stream, error: captureError } = useMediaCaptureSource({
    deviceLabel: deviceLabel !== 'default' ? deviceLabel : '',
    disabled: blocked,
  })

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  const error = blocked
    ? 'Camara desactivada en vista previa para evitar conflicto de dispositivo.'
    : captureError

  const borderRadius =
    shape === 'circle'  ? '50%'  :
    shape === 'rounded' ? '16px' :
    '0'

  const cssFilter = [
    brightness !== 1 && `brightness(${brightness})`,
    contrast   !== 1 && `contrast(${contrast})`,
    saturation !== 1 && `saturate(${saturation})`,
  ]
    .filter(Boolean)
    .join(' ') || 'none'

  if (error) {
    return (
      <div
        style={{
          position:       'absolute',
          inset:          0,
          background:     '#0d0d0d',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            8,
          borderRadius,
          overflow:       'hidden',
        }}
      >
        <span style={{ fontSize: 28 }}>📷</span>
        <div
          style={{
            color:      '#ff6b6b',
            fontFamily: 'monospace',
            fontSize:   11,
            padding:    '0 12px',
            textAlign:  'center',
          }}
        >
          {error}
        </div>
        <div
          style={{
            color:      '#666',
            fontFamily: 'monospace',
            fontSize:   10,
            textAlign:  'center',
            padding:    '0 8px',
          }}
        >
          {deviceLabel !== 'default' ? `Buscando: "${deviceLabel}"` : 'Dispositivo por defecto'}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position:     'absolute',
        inset:        0,
        borderRadius,
        overflow:     'hidden',
        opacity,
      }}
    >
      {/* Feed de cámara */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position:   'absolute',
          inset:      0,
          width:      '100%',
          height:     '100%',
          objectFit,
          filter:     cssFilter,
          transform:  mirror ? 'scaleX(-1)' : 'none',
          display:    'block',
        }}
      />

    </div>
  )
}
