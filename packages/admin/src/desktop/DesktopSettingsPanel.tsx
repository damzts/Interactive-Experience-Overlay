import { useEffect, useState, useCallback } from 'react'
import { isDesktopMode } from './isDesktopMode'
import { Toggle, ConfigSectionPanel, ConfigPageIntro, ConfigCard } from '../shared/ui'

/**
 * Desktop Settings Panel
 *
 * Renders desktop-specific settings (launch-at-startup, auto-update) when
 * running inside the Electron shell. Returns null in web mode.
 *
 * Requirements: 14.1, 14.2
 */
export function DesktopSettingsPanel() {
  const [launchAtStartup, setLaunchAtStartup] = useState(false)
  const [autoUpdate, setAutoUpdate] = useState(true)
  const [loading, setLoading] = useState(true)
  const desktop = isDesktopMode()

  // Load initial values from IPC on mount
  useEffect(() => {
    if (!desktop) return

    let cancelled = false

    async function loadSettings() {
      try {
        const result = await window.ieom.settings.getLaunchAtStartup()
        if (!cancelled) {
          setLaunchAtStartup(result.enabled)
        }
      } catch {
        // Silently handle — defaults are fine
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSettings()
    return () => { cancelled = true }
  }, [desktop])

  // Handler for launch-at-startup toggle
  const handleLaunchAtStartupChange = useCallback(async (enabled: boolean) => {
    setLaunchAtStartup(enabled)
    try {
      const result = await window.ieom.settings.setLaunchAtStartup(enabled)
      setLaunchAtStartup(result.enabled)
    } catch {
      // Revert on failure
      setLaunchAtStartup(!enabled)
    }
  }, [])

  // Handler for auto-update toggle (local state for now — placeholder until IPC channel is wired)
  const handleAutoUpdateChange = useCallback((enabled: boolean) => {
    setAutoUpdate(enabled)
  }, [])

  // Only render in desktop mode
  if (!desktop) {
    return null
  }

  if (loading) {
    return (
      <div className="w-full max-w-none space-y-0 pt-1">
        <ConfigPageIntro title="Desktop Settings" eyebrow="Desktop App">
          Configure desktop application behavior.
        </ConfigPageIntro>
        <div className="flex items-center justify-center py-8">
          <span className="text-sm text-zinc-500">Loading settings...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-none space-y-0 pt-1">
      <ConfigPageIntro title="Desktop Settings" eyebrow="Desktop App">
        Configure desktop application behavior.
      </ConfigPageIntro>

      <div className="space-y-0 pt-3">
        <ConfigSectionPanel label="Startup" first>
          <div className="space-y-4">
            <ConfigCard>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-100">Launch at startup</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    Automatically start IEOM when your computer boots. The app will start minimized to the system tray.
                  </div>
                </div>
                <Toggle
                  checked={launchAtStartup}
                  onChange={handleLaunchAtStartupChange}
                />
              </div>
            </ConfigCard>

            <ConfigCard>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-100">Auto-update</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    Automatically download and install updates when available. You will be notified before the app restarts.
                  </div>
                </div>
                <Toggle
                  checked={autoUpdate}
                  onChange={handleAutoUpdateChange}
                />
              </div>
            </ConfigCard>
          </div>
        </ConfigSectionPanel>
      </div>
    </div>
  )
}
