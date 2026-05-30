import { useCallback, useEffect, useRef, useState } from 'react'
import type { CameraFeed, CameraConnectionStatus, SwitchMode } from '@ieom/shared'
import type { POVStatusPayload, POVScoresPayload, POVFeedStatusPayload, POVSwitchPayload } from '@ieom/shared'
import { ConfigCard, ConfigNotice, ConfigPageIntro, ConfigSectionPanel } from '../../shared/ui'
import { socket } from '../../socket/client'
import { getFeeds } from '../../api/povApi'
import { SwitchingControls } from './SwitchingControls'

// ── Helpers ────────────────────────────────────────────────────────

function statusColor(status: CameraConnectionStatus): string {
  switch (status) {
    case 'connected':    return 'text-emerald-400'
    case 'disconnected': return 'text-zinc-500'
    case 'reconnecting': return 'text-amber-400'
    case 'unresponsive': return 'text-red-400'
    case 'unreachable':  return 'text-red-500'
    default:             return 'text-zinc-500'
  }
}

function statusDotColor(status: CameraConnectionStatus): string {
  switch (status) {
    case 'connected':    return 'bg-emerald-400'
    case 'disconnected': return 'bg-zinc-500'
    case 'reconnecting': return 'bg-amber-400'
    case 'unresponsive': return 'bg-red-400'
    case 'unreachable':  return 'bg-red-500'
    default:             return 'bg-zinc-500'
  }
}

function statusLabel(status: CameraConnectionStatus): string {
  switch (status) {
    case 'connected':    return 'Connected'
    case 'disconnected': return 'Disconnected'
    case 'reconnecting': return 'Reconnecting'
    case 'unresponsive': return 'Unresponsive'
    case 'unreachable':  return 'Unreachable'
    default:             return 'Unknown'
  }
}

// ── CameraFeedCard ─────────────────────────────────────────────────

function CameraFeedCard({ feed, isActive }: { feed: CameraFeed; isActive: boolean }) {
  const scorePercent = Math.round(feed.activityScore * 100)

  return (
    <ConfigCard
      className={
        isActive
          ? 'ring-2 ring-cyan-400/50 border-cyan-400/40'
          : ''
      }
    >
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <div className="flex flex-col items-center gap-1">
          <div className={`h-2.5 w-2.5 rounded-full ${statusDotColor(feed.connectionStatus)}`} />
        </div>

        {/* Feed info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-zinc-100">
              {feed.label}
            </span>
            {isActive && (
              <span className="shrink-0 rounded-full bg-cyan-500/15 border border-cyan-400/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-cyan-200">
                Active
              </span>
            )}
          </div>
          <div className={`text-[11px] ${statusColor(feed.connectionStatus)}`}>
            {statusLabel(feed.connectionStatus)}
          </div>
        </div>

        {/* Activity Score */}
        <div className="shrink-0 text-right">
          <div className="text-xs font-mono text-zinc-300">
            {feed.activityScore.toFixed(2)}
          </div>
          <div className="text-[10px] text-zinc-600">score</div>
        </div>
      </div>

      {/* Activity Score Bar */}
      <div className="mt-2.5">
        <div className="h-1.5 w-full rounded-full bg-zinc-800/80 overflow-hidden">
          <div
            className="h-full rounded-full bg-cyan-400/70 transition-all duration-300"
            style={{ width: `${scorePercent}%` }}
          />
        </div>
      </div>
    </ConfigCard>
  )
}

// ── CameraDashboard ────────────────────────────────────────────────

export function CameraDashboard() {
  const [feeds, setFeeds] = useState<CameraFeed[]>([])
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null)
  const [mode, setMode] = useState<SwitchMode>('automatic')
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  // Fetch initial feeds list
  useEffect(() => {
    mountedRef.current = true
    getFeeds()
      .then((data) => {
        if (mountedRef.current) {
          setFeeds(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (mountedRef.current) setLoading(false)
      })
    return () => { mountedRef.current = false }
  }, [])

  // Handle pov:status — full state sync (sent on connect and mode changes)
  const handleStatus = useCallback((payload: POVStatusPayload) => {
    setActiveCameraId(payload.activeCameraId)
    setMode(payload.mode)
    setFeeds((prev) => {
      const updated = payload.feeds.map((f) => {
        const existing = prev.find((p) => p.id === f.id)
        return existing
          ? { ...existing, connectionStatus: f.connectionStatus, activityScore: f.activityScore, label: f.label }
          : { id: f.id, label: f.label, connectionStatus: f.connectionStatus, activityScore: f.activityScore, obsAddress: '', obsPassword: '', sceneName: '', connectedAt: null, registeredAt: Date.now(), lastHealthCheck: null } as CameraFeed
      })
      return updated
    })
  }, [])

  // Handle pov:scores — periodic activity score updates
  const handleScores = useCallback((payload: POVScoresPayload) => {
    setFeeds((prev) =>
      prev.map((feed) => {
        const scoreEntry = payload.scores.find((s) => s.feedId === feed.id)
        return scoreEntry ? { ...feed, activityScore: scoreEntry.score } : feed
      })
    )
  }, [])

  // Handle pov:feed:status — single feed connection status change
  const handleFeedStatus = useCallback((payload: POVFeedStatusPayload) => {
    setFeeds((prev) =>
      prev.map((feed) =>
        feed.id === payload.feedId
          ? { ...feed, connectionStatus: payload.connectionStatus, label: payload.label }
          : feed
      )
    )
  }, [])

  // Handle pov:switch — active camera changed
  const handleSwitch = useCallback((payload: POVSwitchPayload) => {
    setActiveCameraId(payload.newFeedId)
  }, [])

  // Socket.IO event listeners
  useEffect(() => {
    socket.on('pov:status', handleStatus)
    socket.on('pov:scores', handleScores)
    socket.on('pov:feed:status', handleFeedStatus)
    socket.on('pov:switch', handleSwitch)

    return () => {
      socket.off('pov:status', handleStatus)
      socket.off('pov:scores', handleScores)
      socket.off('pov:feed:status', handleFeedStatus)
      socket.off('pov:switch', handleSwitch)
    }
  }, [handleStatus, handleScores, handleFeedStatus, handleSwitch])

  return (
    <div className="w-full max-w-none space-y-0 pt-1">
      <ConfigPageIntro title="Camera Dashboard">
        Monitor connected camera feeds, activity levels, and the active POV.
      </ConfigPageIntro>

      <ConfigSectionPanel label="Camera Feeds" first>
        {loading ? (
          <ConfigNotice tone="info">Loading camera feeds…</ConfigNotice>
        ) : feeds.length === 0 ? (
          <ConfigNotice tone="info">
            No camera feeds are registered. Add a camera feed to begin multi-POV switching.
          </ConfigNotice>
        ) : (
          <div className="space-y-2">
            {feeds.map((feed) => (
              <CameraFeedCard
                key={feed.id}
                feed={feed}
                isActive={feed.id === activeCameraId}
              />
            ))}
          </div>
        )}
      </ConfigSectionPanel>

      <SwitchingControls
        mode={mode}
        activeCameraId={activeCameraId}
        feeds={feeds.map((f) => ({
          id: f.id,
          label: f.label,
          connectionStatus: f.connectionStatus,
          activityScore: f.activityScore,
        }))}
        onModeChange={setMode}
      />
    </div>
  )
}
