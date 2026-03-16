import { useEffect, useRef, useState } from 'react'

/**
 * CameraRenderer — Plugin que captura un dispositivo de video (cámara física o
 * virtual como NVIDIA Broadcast) via getUserMedia y lo renderiza en la escena.
 *
 * Configuración:
 *   deviceLabel  — Nombre parcial del dispositivo (ej. "NVIDIA Broadcast", "OBS Virtual Camera").
 *                  Usa "default" para tomar el primer dispositivo disponible.
 *   mirror       — Espeja horizontalmente (útil para webcam frontal). Default: true.
 *   shape        — 'rectangle' | 'circle' | 'rounded'. Default: 'rectangle'.
 *   frameUrl     — URL de un PNG con transparencia para poner de marco encima del video.
 *   brightness   — 0.0–2.0, default 1.
 *   contrast     — 0.0–2.0, default 1.
 *   saturation   — 0.0–2.0, default 1.
 *   opacity      — 0.0–1.0, default 1.
 *   objectFit    — 'cover' | 'contain', default 'cover'.
 */
export function CameraRenderer({ config }: { config: Record<string, unknown> }) {
  const deviceLabel = String(config.deviceLabel ?? 'default')
  const mirror      = config.mirror !== false
  const shape       = String(config.shape ?? 'rectangle')
  const frameUrl    = String(config.frameUrl ?? '')
  const brightness  = Number(config.brightness ?? 1)
  const contrast    = Number(config.contrast ?? 1)
  const saturation  = Number(config.saturation ?? 1)
  const opacity     = Number(config.opacity ?? 1)
  const objectFit   = String(config.objectFit ?? 'cover') as 'cover' | 'contain'

  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    async function startCamera() {
      try {
        let deviceId: ConstrainDOMString | undefined

        // Buscar el dispositivo por nombre si no es "default"
        if (deviceLabel && deviceLabel !== 'default') {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            const match = devices.find(
              (d) =>
                d.kind === 'videoinput' &&
                d.label.toLowerCase().includes(deviceLabel.toLowerCase()),
            )
            if (match) deviceId = { exact: match.deviceId }
          } catch {
            // enumerateDevices puede fallar en algunos contextos — seguir con default
          }
        }

        const constraints: MediaStreamConstraints = {
          video: {
            width:     { ideal: 1920 },
            height:    { ideal: 1080 },
            frameRate: { ideal: 60 },
            ...(deviceId ? { deviceId } : {}),
          },
          audio: false,
        }

        stream = await navigator.mediaDevices.getUserMedia(constraints)

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setError(null)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Camera unavailable'
        setError(msg)
        console.warn('[CameraPlugin]', deviceLabel, '—', msg)
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      if (stream) stream.getTracks().forEach((t) => t.stop())
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [deviceLabel])

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

      {/* Marco PNG opcional encima del video */}
      {frameUrl && (
        <img
          src={frameUrl}
          alt=""
          draggable={false}
          style={{
            position:      'absolute',
            inset:         0,
            width:         '100%',
            height:        '100%',
            objectFit:     'fill',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
