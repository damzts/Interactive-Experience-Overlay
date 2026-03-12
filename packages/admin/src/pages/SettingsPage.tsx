import { useState, useEffect } from 'react'
import { useAdminStore } from '../store/useAdminStore'
import { Panel, Btn, Toggle } from '../components/ui'

export function SettingsPage() {
  const config = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:'
  const overlayRuntimeUrl = `${protocol}//${host}:3000`
  const overlayDevUrl = `${protocol}//${host}:3001`
  const adminUrl = `${protocol}//${host}:3002`
  const previewTarget = useAdminStore((s) => s.previewTarget)
  const setPreviewTarget = useAdminStore((s) => s.setPreviewTarget)

  const [url, setUrl] = useState(config.obs.url)
  const [password, setPassword] = useState(config.obs.password)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const obsConnected = useAdminStore((s) => s.obsConnected)
  const previewUrl = previewTarget === 'runtime' ? overlayRuntimeUrl : overlayDevUrl

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
      const res = await fetch('/api/obs/test')
      const data = await res.json()
      setTestResult(data.connected ? '✔ OBS is connected.' : `✘ Not connected: ${data.message}`)
    } catch {
      setTestResult('✘ Could not reach server.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg">

      <Panel title="OBS WebSocket Settings">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-zinc-400">Status:</span>
          <span className={`text-sm font-medium ${obsConnected ? 'text-emerald-400' : 'text-red-500'}`}>
            {obsConnected ? '● Connected' : '○ Disconnected'}
          </span>
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
      </Panel>

      <Panel title="Server Info">
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
      </Panel>

      <Panel title="Preview Routing">
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
      </Panel>

      <Panel title="OBS Setup Guide">
        <ol className="text-sm text-zinc-300 list-decimal list-inside space-y-1.5 leading-relaxed">
          <li>In OBS: create ONE scene called <strong>STREAM</strong></li>
          <li>Add a <strong>Game Capture</strong> source (bottom layer)</li>
          <li>Add a <strong>Browser Source</strong> → <code className="font-mono text-cyan-400">{overlayRuntimeUrl}</code></li>
          <li>Set Browser Source to 1920×1080, check <em>Transparent Background</em></li>
          <li>Use <code className="font-mono text-zinc-300">{overlayDevUrl}</code> only when you want to inspect the overlay dev server directly in a browser</li>
          <li>Enable OBS WebSocket: Tools → obs-websocket Settings → Enable</li>
          <li>Set the URL + password above to match your OBS settings</li>
        </ol>
      </Panel>
    </div>
  )
}
