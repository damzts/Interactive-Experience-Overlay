import { type ReactNode } from 'react'
import type { WindowPreset } from '@ieomlabs/shared'
import { MediaSelectionInput } from './MediaLibrary'
import { findRendererCatalogEntry, RENDERER_CATALOG, type RendererCatalogEntry as CatalogEntry, type RendererFieldDef as FieldDef } from '@ieomlabs/shared'
import { Btn, ConfigCard, ConfigNotice, ConfigSectionPanel, HexColorInput, OverlayCanvas } from '../../shared/ui'
import { LibraryItemBtn } from './mediaLibraryUi'
import { MediaSearchInput } from './MediaLibraryPanel'

export function SourceField({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (value: unknown) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-16 shrink-0 text-[10px] text-zinc-500">{field.label}</label>
      {field.type === 'color' && (
        <HexColorInput
          value={String(value ?? '#000000')}
          onChange={(nextValue) => onChange(nextValue)}
          className="min-w-0 flex-1 gap-1"
          pickerClassName="h-5 w-6 shrink-0"
          textClassName="min-w-0 flex-1 font-mono text-[10px]"
        />
      )}
      {field.type === 'number' && (
        <input
          type="number"
          value={Number(value ?? 0)}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(event) => onChange(Number(event.target.value))}
          className="flex-1 font-mono text-xs"
        />
      )}
      {field.type === 'text' && (
        field.mediaKinds?.length ? (
          <div className="min-w-0 flex-1">
            <MediaSelectionInput
              value={String(value ?? '')}
              onChange={(nextValue) => onChange(nextValue)}
              kinds={field.mediaKinds}
              modalTitle={field.label}
              placeholder={field.placeholder}
              buttonLabel="Browse Assets"
              previewKind={field.mediaKinds[0] ?? 'auto'}
            />
          </div>
        ) : (
          <input
            type="text"
            value={String(value ?? '')}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
            className="flex-1 text-xs"
          />
        )
      )}
      {field.type === 'boolean' && (
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
      )}
      {field.type === 'select' && (
        <select value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} className="flex-1 text-xs">
          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      )}
    </div>
  )
}

function resolveSourcePreviewFontFamily(font: unknown) {
  switch (String(font ?? '').toLowerCase()) {
    case 'vt323':
      return 'VT323, monospace'
    case 'press-start':
      return '"Press Start 2P", monospace'
    case 'serif':
      return 'serif'
    default:
      return 'monospace'
  }
}

function formatSourcePreviewClock(format: unknown) {
  const now = new Date()
  const use12Hour = String(format ?? '').startsWith('12h')
  const includeSeconds = String(format ?? '').includes('sec')
  return now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: use12Hour,
  })
}

