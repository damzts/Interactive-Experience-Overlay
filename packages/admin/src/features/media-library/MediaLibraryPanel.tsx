import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { EventsTabContent, EventsTabSidebar } from './EventsTab'
import { SourcesTabContent, SourcesTabSidebar } from './SourcesTab'
import { TRANSITION_ICONS, getMediaTransitionLabel } from '../../shared/transitionLibrary'
import { Button } from '../../components/atoms'
import { Card } from '../../components/molecules'
import { ConfigPanel } from '../../components/organisms'
import { MediaSelectionInput } from './MediaLibrary'
import { socket } from '../../socket/client'
import { encodeMediaTransitionValue, strToStep } from '../../shared/transitionLibrary'
import { useMediaLibrary } from './MediaLibraryContext'
import type { MediaLibraryTab } from './MediaLibraryContext'
import { SidebarBtn, SectionLabel } from '../dashboard/NavListBox'
import { ConfigNotice } from '../../shared/ui'
import type { MediaRecord } from '../../shared/catalog'

// ── Library tab metadata ───────────────────────────────────────────

const LIBRARY_TABS: Array<{ tab: MediaLibraryTab; icon: string; label: string }> = [
  { tab: 'catalog',     icon: '🖼', label: 'Gallery' },
  { tab: 'events',      icon: '⚡', label: 'Effects' },
  { tab: 'sources',     icon: '📺', label: 'Renders' },
  { tab: 'transitions', icon: '✨', label: 'Transitions' },
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

// ── Transitions tab sidebar ────────────────────────────────────────

function TransitionsTabSidebar() {
  const {
    transitionSearch, setTransitionSearch,
    filteredSystemTransitions, filteredTransitionLibrary,
    selectedTransition, setSelectedTransitionKey,
  } = useMediaLibrary()

  return (
    <>
      <MediaSearchInput value={transitionSearch} onChange={setTransitionSearch} placeholder="Search transitions…" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SectionLabel first>System</SectionLabel>
        {filteredSystemTransitions.map((t) => (
          <SidebarBtn
            key={t.id}
            icon={TRANSITION_ICONS[t.id] ?? '✨'}
            label={t.label}
            active={selectedTransition?.kind === 'system' && selectedTransition.entry.id === t.id}
            onClick={() => setSelectedTransitionKey(`system:${t.id}`)}
          />
        ))}
        <SectionLabel>Saved</SectionLabel>
        {filteredTransitionLibrary.length === 0 && (
          <div className="px-2.5 text-[10px] text-zinc-600">No saved transitions yet.</div>
        )}
        {filteredTransitionLibrary.map((t) => (
          <SidebarBtn
            key={t.id}
            icon="✨"
            label={getMediaTransitionLabel(t)}
            active={selectedTransition?.kind === 'user' && selectedTransition.entry.id === t.id}
            onClick={() => setSelectedTransitionKey(`user:${t.id}`)}
          />
        ))}
      </div>
    </>
  )
}

// ── Sidebar dispatcher ─────────────────────────────────────────────

function MediaLibrarySidebar() {
  const { tab, eventSearch, setEventSearch, filteredEventDefs, selectedEventId, selectEvent,
    sourceSearch, setSourceSearch, filteredSourcePresets, selectedSourcePresetId,
    setSelectedSourcePresetId, usageCountByPreset } = useMediaLibrary()

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
      {tab === 'transitions' && <TransitionsTabSidebar />}
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
    selectedSourceUsageCount, createSourcePresetDraft, patchSourcePresetDraft,
    saveSourcePresetDraft, deleteSourcePresetDraft,
    selectedTransition, handleDeleteMediaEntry,
    name, setName, url, setUrl, durStr, setDurStr, pendingTransitionKind, resetForm, handleSave,
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
          selectedSourceUsageCount={selectedSourceUsageCount}
          createSourcePresetDraft={createSourcePresetDraft}
          patchSourcePresetDraft={patchSourcePresetDraft}
          saveSourcePresetDraft={saveSourcePresetDraft}
          deleteSourcePresetDraft={deleteSourcePresetDraft}
        />
      )}

      {/* ── Transitions ── */}
      {tab === 'transitions' && (
        <div className="space-y-4 pt-0.5">
          {selectedTransition ? (
            <Card variant="elevated" padding="lg" className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {selectedTransition.kind === 'system'
                      ? selectedTransition.entry.label
                      : getMediaTransitionLabel(selectedTransition.entry)}
                  </div>
                  <div className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">
                    {selectedTransition.kind === 'system' ? selectedTransition.entry.id : selectedTransition.entry.url}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() =>
                      selectedTransition.kind === 'system'
                        ? socket.emit('transition:preview', [{ id: selectedTransition.entry.id }])
                        : socket.emit('transition:preview', [strToStep(encodeMediaTransitionValue(selectedTransition.entry))])
                    }
                  >
                    Test Transition
                  </Button>
                  {selectedTransition.kind === 'user' && (
                    <Button type="button" variant="danger" size="md" onClick={() => { void handleDeleteMediaEntry(selectedTransition.entry.id) }}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Card variant="default" padding="sm" className="text-left">
                  <MetaRow label="Type">{selectedTransition.kind === 'system' ? 'System' : selectedTransition.entry.type}</MetaRow>
                </Card>
                <Card variant="default" padding="sm" className="text-left">
                  <MetaRow label="Origin">{selectedTransition.kind === 'system' ? 'Built-in transition' : 'Saved media entry'}</MetaRow>
                </Card>
                <Card variant="default" padding="sm" className="text-left">
                  <MetaRow label="Duration">
                    {selectedTransition.kind === 'user' && selectedTransition.entry.duration != null
                      ? `${selectedTransition.entry.duration}s`
                      : 'Default'}
                  </MetaRow>
                </Card>
              </div>
            </Card>
          ) : (
            <ConfigNotice tone="info" className="py-6 text-center">Select a transition from the left column.</ConfigNotice>
          )}

          <ConfigPanel title="Create User Transition">
            <div className="space-y-3">
              <ConfigNotice>Save an image or video as a reusable user transition.</ConfigNotice>
              <Card variant="default" padding="md" className="space-y-3">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className="w-full text-sm" />
                <MediaSelectionInput
                  value={url}
                  onChange={setUrl}
                  kinds={['image', 'video']}
                  modalTitle="User Transition Asset"
                  placeholder="/assets/images/transition.png or /assets/video/transition.mp4"
                  buttonLabel="Choose Asset"
                  previewKind="auto"
                  showPreview={false}
                />
                {url && pendingTransitionKind === 'image' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0.1} max={120} step={0.5}
                      value={durStr}
                      onChange={(e) => setDurStr(e.target.value)}
                      placeholder="4.0"
                      className="w-28 font-mono text-sm"
                    />
                    <span className="text-xs text-[var(--color-text-muted)]">sec display duration</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="primary" size="md" onClick={() => void handleSave()} disabled={!url} fullWidth>
                    Save Transition
                  </Button>
                  {(name || url || durStr) && (
                    <Button type="button" variant="ghost" size="md" onClick={resetForm}>Reset</Button>
                  )}
                </div>
              </Card>
            </div>
          </ConfigPanel>
        </div>
      )}
    </div>
  )
}

// ── Shared mini helper ─────────────────────────────────────────────

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-1 text-sm text-[var(--color-text-primary)]">{children}</div>
    </div>
  )
}

// ── Panel (no self-wrapping provider — caller must supply MediaLibraryProvider) ──

function MediaLibraryPanelInner({ tab }: { tab: MediaLibraryTab }) {
  const { tab: activeTab, setTab } = useMediaLibrary()
  useEffect(() => { setTab(tab) }, [tab, setTab])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center border-b border-[var(--color-border-default)]">
        {LIBRARY_TABS.map(({ tab: t, icon, label }) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
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

export function MediaLibraryPanel({ tab = 'catalog' }: { tab?: MediaLibraryTab }) {
  return <MediaLibraryPanelInner tab={tab} />
}
