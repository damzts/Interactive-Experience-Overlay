import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { EventsTabContent, EventsTabSidebar } from './EventsTab'
import { SourcesTabContent, SourcesTabSidebar } from './SourcesTab'
import { TRANSITION_ICONS, getMediaTransitionLabel } from '../../shared/transitionLibrary'
import { Button } from '../../components/atoms'
import { Card } from '../../components/molecules'
import { ConfigPanel } from '../../components/organisms'
import { AssetSelectionInput } from './AssetLibrary'
import { socket } from '../../socket/client'
import { encodeMediaTransitionValue, strToStep } from '../../shared/transitionLibrary'
import { useAssetLibrary, AssetLibraryProvider } from './AssetLibraryContext'
import type { AssetLibraryTab } from './AssetLibraryContext'
import { SidebarBtn, SectionLabel, AssetSection } from '../dashboard/NavListBox'

/** Notice component for informational/warning messages within config panels */
function Notice({ tone = 'info', children, className = '' }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: ReactNode; className?: string }) {
  const toneStyles: Record<string, string> = {
    info: 'border-[var(--color-primary-400)]/25 bg-[var(--color-primary-500)]/10 text-[var(--color-primary-100)]',
    warning: 'border-[var(--color-accent-400)]/30 bg-[var(--color-accent-500)]/12 text-[var(--color-accent-100)]',
    danger: 'border-[var(--color-danger-400)]/30 bg-[var(--color-danger-500)]/12 text-[var(--color-danger-400)]',
    success: 'border-[var(--color-success-400)]/30 bg-[var(--color-success-500)]/12 text-[var(--color-success-400)]',
  }
  return (
    <div className={`rounded-[var(--radius-lg)] border px-3 py-2.5 text-sm shadow-[var(--shadow-sm)] backdrop-blur ${toneStyles[tone]} ${className}`.trim()}>
      {children}
    </div>
  )
}