export function SourcePresetPreview({
  preset,
  meta,
  onPositionChange,
}: {
  preset: WindowPreset
  meta?: CatalogEntry
  onPositionChange?: (position: { x: number; y: number; width: number; height: number }) => void
}) {
  const config = preset.config ?? {}
  const opacityValue = Math.max(0, Math.min(1, Number(config.opacity ?? 1)))
  const sourcePosition = {
    x: Math.max(0, Math.min(1920, Number(preset.defaultPosition?.x ?? 0))),
    y: Math.max(0, Math.min(1080, Number(preset.defaultPosition?.y ?? 0))),
    width: Math.max(80, Math.min(1920, Number(preset.defaultPosition?.width ?? 1920))),
    height: Math.max(48, Math.min(1080, Number(preset.defaultPosition?.height ?? 1080))),
  }

  let previewNode: ReactNode

  switch (preset.rendererType) {
    case 'image-static': {
      const url = String(config.url ?? '').trim()
      const objectFit = ['cover', 'contain', 'fill'].includes(String(config.objectFit ?? 'cover')) ? String(config.objectFit) as 'cover' | 'contain' | 'fill' : 'cover'
      previewNode = url ? (
        <img src={url} alt={preset.label} className="h-full w-full" style={{ objectFit, opacity: opacityValue }} />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-zinc-700/80 bg-zinc-950/60 text-sm text-zinc-500">
          Select an image asset to preview it here.
        </div>
      )
      break
    }
    case 'video-loop': {
      const url = String(config.url ?? '').trim()
      previewNode = url ? (
        <video src={url} className="h-full w-full object-cover" style={{ opacity: opacityValue }} muted autoPlay loop playsInline />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-zinc-700/80 bg-zinc-950/60 text-sm text-zinc-500">
          Select a video asset to preview it here.
        </div>
      )
      break
    }
    case 'solid-color':
      previewNode = <div className="h-full w-full" style={{ background: String(config.color ?? '#000000') }} />
      break
    case 'color-overlay':
      previewNode = (
        <div className="relative h-full w-full overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#1f2937,transparent_55%),linear-gradient(135deg,#0f172a,#020617)]" />
          <div className="absolute inset-0" style={{ background: String(config.color ?? '#000000'), opacity: opacityValue }} />
        </div>
      )
      break
    case 'image-slideshow': {
      const interval = Number(config.interval ?? 6)
      previewNode = (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#1e293b,transparent_55%),linear-gradient(135deg,#111827,#020617)] px-6">
          <div className="grid w-full max-w-xl grid-cols-3 gap-3">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className={'rounded-xl border border-zinc-700/80 bg-zinc-900/85 p-3 text-center transition-transform ' + (index === 1 ? 'scale-105 shadow-[0_0_0_1px_rgba(34,211,238,0.3)]' : 'opacity-70')}
              >
                <div className="mb-3 text-3xl">🎞</div>
                <div className="text-[11px] font-medium text-zinc-200">Frame {index + 1}</div>
              </div>
            ))}
          </div>
          <div className="absolute bottom-3 left-3 flex gap-2 text-[10px] text-zinc-300">
            <span className="rounded-full border border-zinc-700/80 bg-zinc-950/70 px-2 py-1">{Number.isFinite(interval) ? interval : 6}s</span>
            <span className="rounded-full border border-zinc-700/80 bg-zinc-950/70 px-2 py-1">{Boolean(config.shuffle) ? 'Shuffle' : 'Sequence'}</span>
          </div>
        </div>
      )
      break
    }
    case 'crt-effect': {
      const scanlineIntensity = Math.max(0, Math.min(1, Number(config.scanlineIntensity ?? 0.25)))
      const vignetteStrength = Math.max(0, Math.min(1, Number(config.vignetteStrength ?? 0.5)))
      previewNode = (
        <div className="relative h-full w-full overflow-hidden bg-[linear-gradient(180deg,#0f172a,#020617)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.18),transparent_60%)] opacity-80" />
          <div className="absolute inset-0" style={{ opacity: 0.15 + scanlineIntensity * 0.45, backgroundImage: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 1px, transparent 1px, transparent 4px)' }} />
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle, transparent 35%, rgba(0,0,0,${0.2 + vignetteStrength * 0.6}) 100%)` }} />
        </div>
      )
      break
    }
    case 'vignette': {
      const strength = Math.max(0, Math.min(1, Number(config.strength ?? 0.6)))
      previewNode = (
        <div className="relative h-full w-full overflow-hidden bg-[linear-gradient(135deg,#1d4ed8,#0f172a_60%,#020617)]">
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle, transparent 40%, ${String(config.color ?? '#000000')} ${60 + strength * 20}%)`, opacity: 0.4 + strength * 0.5 }} />
        </div>
      )
      break
    }
    case 'noise-grain': {
      const grainOpacity = Math.max(0, Math.min(0.5, Number(config.opacity ?? 0.08)))
      previewNode = (
        <div className="relative h-full w-full overflow-hidden bg-[linear-gradient(135deg,#111827,#020617)]">
          <div className="absolute inset-0" style={{ opacity: 0.4, backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08) 0 1px, transparent 1px), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.05) 0 1px, transparent 1px), radial-gradient(circle at 40% 70%, rgba(255,255,255,0.08) 0 1px, transparent 1px)', backgroundSize: '18px 18px, 22px 22px, 16px 16px' }} />
          <div className="absolute bottom-3 left-3 rounded-full border border-zinc-700/80 bg-zinc-950/70 px-2 py-1 text-[10px] text-zinc-300">Opacity {grainOpacity.toFixed(2)}</div>
        </div>
      )
      break
    }
    case 'text-widget': {
      const fontSize = Math.max(8, Number(config.fontSize ?? 28))
      const content = String(config.content ?? 'Label')
      previewNode = (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#1f2937,transparent_55%),linear-gradient(135deg,#111827,#020617)] px-6 text-center">
          <div style={{ color: String(config.color ?? '#ffffff'), fontSize: `${fontSize}px`, fontFamily: resolveSourcePreviewFontFamily(config.font) }}>
            {Boolean(config.typewriterMode) ? `${content}_` : content}
          </div>
        </div>
      )
      break
    }
    case 'clock-widget': {
      const fontSize = Math.max(8, Number(config.fontSize ?? 36))
      previewNode = (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#0f3d2f,transparent_55%),linear-gradient(135deg,#111827,#020617)] px-6 text-center">
          <div style={{ color: String(config.color ?? '#00ff41'), fontSize: `${fontSize}px`, fontFamily: resolveSourcePreviewFontFamily(config.font) }}>
            {formatSourcePreviewClock(config.format)}
          </div>
        </div>
      )
      break
    }
    default:
      previewNode = (
        <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-zinc-700/80 bg-zinc-950/60 text-sm text-zinc-500">
          Preview unavailable for this renderer type.
        </div>
      )
  }

  const canvasItem = { id: 'source', ...sourcePosition }

  return (
    <div className="space-y-3">
      <OverlayCanvas
        items={[canvasItem]}
        selectedId="source"
        onChange={onPositionChange ? (_, patch) => onPositionChange({ ...sourcePosition, ...patch }) : undefined}
        readonly={!onPositionChange}
        renderItem={() => (
          <>
            <div className="absolute inset-0">{previewNode}</div>
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5" />
          </>
        )}
      />
      <div className="grid gap-2 text-[10px] text-zinc-500 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-5 py-4">x: {Math.round(sourcePosition.x)}</div>
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-5 py-4">y: {Math.round(sourcePosition.y)}</div>
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-5 py-4">{Math.round(sourcePosition.width)} × {Math.round(sourcePosition.height)}</div>
      </div>
      <div className="text-[10px] text-zinc-500">Drag to move · Corner handles to resize</div>
    </div>
  )
}

