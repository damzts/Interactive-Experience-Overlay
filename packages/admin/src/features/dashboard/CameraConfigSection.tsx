import { Button } from '../../components/atoms'
import { ConfigPanel } from '../../components/organisms'
import type { Application } from '@ieomlabs/shared'

export interface CameraConfigSectionContext {
  detectedCameras: { deviceId: string; label: string }[]
  detectingCameras: boolean
  cameraLabelsGranted: boolean
  enumerateCameras: (requestPermission?: boolean) => Promise<void>
}

/** Config panel for the 'camera' user widget type — camera device selection + mirror. */
export function CameraConfigSection({
  form,
  update,
  ctx,
}: {
  form: Application
  update: (updater: (draft: Application) => void) => void
  ctx: CameraConfigSectionContext
}) {
  const { detectedCameras, detectingCameras, cameraLabelsGranted, enumerateCameras } = ctx

  return (
    <ConfigPanel title="Camera Defaults" className="mb-4">
      <div className="space-y-3">
        <div className="text-[10px] text-[var(--color-text-secondary)]">
          Configure the camera for this widget. The widget displays video only — no controls. Open OBS with <span className="font-mono text-[var(--color-text-primary)]">?obs=1</span> in the browser source URL.
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] text-[var(--color-text-muted)]">Camera device</div>
            {!cameraLabelsGranted && (
              <Button variant="secondary" size="sm" disabled={detectingCameras} onClick={() => void enumerateCameras(true)}>
                {detectingCameras ? 'Detecting...' : '🔓 Get real names'}
              </Button>
            )}
          </div>
          {detectingCameras && detectedCameras.length === 0 ? (
            <div className="text-[10px] text-[var(--color-text-muted)] italic">Detecting devices...</div>
          ) : (
            <select value={form.cameraSettings?.preferredDeviceLabel ?? ''}
              onChange={(e) => update((d) => { d.cameraSettings = { ...(d.cameraSettings ?? {}), preferredDeviceLabel: e.target.value } })}
              className="w-full text-xs">
              <option value="">— No preference (first device) —</option>
              {detectedCameras.map((cam) => <option key={cam.deviceId} value={cam.label}>{cam.label}</option>)}
              {form.cameraSettings?.preferredDeviceLabel && !detectedCameras.some((c) => c.label === form.cameraSettings?.preferredDeviceLabel) && (
                <option value={form.cameraSettings.preferredDeviceLabel}>{form.cameraSettings.preferredDeviceLabel} (saved)</option>
              )}
            </select>
          )}
          <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
            {!cameraLabelsGranted && detectedCameras.length > 0
              ? 'Generic names — click "Get real names" to see actual system labels.'
              : 'The label is saved on the server. OBS uses it to find the same camera automatically.'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input id={`cam-mirror-${form.id}`} type="checkbox" checked={form.cameraSettings?.mirror ?? false}
            onChange={(e) => update((d) => { d.cameraSettings = { ...(d.cameraSettings ?? {}), mirror: e.target.checked } })} />
          <label htmlFor={`cam-mirror-${form.id}`} className="text-[11px] text-[var(--color-text-primary)] cursor-pointer">Mirror (flip horizontally)</label>
        </div>
      </div>
    </ConfigPanel>
  )
}
