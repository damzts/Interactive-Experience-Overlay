import { useState, useEffect } from 'react'
import { useAdminStore } from '../../store/useAdminStore'
import { AccountSection } from '../../auth/AccountSection'
import { testObsConnection } from '../../api/obsApi.js'
import { getAdminOrigin, getOverlayDevOrigin, getOverlayRuntimeOrigin } from '../../shared/runtimeUrls'
import { Button } from '../../components/atoms'
import { ConfigPanel } from '../../components/organisms'

function formatObsRetry(nextRetryAt: number | null) {
  if (!nextRetryAt) return null
  const seconds = Math.max(1, Math.ceil((nextRetryAt - Date.now()) / 1000))
  return `Retry in ${seconds}s`
}

export function SettingsPage({
  mode = 'general',
}: {
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
      setTestResult(data.connected ? '✓ OBS is connected.' : `✘ Not connected: ${data.message ?? ''}`)
    } catch {
      setTestResult('✘ Could not reach server.')
    } finally {
      setTesting(false)
    }
  }

  if (mode === 'about') {
    return (
      <div className="w-full max-w-none space-y-4 pt-1">
        <ConfigPanel title="OBS Setup Guide">
          <ol className="text-sm text-[var(--color-text-secondary)] list-decimal list-inside space-y-1.5 leading-relaxed">
            <li>In OBS: create ONE scene called <strong>STREAM</strong></li>
            <li>Add a <strong>Game Capture</strong> source as the bottom layer</li>
            <li>Add a <strong>Browser Source</strong> pointing to <code className="font-mono text-[var(--color-primary-400)]">{overlayRuntimeUrl}</code></li>
            <li>Set Browser Source to 1920×1080 and enable <em>Transparent Background</em></li>
            <li>Use <code className="font-mono text-[var(--color-text-secondary)]">{overlayDevUrl}</code> only when you want to inspect the overlay dev server directly in a browser</li>
            <li>Enable OBS WebSocket from Tools → obs-websocket Settings → Enable</li>
            <li>Set the URL and password in General to match your OBS WebSocket settings</li>
          </ol>
        </ConfigPanel>

        <ConfigPanel title="Server Info">
          <div className="grid text-sm gap-y-1.5" style={{ gridTemplateColumns: '160px 1fr' }}>
            <span className="text-[var(--color-text-muted)]">Server port</span>
            <span className="font-mono text-[var(--color-text-primary)]">3000</span>
            <span className="text-[var(--color-text-muted)]">Overlay URL</span>
            <a href={overlayRuntimeUrl} target="_blank" rel="noreferrer"
               className="font-mono text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)]">
              {overlayRuntimeUrl}
            </a>
            <span className="text-[var(--color-text-muted)]">Overlay Dev URL</span>
            <a href={overlayDevUrl} target="_blank" rel="noreferrer"
               className="font-mono text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
              {overlayDevUrl}
            </a>
            <span className="text-[var(--color-text-muted)]">Admin URL</span>
            <span className="font-mono text-[var(--color-text-primary)]">{adminUrl}</span>
            <span className="text-[var(--color-text-muted)]">OBS Browser Source</span>
            <span className="font-mono text-[var(--color-text-primary)]">{overlayRuntimeUrl}</span>
          </div>
        </ConfigPanel>
      </div>
    )
  }

  return (
    <div className="w-full max-w-none space-y-4 pt-1">
      <ConfigPanel title="Account">
        <AccountSection />
      </ConfigPanel>

      <ConfigPanel title="OBS WebSocket Settings">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-[var(--color-text-muted)]">Status:</span>
          <span className={`text-sm font-medium ${obsConnected ? 'text-[var(--color-success-400)]' : 'text-[var(--color-danger-500)]'}`}>
            {obsConnected ? '● Connected' : '○ Disconnected'}
          </span>
        </div>

        <div className="mb-4 grid gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-3 text-xs text-[var(--color-text-muted)] md:grid-cols-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Target</div>
            <div className="mt-1 font-mono text-[var(--color-text-primary)]">{obsStatus.url}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Reconnect</div>
            <div className="mt-1 text-[var(--color-text-primary)]">
              {obsStatus.reconnecting ? `Attempt ${obsStatus.reconnectAttempt}${formatObsRetry(obsStatus.nextRetryAt) ? ` · ${formatObsRetry(obsStatus.nextRetryAt)}` : ''}` : 'Idle'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Last Error</div>
            <div className="mt-1 text-[var(--color-text-primary)]">{obsStatus.lastError ?? 'None'}</div>
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">WebSocket URL</label>
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="ws://localhost:4455" className="w-full" />
        </div>

        <div className="mb-4">
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">Password (leave blank if none)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="OBS WebSocket password" className="w-full" />
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Button variant="primary" size="md" onClick={handleSave} disabled={saving} loading={saving}>
            {saved ? '✓ Saved' : 'Save Settings'}
          </Button>
          <Button variant="secondary" size="md" onClick={handleTest} disabled={testing} loading={testing}>
            {testing ? 'Testing…' : 'Test Connection'}
          </Button>
        </div>
        {testResult && (
          <div className={`mt-3 text-sm font-medium ${testResult.startsWith('✓') ? 'text-[var(--color-success-400)]' : 'text-[var(--color-danger-400)]'}`}>
            {testResult}
          </div>
        )}
      </ConfigPanel>

    </div>
  )
}