export function SourcesTabSidebar({
  sourceSearch,
  onSourceSearchChange,
  filteredSourcePresets,
  selectedSourcePresetId,
  selectedUsageCountByPreset,
  onSelectSourcePreset,
}: {
  sourceSearch: string
  onSourceSearchChange: (value: string) => void
  filteredSourcePresets: WindowPreset[]
  selectedSourcePresetId: string | null
  selectedUsageCountByPreset: Record<string, number>
  onSelectSourcePreset: (presetId: string) => void
}) {
  return (
    <>
      <MediaSearchInput value={sourceSearch} onChange={onSourceSearchChange} placeholder="Search presets…" />
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {filteredSourcePresets.length ? filteredSourcePresets.map((preset) => {
          const meta = findRendererCatalogEntry(preset.rendererType)
          const usageCount = selectedUsageCountByPreset[preset.id] ?? 0
          return (
            <LibraryItemBtn key={preset.id} active={preset.id === selectedSourcePresetId} onClick={() => onSelectSourcePreset(preset.id)}>
              <div className="flex items-center gap-2">
                <span>{meta?.icon ?? '▣'}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{preset.label}</span>
              </div>
              <div className="mt-1 truncate text-[10px] text-zinc-500">{meta?.label ?? preset.rendererType}</div>
              <div className="mt-1 truncate text-[10px] text-zinc-600">
                {usageCount} scene attachment{usageCount === 1 ? '' : 's'}
              </div>
            </LibraryItemBtn>
          )
        }) : (
          <ConfigNotice tone="info">No window presets match this filter.</ConfigNotice>
        )}
      </div>
    </>
  )
}

