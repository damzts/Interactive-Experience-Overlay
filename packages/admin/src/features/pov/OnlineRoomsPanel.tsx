import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { OnlineRoomStatus, ParticipantInfo, OnlineModeConfig, SwitchMode } from '@ieom/shared'
import { ONLINE_CONFIG_BOUNDS, DEFAULT_ONLINE_MODE_CONFIG } from '@ieom/shared'
import type {
  OnlineRoomCreatedPayload,
  OnlineRoomClosedPayload,
  OnlineParticipantJoinedPayload,
  OnlineParticipantLeftPayload,
  OnlineScoresPayload,
  OnlineSwitchPayload,
  OnlineServerToAdminEvents,
  OnlineClientToServerEvents,
} from '@ieom/shared'
import { getOnlineConfig, updateOnlineConfig, getOnlineRooms, provideAuthToken } from '../../api/onlineApi'
import {
  Btn,
  ConfigCard,
  ConfigNotice,
  ConfigPageIntro,
  ConfigSectionPanel,
  ConfigChoiceButton,
  Slider,
  Field,
} from '../../shared/ui'

// ── Types ──────────────────────────────────────────────────────────

type OnlineSocket = Socket<OnlineServerToAdminEvents, OnlineClientToServerEvents>

// ── Helpers ────────────────────────────────────────────────────────

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function buildJoinUrl(roomCode: string): string {
  return `${window.location.origin}/online/room/${roomCode}`
}

function buildOverlayUrl(roomCode: string): string {
  return `${window.location.origin}/online/overlay/${roomCode}`
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
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
    <Btn
      variant={copied ? 'active' : 'ghost'}
      onClick={handleCopy}
      className="text-[10px] px-2 py-0.5"
    >
      {copied ? '✓ Copied' : label}
    </Btn>
  )
}

// ── ParticipantRow ─────────────────────────────────────────────────

function ParticipantRow({
  participant,
  isActive,
  onSelect,
  selecting,
}: {
  participant: ParticipantInfo
  isActive: boolean
  onSelect: (id: string) => void
  selecting: boolean
}) {
  const scorePercent = Math.round(participant.activityScore * 100)

  return (
    <div
      className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${
        isActive ? 'bg-cyan-500/8 ring-1 ring-cyan-400/30' : ''
      }`}
    >
      {/* Connection status dot */}
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          participant.connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-red-400'
        }`}
        title={participant.connectionStatus}
      />

      {/* Display name */}
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-100">
        {participant.displayName}
      </span>

      {/* Active indicator */}
      {isActive && (
        <span className="shrink-0 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-cyan-200">
          Active
        </span>
      )}

      {/* Activity score bar */}
      <div className="w-16 shrink-0">
        <div className="h-1.5 w-full rounded-full bg-zinc-800/80 overflow-hidden">
          <div
            className="h-full rounded-full bg-cyan-400/70 transition-all duration-300"
            style={{ width: `${scorePercent}%` }}
          />
        </div>
      </div>

      {/* Score value */}
      <span className="w-8 shrink-0 text-right text-[10px] font-mono text-zinc-500">
        {participant.activityScore.toFixed(2)}
      </span>

      {/* Manual select button */}
      <Btn
        variant={isActive ? 'active' : 'default'}
        onClick={() => onSelect(participant.id)}
        disabled={isActive || selecting || participant.connectionStatus !== 'connected'}
        className="text-[10px] px-2 py-0.5"
      >
        {isActive ? '● Live' : 'Select'}
      </Btn>
    </div>
  )
}

// ── RoomCard ───────────────────────────────────────────────────────

