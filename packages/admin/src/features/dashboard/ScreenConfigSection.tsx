import { ConfigPanel } from '../../components/organisms'
import { Button } from '../../components/atoms'
import { useScreenSharePublisher } from '../../hooks/useScreenSharePublisher'
import { useAdminStore } from '../../store/useAdminStore'
import type { Application } from '@ieomlabs/shared'

/**
 * Config panel for the 'screen' user widget type.
 *
 * When CaptureSource definitions exist (created in the Capture Sources
 * panel), this section shows a source picker — the widget just subscribes
 * to whichever source is selected. Start/stop controls live in the
 * dedicated Capture Sources panel, not here.
 *
 * sourceId is auto-saved on change (no Apply needed) so the overlay
 * widget immediately gets the updated key and can start receiving the
 * share. Other settings (mirror) still go through the normal draft/apply
 * flow since they don't affect the WebRTC connection.
 *
 * Falls back to the legacy per-widget start/stop flow when no sources
 * are defined, so existing setups keep working without migration.
 */
export function ScreenConfigSection({
  form,
  update,
}: {
  form: Application
  update: (updater: (draft: Application) => void) => void
}) {
  const captureSources = useAdminStore((s) => s.config.captureSources ?? [])
  const saveConfig     = useAdminStore((s) => s.saveConfig)
  const sourceId = form.screenSettings?.sourceId ?? ''
  const audio = form.screenSettings?.audio ?? false

  // For the legacy fallback path (no sources defined), keep the direct publisher
  const legacyPublisher = useScreenSharePublisher(form.id, audio)
  // For the selected-source status badge
  const selectedSource = captureSources.find((s) => s.id === sourceId)
  const selectedPublisher = useScreenSharePublisher(sourceId || '__none__', selectedSource?.audio ?? false)

  const hasSources = captureSources.length > 0

  // Auto-save sourceId immediately so the overlay gets the updated key right
  // away and can request a re-offer. Without this the overlay would sit on
  // the old (or absent) key until the user manually hits Apply.
  const handleSourceChange = (newSourceId: string) => {
    const next = newSourceId || undefined
    // Update local draft so the UI reflects the change immediately
    update((d) => { d.screenSettings = { ...(d.screenSettings ?? {}), sourceId: next } })
    // Persist right away — bypasses the Apply button for this field only
    const currentApps = useAdminStore.getState().config.applications
    void saveConfig({
      applications: currentApps.map((a) =>
        a.id === form.id
          ? { ...a, screenSettings: { ...(a.screenSettings ?? {}), sourceId: next } }
          : a,
      ),
    })
  }

  return (
    <ConfigPanel title="Screen Share" className="mb-4">
      <div className="space-y-3">
        {hasSources ? (
          <>
            <div className="text-[10px] text-[var(--color-text-secondary)]">
              Select which capture source this widget displays. Manage sources
              (start/stop, audio, auto-start) in the{' '}
              <strong className="text-[var(--color-text-primary)]">Capture Sources</strong> panel.
            </div>

            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Source</div>
              <select
                value={sourceId}
                onChange={(e) => handleSourceChange(e.target.value)}
                className="w-full text-xs"
              >
                <option value="">— None —</option>
                {captureSources.map((src) => (
                  <option key={src.id} value={src.id}>
                    {src.name}
                  </option>
                ))}
              </select>
            </div>

            {sourceId && (
              <div className="flex items-center gap-2">
                {selectedPublisher.active ? (
                  <span className="text-[10px] text-[var(--color-success-400)]">● Source is live</span>
                ) : (
                  <span className="text-[10px] text-[var(--color-text-muted)]">○ Source is idle</span>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-[10px] text-[var(--color-text-secondary)]">
              No capture sources defined. You can start sharing directly from
              this widget, or create named sources in the{' '}
              <strong className="text-[var(--color-text-primary)]">Capture Sources</strong> panel
              for a more flexible setup.
            </div>
            <div className="flex items-center gap-2">
              {legacyPublisher.active ? (
                <Button variant="secondary" size="sm" onClick={legacyPublisher.stop}>⏹ Stop sharing</Button>
              ) : (
                <Button variant="primary" size="sm" onClick={legacyPublisher.start}>🖥️ Start screen share</Button>
              )}
              {legacyPublisher.active && (
                <span className="text-[10px] text-[var(--color-success-400)]">● Sharing to overlay</span>
              )}
            </div>
            {legacyPublisher.error && (
              <div className="rounded border border-[var(--color-danger-500)]/60 bg-[var(--color-danger-500)]/10 px-3 py-2 text-[10px] text-[var(--color-danger-400)]">
                {legacyPublisher.error}
              </div>
            )}
            {!legacyPublisher.error && legacyPublisher.warning && (
              <div className="rounded border border-[var(--color-warning-500)]/60 bg-[var(--color-warning-500)]/10 px-3 py-2 text-[10px] text-[var(--color-warning-400)]">
                {legacyPublisher.warning}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                id={`screen-audio-${form.id}`}
                type="checkbox"
                checked={audio}
                onChange={(e) =>
                  update((d) => {
                    d.screenSettings = { ...(d.screenSettings ?? {}), audio: e.target.checked }
                  })
                }
              />
              <label
                htmlFor={`screen-audio-${form.id}`}
                className="text-[11px] text-[var(--color-text-primary)] cursor-pointer"
              >
                Capture audio
              </label>
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          <input
            id={`screen-mirror-${form.id}`}
            type="checkbox"
            checked={form.screenSettings?.mirror ?? false}
            onChange={(e) =>
              update((d) => {
                d.screenSettings = { ...(d.screenSettings ?? {}), mirror: e.target.checked }
              })
            }
          />
          <label
            htmlFor={`screen-mirror-${form.id}`}
            className="text-[11px] text-[var(--color-text-primary)] cursor-pointer"
          >
            Mirror (flip horizontally)
          </label>
        </div>
      </div>
    </ConfigPanel>
  )
}