/** Right column: main content area for the selected tab */
export function AssetLibraryContent() {
  const {
    tab,
    selectedCatalogAsset, refreshCatalog, handleDeleteCatalogAsset,
    filteredEventPresets, editingEvent, eventDraftOriginalId, createEventDraft, patchEventDraft, saveEventDraft, deleteEventDraft, handleTriggerEvent,
    editingSourcePreset, selectedSourceMeta, sourcePresetOriginalId, sourceDraftCreatesNewPreset, selectedSourceUsageCount,
    createSourcePresetDraft, patchSourcePresetDraft, saveSourcePresetDraft, deleteSourcePresetDraft,
    selectedTransition, handleDeleteMediaEntry,
    name, setName, url, setUrl, durStr, setDurStr, pendingTransitionKind, resetForm, handleSave,
  } = useAssetLibrary()

  return (
    <div className="min-w-0 min-h-0 overflow-y-auto pr-1">
      {tab === 'catalog' && (
        <div className="space-y-4">
          {selectedCatalogAsset ? (
            <Card variant="elevated" padding="lg" className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-[var(--color-text-primary)]">{selectedCatalogAsset.name}</div>
                  <div className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">{selectedCatalogAsset.relativePath || selectedCatalogAsset.url}</div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => void refreshCatalog()}>Refresh</Button>
                  {(selectedCatalogAsset.source === 'saved' || selectedCatalogAsset.source === 'filesystem') && (
                    <Button type="button" variant="danger" size="sm" onClick={() => { void handleDeleteCatalogAsset(selectedCatalogAsset) }}>Delete</Button>
                  )}
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_320px]">
                <div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)]/70 p-4">
                  {selectedCatalogAsset.kind === 'image' && <img src={selectedCatalogAsset.url} alt={selectedCatalogAsset.name} className="max-h-[70vh] w-full object-contain" />}
                  {selectedCatalogAsset.kind === 'video' && <video src={selectedCatalogAsset.url} className="max-h-[70vh] w-full rounded-xl bg-black object-contain" controls muted playsInline preload="metadata" />}
                  {selectedCatalogAsset.kind === 'audio' && (
                    <div className="w-full max-w-xl space-y-5 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)]/70 p-6 text-center">
                      <div className="text-5xl">🎵</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">Audio preview</div>
                      <audio src={selectedCatalogAsset.url} controls className="w-full" preload="metadata" />
                    </div>
                  )}
                </div>
                <Card variant="default" padding="md" className="space-y-3">
                  <div><div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Folder</div><div className="mt-1 text-sm text-[var(--color-text-primary)]">{selectedCatalogAsset.folder}</div></div>
                  <div><div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Source</div><div className="mt-1 text-sm text-[var(--color-text-primary)]">{selectedCatalogAsset.source}</div></div>
                  <div><div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Kind</div><div className="mt-1 text-sm text-[var(--color-text-primary)]">{selectedCatalogAsset.kind}</div></div>
                  <div><div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">URL</div><div className="mt-1 break-all font-mono text-xs text-[var(--color-text-secondary)]">{selectedCatalogAsset.url}</div></div>
                </Card>
              </div>
            </Card>
          ) : (
            <Notice tone="info" className="py-8 text-center">Select an asset from the left column to preview it.</Notice>
          )}
        </div>
      )}

      {tab === 'events' && (
        <EventsTabContent
          filteredEventPresets={filteredEventPresets}
          createEventDraft={createEventDraft}
          editingEvent={editingEvent}
          eventDraftOriginalId={eventDraftOriginalId}
          patchEventDraft={patchEventDraft}
          saveEventDraft={saveEventDraft}
          deleteEventDraft={deleteEventDraft}
          onTriggerEvent={handleTriggerEvent}
        />
      )}

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

      {tab === 'transitions' && (
        <div className="space-y-4 pt-0.5">
          {selectedTransition ? (
            <Card variant="elevated" padding="lg" className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {selectedTransition.kind === 'system' ? selectedTransition.entry.label : getMediaTransitionLabel(selectedTransition.entry)}
                  </div>
                  <div className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">
                    {selectedTransition.kind === 'system' ? selectedTransition.entry.id : selectedTransition.entry.url}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" size="md" onClick={() => selectedTransition.kind === 'system'
                    ? socket.emit('transition:preview', [{ id: selectedTransition.entry.id }])
                    : socket.emit('transition:preview', [strToStep(encodeMediaTransitionValue(selectedTransition.entry))])}>
                    Test Transition
                  </Button>
                  {selectedTransition.kind === 'user' && (
                    <Button type="button" variant="danger" size="md" onClick={() => { void handleDeleteMediaEntry(selectedTransition.entry.id) }}>Delete</Button>
                  )}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Card variant="default" padding="sm" className="text-left"><div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Type</div><div className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{selectedTransition.kind === 'system' ? 'System' : selectedTransition.entry.type}</div></Card>
                <Card variant="default" padding="sm" className="text-left"><div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Origin</div><div className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{selectedTransition.kind === 'system' ? 'Built-in transition' : 'Saved media entry'}</div></Card>
                <Card variant="default" padding="sm" className="text-left"><div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Duration</div><div className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{selectedTransition.kind === 'user' && selectedTransition.entry.duration != null ? `${selectedTransition.entry.duration}s` : 'Default'}</div></Card>
              </div>
            </Card>
          ) : (
            <Notice tone="info" className="py-6 text-center">Select a transition from the left column.</Notice>
          )}

          <ConfigPanel title="Create User Transition">
            <div className="space-y-3">
              <Notice>Save an image or video as a reusable user transition.</Notice>
              <Card variant="default" padding="md" className="space-y-3">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className="w-full text-sm" />
                <AssetSelectionInput value={url} onChange={setUrl} kinds={['image', 'video']} modalTitle="User Transition Asset" placeholder="/assets/images/transition.png or /assets/video/transition.mp4" buttonLabel="Choose Asset" previewKind="auto" showPreview={false} />
                {url && pendingTransitionKind === 'image' && (
                  <div className="flex items-center gap-2">
                    <input type="number" min={0.1} max={120} step={0.5} value={durStr} onChange={(e) => setDurStr(e.target.value)} placeholder="4.0" className="w-28 text-sm font-mono" />
                    <span className="text-xs text-[var(--color-text-muted)]">sec display duration</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="primary" size="md" onClick={() => void handleSave()} disabled={!url} fullWidth>Save Transition</Button>
                  {(name || url || durStr) && <Button type="button" variant="ghost" size="md" onClick={resetForm}>Reset</Button>}
                </div>
              </Card>
            </div>
          </ConfigPanel>
        </div>
      )}
    </div>
  )
}

