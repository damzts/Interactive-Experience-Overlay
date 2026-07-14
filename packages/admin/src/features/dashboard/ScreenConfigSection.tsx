import { ConfigPanel } from '../../components/organisms'
import { Button } from '../../components/atoms'
import { useScreenSharePublisher } from '../../hooks/useScreenSharePublisher'
import type { Application } from '@ieomlabs/shared'

/**
 * Config panel for the 'screen' user widget type — capture audio + mirror,
 * plus the actual screen-share publisher control.
 *
 * getDisplayMedia() requires a real user gesture (a click) and the overlay
 * is a passive OBS render target with nobody present to click anything —
 * so capture happens here, in admin, and is relayed to the overlay over
 * WebRTC via the server's local screen-share signaling relay.
 *
 * The share itself is owned by screenSharePublisherRegistry (module-level,
 * outside React), not by this component — closing this panel or switching
 * to a different widget does not stop the share. This panel is just a
 * selector/control surface for whichever screen share is running.
 */
export function ScreenConfigSection({
  form,
  update,
}: {
  form: Application
  update: (updater: (draft: Application) => void) => void
}) {
  const audio = form.screenSettings?.audio ?? false
  const { active, error, warning, start, stop } = useScreenSharePublisher(form.id, audio)

  return (
    <ConfigPanel title="Screen Share Defaults" className="mb-4">
      <div className="space-y-3">
        <div className="text-[10px] text-[var(--color-text-secondary)]">
          The widget displays video only — no controls. Click below to start sharing your screen to the overlay widget
          (in the desktop app, this captures your whole screen automatically with no picker; audio, if enabled below,
          uses system loopback rather than Chrome's tab-only audio capture).
        </div>
        <div className="flex items-center gap-2">
          {active ? (
            <Button variant="secondary" size="sm" onClick={stop}>⏹ Stop sharing</Button>
          ) : (
            <Button variant="primary" size="sm" onClick={start}>🖥️ Start screen share</Button>
          )}
          {active && <span className="text-[10px] text-[var(--color-success-400)]">● Sharing to overlay</span>}
        </div>
        {error && (
          <div className="rounded border border-[var(--color-danger-500)]/60 bg-[var(--color-danger-500)]/10 px-3 py-2 text-[10px] text-[var(--color-danger-400)]">{error}</div>
        )}
        {!error && warning && (
          <div className="rounded border border-[var(--color-warning-500)]/60 bg-[var(--color-warning-500)]/10 px-3 py-2 text-[10px] text-[var(--color-warning-400)]">{warning}</div>
        )}
        <div className="flex items-center gap-2">
          <input id={`screen-audio-${form.id}`} type="checkbox" checked={audio}
            onChange={(e) => update((d) => { d.screenSettings = { ...(d.screenSettings ?? {}), audio: e.target.checked } })} />
          <label htmlFor={`screen-audio-${form.id}`} className="text-[11px] text-[var(--color-text-primary)] cursor-pointer">Capture audio (system/tab audio, if supported)</label>
        </div>
        <div className="flex items-center gap-2">
          <input id={`screen-mirror-${form.id}`} type="checkbox" checked={form.screenSettings?.mirror ?? false}
            onChange={(e) => update((d) => { d.screenSettings = { ...(d.screenSettings ?? {}), mirror: e.target.checked } })} />
          <label htmlFor={`screen-mirror-${form.id}`} className="text-[11px] text-[var(--color-text-primary)] cursor-pointer">Mirror (flip horizontally)</label>
        </div>
      </div>
    </ConfigPanel>
  )
}
