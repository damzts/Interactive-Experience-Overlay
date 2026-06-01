import { useState, useEffect } from 'react'
import { useAdminStore } from '../../store/useAdminStore'
import { Btn, ConfigSectionPanel } from '../../shared/ui'
import { AccountSection } from '../../auth/AccountSection'
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
  consolePanel?: React.ReactNode
  mode?: 'general' | 'about'
}) {
  const config = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const overlayRuntimeUrl = getOverlayRuntimeOrigin()
  const overlayDevUrl = getOverlayDevOrigin()
  const adminUrl = getAdminOrigin()

  const [url, setUrl] = useState(config.obs.url)
  const [password, setPassword] = useState(config.obs.password)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const obsConnected = useAdminStore((s) => s.obsConnected)
  const obsStatus = useAdminStore((s) => s.obsStatus)

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
      setTestResult(data.connected ? 'âœ” OBS is connected.' : `âœ˜ Not connected: ${data.message ?? ''}`)
    } catch {
      setTestResult('âœ˜ Could not reach server.')
    } finally {
      setTesting(false)
    }
  }

  if (mode === 'about') {
    return (
      <div className="w-full max-w-none space-y-0 pt-1">
        <ConfigSectionPanel label="OBS Setup Guide" first>
          <ol className="text-sm text-zinc-300 list-decimal list-inside space-y-1.5 leading-relaxed">
            <li>In OBS: create ONE scene called <strong>STREAM</strong></li>
            <li>Add a <strong>Game Capture</strong> source as the bottom layer</li>
            <li>Add a <strong>Browser Source</strong> pointing to <code className="font-mono text-cyan-400">{overlayRuntimeUrl}</code></li>
            <li>Set Browser Source to 1920Ã—1080 and enable <em>Transparent Background</em></li>
            <li>Use <code className="font-mono text-zinc-300">{overlayDevUrl}</code> only when you want to inspect the overlay dev server directly in a browser</li>
            <li>Enable OBS WebSocket from Tools â†’ obs-websocket Settings â†’ Enable</li>
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
            <span className="text-zinc-400">OBS Browser Source</span>
            <span className="font-mono text-zinc-200">{overlayRuntimeUrl}</span>
          </div>
        </ConfigSectionPanel>
      </div>
    )
  }

  return (
    <div className="w-full max-w-none space-y-0 pt-1">
      <ConfigSectionPanel label="Account" first>
        <AccountSection />
      </ConfigSectionPanel>

      <ConfigSectionPanel label="OBS WebSocket Settings">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-zinc-400">Status:</span>
          <span className={`text-sm font-medium ${obsConnected ? 'text-emerald-400' : 'text-red-500'}`}>
            {obsConnected ? 'â— Connected' : 'â—‹ Disconnected'}
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
              {obsStatus.reconnecting ? `Attempt ${obsStatus.reconnectAttempt}${formatObsRetry(obsStatus.nextRetryAt) ? ` Â· ${formatObsRetry(obsStatus.nextRetryAt)}` : ''}` : 'Idle'}
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
            {saved ? 'âœ” Saved' : saving ? 'Savingâ€¦' : 'ðŸ’¾ Save Settings'}
          </Btn>
          <Btn onClick={handleTest} disabled={testing}>
            {testing ? 'Testingâ€¦' : 'âš¡ Test Connection'}
          </Btn>
        </div>
        {testResult && (
          <div className={`mt-3 text-sm font-medium ${testResult.startsWith('âœ”') ? 'text-emerald-400' : 'text-red-400'}`}>
            {testResult}
          </div>
        )}
      </ConfigSectionPanel>

      {consolePanel && (
        <ConfigSectionPanel label="Socket Console">
          {consolePanel}
        </ConfigSectionPanel>
      )}
    </div>
  )
}


