import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { RoomStatus, ParticipantInfo, RoomConfig, SwitchMode, PerRoomConfig, TransitionConfig } from '@ieomlabs/shared'
import { ROOM_CONFIG_BOUNDS, DEFAULT_ROOM_CONFIG, DEFAULT_PER_ROOM_CONFIG } from '@ieomlabs/shared'
import type {
  RoomCreatedPayload,
  RoomClosedPayload,
  RoomParticipantJoinedPayload,
  RoomParticipantLeftPayload,
  RoomScoresPayload,
  RoomSwitchPayload,
  RoomServerToAdminEvents,
  RoomClientToServerEvents,
} from '@ieomlabs/shared'
import { getRoomConfig, updateRoomConfig, getRooms, provideAuthToken, getActiveRoomCode, setActiveRoomCode as setActiveRoomCodeApi, updateCloudRoomConfig, setParticipantTransition } from '../../api/roomApi'
import { getStoredAuthToken } from '../../auth/sessionToken'
import { apiFetch } from '../../api/client'
import { Slider, ConfigPageIntro, ConfigChoiceButton, Field } from '../../shared/ui'
import { Button } from '../../components/atoms'
import { Card } from '../../components/molecules'
import { ConfigPanel } from '../../components/organisms'
import { AdminStreamGrid } from './AdminStreamGrid'
import { FeatureGate } from '../../desktop/FeatureGate'
import { useAuth } from '../../auth/AuthContext'

// ── Types ──────────────────────────────────────────────────────────

type RoomSocket = Socket<RoomServerToAdminEvents, RoomClientToServerEvents>

// ── Helpers ────────────────────────────────────────────────────────

const CLOUD_ORIGIN = import.meta.env.VITE_API_ORIGIN as string || 'https://ieom.danhub.dev'

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function buildJoinUrl(roomCode: string): string {
  return `${CLOUD_ORIGIN}/room/${roomCode}`
}

function buildLanJoinUrl(): string {
  const serverOrigin = import.meta.env.VITE_OVERLAY_RUNTIME_ORIGIN as string || 'http://localhost:3000'
  return `${serverOrigin}/studio`
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// ── Notice ─────────────────────────────────────────────────────────

function Notice({ tone = 'info', className, children }: { tone?: 'info' | 'warning' | 'danger' | 'success'; className?: string; children: React.ReactNode }) {
  const toneStyles: Record<string, string> = {
    info: 'border-[var(--color-primary-400)]/25 bg-[var(--color-primary-500)]/10 text-[var(--color-primary-100)]',
    warning: 'border-[var(--color-accent-400)]/30 bg-[var(--color-accent-500)]/12 text-[var(--color-accent-100)]',
    danger: 'border-[var(--color-danger-400)]/30 bg-[var(--color-danger-500)]/12 text-[var(--color-danger-400)]',
    success: 'border-[var(--color-success-400)]/30 bg-[var(--color-success-500)]/12 text-[var(--color-success-400)]',
  }
  return (
    <div className={`rounded-[var(--radius-lg)] border px-3 py-2.5 text-sm shadow-[var(--shadow-sm)] backdrop-blur ${toneStyles[tone]} ${className ?? ''}`}>
      {children}
    </div>
  )
}

// ── CopyButton ─────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [text])

  return (
    <Button
      variant={copied ? 'success' : 'ghost'}
      size="sm"
      onClick={handleCopy}
      className="text-[10px] px-2 py-0.5"
    >
      {copied ? '✓ Copied' : label}
    </Button>
  )
}

// ── ParticipantRow ─────────────────────────────────────────────────

