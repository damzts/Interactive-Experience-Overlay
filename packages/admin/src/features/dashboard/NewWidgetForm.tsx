import { useMemo, useState } from 'react'
import type { Application } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { MediaSelectionInput } from '../media-library/MediaLibrary'
import { IconGlyph } from '../../shared/ui'
import { Button } from '../../components/atoms'
import { ConfigPanel } from '../../components/organisms'
import { USER_WIDGET_TYPES } from './userWidgetTypes'
import { buildUserWidgetId } from './widgetHelpers'

// ── NewWidgetForm ─────────────────────────────────────────────────────

export function NewWidgetForm({ onCreated }: { onCreated: (appId: string) => void }) {
  const applications    = useAdminStore((s) => s.persistedConfig.applications)
  const saveConfig      = useAdminStore((s) => s.saveConfig)
  const patchConfig     = useAdminStore((s) => s.patchConfig)

  const [widgetType, setWidgetType] = useState(USER_WIDGET_TYPES[0])
  const [label,    setLabel]    = useState('')
  const [icon,     setIcon]     = useState(USER_WIDGET_TYPES[0].icon)
  const [creating, setCreating] = useState(false)
  const [error,    setError]    = useState('')

  const existingIds = useMemo(() => new Set(applications.map((app) => app.id)), [applications])
  const nextLabel = label.trim() || widgetType.defaultLabel
  const previewId = buildUserWidgetId(widgetType.componentType, nextLabel, existingIds)

  const handleCreate = () => {
    setCreating(true)
    setError('')
    const existingZIndices = applications.map((a) => a.zIndexDefault ?? 0)
    const nextDefaultZIndex = Math.max(-1, ...existingZIndices) + 1
    const nextWidget: Application = {
      id: previewId,
      label: nextLabel,
      icon: icon.trim() || widgetType.icon,
      widgetSource: 'user',
      widgetComponent: widgetType.componentType,
      zIndexDefault: nextDefaultZIndex,
      ...widgetType.createDefaults(),
    }
    const nextApplications = [...applications, nextWidget]
    patchConfig({ applications: nextApplications })
    onCreated(previewId)
    void saveConfig({ applications: nextApplications })
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
              {USER_WIDGET_TYPES.map((option) => {
                const active = option.componentType === widgetType.componentType
                return (
                  <button key={option.componentType} type="button"
                    onClick={() => {
                      const currentType = widgetType
                      setWidgetType(option)
                      if (!icon.trim() || icon === currentType.icon) setIcon(option.icon)
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
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={widgetType.defaultLabel} className="w-full text-xs" />
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Generated ID</div>
            <input type="text" value={previewId} readOnly className="w-full text-xs font-mono text-[var(--color-text-muted)] cursor-default select-all" />
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Icon</div>
            <div className="flex gap-2 items-center">
              <div className="w-11 h-11 flex items-center justify-center bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-strong)] overflow-hidden shrink-0">
                <IconGlyph icon={icon || widgetType.icon} label={nextLabel} size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <MediaSelectionInput value={icon} onChange={setIcon} kinds={['image']} modalTitle="Widget Icon"
                  placeholder="Emoji or /assets/icons/custom.png" buttonLabel="Choose Image"
                  hint="Leave an emoji in the field, or use the asset library to assign a custom image icon."
                  inputClassName="font-mono" previewKind="image" showPreview={false} />
              </div>
            </div>
          </div>
          {widgetType.componentType === 'window' && (
            <div className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-base)]/40 px-3 py-2 text-[10px] leading-relaxed text-[var(--color-text-secondary)]">
              Starts with the Media Visualizer renderer. Switch it to any other renderer — or a full scene — in the widget editor after creation.
            </div>
          )}
          {error && <div className="rounded border border-[var(--color-danger-500)]/60 bg-[var(--color-danger-500)]/10 px-3 py-2 text-[10px] text-[var(--color-danger-400)]">{error}</div>}
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create Widget'}
            </Button>
          </div>
        </div>
      </ConfigPanel>
    </div>
  )
}