function RoomCard({
  room,
  onClose,
  onModeSet,
  onSelect,
  socket: onlineSocket,
}: {
  room: OnlineRoomStatus
  onClose: (roomCode: string) => void
  onModeSet: (roomCode: string, mode: SwitchMode) => void
  onSelect: (roomCode: string, participantId: string) => void
  socket: OnlineSocket | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [selecting, setSelecting] = useState(false)

  const joinUrl = buildJoinUrl(room.roomCode)
  const overlayUrl = buildOverlayUrl(room.roomCode)

  const handleSelect = useCallback(
    (participantId: string) => {
      setSelecting(true)
      onSelect(room.roomCode, participantId)
      // Reset selecting after a short delay (ack will update state)
      setTimeout(() => setSelecting(false), 1000)
    },
    [room.roomCode, onSelect],
  )

  const handleClose = useCallback(() => {
    if (!confirmClose) {
      setConfirmClose(true)
      return
    }
    onClose(room.roomCode)
    setConfirmClose(false)
  }, [confirmClose, room.roomCode, onClose])

  return (
    <ConfigCard className={room.status === 'idle' ? 'opacity-70' : ''}>
      {/* Room header */}
      <div className="flex items-center gap-3">
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors text-sm"
          aria-label={expanded ? 'Collapse room' : 'Expand room'}
        >
          {expanded ? '▾' : '▸'}
        </button>

        {/* Room code */}
        <span className="shrink-0 rounded-md border border-zinc-700/80 bg-zinc-950/70 px-2 py-0.5 font-mono text-sm font-bold text-zinc-100 tracking-wider">
          {room.roomCode}
        </span>

        {/* Status badge */}
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
            room.status === 'active'
              ? 'border border-emerald-500/30 bg-emerald-500/12 text-emerald-200'
              : 'border border-amber-500/30 bg-amber-500/12 text-amber-200'
          }`}
        >
          {room.status}
        </span>

        {/* Participant count */}
        <span className="shrink-0 text-xs text-zinc-400">
          {room.participantCount}/{room.maxPlayers} players
        </span>

        {/* Created time */}
        <span className="shrink-0 text-[10px] text-zinc-600">
          Created {formatTimestamp(room.createdAt)}
        </span>

        <div className="flex-1" />

        {/* Mode toggle */}
        <Btn
          variant={room.mode === 'automatic' ? 'primary' : 'warning'}
          onClick={() => onModeSet(room.roomCode, room.mode === 'automatic' ? 'manual' : 'automatic')}
          className="text-[10px] px-2 py-0.5"
        >
          {room.mode === 'automatic' ? '⚡ Auto' : '✋ Manual'}
        </Btn>

        {/* Close button */}
        {confirmClose ? (
          <div className="flex items-center gap-1">
            <Btn variant="danger" onClick={handleClose} className="text-[10px] px-2 py-0.5">
              Confirm
            </Btn>
            <Btn variant="ghost" onClick={() => setConfirmClose(false)} className="text-[10px] px-2 py-0.5">
              Cancel
            </Btn>
          </div>
        ) : (
          <Btn variant="danger" onClick={handleClose} className="text-[10px] px-2 py-0.5">
            Close Room
          </Btn>
        )}
      </div>

      {/* URLs row */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md border border-zinc-800/80 bg-zinc-950/55 px-2 py-1">
          <span className="text-[10px] text-zinc-500">Join:</span>
          <span className="text-[10px] font-mono text-zinc-300 max-w-[200px] truncate">{joinUrl}</span>
          <CopyButton text={joinUrl} label="Copy" />
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-zinc-800/80 bg-zinc-950/55 px-2 py-1">
          <span className="text-[10px] text-zinc-500">OBS Source:</span>
          <span className="text-[10px] font-mono text-zinc-300 max-w-[200px] truncate">{overlayUrl}</span>
          <CopyButton text={overlayUrl} label="Copy" />
        </div>
      </div>

      {/* Expanded section: participants */}
      {expanded && (
        <div className="mt-3 border-t border-zinc-800/60 pt-3">
          {room.participants.length === 0 ? (
            <ConfigNotice tone="info">
              No participants connected yet. Share the join URL to invite players.
            </ConfigNotice>
          ) : (
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2 mb-1">
                Participants
              </div>
              {room.participants.map((p) => (
                <ParticipantRow
                  key={p.id}
                  participant={p}
                  isActive={p.id === room.activePlayerId}
                  onSelect={handleSelect}
                  selecting={selecting}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </ConfigCard>
  )
}

// ── OnlineRoomsPanel ───────────────────────────────────────────────

export function OnlineRoomsPanel() {
  const [rooms, setRooms] = useState<OnlineRoomStatus[]>([])
  const [config, setConfig] = useState<OnlineModeConfig>(DEFAULT_ONLINE_MODE_CONFIG)
  const [configDraft, setConfigDraft] = useState<OnlineModeConfig>(DEFAULT_ONLINE_MODE_CONFIG)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const socketRef = useRef<OnlineSocket | null>(null)
  const mountedRef = useRef(true)

  // ── Connect to /online namespace on mount ────────────────────────

  useEffect(() => {
    mountedRef.current = true

    const onlineSocket: OnlineSocket = io(`${window.location.origin}/online`, {
      forceNew: true,
      autoConnect: true,
      auth: { clientType: 'admin' },
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    socketRef.current = onlineSocket

    // ── Connection state ─────────────────────────────────────────
    onlineSocket.on('connect', () => { if (mountedRef.current) setSocketConnected(true) })
    onlineSocket.on('disconnect', () => { if (mountedRef.current) setSocketConnected(false) })

    // ── Event listeners ──────────────────────────────────────────

    onlineSocket.on('pov-online:room:created', (payload: OnlineRoomCreatedPayload) => {
      if (!mountedRef.current) return
      const newRoom: OnlineRoomStatus = {
        roomCode: payload.roomCode,
        createdAt: payload.createdAt,
        status: 'active',
        maxPlayers: config.maxPlayersPerRoom,
        participantCount: 0,
        participants: [],
        activePlayerId: null,
        mode: 'automatic',
      }
      setRooms((prev) => [...prev, newRoom])
    })

    onlineSocket.on('pov-online:room:closed', (payload: OnlineRoomClosedPayload) => {
      if (!mountedRef.current) return
      setRooms((prev) => prev.filter((r) => r.roomCode !== payload.roomCode))
    })

    onlineSocket.on('pov-online:participant:joined', (payload: OnlineParticipantJoinedPayload) => {
      if (!mountedRef.current) return
      setRooms((prev) =>
        prev.map((room) => {
          if (room.roomCode !== payload.roomCode) return room
          const exists = room.participants.some((p) => p.id === payload.participant.id)
          if (exists) return room
          return {
            ...room,
            participantCount: room.participantCount + 1,
            participants: [...room.participants, payload.participant],
          }
        }),
      )
    })

    onlineSocket.on('pov-online:participant:left', (payload: OnlineParticipantLeftPayload) => {
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
    })

    onlineSocket.on('pov-online:scores', (payload: OnlineScoresPayload) => {
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

    onlineSocket.on('pov-online:switch', (payload: OnlineSwitchPayload) => {
      if (!mountedRef.current) return
      setRooms((prev) =>
        prev.map((room) => {
          if (room.roomCode !== payload.roomCode) return room
          return { ...room, activePlayerId: payload.newId }
        }),
      )
    })

    onlineSocket.on('pov-online:status', (payload: OnlineRoomStatus) => {
      if (!mountedRef.current) return
      setRooms((prev) => {
        const idx = prev.findIndex((r) => r.roomCode === payload.roomCode)
        if (idx === -1) return [...prev, payload]
        const updated = [...prev]
        updated[idx] = payload
        return updated
      })
    })

    return () => {
      mountedRef.current = false
      onlineSocket.disconnect()
      socketRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load initial data ────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await provideAuthToken()
        const [roomsData, configData] = await Promise.all([getOnlineRooms(), getOnlineConfig()])
        if (!cancelled) {
          setRooms(roomsData)
          setConfig(configData)
          setConfigDraft(configData)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setLoading(false)
          setError('Failed to load online rooms data')
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
      // Room will be added via the pov-online:room:created event
    })
  }, [creating])

  // ── Close room ───────────────────────────────────────────────────

  const handleCloseRoom = useCallback((roomCode: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('pov-online:room:close', { roomCode })
    // Room will be removed via the pov-online:room:closed event
  }, [])

  // ── Set mode ─────────────────────────────────────────────────────

  const handleModeSet = useCallback((roomCode: string, mode: SwitchMode) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('pov-online:mode:set', { roomCode, mode })
    // Optimistic update
    setRooms((prev) =>
      prev.map((r) => (r.roomCode === roomCode ? { ...r, mode } : r)),
    )
  }, [])

  // ── Manual select ────────────────────────────────────────────────

  const handleSelect = useCallback((roomCode: string, participantId: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('pov-online:select', { roomCode, participantId }, (response) => {
      if (!response.ok) {
        setError(response.error || 'Failed to select participant')
      }
    })
  }, [])

  // ── Config save ──────────────────────────────────────────────────

  const handleSaveConfig = useCallback(async () => {
    setSavingConfig(true)
    setError(null)
    setConfigSaved(false)
    try {
      const result = await updateOnlineConfig(configDraft)
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

  const updateConfigDraft = useCallback(<K extends keyof OnlineModeConfig>(
    key: K,
    value: OnlineModeConfig[K],
  ) => {
    setConfigDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  // ── Render ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="w-full max-w-none space-y-0 pt-1">
        <ConfigPageIntro title="Online Rooms" eyebrow="Browser POV">
          Loading online rooms…
        </ConfigPageIntro>
      </div>
    )
  }

  return (
    <div className="w-full max-w-none space-y-0 pt-1">
      <ConfigPageIntro title="Online Rooms" eyebrow="Browser POV">
        Manage remote player rooms. Players connect via browser, share camera and microphone, and the system automatically switches to the active speaker.
      </ConfigPageIntro>

      {/* Status indicators */}
      {configSaved && (
        <ConfigNotice tone="success" className="mb-3">
          ✔ Configuration saved successfully.
        </ConfigNotice>
      )}
      {error && (
        <ConfigNotice tone="danger" className="mb-3">
          ✖ {error}
        </ConfigNotice>
      )}

      {/* Active Rooms */}
      <ConfigSectionPanel label="Active Rooms" first>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-zinc-400">
            {rooms.length} room{rooms.length !== 1 ? 's' : ''} active
          </span>
          <Btn variant="primary" onClick={handleCreateRoom} disabled={creating || !socketConnected}>
            {creating ? 'Creating…' : '+ Create Room'}
          </Btn>
        </div>

        {rooms.length === 0 ? (
          <ConfigNotice tone="info">
            No online rooms active. Create a room to get started.
          </ConfigNotice>
        ) : (
          <div className="space-y-2">
            {rooms.map((room) => (
              <RoomCard
                key={room.roomCode}
                room={room}
                onClose={handleCloseRoom}
                onModeSet={handleModeSet}
                onSelect={handleSelect}
                socket={socketRef.current}
              />
            ))}
          </div>
        )}
      </ConfigSectionPanel>

      {/* Configuration */}
      <ConfigSectionPanel label="Online Mode Configuration">
        <ConfigNotice>
          Configure switching behavior for online rooms. These settings apply to all active and future rooms.
        </ConfigNotice>
        <div className="mt-4 space-y-2">
          <Slider
            label="Switch Cooldown"
            value={configDraft.cooldownMs / 1000}
            min={ONLINE_CONFIG_BOUNDS.cooldownMs.min / 1000}
            max={ONLINE_CONFIG_BOUNDS.cooldownMs.max / 1000}
            step={0.5}
            unit="s"
            onChange={(v) => updateConfigDraft('cooldownMs', Math.round(v * 1000))}
          />
          <Slider
            label="Activity Threshold"
            value={configDraft.activityThreshold}
            min={ONLINE_CONFIG_BOUNDS.activityThreshold.min}
            max={ONLINE_CONFIG_BOUNDS.activityThreshold.max}
            step={0.01}
            onChange={(v) => updateConfigDraft('activityThreshold', v)}
          />
          <Slider
            label="Silence Threshold"
            value={configDraft.silenceThreshold}
            min={ONLINE_CONFIG_BOUNDS.silenceThreshold.min}
            max={ONLINE_CONFIG_BOUNDS.silenceThreshold.max}
            step={0.01}
            onChange={(v) => updateConfigDraft('silenceThreshold', v)}
          />
          <Slider
            label="Rolling Window"
            value={configDraft.rollingWindowMs}
            min={ONLINE_CONFIG_BOUNDS.rollingWindowMs.min}
            max={ONLINE_CONFIG_BOUNDS.rollingWindowMs.max}
            step={100}
            unit="ms"
            onChange={(v) => updateConfigDraft('rollingWindowMs', Math.round(v))}
          />
          <Slider
            label="Audio Report Interval"
            value={configDraft.audioReportIntervalMs}
            min={ONLINE_CONFIG_BOUNDS.audioReportIntervalMs.min}
            max={ONLINE_CONFIG_BOUNDS.audioReportIntervalMs.max}
            step={10}
            unit="ms"
            onChange={(v) => updateConfigDraft('audioReportIntervalMs', Math.round(v))}
          />
        </div>

        {/* Transition Settings */}
        <div className="mt-4">
          <Field label="Transition Type">
            <div className="flex gap-2">
              <ConfigChoiceButton
                selected={configDraft.transition.type === 'cut'}
                onClick={() => updateConfigDraft('transition', { type: 'cut', durationMs: 0 })}
              >
                Cut
              </ConfigChoiceButton>
              <ConfigChoiceButton
                selected={configDraft.transition.type === 'fade'}
                onClick={() =>
                  updateConfigDraft('transition', {
                    type: 'fade',
                    durationMs: configDraft.transition.durationMs || 500,
                  })
                }
              >
                Fade
              </ConfigChoiceButton>
            </div>
          </Field>
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

        {/* Save / Reset */}
        <div className="mt-5 flex items-center gap-3">
          <Btn variant="primary" onClick={handleSaveConfig} disabled={savingConfig}>
            {savingConfig ? 'Saving…' : 'Apply Configuration'}
          </Btn>
          <Btn variant="default" onClick={handleResetConfig} disabled={savingConfig}>
            Reset
          </Btn>
        </div>
      </ConfigSectionPanel>
    </div>
  )
}
