import { useEffect, useRef } from 'react'
import { DesktopWindow } from './DesktopWindow'
import { useRemoteScreenShare } from '../services/useRemoteScreenShare'
import { audioEngine } from '../engine/AudioEngine'

interface DesktopWidgetProps {
  appId?: string
  defaultMirror?: boolean
  /** sourceId from CaptureSource — used as the screen-share registry key in
   *  the new Sources-panel flow. Falls back to appId (then 'screen') when
   *  not set (legacy per-widget flow). */
  sourceId?: string
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

function getScreenRoleLabel(appId?: string) {
  if (!appId || appId === 'screen') return 'Host'
  const match = appId.match(/^screen[-:_](.+)$/i)
  if (!match) return 'Screen'
  const token = match[1].trim().toLowerCase()
  return token.split(/[-_\s]+/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

/**
 * Desktop widget that renders a screen/window/tab share published from the
 * admin app (getDisplayMedia requires a user gesture, which only exists in
 * admin — the overlay is a passive OBS render target). See ScreenConfigSection
 * in the admin panel to start sharing for this widget.
 */
export function ScreenWidget({ appId, defaultMirror = false, sourceId, onClose, onMinimize, onFocus, windowState = 'open', zIndex }: DesktopWidgetProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const roleLabel = getScreenRoleLabel(appId)

  const { stream, connecting, error } = useRemoteScreenShare(sourceId ?? appId ?? 'screen')

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      if (stream) void videoRef.current.play().catch(() => {})
    }
  }, [stream])

  // Feed this widget's captured audio into 'internal' reactivity analysis —
  // automatic, no separate capture/prompt. Analysis-only: never routed to
  // speakers (the <video> element above already handles this widget's own
  // playback). Unregisters on stream change/unmount so closing the widget
  // stops contributing audio to the internal mix.
  const widgetId = sourceId ?? appId ?? 'screen'
  useEffect(() => {
    if (stream && stream.getAudioTracks().length > 0) {
      audioEngine.registerExternalAudioSource(widgetId, stream)
    } else {
      audioEngine.unregisterExternalAudioSource(widgetId)
    }
    return () => audioEngine.unregisterExternalAudioSource(widgetId)
  }, [widgetId, stream])

  const idle = !stream && !connecting && !error

  return (
    <DesktopWindow
      id={appId ?? 'screen'}
      title={`🖥️ Screen - ${roleLabel}`}
      width={480}
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
        {idle && (
          <span className="widget-empty-state">Waiting for screen share to start (start it from the admin panel)...</span>
        )}
        {connecting && (
          <span className="widget-empty-state">Connecting to screen share...</span>
        )}
        {error && (
          <div className="widget-camera-status">
            <span className="widget-camera-status-icon">🖥️</span>
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
            objectFit: 'contain',
            transform: defaultMirror ? 'scaleX(-1)' : 'none',
            display:   stream ? 'block' : 'none',
          }}
        />
      </div>
    </DesktopWindow>
  )
}
