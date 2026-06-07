import { useMemo, useState } from 'react'
import { withDesktopConfigDefaults } from '@ieom/shared'
import type { Application } from '@ieom/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { AssetSelectionInput } from '../asset-library/AssetLibrary'
import { IconGlyph } from '../../shared/ui'
import { Button } from '../../components/atoms'
import { ConfigPanel } from '../../components/organisms'
import type { UserWidgetBaseComponent } from './widgetHelpers'
import { buildUserWidgetId, findFirstSceneSource } from './widgetHelpers'

// ── USER_WIDGET_COMPONENT_OPTIONS ─────────────────────────────────────

const USER_WIDGET_COMPONENT_OPTIONS: Array<{
  id: UserWidgetBaseComponent
  label: string
  icon: string
  description: string
}> = [
  { id: 'camera', label: 'Camera', icon: '📷', description: 'Opens a desktop camera window with per-widget camera defaults.' },
  { id: 'source', label: 'Source', icon: '🧩', description: 'Opens a desktop window bound to an existing scene source renderer.' },
]

// ── NewWidgetForm ─────────────────────────────────────────────────────

export function NewWidgetForm({ onCreated }: { onCreated: (appId: string) => void }) {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const applications = config.applications

  const [widgetComponent, setWidgetComponent] = useState<UserWidgetBaseComponent>('camera')
  const [label,    setLabel]    = useState('')
  const [icon,     setIcon]     = useState(USER_WIDGET_COMPONENT_OPTIONS[0].icon)
  const [creating, setCreating] = useState(false)
  const [error,    setError]    = useState('')

  const componentMeta = USER_WIDGET_COMPONENT_OPTIONS.find((option) => option.id === widgetComponent) ?? USER_WIDGET_COMPONENT_OPTIONS[0]
  const existingIds = useMemo(() => new Set(applications.map((app) => app.id)), [applications])
  const defaultLabel = widgetComponent === 'camera' ? 'Camera Widget' : 'Source Widget'
  const nextLabel = label.trim() || defaultLabel
  const previewId = buildUserWidgetId(widgetComponent, nextLabel, existingIds)
  const firstSourceReference = useMemo(() => findFirstSceneSource(config.scenes), [config.scenes])

  const handleCreate = async () => {
    setCreating(true)
    setError('')
    try {
      const existingZIndices = applications.map((a) => a.zIndexDefault ?? 0)
      const nextDefaultZIndex = Math.max(-1, ...existingZIndices) + 1
      const nextWidget: Application = {
        id: previewId,
        label: nextLabel,
        icon: icon.trim() || componentMeta.icon,
        widgetSource: 'user',
        widgetComponent,
        zIndexDefault: nextDefaultZIndex,
        ...(widgetComponent === 'camera' ? { cameraSettings: { mirror: false } } : {}),
        ...(widgetComponent === 'source' && firstSourceReference ? { sourceWidgetSettings: firstSourceReference } : {}),
      }
      await saveConfig({ applications: [...applications, nextWidget] })
      onCreated(previewId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create widget.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-0 pt-1">
      <ConfigPanel title="Create Widget" className="mb-4">
        <div className="space-y-3">
          <div className="text-[10px] text-[var(--color-text-secondary)] leading-relaxed">
            New widgets are stored as user widget records. Choose the base component first, then create the widget and continue configuring it from the standard widget editor.
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-1.5">Base Component</div>
            <div className="grid grid-cols-2 gap-2">
              {USER_WIDGET_COMPONENT_OPTIONS.map((option) => {
                const active = option.id === widgetComponent
                return (
                  <button key={option.id} type="button"
                    onClick={() => {
                      const currentMeta = USER_WIDGET_COMPONENT_OPTIONS.find((entry) => entry.id === widgetComponent)
                      setWidgetComponent(option.id)
                      if (!icon.trim() || icon === currentMeta?.icon) setIcon(option.icon)
                    }}
                    className={'rounded border px-3 py-3 text-left transition-colors ' + (
                      active ? 'border-[var(--color-primary-400)]/40 bg-[var(--color-primary-500)]/10 text-[var(--color-primary-200)]' : 'border-[var(--color-border-default)] bg-[var(--color-bg-base)]/40 text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-base)]/60'
                    )}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{option.icon}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{option.label}</span>
                    </div>
                    <div className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">{option.description}</div>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Label</div>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={defaultLabel} className="w-full text-xs" />
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Generated ID</div>
            <input type="text" value={previewId} readOnly className="w-full text-xs font-mono text-[var(--color-text-muted)] cursor-default select-all" />
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Icon</div>
            <div className="flex gap-2 items-center">
              <div className="w-11 h-11 flex items-center justify-center bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-strong)] overflow-hidden shrink-0">
                <IconGlyph icon={icon || componentMeta.icon} label={nextLabel} size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <AssetSelectionInput value={icon} onChange={setIcon} kinds={['image']} modalTitle="Widget Icon"
                  placeholder="Emoji or /assets/icons/custom.png" buttonLabel="Choose Image"
                  hint="Leave an emoji in the field, or use the asset library to assign a custom image icon."
                  inputClassName="font-mono" previewKind="image" showPreview={false} />
              </div>
            </div>
          </div>
          {widgetComponent === 'source' && (
            <div className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-base)]/40 px-3 py-2 text-[10px] leading-relaxed text-[var(--color-text-secondary)]">
              {firstSourceReference
                ? `Initial binding will use ${firstSourceReference.sceneId} / ${firstSourceReference.sourceId}. You can change this immediately after creation.`
                : 'No scene sources are available yet. The widget will still be created, but you will need to bind it to a source from the widget editor later.'}
            </div>
          )}
          {error && <div className="rounded border border-[var(--color-danger-500)]/60 bg-[var(--color-danger-500)]/10 px-3 py-2 text-[10px] text-[var(--color-danger-400)]">{error}</div>}
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={() => { void handleCreate() }} disabled={creating}>
              {creating ? 'Creating...' : 'Create Widget'}
            </Button>
          </div>
        </div>
      </ConfigPanel>
    </div>
  )
}