/** Sidebar for the asset library — driven by the active tab */
function AssetLibrarySidebar() {
  const {
    tab,
    catalogSearch, setCatalogSearch, catalogKindFilter, setCatalogKindFilter,
    catalogFolderGroups, catalogLoading, catalogError, selectedCatalogAsset, setSelectedCatalogAssetId,
    eventSearch, setEventSearch, filteredEventDefs, selectedEventId, selectEvent,
    sourceSearch, setSourceSearch, filteredSourcePresets, selectedSourcePresetId, setSelectedSourcePresetId, usageCountByPreset,
    transitionSearch, setTransitionSearch, filteredSystemTransitions, filteredTransitionLibrary, selectedTransition, setSelectedTransitionKey,
  } = useAssetLibrary()

  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
      {tab === 'catalog' && (
        <>
          <input type="text" value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} placeholder="Search assets…" className="w-full text-xs" />
          <div className="flex flex-wrap gap-1">
            {(['all', 'image', 'video', 'audio'] as const).map((kind) => (
              <Button key={kind} type="button" variant={catalogKindFilter === kind ? 'secondary' : 'ghost'} size="sm" onClick={() => setCatalogKindFilter(kind)} className="px-2 py-0.5 text-[10px] uppercase tracking-wide">{kind}</Button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {catalogError && <div className="text-[10px] text-red-400 px-1">{catalogError}</div>}
            {catalogLoading && <div className="text-[10px] text-zinc-500 px-1">Loading…</div>}
            {!catalogLoading && catalogFolderGroups.length === 0 && <div className="text-[10px] text-zinc-600 px-1">No assets match this filter.</div>}
            {catalogFolderGroups.map((group) => (
              <AssetSection key={group.folder} title={group.folder} items={group.items} selectedId={selectedCatalogAsset?.id} onSelect={(asset) => setSelectedCatalogAssetId(asset.id)} />
            ))}
          </div>
        </>
      )}
      {tab === 'events' && (
        <EventsTabSidebar
          eventSearch={eventSearch}
          onEventSearchChange={setEventSearch}
          filteredEventDefs={filteredEventDefs}
          selectedEventId={selectedEventId}
          onSelectEvent={selectEvent}
        />
      )}
      {tab === 'sources' && (
        <SourcesTabSidebar
          sourceSearch={sourceSearch}
          onSourceSearchChange={setSourceSearch}
          filteredSourcePresets={filteredSourcePresets}
          selectedSourcePresetId={selectedSourcePresetId}
          selectedUsageCountByPreset={usageCountByPreset}
          onSelectSourcePreset={setSelectedSourcePresetId}
        />
      )}
      {tab === 'transitions' && (
        <>
          <input type="text" value={transitionSearch} onChange={(e) => setTransitionSearch(e.target.value)} placeholder="Search transitions…" className="w-full text-xs" />
          <div className="flex gap-2">
            <Card variant="default" padding="sm" className="flex-1 text-left">
              <div className="text-[9px] uppercase tracking-wider text-zinc-600">System</div>
              <div className="text-sm font-semibold text-zinc-200">{filteredSystemTransitions.length}</div>
            </Card>
            <Card variant="default" padding="sm" className="flex-1 text-left">
              <div className="text-[9px] uppercase tracking-wider text-zinc-600">Saved</div>
              <div className="text-sm font-semibold text-zinc-200">{filteredTransitionLibrary.length}</div>
            </Card>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SectionLabel first>System</SectionLabel>
            {filteredSystemTransitions.map((t) => (
              <SidebarBtn key={t.id} icon={TRANSITION_ICONS[t.id] ?? '✨'} label={t.label}
                active={selectedTransition?.kind === 'system' && selectedTransition.entry.id === t.id}
                onClick={() => setSelectedTransitionKey(`system:${t.id}`)} />
            ))}
            <SectionLabel>Saved</SectionLabel>
            {filteredTransitionLibrary.map((t) => (
              <SidebarBtn key={t.id} icon="✨" label={getMediaTransitionLabel(t)}
                active={selectedTransition?.kind === 'user' && selectedTransition.entry.id === t.id}
                onClick={() => setSelectedTransitionKey(`user:${t.id}`)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Inner panel — requires AssetLibraryProvider above it */
function AssetLibraryPanelInner({ tab }: { tab: AssetLibraryTab }) {
  const { setTab } = useAssetLibrary()
  useEffect(() => { setTab(tab) }, [tab, setTab])

  return (
    <div className="grid h-full min-h-0 gap-5 grid-cols-[220px_minmax(0,1fr)]">
      <AssetLibrarySidebar />
      <AssetLibraryContent />
    </div>
  )
}

/** Standalone panel — wraps its own AssetLibraryProvider */
export function AssetLibraryPanel({ tab = 'catalog' }: { tab?: AssetLibraryTab }) {
  return (
    <AssetLibraryProvider>
      <AssetLibraryPanelInner tab={tab} />
    </AssetLibraryProvider>
  )
}