export function SourcesTabContent({
  editingSourcePreset,
  selectedSourceMeta,
  sourcePresetOriginalId,
  sourceDraftCreatesNewPreset,
  selectedSourceUsageCount,
  createSourcePresetDraft,
  patchSourcePresetDraft,
  saveSourcePresetDraft,
  deleteSourcePresetDraft,
}: {
  editingSourcePreset: WindowPreset | null
  selectedSourceMeta?: CatalogEntry
  sourcePresetOriginalId: string | null
  sourceDraftCreatesNewPreset: boolean
  selectedSourceUsageCount: number
  createSourcePresetDraft: (entry: CatalogEntry) => void
  patchSourcePresetDraft: (updates: Partial<WindowPreset>) => void
  saveSourcePresetDraft: () => void
  deleteSourcePresetDraft: () => void
}) {
  const catalogButtons = (
    <div className="grid gap-2 lg:grid-cols-2">
      {RENDERER_CATALOG.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => createSourcePresetDraft(entry)}
          className="w-full rounded-lg border border-zinc-800/80 bg-zinc-950/55 px-3 py-3 text-left transition-colors hover:border-zinc-700/80 hover:bg-zinc-900/75"
        >
          <div className="flex items-center gap-2">
            <span>{entry.icon}</span>
            <span className="text-[12px] font-medium text-zinc-100">{entry.label}</span>
          </div>
          <div className="mt-1 text-[10px] text-zinc-500">{entry.desc}</div>
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex min-h-0 flex-col gap-4 pt-0.5">
      {editingSourcePreset && selectedSourceMeta ? (
        <>
          <ConfigCard className="space-y-4 p-5 sm:p-6">
            <div className="space-y-3 rounded-2xl border border-dashed border-cyan-500/25 bg-cyan-500/5 px-4 py-4">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">Add Renderer Type</div>
                <div className="text-xs text-zinc-500">Pick a renderer type to open a new preset draft below.</div>
              </div>
              {catalogButtons}
            </div>
          </ConfigCard>

          <ConfigCard className="space-y-4 p-5 sm:p-6">
            <div className="space-y-1 rounded-xl border border-zinc-800/80 bg-zinc-950/35 px-5 py-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">Preset Editor</div>
              <div className="text-xs text-zinc-500">Primary window preset authoring card.</div>
            </div>

            <div className="grid items-start gap-4 xl:grid-cols-2">
              <div className="min-w-0">
                <ConfigSectionPanel label="Preset Summary" first>
                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-5 py-4">
                        <div className="flex items-baseline justify-between gap-3 text-[11px]">
                          <span className="text-zinc-500">Label</span>
                          <span className="truncate text-right font-semibold text-zinc-100">{editingSourcePreset.label}</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-5 py-4">
                        <div className="flex items-baseline justify-between gap-3 text-[11px]">
                          <span className="text-zinc-500">Preset Id</span>
                          <span className="truncate text-right font-semibold text-zinc-100">{sourcePresetOriginalId ?? 'Draft until saved'}</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-5 py-4">
                        <div className="flex items-baseline justify-between gap-3 text-[11px]">
                          <span className="text-zinc-500">Type</span>
                          <span className="truncate text-right font-semibold text-zinc-100">{selectedSourceMeta.label}</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-5 py-4">
                        <div className="flex items-baseline justify-between gap-3 text-[11px]">
                          <span className="text-zinc-500">Used In Scenes</span>
                          <span className="text-right font-semibold text-zinc-100">{selectedSourceUsageCount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-5 py-4 text-[11px] leading-relaxed text-zinc-500">
                      Review the selected draft details and configure the preset below.
                    </div>
                  </div>
                </ConfigSectionPanel>
              </div>

              <div className="min-w-0">
                <ConfigSectionPanel label="Actions" first>
                  <div className="space-y-4">
                    <div className="text-sm text-zinc-500">{sourceDraftCreatesNewPreset ? 'Editing new window preset draft' : `Editing ${editingSourcePreset.label}`}</div>
                    <div className="flex flex-wrap gap-2">
                      <Btn type="button" variant="primary" onClick={saveSourcePresetDraft} className="px-4 py-2 text-sm">
                        {sourceDraftCreatesNewPreset ? 'Save as New Preset' : 'Save Preset'}
                      </Btn>
                      <Btn type="button" variant="danger" onClick={deleteSourcePresetDraft} className="px-4 py-2 text-sm">
                        {sourcePresetOriginalId ? 'Delete Preset' : 'Delete Draft'}
                      </Btn>
                    </div>
                  </div>
                </ConfigSectionPanel>
              </div>

              <div className="min-w-0">
                <ConfigSectionPanel label="Identity" first>
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 text-[10px] text-zinc-500">Label</div>
                      <input
                        type="text"
                        value={editingSourcePreset.label}
                        onChange={(event) => patchSourcePresetDraft({ label: event.target.value })}
                        className="w-full text-sm"
                      />
                    </div>
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-5 py-4 text-[11px] leading-relaxed text-zinc-500">
                      {sourceDraftCreatesNewPreset
                        ? 'Saving will create a new preset because this label differs from the saved window.'
                        : 'Saving will update the currently selected preset.'}
                    </div>
                  </div>
                </ConfigSectionPanel>
              </div>

              <div className="min-w-0">
                <ConfigSectionPanel label="Default Position" first>
                  <div className="grid grid-cols-4 gap-2">
                    {(['x', 'y', 'width', 'height'] as const).map((field) => (
                      <div key={field}>
                        <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">{field}</div>
                        <input
                          type="number"
                          value={editingSourcePreset.defaultPosition?.[field] ?? (field === 'width' ? 1920 : field === 'height' ? 1080 : 0)}
                          onChange={(event) => patchSourcePresetDraft({
                            defaultPosition: {
                              ...(editingSourcePreset.defaultPosition ?? { x: 0, y: 0, width: 1920, height: 1080 }),
                              [field]: Number(event.target.value),
                            },
                          })}
                          className="w-full font-mono text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </ConfigSectionPanel>
              </div>

              <div className="min-w-0">
                <ConfigSectionPanel label="Renderer Settings" first>
                  <div className="space-y-3">
                    {selectedSourceMeta.fields.map((field) => (
                      <SourceField
                        key={field.key}
                        field={field}
                        value={editingSourcePreset.config[field.key]}
                        onChange={(value) => patchSourcePresetDraft({
                          config: { ...editingSourcePreset.config, [field.key]: value },
                        })}
                      />
                    ))}
                  </div>
                </ConfigSectionPanel>
              </div>
            </div>
          </ConfigCard>

          <ConfigCard className="p-5 sm:p-6">
            <ConfigSectionPanel label="Preview" first>
              <SourcePresetPreview
                preset={editingSourcePreset}
                meta={selectedSourceMeta}
                onPositionChange={({ x, y, width, height }) => patchSourcePresetDraft({
                  defaultPosition: { x, y, width, height },
                })}
              />
            </ConfigSectionPanel>
          </ConfigCard>
        </>
      ) : (
        <div className="space-y-4">
          <ConfigCard className="space-y-4 p-5 sm:p-6">
            <div className="space-y-3 rounded-2xl border border-dashed border-cyan-500/25 bg-cyan-500/5 px-4 py-4">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">Add Renderer Type</div>
                <div className="text-xs text-zinc-500">Choose a renderer type to start a new preset draft.</div>
              </div>
              {catalogButtons}
            </div>
          </ConfigCard>
          <ConfigNotice tone="info" className="py-8 text-center">Select a window preset from the left column to configure it.</ConfigNotice>
        </div>
      )}
    </div>
  )
}