function ParticipantRow({
  participant,
  isActive,
  onSelect,
  onKick,
  selecting,
  roomCode,
  onTransitionChange,
}: {
  participant: ParticipantInfo
  isActive: boolean
  onSelect: (id: string) => void
  onKick: (id: string) => void
  selecting: boolean
  roomCode: string
  onTransitionChange: (roomCode: string, participantId: string, transition: TransitionConfig) => void
}) {
  const scorePercent = Math.round(participant.activityScore * 100)
  const [showTransitionMenu, setShowTransitionMenu] = useState(false)

  return (
    <div
      className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${
        isActive ? 'bg-[var(--color-primary-500)]/8 ring-1 ring-[var(--color-primary-400)]/30' : ''
      }`}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          participant.connectionStatus === 'connected' ? 'bg-[var(--color-success-400)]' : 'bg-[var(--color-danger-400)]'
        }`}
        title={participant.connectionStatus}
      />

      <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--color-text-primary)]">
        {participant.displayName}
      </span>

      {isActive && (
        <span className="shrink-0 rounded-full border border-[var(--color-primary-400)]/30 bg-[var(--color-primary-500)]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--color-primary-200)]">
          Active
        </span>
      )}

      <div className="w-20 shrink-0">
        <div className="h-2 w-full rounded-full bg-[var(--color-bg-elevated)]/80 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-150 ${
              scorePercent > 60
                ? 'bg-[var(--color-success-400)]'
                : scorePercent > 30
                  ? 'bg-[var(--color-primary-400)]'
                  : scorePercent > 5
                    ? 'bg-[var(--color-accent-400)]/70'
                    : 'bg-[var(--color-text-muted)]/30'
            }`}
            style={{ width: `${scorePercent}%` }}
          />
        </div>
      </div>

      <span className="w-8 shrink-0 text-right text-[10px] font-mono text-[var(--color-text-muted)]">
        {scorePercent}%
      </span>

      <div className="relative">
        <button
          onClick={() => setShowTransitionMenu(!showTransitionMenu)}
          className="text-[10px] px-2 py-1.5 rounded-md font-medium transition-all bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-500)]/20 hover:text-[var(--color-accent-400)] cursor-pointer active:bg-[var(--color-accent-500)]/30"
          title="Set transition effect"
        >
          ⚡
        </button>
        {showTransitionMenu && (
          <div className="absolute top-full right-0 mt-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-md shadow-lg z-10 min-w-max">
            {[
              { type: 'cut', label: 'Cut' },
              { type: 'fade', label: 'Fade' },
            ].map(({ type, label }) => (
              <button
                key={type}
                onClick={() => {
                  onTransitionChange(roomCode, participant.id, {
                    type: type as 'cut' | 'fade',
                    durationMs: type === 'cut' ? 0 : 500,
                  })
                  setShowTransitionMenu(false)
                }}
                className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-[var(--color-primary-500)]/20 hover:text-[var(--color-primary-400)] transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => onSelect(participant.id)}
        disabled={isActive || selecting || participant.connectionStatus !== 'connected'}
        className={`text-[10px] px-3 py-1.5 rounded-md font-medium transition-all ${
          isActive
            ? 'bg-[var(--color-primary-500)] text-white shadow-lg shadow-[var(--color-primary-500)]/40 cursor-default'
            : participant.connectionStatus !== 'connected'
              ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] cursor-not-allowed opacity-50'
              : selecting
                ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] cursor-wait'
                : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-500)]/20 hover:text-[var(--color-primary-400)] cursor-pointer active:bg-[var(--color-primary-500)]/30'
        }`}
      >
        {isActive ? '● LIVE' : 'Select'}
      </button>

      <Button
        variant="danger"
        size="sm"
        onClick={() => onKick(participant.id)}
        className="text-[10px] px-1.5 py-0.5"
        title="Remove participant"
      >
        ✕
      </Button>
    </div>
  )
}

// ── RoomCard ───────────────────────────────────────────────────────

function RoomCard({
  room,
  onClose,
  onRejoin,
  onModeSet,
  onSelect,
  onKick,
  isActive,
  onSetActive,
  socket: roomSocket,
  onConfigSave,
}: {
  room: RoomStatus
  onClose: (roomCode: string) => void
  onRejoin: (roomCode: string) => void
  onModeSet: (roomCode: string, mode: SwitchMode) => void
  onSelect: (roomCode: string, participantId: string) => void
  onKick: (roomCode: string, participantId: string) => void
  isActive: boolean
  onSetActive: (roomCode: string) => void
  socket: RoomSocket | null
  onConfigSave: (roomCode: string, config: Partial<PerRoomConfig>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [rejoining, setRejoining] = useState(false)
  const [configExpanded, setConfigExpanded] = useState(false)
  const [transitionsExpanded, setTransitionsExpanded] = useState(false)
  const [configDraft, setConfigDraft] = useState<PerRoomConfig>(room.config)
  const [savingConfig, setSavingConfig] = useState(false)

  const joinUrl = buildJoinUrl(room.roomCode)
  const lanJoinUrl = buildLanJoinUrl()

  const handleSelect = useCallback(
    (participantId: string) => {
      setSelecting(true)
      onSelect(room.roomCode, participantId)
      setTimeout(() => setSelecting(false), 1000)
    },
    [room.roomCode, onSelect],
  )

  const handleKick = useCallback(
    (participantId: string) => {
      onKick(room.roomCode, participantId)
    },
    [room.roomCode, onKick],
  )

  const handleRejoin = useCallback(() => {
    setRejoining(true)
    onRejoin(room.roomCode)
    setTimeout(() => setRejoining(false), 3000)
  }, [room.roomCode, onRejoin])

  const handleClose = useCallback(() => {
    if (!confirmClose) {
      setConfirmClose(true)
      return
    }
    onClose(room.roomCode)
    setConfirmClose(false)
  }, [confirmClose, room.roomCode, onClose])

  const handleSaveConfig = useCallback(async () => {
    setSavingConfig(true)
    try {
      onConfigSave(room.roomCode, configDraft)
    } finally {
      setSavingConfig(false)
    }
  }, [room.roomCode, configDraft, onConfigSave])

  const handleResetConfig = useCallback(() => {
    setConfigDraft(room.config)
  }, [room.config])

  const updateConfigDraft = useCallback(<K extends keyof PerRoomConfig>(
    key: K,
    value: PerRoomConfig[K],
  ) => {
    setConfigDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleParticipantTransitionChange = useCallback(
    (roomCode: string, participantId: string, transition: TransitionConfig) => {
      onConfigSave(roomCode, { transition })
    },
    [onConfigSave],
  )

  return (
    <Card variant="default" padding="md" className={room.status === 'idle' ? 'opacity-70' : ''}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors text-sm"
          aria-label={expanded ? 'Collapse room' : 'Expand room'}
        >
          {expanded ? '▾' : '▸'}
        </button>

        <span className="shrink-0 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-base)]/70 px-2 py-0.5 font-mono text-sm font-bold text-[var(--color-text-primary)] tracking-wider">
          {room.roomCode}
        </span>

        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
            room.status === 'active'
              ? 'border border-[var(--color-success-400)]/30 bg-[var(--color-success-500)]/12 text-[var(--color-success-400)]'
              : 'border border-[var(--color-accent-400)]/30 bg-[var(--color-accent-500)]/12 text-[var(--color-accent-400)]'
          }`}
        >
          {room.status}
        </span>

        <span
          className={`shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
            room.hubConnected
              ? 'border border-[var(--color-success-400)]/30 bg-[var(--color-success-500)]/12 text-[var(--color-success-400)]'
              : 'border border-[var(--color-danger-400)]/30 bg-[var(--color-danger-500)]/12 text-[var(--color-danger-400)]'
          }`}
          title={room.hubConnected ? 'Hub connected to cloud room' : 'Hub disconnected — participants cannot join'}
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${room.hubConnected ? 'bg-[var(--color-success-400)]' : 'bg-[var(--color-danger-400)]'}`} />
          {room.hubConnected ? 'Hub' : 'No Hub'}
        </span>

        <span className="shrink-0 text-xs text-[var(--color-text-secondary)]">
          {room.participantCount}/{room.maxPlayers} players
        </span>

        <span className="shrink-0 text-[10px] text-[var(--color-text-muted)]">
          Created {formatTimestamp(room.createdAt)}
        </span>

        <div className="flex-1" />

        <button
          onClick={() => onSetActive(room.roomCode)}
          className={`text-[10px] px-3 py-1.5 rounded-md font-medium transition-all ${
            isActive
              ? 'bg-[var(--color-accent-500)] text-white shadow-md shadow-[var(--color-accent-500)]/50'
              : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-500)]/20'
          }`}
          title="Make this room the active POV source"
        >
          {isActive ? '📺 Active POV' : 'POV'}
        </button>

        <Button
          variant={room.mode === 'automatic' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => onModeSet(room.roomCode, room.mode === 'automatic' ? 'manual' : 'automatic')}
          className="text-[10px] px-2 py-0.5"
        >
          {room.mode === 'automatic' ? '⚡ Auto' : '✋ Manual'}
        </Button>

        {!room.hubConnected && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleRejoin}
            disabled={rejoining}
            className="text-[10px] px-2 py-0.5"
            title="Reconnect hub to cloud room (manual override of auto-reconnect backoff)"
          >
            {rejoining ? '🔄 Reconnecting…' : '🔌 Reconnect Hub'}
          </Button>
        )}

        {confirmClose ? (
          <div className="flex items-center gap-1">
            <Button variant="danger" size="sm" onClick={handleClose} className="text-[10px] px-2 py-0.5">
              Confirm
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmClose(false)} className="text-[10px] px-2 py-0.5">
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="danger" size="sm" onClick={handleClose} className="text-[10px] px-2 py-0.5">
            Close Room
          </Button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-base)]/55 px-2 py-1">
          <span className="text-[10px] text-[var(--color-text-muted)]">☁️ Cloud Join:</span>
          <span className="text-[10px] font-mono text-[var(--color-text-secondary)] max-w-[220px] truncate" title={joinUrl}>{joinUrl}</span>
          <CopyButton text={joinUrl} label="Copy" />
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-base)]/55 px-2 py-1">
          <span className="text-[10px] text-[var(--color-text-muted)]">🏠 LAN Join:</span>
          <span className="text-[10px] font-mono text-[var(--color-text-secondary)] max-w-[200px] truncate" title={lanJoinUrl}>{lanJoinUrl}</span>
          <CopyButton text={lanJoinUrl} label="Copy" />
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-[var(--color-border-default)] pt-3 space-y-3">
          {/* Participants section */}
          {room.participants.length === 0 ? (
            <Notice tone="info">
              No participants connected yet. Share the join URL to invite players.
            </Notice>
          ) : (
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] px-2 mb-1">
                Participants
              </div>
              {room.participants.map((p) => (
                <ParticipantRow
                  key={p.id}
                  participant={p}
                  isActive={p.id === room.activePlayerId}
                  onSelect={handleSelect}
                  onKick={handleKick}
                  selecting={selecting}
                  roomCode={room.roomCode}
                  onTransitionChange={handleParticipantTransitionChange}
                />
              ))}
            </div>
          )}

          {/* Auto Mode Config section */}
          <div className="border-t border-[var(--color-border-default)] pt-3">
            <button
              onClick={() => setConfigExpanded(!configExpanded)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)] mb-2"
            >
              <span className="text-[10px]">{configExpanded ? '▾' : '▸'}</span>
              <span>Auto Mode Config</span>
            </button>
            {configExpanded && (
              <div className="space-y-3 ml-4">
                <Slider
                  label="Activity Threshold"
                  value={configDraft.activityThreshold}
                  min={ROOM_CONFIG_BOUNDS.activityThreshold.min}
                  max={ROOM_CONFIG_BOUNDS.activityThreshold.max}
                  step={0.01}
                  onChange={(v) => updateConfigDraft('activityThreshold', v)}
                />
                <Slider
                  label="Silence Threshold"
                  value={configDraft.silenceThreshold}
                  min={ROOM_CONFIG_BOUNDS.silenceThreshold.min}
                  max={ROOM_CONFIG_BOUNDS.silenceThreshold.max}
                  step={0.01}
                  onChange={(v) => updateConfigDraft('silenceThreshold', v)}
                />
                <Slider
                  label="Motion Weight"
                  value={configDraft.motionWeight}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => updateConfigDraft('motionWeight', v)}
                />
                <Slider
                  label="Response Window"
                  value={configDraft.rollingWindowMs}
                  min={ROOM_CONFIG_BOUNDS.rollingWindowMs.min}
                  max={ROOM_CONFIG_BOUNDS.rollingWindowMs.max}
                  step={100}
                  unit="ms"
                  onChange={(v) => updateConfigDraft('rollingWindowMs', Math.round(v))}
                />
                <Slider
                  label="Switch Cooldown"
                  value={configDraft.cooldownMs / 1000}
                  min={ROOM_CONFIG_BOUNDS.cooldownMs.min / 1000}
                  max={ROOM_CONFIG_BOUNDS.cooldownMs.max / 1000}
                  step={0.5}
                  unit="s"
                  onChange={(v) => updateConfigDraft('cooldownMs', Math.round(v * 1000))}
                />
              </div>
            )}
          </div>

          {/* Transitions section */}
          <div className="border-t border-[var(--color-border-default)] pt-3">
            <button
              onClick={() => setTransitionsExpanded(!transitionsExpanded)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)] mb-2"
            >
              <span className="text-[10px]">{transitionsExpanded ? '▾' : '▸'}</span>
              <span>Transitions</span>
            </button>
            {transitionsExpanded && (
              <div className="space-y-3 ml-4">
                <div>
                  <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Default Camera</div>
                  <div className="flex gap-2">
                    {[
                      { val: 'auto', label: 'Auto-select First' },
                      { val: 'blank', label: 'Start Blank' }
                    ].map(({ val, label }) => {
                      const isSelected = configDraft.defaultFirstCamera === val
                      return (
                        <button
                          key={val}
                          onClick={() => updateConfigDraft('defaultFirstCamera', val as any)}
                          className={`flex-1 px-3 py-1.5 rounded-md font-medium transition-all text-xs ${
                            isSelected
                              ? 'bg-[var(--color-primary-500)] text-white shadow-md shadow-[var(--color-primary-500)]/50'
                              : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-500)]/20'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Transition Animation</div>
                  <div className="flex gap-2 mb-2">
                    {[
                      { val: 'cut', label: 'Cut (instant)' },
                      { val: 'fade', label: 'Fade' }
                    ].map(({ val, label }) => {
                      const isSelected = configDraft.transition.type === val
                      return (
                        <button
                          key={val}
                          onClick={() => updateConfigDraft('transition', val === 'cut' ? { type: 'cut', durationMs: 0 } : { type: 'fade', durationMs: 500 })}
                          className={`flex-1 px-3 py-1.5 rounded-md font-medium transition-all text-xs ${
                            isSelected
                              ? 'bg-[var(--color-primary-500)] text-white shadow-md shadow-[var(--color-primary-500)]/50'
                              : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-500)]/20'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>

                  {configDraft.transition.type === 'fade' && (
                    <Slider
                      label="Fade Duration"
                      value={configDraft.transition.durationMs}
                      min={100}
                      max={5000}
                      step={50}
                      unit="ms"
                      onChange={(v) =>
                        updateConfigDraft('transition', { ...configDraft.transition, durationMs: Math.round(v) })
                      }
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Config save buttons */}
          <div className="flex gap-2 justify-end border-t border-[var(--color-border-default)] pt-3">
            <Button variant="secondary" size="sm" onClick={handleResetConfig} disabled={savingConfig} className="text-[10px]">
              Reset
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveConfig} disabled={savingConfig} className="text-[10px]">
              {savingConfig ? 'Saving…' : 'Apply'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── RoomsPanel ─────────────────────────────────────────────────────

export function RoomsPanel() {
  const { isAuthenticated, login } = useAuth()
  const [rooms, setRooms] = useState<RoomStatus[]>([])
  const [config, setConfig] = useState<RoomConfig>(DEFAULT_ROOM_CONFIG)
  const [configDraft, setConfigDraft] = useState<RoomConfig>(DEFAULT_ROOM_CONFIG)
  const [creating, setCreating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [activityLog, setActivityLog] = useState<Array<{ id: number; time: number; icon: string; text: string }>>([])
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null)


  const socketRef = useRef<RoomSocket | null>(null)
  const mountedRef = useRef(true)
  const logIdRef = useRef(0)

  // ── LAN state ────────────────────────────────────────────────────

  const [lanCode, setLanCode] = useState<string | null>(null)
  const [lanParticipants, setLanParticipants] = useState<Array<{ id: string; iceState: string; videoMuted: boolean }>>([])
  const [regeneratingCode, setRegeneratingCode] = useState(false)
  const [lanConfigExpanded, setLanConfigExpanded] = useState(true)
  const [lanTransitionsExpanded, setLanTransitionsExpanded] = useState(true)

  const refreshLan = useCallback(async () => {
    try {
      const [{ code }, { participants }] = await Promise.all([
        apiFetch<{ code: string }>('/api/room/code'),
        apiFetch<{ participants: Array<{ id: string; iceState: string; videoMuted: boolean }> }>('/api/room/lan-participants'),
      ])
      setLanCode(code)
      setLanParticipants(participants)
    } catch { /* non-fatal */ }
  }, [])


  useEffect(() => {
    refreshLan()
    const lanTimer = setInterval(refreshLan, 3000)
    return () => clearInterval(lanTimer)
  }, [refreshLan])



  const pushLog = useCallback((icon: string, text: string) => {
    const id = ++logIdRef.current
    setActivityLog((prev) => [{ id, time: Date.now(), icon, text }, ...prev].slice(0, 50))
  }, [])

  // ── Connect to /room namespace on mount ──────────────────────────

  useEffect(() => {
    mountedRef.current = true

    const roomSocket: RoomSocket = io(`${window.location.origin}/room`, {
      forceNew: true,
      autoConnect: true,
      auth: { clientType: 'admin', ...(getStoredAuthToken() ? { token: getStoredAuthToken() } : {}) },
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    socketRef.current = roomSocket

    roomSocket.on('connect', () => { if (mountedRef.current) { setSocketConnected(true); pushLog('🟢', 'Connected to server') } })
    roomSocket.on('disconnect', () => { if (mountedRef.current) { setSocketConnected(false); pushLog('🔴', 'Disconnected from server') } })

    roomSocket.on('pov-online:room:created', (payload: RoomCreatedPayload) => {
      if (!mountedRef.current) return
      const newRoom: RoomStatus = {
        roomCode: payload.roomCode,
        createdAt: payload.createdAt,
        status: 'active',
        maxPlayers: config.maxPlayersPerRoom,
        participantCount: 0,
        participants: [],
        activePlayerId: null,
        mode: 'automatic',
        hubConnected: true,
        config: { ...DEFAULT_PER_ROOM_CONFIG },
      }
      setRooms((prev) => [...prev, newRoom])
      pushLog('🏠', `Room ${payload.roomCode} created`)
    })

    roomSocket.on('pov-online:room:closed', (payload: RoomClosedPayload) => {
      if (!mountedRef.current) return
      setRooms((prev) => prev.filter((r) => r.roomCode !== payload.roomCode))
      pushLog('🚪', `Room ${payload.roomCode} closed`)
    })

    roomSocket.on('pov-online:participant:joined', (payload: RoomParticipantJoinedPayload) => {
      if (!mountedRef.current) return
      setRooms((prev) =>
        prev.map((room) => {
          if (room.roomCode !== payload.roomCode) return room
          const exists = room.participants.some((p) => p.id === payload.participant.id)
          if (exists) return room
          return {
            ...room,
            status: 'active',
            hubConnected: true,
            participantCount: room.participantCount + 1,
            participants: [...room.participants, payload.participant],
          }
        }),
      )
      setToast(`🎥 ${payload.participant.displayName} joined the room`)
      setTimeout(() => { if (mountedRef.current) setToast(null) }, 4000)
      pushLog('🎥', `${payload.participant.displayName} joined`)
    })

    roomSocket.on('pov-online:participant:left', (payload: RoomParticipantLeftPayload) => {
      if (!mountedRef.current) return
      setRooms((prev) =>
        prev.map((room) => {
          if (room.roomCode !== payload.roomCode) return room
          return {
            ...room,
            participantCount: Math.max(0, room.participantCount - 1),
            participants: room.participants.filter((p) => p.id !== payload.participantId),
          }
        }),
      )
      pushLog('👋', `${payload.participantId.slice(0, 8)}… left`)
    })

    roomSocket.on('pov-online:scores', (payload: RoomScoresPayload) => {
      if (!mountedRef.current) return
      setRooms((prev) =>
        prev.map((room) => {
          if (room.roomCode !== payload.roomCode) return room
          return {
            ...room,
            participants: room.participants.map((p) => {
              const entry = payload.scores.find((s) => s.participantId === p.id)
              return entry ? { ...p, activityScore: entry.score } : p
            }),
          }
        }),
      )
    })

    roomSocket.on('pov-online:switch', (payload: RoomSwitchPayload) => {
      if (!mountedRef.current) return
      setRooms((prev) =>
        prev.map((room) => {
          if (room.roomCode !== payload.roomCode) return room
          return { ...room, activePlayerId: payload.newId }
        }),
      )
      pushLog('🔄', `POV → ${payload.newId.slice(0, 8)}… (${payload.reason})`)
    })

    roomSocket.on('pov-online:status', (payload: RoomStatus) => {
      if (!mountedRef.current) return
      setRooms((prev) => {
        const idx = prev.findIndex((r) => r.roomCode === payload.roomCode)
        if (idx === -1) return [...prev, payload]
        const updated = [...prev]
        const old = updated[idx]
        if (old.hubConnected !== payload.hubConnected) {
          pushLog(payload.hubConnected ? '🟢' : '🔴', `Hub ${payload.hubConnected ? 'connected' : 'disconnected'} (${payload.roomCode})`)
        }
        updated[idx] = payload
        return updated
      })
    })

    roomSocket.on('pov-online:active-room', (payload: { roomCode: string | null }) => {
      if (!mountedRef.current) return
      setActiveRoomCode(payload.roomCode)
    })

    return () => {
      mountedRef.current = false
      roomSocket.disconnect()
      socketRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load initial data ────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await provideAuthToken()
        const [roomsData, configData, activeRoom] = await Promise.all([getRooms(), getRoomConfig(), getActiveRoomCode()])
        if (!cancelled) {
          setRooms(roomsData)
          setConfig(configData)
          setConfigDraft(configData)
          setActiveRoomCode(activeRoom)
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load rooms data')
        }
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  // ── Create room ──────────────────────────────────────────────────

  const handleCreateRoom = useCallback(() => {
    const sock = socketRef.current
    if (!sock?.connected || creating) return
    setCreating(true)
    setError(null)

    const timeout = setTimeout(() => { setCreating(false); setError('Room creation timed out') }, 15000)
    sock.emit('pov-online:room:create', (response) => {
      clearTimeout(timeout)
      setCreating(false)
      if (!response.ok) {
        setError(response.error || 'Failed to create room')
      }
    })
  }, [creating])

  const handleCloseRoom = useCallback((roomCode: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('pov-online:room:close', { roomCode })
  }, [])

  const handleRejoinRoom = useCallback((roomCode: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('pov-online:room:rejoin' as any, { roomCode }, (response: { ok: boolean; error?: string }) => {
      if (!response.ok) {
        setError(response.error || 'Failed to rejoin room')
      }
    })
  }, [])

  const handleModeSet = useCallback((roomCode: string, mode: SwitchMode) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('pov-online:mode:set', { roomCode, mode })
    setRooms((prev) =>
      prev.map((r) => (r.roomCode === roomCode ? { ...r, mode } : r)),
    )
  }, [])

  const handleSelect = useCallback((roomCode: string, participantId: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('pov-online:select', { roomCode, participantId }, (response) => {
      if (!response.ok) {
        setError(response.error || 'Failed to select participant')
      }
    })
  }, [])

  const handleKick = useCallback((roomCode: string, participantId: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('pov-online:kick' as any, { roomCode, participantId }, (response: { ok: boolean; error?: string }) => {
      if (!response.ok) {
        setError(response.error || 'Failed to kick participant')
      }
    })
  }, [])

  const handleSaveConfig = useCallback(async () => {
    setSavingConfig(true)
    setError(null)
    setConfigSaved(false)
    try {
      const result = await updateRoomConfig(configDraft)
      setConfig(result.config)
      setConfigDraft(result.config)
      setConfigSaved(true)
      setTimeout(() => setConfigSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setSavingConfig(false)
    }
  }, [configDraft])

  const handleResetConfig = useCallback(() => {
    setConfigDraft(config)
    setError(null)
  }, [config])

  const handleSetActiveRoom = useCallback(async (roomCode: string | null) => {
    setError(null)
    const prevRoomCode = activeRoomCode
    setActiveRoomCode(roomCode)
    try {
      const result = await setActiveRoomCodeApi(roomCode)
      if (result.ok) {
        setToast(`✓ POV relay switched to ${roomCode ? `room ${roomCode}` : 'LAN'}`)
        setTimeout(() => setToast(null), 3000)
      } else {
        setError(result.error || 'Failed to set active room')
        setActiveRoomCode(prevRoomCode)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set active room')
      setActiveRoomCode(prevRoomCode)
    }
  }, [activeRoomCode])

  const updateConfigDraft = useCallback(<K extends keyof RoomConfig>(
    key: K,
    value: RoomConfig[K],
  ) => {
    setConfigDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSaveRoomConfig = useCallback(async (roomCode: string, partial: Partial<PerRoomConfig>) => {
    try {
      const result = await updateCloudRoomConfig(roomCode, partial)
      if (result.ok) {
        setRooms((prev) =>
          prev.map((r) => (r.roomCode === roomCode ? { ...r, config: result.config } : r))
        )
        setToast(`✓ ${roomCode} config updated`)
        setTimeout(() => setToast(null), 3000)
      } else {
        setError(`Failed to update ${roomCode} config`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to update ${roomCode} config`)
    }
  }, [])

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-none space-y-0 pt-1">
      <ConfigPageIntro title="Online Rooms" eyebrow="Browser POV">
        Manage remote player rooms. Players connect via browser, share camera and microphone, and the system automatically switches to the active speaker.
      </ConfigPageIntro>

      {configSaved && (
        <Notice tone="success" className="mb-3">
          ✔ Configuration saved successfully.
        </Notice>
      )}
      {error && (
        <Notice tone="danger" className="mb-3">
          ✖ {error}
        </Notice>
      )}
      {toast && (
        <Notice tone="info" className="mb-3">
          {toast}
        </Notice>
      )}

      <div className="space-y-6 pt-3">
        <ConfigPanel title="LAN Room" collapsible>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-primary-500)]/10 border border-[var(--color-primary-400)]/20">
              <button
                onClick={() => { if (activeRoomCode !== null) handleSetActiveRoom(null) }}
                disabled={activeRoomCode === null}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  activeRoomCode === null
                    ? 'bg-[var(--color-primary-500)] cursor-default'
                    : 'bg-[var(--color-bg-elevated)] cursor-pointer hover:bg-[var(--color-bg-elevated)]/80'
                }`}
                title={activeRoomCode === null ? 'LAN room is the active POV source' : 'Switch to LAN room POV'}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  activeRoomCode === null ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </button>
              <div>
                <div className="text-sm font-medium text-[var(--color-text-primary)]">LAN Room POV</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">
                  {activeRoomCode === null ? '✓ Active — displaying LAN participants' : 'Inactive — click to switch to LAN POV'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Room Code</div>
                <span className="font-mono text-2xl tracking-[0.25em] font-bold text-[var(--color-primary-400)] select-all">
                  {lanCode ?? '······'}
                </span>
              </div>
              <Button
                variant="secondary" size="sm"
                loading={regeneratingCode}
                onClick={async () => {
                  setRegeneratingCode(true)
                  try {
                    const r = await apiFetch<{ code: string }>('/api/room/code/regenerate', { method: 'POST' })
                    setLanCode(r.code)
                  } finally { setRegeneratingCode(false) }
                }}
              >
                Regenerate
              </Button>
            </div>
            <div className="flex items-center gap-1.5 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-base)]/55 px-2 py-1">
              <span className="text-[10px] text-[var(--color-text-muted)]">🏠 LAN Join:</span>
              <span className="text-[10px] font-mono text-[var(--color-text-secondary)] truncate">{buildLanJoinUrl()}</span>
              <CopyButton text={buildLanJoinUrl()} label="Copy" />
            </div>
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                Connected ({lanParticipants.length})
              </div>
              {lanParticipants.length === 0 ? (
                <Notice tone="info">No LAN participants connected.</Notice>
              ) : (
                <div className="space-y-1">
                  {lanParticipants.map(p => (
                    <div key={p.id} className="flex items-center justify-between rounded-md px-2 py-1.5 bg-[var(--color-bg-elevated)]/40">
                      <div>
                        <span className="text-xs font-mono text-[var(--color-text-primary)]">{p.id}</span>
                        <span className={`ml-2 text-[10px] ${p.iceState === 'connected' || p.iceState === 'completed' ? 'text-[var(--color-success-400)]' : 'text-[var(--color-text-muted)]'}`}>{p.iceState}</span>
                      </div>
                      <span className={`text-[10px] ${p.videoMuted ? 'text-[var(--color-danger-400)]' : 'text-[var(--color-success-400)]'}`}>
                        {p.videoMuted ? '📵 muted' : '📹 live'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Auto Mode Config section for LAN */}
            <div className="border-t border-[var(--color-border-default)] pt-3">
              <button
                onClick={() => setLanConfigExpanded(!lanConfigExpanded)}
                className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)] mb-2"
              >
                <span className="text-[10px]">{lanConfigExpanded ? '▾' : '▸'}</span>
                <span>Auto Mode Config</span>
              </button>
              {lanConfigExpanded && (
                <div className="space-y-3 ml-4">
                  <Slider
                    label="Activity Threshold"
                    value={configDraft.activityThreshold}
                    min={ROOM_CONFIG_BOUNDS.activityThreshold.min}
                    max={ROOM_CONFIG_BOUNDS.activityThreshold.max}
                    step={0.01}
                    onChange={(v) => updateConfigDraft('activityThreshold', v)}
                  />
                  <Slider
                    label="Silence Threshold"
                    value={configDraft.silenceThreshold}
                    min={ROOM_CONFIG_BOUNDS.silenceThreshold.min}
                    max={ROOM_CONFIG_BOUNDS.silenceThreshold.max}
                    step={0.01}
                    onChange={(v) => updateConfigDraft('silenceThreshold', v)}
                  />
                  <Slider
                    label="Motion Weight"
                    value={configDraft.motionWeight}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => updateConfigDraft('motionWeight', v)}
                  />
                  <Slider
                    label="Response Window"
                    value={configDraft.rollingWindowMs}
                    min={ROOM_CONFIG_BOUNDS.rollingWindowMs.min}
                    max={ROOM_CONFIG_BOUNDS.rollingWindowMs.max}
                    step={100}
                    unit="ms"
                    onChange={(v) => updateConfigDraft('rollingWindowMs', Math.round(v))}
                  />
                  <Slider
                    label="Switch Cooldown"
                    value={configDraft.cooldownMs / 1000}
                    min={ROOM_CONFIG_BOUNDS.cooldownMs.min / 1000}
                    max={ROOM_CONFIG_BOUNDS.cooldownMs.max / 1000}
                    step={0.5}
                    unit="s"
                    onChange={(v) => updateConfigDraft('cooldownMs', Math.round(v * 1000))}
                  />
                </div>
              )}
            </div>

            {/* Transitions section for LAN */}
            <div className="border-t border-[var(--color-border-default)] pt-3">
              <button
                onClick={() => setLanTransitionsExpanded(!lanTransitionsExpanded)}
                className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)] mb-2"
              >
                <span className="text-[10px]">{lanTransitionsExpanded ? '▾' : '▸'}</span>
                <span>Transitions</span>
              </button>
              {lanTransitionsExpanded && (
                <div className="space-y-3 ml-4">
                  <div>
                    <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Default Camera</div>
                    <div className="flex gap-2">
                      {[
                        { val: 'auto', label: 'Auto-select First' },
                        { val: 'blank', label: 'Start Blank' }
                      ].map(({ val, label }) => {
                        const isSelected = configDraft.defaultFirstCamera === val
                        return (
                          <button
                            key={val}
                            onClick={() => updateConfigDraft('defaultFirstCamera', val as any)}
                            className={`flex-1 px-3 py-1.5 rounded-md font-medium transition-all text-xs ${
                              isSelected
                                ? 'bg-[var(--color-primary-500)] text-white shadow-md shadow-[var(--color-primary-500)]/50'
                                : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-500)]/20'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Transition Animation</div>
                    <div className="flex gap-2 mb-2">
                      {[
                        { val: 'cut', label: 'Cut (instant)' },
                        { val: 'fade', label: 'Fade' }
                      ].map(({ val, label }) => {
                        const isSelected = configDraft.transition.type === val
                        return (
                          <button
                            key={val}
                            onClick={() => updateConfigDraft('transition', val === 'cut' ? { type: 'cut', durationMs: 0 } : { type: 'fade', durationMs: 500 })}
                            className={`flex-1 px-3 py-1.5 rounded-md font-medium transition-all text-xs ${
                              isSelected
                                ? 'bg-[var(--color-primary-500)] text-white shadow-md shadow-[var(--color-primary-500)]/50'
                                : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-500)]/20'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>

                    {configDraft.transition.type === 'fade' && (
                      <Slider
                        label="Fade Duration"
                        value={configDraft.transition.durationMs}
                        min={100}
                        max={5000}
                        step={50}
                        unit="ms"
                        onChange={(v) =>
                          updateConfigDraft('transition', { ...configDraft.transition, durationMs: Math.round(v) })
                        }
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Config save buttons for LAN */}
            <div className="flex gap-2 justify-end border-t border-[var(--color-border-default)] pt-3">
              <Button variant="secondary" size="sm" onClick={handleResetConfig} disabled={savingConfig} className="text-[10px]">
                Reset
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveConfig} disabled={savingConfig} className="text-[10px]">
                {savingConfig ? 'Saving…' : 'Apply'}
              </Button>
            </div>
          </div>
        </ConfigPanel>

        <FeatureGate feature="stream-rooms">
          <ConfigPanel title="Cloud Rooms" collapsible>
            {!isAuthenticated ? (
              <Notice tone="warning" className="mb-3">
                <div className="flex items-center justify-between">
                  <span>Sign in to access your cloud rooms and create new ones.</span>
                  <Button variant="primary" size="sm" onClick={login} className="ml-3">
                    Sign In
                  </Button>
                </div>
              </Notice>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {rooms.length} room{rooms.length !== 1 ? 's' : ''} active
                  </span>
                  <Button variant="primary" size="sm" onClick={handleCreateRoom} disabled={creating || !socketConnected}>
                    {creating ? 'Creating…' : '+ Create Room'}
                  </Button>
                </div>

                {rooms.length === 0 ? (
                  <Notice tone="info">
                    No online rooms active. Create a room to get started.
                  </Notice>
                ) : (
                  <div className="space-y-2">
                    {rooms.map((room) => (
                      <RoomCard
                        key={room.roomCode}
                        room={room}
                        onClose={handleCloseRoom}
                        onRejoin={handleRejoinRoom}
                        onModeSet={handleModeSet}
                        onSelect={handleSelect}
                        onKick={handleKick}
                        isActive={activeRoomCode === room.roomCode}
                        onSetActive={handleSetActiveRoom}
                        socket={socketRef.current}
                        onConfigSave={handleSaveRoomConfig}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </ConfigPanel>

          <ConfigPanel title="Admin Stream Preview" collapsible>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-accent-500)]/10 border border-[var(--color-accent-400)]/20">
                <button
                  onClick={() => setShowPreview(v => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${showPreview ? 'bg-[var(--color-accent-500)]' : 'bg-[var(--color-bg-elevated)]'}`}
                  role="switch" aria-checked={showPreview}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${showPreview ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">View Participant Streams</div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">Shows all participant streams. Disables overlay widget stream relay while active.</div>
                </div>
              </div>
              {showPreview && <AdminStreamGrid socket={socketRef.current as any} />}
            </div>
          </ConfigPanel>

          <ConfigPanel title="Activity Log" collapsible>
            {activityLog.length === 0 ? (
              <Notice tone="info">No activity yet. Events will appear here in real time.</Notice>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {activityLog.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 rounded px-2 py-1 text-[11px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]/50">
                    <span className="shrink-0">{entry.icon}</span>
                    <span className="flex-1 min-w-0 truncate">{entry.text}</span>
                    <span className="shrink-0 text-[9px] text-[var(--color-text-muted)] font-mono">
                      {new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ConfigPanel>
        </FeatureGate>

        {/* ── ROOM LIMITS ── */}
        <ConfigPanel title="Room Limits" collapsible>
          <div className="space-y-4">
            <Slider
              label="Max Players Per Room"
              value={configDraft.maxPlayersPerRoom}
              min={ROOM_CONFIG_BOUNDS.maxPlayersPerRoom.min}
              max={ROOM_CONFIG_BOUNDS.maxPlayersPerRoom.max}
              step={1}
              onChange={(v) => updateConfigDraft('maxPlayersPerRoom', Math.round(v))}
            />

            <Slider
              label="Max Simultaneous Rooms"
              value={configDraft.maxActiveRooms}
              min={ROOM_CONFIG_BOUNDS.maxActiveRooms.min}
              max={ROOM_CONFIG_BOUNDS.maxActiveRooms.max}
              step={1}
              onChange={(v) => updateConfigDraft('maxActiveRooms', Math.round(v))}
            />

            <div className="flex gap-2 justify-end border-t border-[var(--color-border-default)] pt-3">
              <Button variant="secondary" size="sm" onClick={handleResetConfig} disabled={savingConfig} className="text-[10px]">
                Reset
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveConfig} disabled={savingConfig} className="text-[10px]">
                {savingConfig ? 'Saving…' : 'Apply'}
              </Button>
            </div>
          </div>
        </ConfigPanel>
      </div>
    </div>
  )
}

/** @deprecated Use RoomsPanel */
export { RoomsPanel as OnlineRoomsPanel }
