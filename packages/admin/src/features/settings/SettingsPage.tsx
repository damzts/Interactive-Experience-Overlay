import { getAdminOrigin, getOverlayDevOrigin, getOverlayRuntimeOrigin } from '../../shared/runtimeUrls'
import { AccountSection } from '../../auth/AccountSection'
import { ConfigPanel } from '../../components/organisms'

export function SettingsPage({ mode = 'general' }: { mode?: 'general' | 'about' }) {
  const overlayRuntimeUrl = getOverlayRuntimeOrigin()
  const overlayDevUrl     = getOverlayDevOrigin()
  const adminUrl          = getAdminOrigin()

  if (mode === 'about') {
    return (
      <div className="w-full max-w-none space-y-4 pt-1">
        <ConfigPanel title="OBS Setup Guide">
          <ol className="text-sm text-[var(--color-text-secondary)] list-decimal list-inside space-y-1.5 leading-relaxed">
            <li>In OBS: create ONE scene called <strong>STREAM</strong></li>
            <li>Add a <strong>Game Capture</strong> source as the bottom layer</li>
            <li>Add a <strong>Browser Source</strong> pointing to <code className="font-mono text-[var(--color-primary-400)]">{overlayRuntimeUrl}</code></li>
            <li>Set Browser Source to 1920×1080 and enable <em>Transparent Background</em></li>
            <li>Enable OBS WebSocket from Tools → obs-websocket Settings → Enable</li>
            <li>Configure the OBS WebSocket URL and password in the <strong>OBS panel</strong> (System → OBS)</li>
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
      <ConfigPanel title="Server Info">
        <div className="grid text-sm gap-y-1.5" style={{ gridTemplateColumns: '160px 1fr' }}>
          <span className="text-[var(--color-text-muted)]">Overlay URL</span>
          <a href={overlayRuntimeUrl} target="_blank" rel="noreferrer"
             className="font-mono text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)]">
            {overlayRuntimeUrl}
          </a>
          <span className="text-[var(--color-text-muted)]">Admin URL</span>
          <span className="font-mono text-[var(--color-text-primary)]">{adminUrl}</span>
        </div>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          OBS WebSocket settings → System → OBS. CORS origins → set <code className="font-mono">CORS_ORIGINS</code> env (comma-separated).
        </p>
      </ConfigPanel>
    </div>
  )
}
