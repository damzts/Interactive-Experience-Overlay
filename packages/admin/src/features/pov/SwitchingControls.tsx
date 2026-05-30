import { useCallback, useEffect, useState } from 'react'
import type { SwitchMode, CameraConnectionStatus } from '@ieom/shared'
import type { POVErrorPayload } from '@ieom/shared'
import { socket } from '../../socket/client'
import { Btn, ConfigCard, ConfigNotice, ConfigSectionPanel } from '../../shared/ui'

// ── Types ──────────────────────────────────────────────────────────

interface FeedInfo {
  id: string
  label: string
  connectionStatus: CameraConnectionStatus
  activityScore: number
}

interface SwitchingControlsProps {
  mode: SwitchMode
  activeCameraId: string | null
  feeds: FeedInfo[]
  onModeChange?: (mode: SwitchMode) => void
}

// ── SwitchingControls ──────────────────────────────────────────────

/**
 * Switching controls and manual override UI.
 * Displays mode toggle, manual camera selection buttons, error toast on rejection,
 * and current mode indicator updated via pov:status events.
 *
 * Can be used standalone (listens to pov:status/pov:error itself) or receive
 * state via props from a parent CameraDashboard.
 */
export function SwitchingControls({ mode, activeCameraId, feeds, onModeChange }: SwitchingControlsProps) {
  const [errorToast, setErrorToast] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)

  // ── Listen for pov:error to show toast on feed_unavailable ─────

  useEffect(() => {
    const handleError = (payload: POVErrorPayload) => {
      if (payload.code === 'feed_unavailable') {
        setErrorToast(payload.message)
      }
    }

    socket.on('pov:error', handleError)

    return () => {
      socket.off('pov:error', handleError)
    }
  }, [])

  // ── Auto-dismiss error toast ───────────────────────────────────

  useEffect(() => {
    if (!errorToast) return
    const timer = setTimeout(() => setErrorToast(null), 4000)
    return () => clearTimeout(timer)
  }, [errorToast])

  // ── Mode toggle handler ────────────────────────────────────────

  const handleModeToggle = useCallback(() => {
    const newMode: SwitchMode = mode === 'automatic' ? 'manual' : 'automatic'
    socket.emit('pov:mode:set', newMode, (err: string | null) => {
      if (err) {
        setErrorToast(err)
      } else {
        onModeChange?.(newMode)
      }
    })
  }, [mode, onModeChange])

  // ── Manual camera selection handler ────────────────────────────

  const handleSelectFeed = useCallback((feedId: string) => {
    setSwitching(true)
    socket.emit('pov:select', feedId, (err: string | null) => {
      setSwitching(false)
      if (err) {
        setErrorToast(err)
      }
    })
  }, [])

  // ── Render ─────────────────────────────────────────────────────

  const connectedFeeds = feeds.filter((f) => f.connectionStatus === 'connected')
  const disconnectedFeeds = feeds.filter((f) => f.connectionStatus !== 'connected')

  return (
    <ConfigSectionPanel label="Switching Controls">
      {/* Error toast */}
      {errorToast && (
        <ConfigNotice tone="danger" className="mb-3">
          <div className="flex items-center justify-between gap-2">
            <span>{errorToast}</span>
            <button
              type="button"
              onClick={() => setErrorToast(null)}
              className="shrink-0 text-red-300 hover:text-red-100 transition-colors"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        </ConfigNotice>
      )}

      {/* Current mode indicator */}
      <ConfigCard className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Switching Mode</span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] ${
                mode === 'automatic'
                  ? 'border border-emerald-500/30 bg-emerald-500/12 text-emerald-200'
                  : 'border border-amber-500/30 bg-amber-500/12 text-amber-200'
              }`}
            >
              {mode === 'automatic' ? '⚡ Automatic' : '✋ Manual'}
            </span>
          </div>
          <Btn
            variant={mode === 'automatic' ? 'warning' : 'primary'}
            onClick={handleModeToggle}
            className="text-xs px-3 py-1"
          >
            {mode === 'automatic' ? 'Switch to Manual' : 'Switch to Automatic'}
          </Btn>
        </div>
      </ConfigCard>

      {/* Manual camera selection */}
      {feeds.length === 0 ? (
        <ConfigNotice tone="info">
          No camera feeds registered. Add camera feeds to enable switching controls.
        </ConfigNotice>
      ) : (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-0.5">
            Camera Feeds
          </div>

          {/* Connected feeds */}
          {connectedFeeds.map((feed) => {
            const isActive = feed.id === activeCameraId
            return (
              <ConfigCard key={feed.id} className={isActive ? 'ring-1 ring-cyan-400/40' : ''}>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        isActive ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]' : 'bg-emerald-400'
                      }`}
                      title={isActive ? 'Active camera' : 'Connected'}
                    />
                    <span className="text-xs font-medium text-zinc-100 truncate">
                      {feed.label}
                    </span>
                    {isActive && (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-cyan-300">
                        LIVE
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] font-mono text-zinc-500">
                    {feed.activityScore.toFixed(2)}
                  </span>
                  <Btn
                    variant={isActive ? 'active' : 'default'}
                    onClick={() => handleSelectFeed(feed.id)}
                    disabled={isActive || switching}
                    className="text-[10px] px-2 py-1"
                  >
                    {isActive ? '● Active' : 'Select'}
                  </Btn>
                </div>
              </ConfigCard>
            )
          })}

          {/* Disconnected feeds */}
          {disconnectedFeeds.map((feed) => (
            <ConfigCard key={feed.id} className="opacity-60">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-red-400"
                    title={feed.connectionStatus}
                  />
                  <span className="text-xs font-medium text-zinc-400 truncate">
                    {feed.label}
                  </span>
                  <span className="shrink-0 text-[9px] font-medium uppercase tracking-wider text-red-400/80">
                    {feed.connectionStatus}
                  </span>
                </div>
                <Btn
                  variant="default"
                  onClick={() => handleSelectFeed(feed.id)}
                  disabled={switching}
                  className="text-[10px] px-2 py-1"
                  title="Feed is unavailable — selection will be rejected"
                >
                  Select
                </Btn>
              </div>
            </ConfigCard>
          ))}
        </div>
      )}

      {/* Mode explanation */}
      <ConfigNotice tone="info" className="mt-3">
        {mode === 'automatic'
          ? 'The system automatically switches to the camera with the highest activity. Toggle to manual to lock onto a specific feed.'
          : 'Manual mode is active — automatic switching is suspended. Select a camera above or switch back to automatic mode.'}
      </ConfigNotice>
    </ConfigSectionPanel>
  )
}
