import { useEffect } from 'react'
import { EventsTabContent, EventsTabSidebar } from './EventsTab'
import { SourcesTabContent, SourcesTabSidebar } from './SourcesTab'
import { AvatarTabContent, AvatarTabSidebar } from './AvatarTab'
import { Button } from '../../components/atoms'
import { Card } from '../../components/molecules'
import { useMediaLibrary } from './MediaLibraryContext'
import type { MediaLibraryTab } from './MediaLibraryContext'
import { ConfigNotice } from '../../shared/ui'
import type { MediaRecord } from '../../shared/catalog'

// ── Library tab metadata ───────────────────────────────────────────

const LIBRARY_TABS: Array<{ tab: MediaLibraryTab; icon: string; label: string }> = [
  { tab: 'sources',     icon: '📺', label: 'Renderers' },
  { tab: 'events',      icon: '⚡', label: 'Events' },
  { tab: 'catalog',     icon: '🖼', label: 'Gallery' },
  { tab: 'avatar',      icon: '🙂', label: 'Avatar' },
]

// ── Search input ───────────────────────────────────────────────────

/** Uniform search bar used across all media library tab sidebars. */
export function MediaSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-sm"
    />
  )
}

// ── Catalog tab: thumbnail grid ─────────────────────────────────────
// The Gallery tab gets its own full-width grid layout (instead of the
// narrow list + big-detail-card pattern the other tabs use) so assets
// are visually scannable at a glance.

