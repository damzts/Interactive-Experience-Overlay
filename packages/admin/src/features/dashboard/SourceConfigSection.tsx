import { RENDERER_CATALOG } from '@ieomlabs/shared'
import type { Application, AppConfig } from '@ieomlabs/shared'
import { ConfigPanel } from '../../components/organisms'

/** Config panel for the 'window' (Source) user widget type — renderer or scene binding. */
export function SourceConfigSection({
  form,
  update,
  ctx,
}: {
  form: Application
  update: (updater: (draft: Application) => void) => void
  ctx: { config: AppConfig }
}) {
  const { config } = ctx
  const sourceMode = form.windowWidgetSettings?.mode
    ?? (form.windowWidgetSettings?.rendererType ? 'renderer' : form.windowWidgetSettings?.sceneId ? 'scene' : '')

  return (
    <ConfigPanel title="Widget Source" className="mb-4">
      <div className="space-y-3">
        <div className="text-[10px] text-[var(--color-text-secondary)]">
          Source widgets render either a single renderer directly, or a whole scene scaled to fit the widget window.
        </div>
        <div>
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Source type</div>
          <select value={sourceMode}
            onChange={(e) => update((d) => {
              const nextMode = e.target.value as '' | 'renderer' | 'scene'
              d.windowWidgetSettings = nextMode === 'renderer'
                ? { mode: 'renderer', rendererType: d.windowWidgetSettings?.rendererType ?? 'media-viz' }
                : nextMode === 'scene'
                  ? { mode: 'scene', sceneId: d.windowWidgetSettings?.sceneId ?? Object.keys(config.scenes)[0] ?? '' }
                  : undefined
            })}
            className="w-full text-xs">
            <option value="">— No source —</option>
            <option value="renderer">Renderer</option>
            <option value="scene">Full scene</option>
          </select>
        </div>
        {sourceMode === 'renderer' && (
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Renderer</div>
            <select value={form.windowWidgetSettings?.rendererType ?? ''}
              onChange={(e) => update((d) => { d.windowWidgetSettings = { mode: 'renderer', rendererType: e.target.value } })}
              className="w-full text-xs">
              {RENDERER_CATALOG.map((entry) => (
                <option key={entry.id} value={entry.id} title={entry.desc}>{entry.icon} {entry.label}</option>
              ))}
            </select>
          </div>
        )}
        {sourceMode === 'scene' && (
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Scene</div>
            <select value={form.windowWidgetSettings?.sceneId ?? ''}
              onChange={(e) => update((d) => { d.windowWidgetSettings = { mode: 'scene', sceneId: e.target.value } })}
              className="w-full text-xs">
              <option value="">— Select scene —</option>
              {Object.values(config.scenes).map((scene) => (
                <option key={scene.id} value={scene.id}>{scene.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </ConfigPanel>
  )
}
