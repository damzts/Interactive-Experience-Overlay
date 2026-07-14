import { useEffect, useRef } from 'react'
import { useRemoteScreenShare } from '../../services/useRemoteScreenShare'

/**
 * ScreenShareRenderer — renders a screen/window/tab share published from the
 * admin app (getDisplayMedia requires a user gesture, which only exists in
 * admin — this renderer just displays whatever the admin panel is publishing
 * for the owning widget).
 *
 * Configuración:
 *   widgetId     — Key identifying which admin-published screen share to
 *                  display. Defaults to the hosting window/widget instanceId.
 *   mirror       — Espeja horizontalmente. Default: false.
 *   shape        — 'rectangle' | 'circle' | 'rounded'. Default: 'rectangle'.
 *   frameUrl     — URL de un PNG con transparencia para poner de marco encima del video.
 *   brightness   — 0.0–2.0, default 1.
 *   contrast     — 0.0–2.0, default 1.
 *   saturation   — 0.0–2.0, default 1.
 *   opacity      — 0.0–1.0, default 1.
 *   objectFit    — 'cover' | 'contain', default 'contain'.
 */
export function ScreenShareRenderer({ config, instanceId }: import('../registry').RendererProps) {
  const widgetId   = String(config.widgetId ?? instanceId ?? 'screen')
  const mirror     = config.mirror === true
  const shape      = String(config.shape ?? 'rectangle')
  const frameUrl    = String(config.frameUrl ?? '')
  const brightness = Number(config.brightness ?? 1)
  const contrast   = Number(config.contrast ?? 1)
  const saturation = Number(config.saturation ?? 1)
  const opacity    = Number(config.opacity ?? 1)
  const objectFit  = String(config.objectFit ?? 'contain') as 'cover' | 'contain'

  const videoRef = useRef<HTMLVideoElement>(null)

  const { stream, connecting, error } = useRemoteScreenShare(widgetId)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

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

  if (!stream) {
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
        <span style={{ fontSize: 28 }}>🖥️</span>
        <div
          style={{
            color:      error ? '#ff6b6b' : '#666',
            fontFamily: 'monospace',
            fontSize:   11,
            padding:    '0 12px',
            textAlign:  'center',
          }}
        >
          {error ?? (connecting ? 'Connecting to screen share...' : 'Waiting for screen share (start it from the admin panel)')}
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
      {/* Feed de pantalla/ventana */}
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