function CatalogThumb({ asset, selected, onSelect }: { asset: MediaRecord; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={asset.name}
      className={
        'group relative flex aspect-square flex-col overflow-hidden rounded-lg border transition-colors ' +
        (selected ? 'border-cyan-400/60 ring-1 ring-cyan-400/40' : 'border-zinc-800/70 hover:border-zinc-600')
      }
    >
      <div className="flex flex-1 items-center justify-center overflow-hidden bg-zinc-950">
        {asset.kind === 'image' && (
          <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" loading="lazy" />
        )}
        {asset.kind === 'video' && (
          <video src={asset.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
        )}
        {asset.kind === 'audio' && (
          <span
            role="button"
            tabIndex={0}
            title="Preview sound"
            onClick={(event) => {
              event.stopPropagation()
              const audio = new Audio(asset.url)
              audio.volume = 0.5
              audio.play().catch(() => {})
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.stopPropagation()
              const audio = new Audio(asset.url)
              audio.volume = 0.5
              audio.play().catch(() => {})
            }}
            className="text-2xl text-zinc-400 transition-colors hover:text-cyan-300"
          >
            ▶
          </span>
        )}
      </div>
      <div className="truncate bg-black/60 px-1.5 py-1 text-left text-[10px] text-zinc-300">{asset.name}</div>
    </button>
  )
}

function CatalogGridView() {
  const {
    catalogSearch, setCatalogSearch,
    catalogKindFilter, setCatalogKindFilter,
    catalogFolderGroups, catalogLoading, catalogError,
    selectedCatalogAsset, setSelectedCatalogAssetId,
    refreshCatalog, handleDeleteCatalogAsset,
  } = useMediaLibrary()

  const allAssets = catalogFolderGroups.flatMap((group) => group.items)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <MediaSearchInput value={catalogSearch} onChange={setCatalogSearch} placeholder="Search assets…" />
        </div>
        <div className="flex flex-wrap gap-1">
          {(['all', 'image', 'video', 'audio'] as const).map((kind) => (
            <Button
              key={kind}
              type="button"
              variant={catalogKindFilter === kind ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setCatalogKindFilter(kind)}
              className="px-2 py-0.5 text-[10px] uppercase tracking-wide"
            >
              {kind}
            </Button>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => void refreshCatalog()}>Refresh</Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {catalogError && <div className="px-1 pb-2 text-[10px] text-red-400">{catalogError}</div>}
        {catalogLoading && <div className="px-1 text-[10px] text-zinc-500">Loading…</div>}
        {!catalogLoading && allAssets.length === 0 && (
          <ConfigNotice tone="info" className="py-8 text-center">No assets match this filter.</ConfigNotice>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
          {allAssets.map((asset) => (
            <CatalogThumb
              key={asset.id}
              asset={asset}
              selected={selectedCatalogAsset?.id === asset.id}
              onSelect={() => setSelectedCatalogAssetId(selectedCatalogAsset?.id === asset.id ? null : asset.id)}
            />
          ))}
        </div>
      </div>

      {selectedCatalogAsset && (
        <Card variant="elevated" padding="sm" className="flex shrink-0 flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{selectedCatalogAsset.name}</div>
            <div className="truncate text-[10px] text-[var(--color-text-muted)]">
              {selectedCatalogAsset.folder} · {selectedCatalogAsset.kind} · {selectedCatalogAsset.source}
            </div>
          </div>
          {selectedCatalogAsset.kind === 'audio' && (
            <audio src={selectedCatalogAsset.url} controls className="h-8 max-w-[220px]" preload="metadata" />
          )}
          {(selectedCatalogAsset.source === 'saved' || selectedCatalogAsset.source === 'filesystem') && (
            <Button type="button" variant="danger" size="sm" onClick={() => { void handleDeleteCatalogAsset(selectedCatalogAsset) }}>
              Delete
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedCatalogAssetId(null)}>✕</Button>
        </Card>
      )}
    </div>
  )
}

// ── Sidebar dispatcher ─────────────────────────────────────────────

function MediaLibrarySidebar() {
  const { tab, eventSearch, setEventSearch, filteredEventDefs, selectedEventId, selectEvent,
    sourceSearch, setSourceSearch, filteredSourcePresets, selectedSourcePresetId,
    setSelectedSourcePresetId, usageCountByPreset,
    avatarSearch, setAvatarSearch, filteredAvatarPresets, selectedAvatarPresetId, setSelectedAvatarPresetId } = useMediaLibrary()

  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
      {tab === 'events'      && (
        <EventsTabSidebar
          eventSearch={eventSearch}
          onEventSearchChange={setEventSearch}
          filteredEventDefs={filteredEventDefs}
          selectedEventId={selectedEventId}
          onSelectEvent={selectEvent}
        />
      )}
      {tab === 'sources'     && (
        <SourcesTabSidebar
          sourceSearch={sourceSearch}
          onSourceSearchChange={setSourceSearch}
          filteredSourcePresets={filteredSourcePresets}
          selectedSourcePresetId={selectedSourcePresetId}
          selectedUsageCountByPreset={usageCountByPreset}
          onSelectSourcePreset={setSelectedSourcePresetId}
        />
      )}
      {tab === 'avatar'      && (
        <AvatarTabSidebar
          avatarSearch={avatarSearch}
          onAvatarSearchChange={setAvatarSearch}
          filteredAvatarPresets={filteredAvatarPresets}
          selectedAvatarPresetId={selectedAvatarPresetId}
          onSelectAvatarPreset={setSelectedAvatarPresetId}
        />
      )}
    </div>
  )
}

// ── Content area ───────────────────────────────────────────────────

export function MediaLibraryContent() {
  const {
    tab,
    editingEvent, eventDraftOriginalId, createEventDraft, patchEventDraft,
    saveEventDraft, deleteEventDraft, handleTriggerEvent,
    editingSourcePreset, selectedSourceMeta, sourcePresetOriginalId, sourceDraftCreatesNewPreset,
    createSourcePresetDraft, patchSourcePresetDraft,
    saveSourcePresetDraft, deleteSourcePresetDraft,
    editingAvatarPreset, avatarPresetOriginalId,
    createAvatarPresetDraft, patchAvatarPresetDraft, saveAvatarPresetDraft, deleteAvatarPresetDraft,
  } = useMediaLibrary()

  return (
    <div className="min-w-0 min-h-0 overflow-y-auto pr-1">

      {/* ── Events ── */}
      {tab === 'events' && (
        <EventsTabContent
          createEventDraft={createEventDraft}
          editingEvent={editingEvent}
          eventDraftOriginalId={eventDraftOriginalId}
          patchEventDraft={patchEventDraft}
          saveEventDraft={saveEventDraft}
          deleteEventDraft={deleteEventDraft}
          onTriggerEvent={handleTriggerEvent}
        />
      )}

      {/* ── Sources ── */}
      {tab === 'sources' && (
        <SourcesTabContent
          editingSourcePreset={editingSourcePreset}
          selectedSourceMeta={selectedSourceMeta}
          sourcePresetOriginalId={sourcePresetOriginalId}
          sourceDraftCreatesNewPreset={sourceDraftCreatesNewPreset}
          createSourcePresetDraft={createSourcePresetDraft}
          patchSourcePresetDraft={patchSourcePresetDraft}
          saveSourcePresetDraft={saveSourcePresetDraft}
          deleteSourcePresetDraft={deleteSourcePresetDraft}
        />
      )}

      {/* ── Avatar ── */}
      {tab === 'avatar' && (
        <AvatarTabContent
          editingAvatarPreset={editingAvatarPreset}
          avatarPresetOriginalId={avatarPresetOriginalId}
          createAvatarPresetDraft={createAvatarPresetDraft}
          patchAvatarPresetDraft={patchAvatarPresetDraft}
          saveAvatarPresetDraft={saveAvatarPresetDraft}
          deleteAvatarPresetDraft={deleteAvatarPresetDraft}
        />
      )}

    </div>
  )
}

// ── Panel (no self-wrapping provider — caller must supply MediaLibraryProvider) ──

function MediaLibraryPanelInner({ tab, onTabChange }: { tab: MediaLibraryTab; onTabChange?: (tab: MediaLibraryTab) => void }) {
  const { tab: activeTab, setTab } = useMediaLibrary()
  useEffect(() => { setTab(tab) }, [tab, setTab])

  const handleTabClick = (t: MediaLibraryTab) => {
    setTab(t)
    onTabChange?.(t)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center border-b border-[var(--color-border-default)]">
        {LIBRARY_TABS.map(({ tab: t, icon, label }) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTabClick(t)}
            className={
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-2 text-xs font-medium transition-colors ' +
              (activeTab === t
                ? 'border-cyan-400 text-zinc-50'
                : 'border-transparent text-zinc-500 hover:text-zinc-200')
            }
          >
            <span className="text-sm leading-none">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
      {activeTab === 'catalog' ? (
        <div className="flex-1 min-h-0 pt-4">
          <CatalogGridView />
        </div>
      ) : (
        <div className="grid flex-1 min-h-0 gap-5 grid-cols-[220px_minmax(0,1fr)] pt-4">
          <MediaLibrarySidebar />
          <MediaLibraryContent />
        </div>
      )}
    </div>
  )
}

export function MediaLibraryPanel({ tab = 'sources', onTabChange }: { tab?: MediaLibraryTab; onTabChange?: (tab: MediaLibraryTab) => void }) {
  return <MediaLibraryPanelInner tab={tab} onTabChange={onTabChange} />
}
