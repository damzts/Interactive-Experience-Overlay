import { useMemo, useState } from 'react'
import type { MediaEntry } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import {
  deleteMediaFile,
  inferMediaKindFromUrl,
  isLikelyMediaUrl,
  mediaEntryToRecord,
  uploadMediaFile,
  useMediaCatalog,
} from '../../shared/catalog'
import type { MediaKind, MediaRecord } from '../../shared/catalog'
import { Btn, ConfigCard, ConfigNotice, ConfigToolbar, FloatingWindowHeader, FloatingWindowShell } from '../../shared/ui'

const MEDIA_RESULT_LIMIT = 60

function getAssetSearchText(asset: MediaRecord) {
  return [asset.name, asset.url, asset.folder, asset.relativePath, asset.game ?? ''].join(' ').toLowerCase()
}

function getAssetLabel(asset: MediaRecord) {
  if (asset.source === 'games') return asset.game ? `Game: ${asset.game}` : 'Game Image'
  if (asset.source === 'saved') return 'Saved Media'
  return asset.folder
}

function getAssetNameFromUrl(url: string) {
  const tail = url.split('/').pop() ?? url
  return decodeURIComponent(tail).replace(/\.[^.]+$/, '') || 'Untitled'
}

function AssetPreview({ asset }: { asset: MediaRecord }) {
  return (
    <div className="w-20 h-12 rounded overflow-hidden bg-zinc-950 border border-zinc-700/60 shrink-0 flex items-center justify-center">
      {asset.kind === 'image' && (
        <>
          <img
            src={asset.url}
            alt={asset.name}
            className="w-full h-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
              const fallback = event.currentTarget.nextElementSibling as HTMLElement | null
              if (fallback) fallback.style.display = 'flex'
            }}
          />
          <span className="hidden items-center justify-center text-sm">🖼</span>
        </>
      )}
      {asset.kind === 'video' && (
        <video src={asset.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
      )}
      {asset.kind === 'audio' && (
        <button
          type="button"
          title="Preview sound"
          onClick={(event) => {
            event.stopPropagation()
            const audio = new Audio(asset.url)
            audio.volume = 0.5
            audio.play().catch(() => {})
          }}
          className="flex h-full w-full items-center justify-center text-lg text-zinc-300 transition-colors hover:text-cyan-300"
        >
          ▶
        </button>
      )}
    </div>
  )
}

function AssetRow({
  asset,
  selected,
  onSelect,
  onDelete,
}: {
  asset: MediaRecord
  selected: boolean
  onSelect?: (asset: MediaRecord) => void
  onDelete?: (asset: MediaRecord) => void
}) {
  const interactive = Boolean(onSelect)

  return (
    <ConfigCard className={selected ? 'border-cyan-400/35 bg-cyan-500/10' : interactive ? 'hover:border-zinc-700/80 hover:bg-zinc-900/70' : ''}>
      {interactive ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect?.(asset)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(asset) }
          }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
        >
          <AssetPreview asset={asset} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-zinc-100 truncate">{asset.name}</div>
            <div className="text-[10px] text-zinc-500 truncate">{getAssetLabel(asset)}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="rounded bg-zinc-900/80 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-400">{asset.kind}</span>
              <span className="rounded bg-zinc-900/80 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-500">{asset.source}</span>
              {asset.duration != null && (
                <span className="rounded bg-zinc-900/80 px-1.5 py-0.5 text-[9px] font-mono text-zinc-500">{asset.duration}s</span>
              )}
            </div>
          </div>
          <span className="shrink-0 text-[10px] text-cyan-400">Use</span>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <AssetPreview asset={asset} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-zinc-100 truncate">{asset.name}</div>
            <div className="text-[10px] text-zinc-500 truncate">{getAssetLabel(asset)}</div>
            <div className="text-[10px] text-zinc-600 truncate font-mono">{asset.url}</div>
          </div>
        </div>
      )}

      {onDelete && (
        <Btn
          type="button"
          variant="danger"
          onClick={() => onDelete(asset)}
          className="px-2 py-1 text-[10px]"
          title="Delete saved entry"
        >
          Delete
        </Btn>
      )}
    </ConfigCard>
  )
}

