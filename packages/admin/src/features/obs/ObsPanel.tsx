import { useEffect, useRef, useState } from 'react'
import { useAdminStore } from '../../store/useAdminStore'
import { Btn, ConfigCard, ConfigPageIntro, ConfigSectionPanel, Field } from '../../shared/ui'

function formatCountdown(nextRetryAt: number | null): string {
  if (!nextRetryAt) return ''
  const s = Math.max(0, Math.ceil((nextRetryAt - Date.now()) / 1000))
  if (s === 0) return 'retrying…'
  if (s < 60) return `retry in ${s}s`
  return `retry in ${Math.ceil(s / 60)}m`
}

export function ObsPanel() {
  const obsStatus  = useAdminStore((s) => s.obsStatus)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const savedObs   = useAdminStore((s) => s.config.obs)

  const [url,      setUrl]      = useState(savedObs.url)
  const [password, setPassword] = useState(savedObs.password)
  const [dirty,    setDirty]    = useState(false)
  const [, setTick] = useState(0)

  // keep local fields in sync when config reloads from server
  const savedRef = useRef(savedObs)
  useEffect(() => {
    if (savedObs.url === savedRef.current.url && savedObs.password === savedRef.current.password) return
    savedRef.current = savedObs
    setUrl(savedObs.url)
    setPassword(savedObs.password)
    setDirty(false)
  }, [savedObs])

  // tick every second for retry countdown
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const handleSave = () => {
    void saveConfig({ obs: { url, password } })
    setDirty(false)
  }

  const handleReconnect = () => {
    // Saving the same values triggers configService.onConfigUpdate → obsBridge.updateConnection
    void saveConfig({ obs: { url: obsStatus.url, password: savedObs.password } })
  }

  const statusColor = obsStatus.connected
    ? 'text-emerald-400'
    : obsStatus.reconnecting
    ? 'text-amber-400'
    : 'text-red-400'

  const statusLabel = obsStatus.connected
    ? 'Connected'
    : obsStatus.reconnecting
    ? 'Reconnecting'
    : 'Disconnected'

  return (
    <div className="space-y-5">
      <ConfigPageIntro
        icon="🎬"
        title="OBS"
        description="WebSocket connection to OBS Studio. The server uses this bridge for hotkey passthrough and scene sync."
      />

      <ConfigSectionPanel label="Connection status">
        <ConfigCard>
          <div className="flex items-center gap-3">
            <div
              className={'h-2.5 w-2.5 rounded-full shrink-0 ' + (
                obsStatus.connected ? 'bg-emerald-400' : obsStatus.reconnecting ? 'bg-amber-400 animate-pulse' : 'bg-red-500'
              )}
            />
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</div>
              <div className="text-[10px] text-zinc-500 font-mono truncate">{obsStatus.url}</div>
            </div>
            {!obsStatus.connected && (
              <Btn type="button" variant="default" onClick={handleReconnect} className="px-3 py-1.5 text-xs shrink-0">
                Reconnect
              </Btn>
            )}
          </div>

          {!obsStatus.connected && obsStatus.nextRetryAt && (
            <div className="mt-2 text-[10px] text-zinc-500 tabular-nums">
              Attempt {obsStatus.reconnectAttempt} · {formatCountdown(obsStatus.nextRetryAt)}
            </div>
          )}

          {obsStatus.lastError && (
            <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/8 px-2.5 py-1.5 text-[10px] text-red-300 font-mono break-all">
              {obsStatus.lastError}
            </div>
          )}
        </ConfigCard>
      </ConfigSectionPanel>

      <ConfigSectionPanel label="WebSocket settings">
        <ConfigCard>
          <div className="space-y-3">
            <Field label="URL">
              <input
                type="text"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setDirty(true) }}
                placeholder="ws://localhost:4455"
                className="w-full rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setDirty(true) }}
                placeholder="Leave empty if no auth"
                className="w-full rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none"
              />
            </Field>
          </div>
          {dirty && (
            <div className="mt-3 flex justify-end">
              <Btn type="button" variant="default" onClick={handleSave} className="px-4 py-1.5 text-xs">
                Save &amp; reconnect
              </Btn>
            </div>
          )}
        </ConfigCard>
      </ConfigSectionPanel>
    </div>
  )
}
