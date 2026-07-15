import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { DesktopWindow } from './DesktopWindow'
import { useMediaCaptureSource } from '../services/useMediaCaptureSource'

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

function getCameraRoleLabel(appId?: string) {
  if (!appId || appId === 'camera') return 'Host'
  const match = appId.match(/^camera[-:_](.+)$/i)
  if (!match) return 'Camera'
  const token = match[1].trim().toLowerCase()
  if (token === '2' || token === 'a' || token === 'source-a' || token === 'sourcea') return 'Source A'
  if (token === '3' || token === 'b' || token === 'source-b' || token === 'sourceb') return 'Source B'
  return token.split(/[-_\s]+/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

/** Desktop widget that captures a physical/virtual camera device via getUserMedia. */
export function CameraWidget({ appId, defaultCameraLabel, defaultMirror = false, onClose, onMinimize, onFocus, windowState = 'open', zIndex }: DesktopWidgetProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const setCameraPermissionState = useAppStore((s) => s.setCameraPermissionState)
  const roleLabel = getCameraRoleLabel(appId)

  const { stream, loading, error, permissionGranted } = useMediaCaptureSource({
    deviceLabel: defaultCameraLabel ?? '',
  })

  useEffect(() => {
    setCameraPermissionState(permissionGranted ? 'granted' : error ? 'denied' : 'unknown')
  }, [permissionGranted, error, setCameraPermissionState])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      if (stream) void videoRef.current.play().catch(() => {})
    }
  }, [stream])

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
      <div className="widget-panel widget-camera-frame">
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