function MediaSectionBlock({
  title,
  items,
  selectedUrl,
  onSelect,
  onDelete,
  emptyMessage,
}: {
  title: string
  items: MediaRecord[]
  selectedUrl?: string
  onSelect?: (asset: MediaRecord) => void
  onDelete?: (asset: MediaRecord) => void
  emptyMessage?: string
}) {
  if (items.length === 0) {
    if (!emptyMessage) return null
    return (
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">{title}</div>
        <ConfigNotice tone="info" className="py-4">{emptyMessage}</ConfigNotice>
      </div>
    )
  }
  const visibleItems = items.slice(0, MEDIA_RESULT_LIMIT)
  const remaining = items.length - visibleItems.length
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">{title}</div>
        <div className="text-[10px] text-zinc-600">{items.length} items</div>
      </div>
      <div className="space-y-1.5">
        {visibleItems.map((asset) => (
          <AssetRow key={asset.id} asset={asset} selected={selectedUrl === asset.url} onSelect={onSelect} onDelete={asset.source === 'saved' ? onDelete : undefined} />
        ))}
      </div>
      {remaining > 0 && <div className="text-[10px] text-zinc-600">Showing the first {visibleItems.length} matches. Refine the search to narrow the list.</div>}
    </div>
  )
}

export function AssetCatalogPanel({
  kinds = ['image', 'video', 'audio'],
  selectedUrl,
  onSelect,
  onDeleteSavedEntry,
  allowFilesystemDelete = false,
  savedEntries,
  emptyMessage = 'No matching assets found.',
  search,
  onSearchChange,
  kindFilter,
  onKindFilterChange,
  showControls = true,
}: {
  kinds?: MediaKind[]
  selectedUrl?: string
  onSelect?: (asset: MediaRecord) => void
  onDeleteSavedEntry?: (asset: MediaRecord) => Promise<void> | void
  allowFilesystemDelete?: boolean
  savedEntries?: MediaEntry[] | false
  emptyMessage?: string
  search?: string
  onSearchChange?: (value: string) => void
  kindFilter?: 'all' | MediaKind
  onKindFilterChange?: (value: 'all' | MediaKind) => void
  showControls?: boolean
}) {
  const fallbackSavedEntries = useAdminStore((store) => store.config.sourceMedia ?? [])
  const { assets, error, loading, refresh } = useMediaCatalog()
  const [internalSearch, setInternalSearch] = useState('')
  const [internalKindFilter, setInternalKindFilter] = useState<'all' | MediaKind>(kinds.length === 1 ? kinds[0] : 'all')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const effectiveSearch = search ?? internalSearch
  const effectiveKindFilter = kindFilter ?? internalKindFilter

  const setSearchValue = (value: string) => {
    if (onSearchChange) onSearchChange(value)
    else setInternalSearch(value)
  }

  const setKindFilterValue = (value: 'all' | MediaKind) => {
    if (onKindFilterChange) onKindFilterChange(value)
    else setInternalKindFilter(value)
  }

  const savedAssets = useMemo(() => {
    if (savedEntries === false) return []
    const entries = savedEntries ?? fallbackSavedEntries
    return entries.map(mediaEntryToRecord)
  }, [fallbackSavedEntries, savedEntries])

  const allowedKinds = new Set(kinds)
  const normalizedSearch = effectiveSearch.trim().toLowerCase()

  const matches = (asset: MediaRecord) => {
    if (!allowedKinds.has(asset.kind)) return false
    if (effectiveKindFilter !== 'all' && asset.kind !== effectiveKindFilter) return false
    if (!normalizedSearch) return true
    return getAssetSearchText(asset).includes(normalizedSearch)
  }

  const visibleSaved = useMemo(() => savedAssets.filter(matches), [savedAssets, effectiveKindFilter, normalizedSearch])
  const visibleProjectAssets = useMemo(() => assets.filter((asset) => asset.source === 'filesystem' && matches(asset)), [assets, effectiveKindFilter, normalizedSearch])
  const visibleGameAssets = useMemo(() => assets.filter((asset) => asset.source === 'games' && matches(asset)), [assets, effectiveKindFilter, normalizedSearch])

  const handleDelete = async (asset: MediaRecord) => {
    const actionLabel = asset.source === 'saved' ? 'delete this saved media entry' : 'delete this project asset file'
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${asset.name}? This will ${actionLabel}.`)) {
      return
    }

    setDeleteError(null)
    setDeletingId(asset.id)

    try {
      if (asset.source === 'saved') {
        await onDeleteSavedEntry?.(asset)
      } else if (asset.source === 'filesystem') {
        await deleteMediaFile(asset.url)
      }
      await refresh()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {showControls && (
        <ConfigToolbar className="flex-col items-stretch md:flex-row md:items-center">
          <input
            type="text"
            value={effectiveSearch}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search assets, folders, or game names..."
            className="flex-1 text-xs"
          />
          <Btn type="button" onClick={() => void refresh()} className="px-3 py-1.5 text-xs">
            Refresh
          </Btn>
        </ConfigToolbar>
      )}

      {showControls && kinds.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {(['all', ...kinds] as const).map((kind) => (
            <Btn
              key={kind}
              type="button"
              variant={effectiveKindFilter === kind ? 'active' : 'default'}
              onClick={() => setKindFilterValue(kind)}
              className="px-2.5 py-1 text-[10px] uppercase tracking-wide"
            >
              {kind}
            </Btn>
          ))}
        </div>
      )}

      {error && (
        <ConfigNotice tone="danger">{error}</ConfigNotice>
      )}

      {deleteError && (
        <ConfigNotice tone="danger">{deleteError}</ConfigNotice>
      )}

      {deletingId && (
        <ConfigNotice tone="info">Deleting asset...</ConfigNotice>
      )}

      {loading && !error && <ConfigNotice tone="info">Loading asset catalog...</ConfigNotice>}

      {!loading && !error && visibleSaved.length === 0 && visibleProjectAssets.length === 0 && visibleGameAssets.length === 0 && (
        <ConfigNotice tone="info" className="py-5">{emptyMessage}</ConfigNotice>
      )}

      {!loading && (
        <div className="space-y-4">
          <MediaSectionBlock
            title="Saved Media"
            items={visibleSaved}
            selectedUrl={selectedUrl}
            onSelect={onSelect}
            onDelete={onDeleteSavedEntry ? ((asset) => { void handleDelete(asset) }) : undefined}
          />
          <MediaSectionBlock
            title="Project Assets"
            items={visibleProjectAssets}
            selectedUrl={selectedUrl}
            onSelect={onSelect}
            onDelete={allowFilesystemDelete ? ((asset) => { void handleDelete(asset) }) : undefined}
          />
          <MediaSectionBlock
            title="Game Images"
            items={visibleGameAssets}
            selectedUrl={selectedUrl}
            onSelect={onSelect}
          />
        </div>
      )}
    </div>
  )
}

async function persistSavedMediaEntry({
  entry,
  existingEntries,
  saveConfig,
}: {
  entry: MediaEntry
  existingEntries: MediaEntry[]
  saveConfig: (updates: { sourceMedia: MediaEntry[] }) => Promise<void>
}) {
  if (existingEntries.some((candidate) => candidate.url === entry.url)) return
  await saveConfig({ sourceMedia: [...existingEntries, entry] })
}

export function AssetPickerModal({
  title,
  kinds,
  selectedUrl,
  onSelect,
  onClose,
}: {
  title: string
  kinds: MediaKind[]
  selectedUrl?: string
  onSelect: (asset: MediaRecord) => void
  onClose: () => void
}) {
  const mediaLibrary = useAdminStore((store) => store.config.sourceMedia ?? [])
  const saveConfig = useAdminStore((store) => store.saveConfig)
  const [manualValue, setManualValue] = useState(selectedUrl ?? '')
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)

  const handleCatalogSelect = (asset: MediaRecord) => {
    onSelect(asset)
    onClose()
  }

  const handleManualUse = () => {
    const trimmed = manualValue.trim()
    if (!trimmed) {
      setUploadError('Enter a URL or local /assets path first.')
      return
    }
    setUploadError('')
    handleCatalogSelect({
      id: `manual:${trimmed}`,
      name: getAssetNameFromUrl(trimmed),
      kind: inferMediaKindFromUrl(trimmed, kinds[0] ?? 'image'),
      url: trimmed,
      source: 'saved',
      folder: 'Manual Entry',
      relativePath: trimmed,
      ext: trimmed.includes('.') ? `.${trimmed.split('.').pop()?.split('?')[0] ?? ''}` : '',
    })
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploadError('')
    setUploading(true)
    try {
      const uploaded = await uploadMediaFile(file)
      if (!kinds.includes(uploaded.kind)) {
        throw new Error(`This field expects ${kinds.join(' / ')} assets.`)
      }

      const entry: MediaEntry = {
        id: `media-${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        type: uploaded.kind === 'video' ? 'video' : 'image',
        url: uploaded.url,
      }

      await persistSavedMediaEntry({ entry, existingEntries: mediaLibrary, saveConfig })

      handleCatalogSelect({
        ...mediaEntryToRecord(entry),
        source: 'saved',
      })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const uploadEnabled = kinds.some((kind) => kind === 'image' || kind === 'video')

  return (
    <FloatingWindowShell frameClassName="h-[85vh] max-h-[780px]" layerClassName="z-[70]">
        <FloatingWindowHeader icon="🗂" title={title} onClose={onClose} />

        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          <ConfigCard className="space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Quick Add</div>
            <div className="flex flex-col gap-2 md:flex-row">
              <input
                type="text"
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder="/assets/images/example.png or https://..."
                className="flex-1 text-xs font-mono"
              />
              <Btn type="button" variant="primary" onClick={handleManualUse} className="px-3 py-1.5 text-xs">
                Use URL
              </Btn>
            </div>

            {uploadEnabled && (
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:border-zinc-600/90 hover:bg-zinc-900/80">
                  <input type="file" className="hidden" accept={kinds.includes('video') ? 'image/*,video/*' : 'image/*'} onChange={handleUpload} />
                  {uploading ? 'Uploading...' : 'Upload File'}
                </label>
                <div className="text-[10px] text-zinc-600">Uploaded image and video files are added to Saved Media automatically.</div>
              </div>
            )}

            {uploadError && <ConfigNotice tone="danger">{uploadError}</ConfigNotice>}
          </ConfigCard>

          <AssetCatalogPanel kinds={kinds} selectedUrl={selectedUrl} onSelect={handleCatalogSelect} />
        </div>
    </FloatingWindowShell>
  )
}

export function MediaSelectionInput({
  value,
  onChange,
  kinds,
  modalTitle,
  placeholder,
  buttonLabel = 'Browse Library',
  hint,
  previewKind = 'auto',
  showPreview = true,
  inputClassName = '',
}: {
  value: string
  onChange: (value: string) => void
  kinds: MediaKind[]
  modalTitle: string
  placeholder?: string
  buttonLabel?: string
  hint?: string
  previewKind?: MediaKind | 'auto'
  showPreview?: boolean
  inputClassName?: string
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const resolvedPreviewKind = previewKind === 'auto' ? inferMediaKindFromUrl(value, kinds[0] ?? 'image') : previewKind
  const shouldShowPreview = showPreview && isLikelyMediaUrl(value) && resolvedPreviewKind !== 'audio'

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 md:flex-row">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`flex-1 text-xs font-mono ${inputClassName}`}
        />
        <div className="flex gap-2">
          <Btn type="button" onClick={() => setPickerOpen(true)} className="px-3 py-1.5 text-xs">
            {buttonLabel}
          </Btn>
          {value && (
            <Btn type="button" variant="ghost" onClick={() => onChange('')} className="px-3 py-1.5 text-xs">
              Clear
            </Btn>
          )}
        </div>
      </div>

      {hint && <div className="text-[10px] text-zinc-600">{hint}</div>}

      {shouldShowPreview && (
        <div className="relative aspect-video w-full overflow-hidden rounded border border-zinc-800 bg-zinc-950">
          {resolvedPreviewKind === 'image' ? (
            <img src={value} alt="Selected asset" className="h-full w-full object-contain" />
          ) : (
            <video src={value} className="h-full w-full object-contain" muted playsInline loop autoPlay />
          )}
        </div>
      )}

      {pickerOpen && (
        <AssetPickerModal
          title={modalTitle}
          kinds={kinds}
          selectedUrl={value}
          onSelect={(asset) => onChange(asset.url)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}