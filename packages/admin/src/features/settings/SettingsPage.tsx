import { useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useAdminStore } from '../../store/useAdminStore'
import { socket } from '../../socket/client'
import { Btn, Toggle, ConfigSectionPanel } from '../../shared/ui'
import { testObsConnection } from '../../api/obsApi.js'
import { getAdminOrigin, getOverlayDevOrigin, getOverlayRuntimeOrigin } from '../../shared/runtimeUrls'

function formatObsRetry(nextRetryAt: number | null) {
  if (!nextRetryAt) return null
  const seconds = Math.max(1, Math.ceil((nextRetryAt - Date.now()) / 1000))
  return `Retry in ${seconds}s`
}

export function SettingsPage({
  consolePanel,
  mode = 'general',
}: {
  consolePanel?: ReactNode
  mode?: 'general' | 'about'
}) {
  const config = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const overlayRuntimeUrl = getOverlayRuntimeOrigin()
  const overlayDevUrl = getOverlayDevOrigin()
  const adminUrl = getAdminOrigin()
  const previewTarget = useAdminStore((s) => s.previewTarget)
  const setPreviewTarget = useAdminStore((s) => s.setPreviewTarget)
  const cameraOwnerSocketId = useAdminStore((s) => s.cameraOwnerSocketId)
  const overlayClients = useAdminStore((s) => s.runtimeDiagnostics.ambiance.overlayClients)

  const [url, setUrl] = useState(config.obs.url)
  const [password, setPassword] = useState(config.obs.password)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [cameraOwnerSaving, setCameraOwnerSaving] = useState(false)
  const [cameraOwnerError, setCameraOwnerError] = useState<string | null>(null)
  const obsConnected = useAdminStore((s) => s.obsConnected)
  const obsStatus = useAdminStore((s) => s.obsStatus)
  const previewUrl = previewTarget === 'runtime' ? overlayRuntimeUrl : overlayDevUrl
  const overlayClientOptions = useMemo(() => {
    const permissionRank = { granted: 0, prompt: 1, denied: 2, unknown: 3, unsupported: 4 } as const
    return [...overlayClients].sort((left, right) => {
      const permissionDelta = permissionRank[left.cameraPermission] - permissionRank[right.cameraPermission]
      if (permissionDelta !== 0) return permissionDelta
      return left.label.localeCompare(right.label)
    })
  }, [overlayClients])
  const cameraOwnerLabel = useMemo(() => {
    if (!cameraOwnerSocketId) return 'Automatic / no lock'
    const match = overlayClients.find((client) => client.socketId === cameraOwnerSocketId)
    return match ? `${match.label} · ${match.socketId.slice(0, 8)}` : `${cameraOwnerSocketId.slice(0, 8)} (offline)`
  }, [cameraOwnerSocketId, overlayClients])

  useEffect(() => {
    setUrl(config.obs.url)
    setPassword(config.obs.password)
  }, [config.obs])

  const handleSave = async () => {
    setSaving(true)
    await saveConfig({ obs: { url, password } })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const data = await testObsConnection()
      setTestResult(data.connected ? '✔ OBS is connected.' : `✘ Not connected: ${data.message ?? ''}`)
    } catch {
      setTestResult('✘ Could not reach server.')
    } finally {
      setTesting(false)
    }
  }

  const handleCameraOwnerChange = async (value: string) => {
    setCameraOwnerSaving(true)
    setCameraOwnerError(null)

    await new Promise<void>((resolve) => {
      socket.emit('camera:owner:select', value || null, (err) => {
        if (err) setCameraOwnerError(err)
        resolve()
      })
    })

    setCameraOwnerSaving(false)
  }

  if (mode === 'about') {
    return (
      <div className="w-full max-w-none space-y-0 pt-1">
        <ConfigSectionPanel label="OBS Setup Guide" first>
          <ol className="text-sm text-zinc-300 list-decimal list-inside space-y-1.5 leading-relaxed">
            <li>In OBS: create ONE scene called <strong>STREAM</strong></li>
            <li>Add a <strong>Game Capture</strong> source as the bottom layer</li>
            <li>Add a <strong>Browser Source</strong> pointing to <code className="font-mono text-cyan-400">{overlayRuntimeUrl}</code></li>
            <li>Set Browser Source to 1920×1080 and enable <em>Transparent Background</em></li>
            <li>Use <code className="font-mono text-zinc-300">{overlayDevUrl}</code> only when you want to inspect the overlay dev server directly in a browser</li>
            <li>Enable OBS WebSocket from Tools → obs-websocket Settings → Enable</li>
            <li>Set the URL and password in General to match your OBS WebSocket settings</li>
          </ol>
        </ConfigSectionPanel>

        <ConfigSectionPanel label="Server Info">
          <div className="grid text-sm gap-y-1.5" style={{ gridTemplateColumns: '160px 1fr' }}>
            <span className="text-zinc-400">Server port</span>
            <span className="font-mono text-zinc-200">3000</span>
            <span className="text-zinc-400">Overlay URL</span>
            <a href={overlayRuntimeUrl} target="_blank" rel="noreferrer"
               className="font-mono text-cyan-400 hover:text-cyan-300">
              {overlayRuntimeUrl}
            </a>
            <span className="text-zinc-400">Overlay Dev URL</span>
            <a href={overlayDevUrl} target="_blank" rel="noreferrer"
               className="font-mono text-zinc-300 hover:text-zinc-100">
              {overlayDevUrl}
            </a>
            <span className="text-zinc-400">Admin URL</span>
            <span className="font-mono text-zinc-200">{adminUrl}</span>
            <span className="text-zinc-400">Admin Preview URL</span>
            <span className="font-mono text-zinc-200">{previewUrl}</span>
            <span className="text-zinc-400">OBS Browser Source</span>
            <span className="font-mono text-zinc-200">{overlayRuntimeUrl}</span>
          </div>
        </ConfigSectionPanel>
      </div>
    )
  }

  return (
    <div className="w-full max-w-none space-y-0 pt-1">
      <ConfigSectionPanel label="OBS WebSocket Settings" first>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-zinc-400">Status:</span>
          <span className={`text-sm font-medium ${obsConnected ? 'text-emerald-400' : 'text-red-500'}`}>
            {obsConnected ? '● Connected' : '○ Disconnected'}
          </span>
        </div>

        <div className="mb-4 grid gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/55 p-3 text-xs text-zinc-400 md:grid-cols-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Target</div>
            <div className="mt-1 font-mono text-zinc-200">{obsStatus.url}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Reconnect</div>
            <div className="mt-1 text-zinc-200">
              {obsStatus.reconnecting ? `Attempt ${obsStatus.reconnectAttempt}${formatObsRetry(obsStatus.nextRetryAt) ? ` · ${formatObsRetry(obsStatus.nextRetryAt)}` : ''}` : 'Idle'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Last Error</div>
            <div className="mt-1 text-zinc-200">{obsStatus.lastError ?? 'None'}</div>
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs text-zinc-400 mb-1">WebSocket URL</label>
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="ws://localhost:4455" className="w-full" />
        </div>

        <div className="mb-4">
          <label className="block text-xs text-zinc-400 mb-1">Password (leave blank if none)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="OBS WebSocket password" className="w-full" />
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Btn variant="primary" onClick={handleSave} disabled={saving}>
            {saved ? '✔ Saved' : saving ? 'Saving…' : '💾 Save Settings'}
          </Btn>
          <Btn onClick={handleTest} disabled={testing}>
            {testing ? 'Testing…' : '⚡ Test Connection'}
          </Btn>
        </div>
        {testResult && (
          <div className={`mt-3 text-sm font-medium ${testResult.startsWith('✔') ? 'text-emerald-400' : 'text-red-400'}`}>
            {testResult}
          </div>
        )}
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Preview Routing">
        <Toggle
          checked={previewTarget === 'runtime'}
          onChange={(useRuntime) => setPreviewTarget(useRuntime ? 'runtime' : 'dev')}
          label="Use server-routed overlay for admin preview"
        />
        <div className="mt-3 text-xs text-zinc-400 leading-relaxed">
          When enabled, the admin preview loads <span className="font-mono text-zinc-200">{overlayRuntimeUrl}</span>.
          When disabled, it loads the direct overlay dev server at <span className="font-mono text-zinc-200">{overlayDevUrl}</span>.
          This setting affects the admin preview only. OBS should still use <span className="font-mono text-cyan-300">{overlayRuntimeUrl}</span>.
        </div>
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Camera Capture Owner">
        <div className="space-y-3">
          <div className="text-xs text-zinc-400 leading-relaxed">
            Choose which connected overlay client is allowed to capture the camera. Only clients with granted permission can be selected. Other overlays stay passive and show a status message instead of trying to grab the device.
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Allowed overlay client</label>
              <select
                value={cameraOwnerSocketId ?? ''}
                onChange={(e) => void handleCameraOwnerChange(e.target.value)}
                disabled={cameraOwnerSaving}
                className="w-full text-xs"
              >
                <option value="">Automatic / no lock</option>
                {overlayClientOptions.map((client) => (
                  <option
                    key={client.socketId}
                    value={client.socketId}
                    disabled={client.cameraPermission !== 'granted'}
                  >
                    {`${client.label} · ${client.socketId.slice(0, 8)} · ${client.cameraPermission}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-3 py-2 text-[11px] text-zinc-300">
              Current owner: <span className="font-mono text-zinc-100">{cameraOwnerLabel}</span>
            </div>
          </div>
          {cameraOwnerError && (
            <div className="text-xs text-red-400">{cameraOwnerError}</div>
          )}
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {overlayClientOptions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800/80 bg-zinc-950/35 px-3 py-3 text-xs text-zinc-500">
                No overlay clients connected.
              </div>
            ) : overlayClientOptions.map((client) => (
              <div key={client.socketId} className="rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-3 py-3 text-xs text-zinc-300">
                <div className="font-medium text-zinc-100">{client.label}</div>
                <div className="mt-1 font-mono text-[11px] text-zinc-500">{client.socketId}</div>
                <div className="mt-2 text-zinc-400">Permission: <span className="text-zinc-200">{client.cameraPermission}</span></div>
                <div className="text-zinc-400">Ready: <span className="text-zinc-200">{client.ready ? 'yes' : 'no'}</span></div>
              </div>
            ))}
          </div>
        </div>
      </ConfigSectionPanel>

      {consolePanel && (
        <ConfigSectionPanel label="Socket Console">
          {consolePanel}
        </ConfigSectionPanel>
      )}
    </div>
  )
}
