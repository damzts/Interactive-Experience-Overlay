import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_EVENT_DEFS, EVENT_PRESET_OPTIONS, createEventPreset, type EventDef, type EventPresetId } from './eventPresets'
import { EventsTabContent, EventsTabSidebar } from './EventsTab'
import { SourcesTabContent, SourcesTabSidebar } from './SourcesTab'
import { deleteAssetFile, inferAssetKindFromUrl, mediaEntryToAsset, useAssetCatalog, type AssetKind, type AssetRecord } from '../../shared/catalog'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { Button } from '../../components/atoms'
import { Card } from '../../components/molecules'
import { ConfigPanel } from '../../components/organisms'
import { AssetSelectionInput } from './AssetLibrary'
import { AssetLibraryModal } from './AssetLibraryModal'
import { SOURCE_CATALOG, findSourceCatalogEntry, getSafeSceneSources } from '../../shared/sourceCatalog'
import { TRANSITION_ICONS, TRANSITION_OPTIONS, encodeMediaTransitionValue, getMediaTransitionLabel, strToStep } from '../../shared/transitionLibrary'
import { withDesktopConfigDefaults } from '@ieom/shared'
import type { MediaEntry, SourcePreset } from '@ieom/shared'

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

export function AssetLibraryPanel({ isOpen, onHide, onClose }: { isOpen: boolean; onHide: () => void; onClose: () => void }) {
  const config = useAdminStore((state) => state.config)
  const mediaLibrary = useAdminStore((state) => state.config.mediaLibrary ?? [])
  const eventDefs = useAdminStore((state) => (state.config.events ?? DEFAULT_EVENT_DEFS) as EventDef[])
  const widgetIds = useAdminStore((state) => state.config.applications.filter((app) => app.appType === 'widget').map((app) => app.id))
  const widgetLayouts = useAdminStore((state) => withDesktopConfigDefaults(state.config.desktopConfig).widgetLayouts ?? [])
  const saveConfig = useAdminStore((state) => state.saveConfig)
  const { assets: catalogAssets, loading: catalogLoading, error: catalogError, refresh: refreshCatalog } = useAssetCatalog()

  const [tab, setTab] = useState<'catalog' | 'events' | 'sources' | 'transitions'>('catalog')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [durStr, setDurStr] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogKindFilter, setCatalogKindFilter] = useState<'all' | AssetKind>('all')
  const [selectedCatalogAssetId, setSelectedCatalogAssetId] = useState<string | null>(null)
  const [eventSearch, setEventSearch] = useState('')
  const [eventDraft, setEventDraft] = useState<{
    event: EventDef
    originalId: string | null
  } | null>(null)
  const [sourceSearch, setSourceSearch] = useState('')
  const [selectedSourcePresetId, setSelectedSourcePresetId] = useState<string | null>((useAdminStore.getState().config.sourcePresets ?? [])[0]?.id ?? null)
  const [sourcePresetDraft, setSourcePresetDraft] = useState<{
    preset: SourcePreset
    originalId: string | null
    originalLabel: string | null
  } | null>(null)
  const [transitionSearch, setTransitionSearch] = useState('')
  const [selectedTransitionKey, setSelectedTransitionKey] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const sourcePresets = config.sourcePresets ?? []
  const resetForm = () => {
    setName('')
    setUrl('')
    setDurStr('')
  }
  const editingEvent = eventDraft?.event ?? null
  const filteredEventDefs = useMemo(() => {
    const query = eventSearch.trim().toLowerCase()
    if (!query) return eventDefs
    return eventDefs.filter((def) => [def.label, def.desc, def.id].some((value) => value.toLowerCase().includes(query)))
  }, [eventDefs, eventSearch])
  const filteredEventPresets = useMemo(() => {
    const query = eventSearch.trim().toLowerCase()
    return EVENT_PRESET_OPTIONS.filter((preset) => preset.id !== 'blank' && (!query || [preset.label, preset.description, preset.id].some((value) => value.toLowerCase().includes(query))))
  }, [eventSearch])
  const catalogSavedAssets = useMemo(() => mediaLibrary.map(mediaEntryToAsset), [mediaLibrary])
  const filteredCatalogAssets = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase()
    const matchesQuery = (asset: AssetRecord) => {
      if (catalogKindFilter !== 'all' && asset.kind !== catalogKindFilter) return false
      if (!query) return true
      return [asset.name, asset.url, asset.folder, asset.relativePath, asset.game ?? ''].some((value) => value.toLowerCase().includes(query))
    }
    return [...catalogSavedAssets, ...catalogAssets].filter(matchesQuery)
  }, [catalogAssets, catalogKindFilter, catalogSavedAssets, catalogSearch])
  const catalogFolderGroups = useMemo(() => {
    const groups = new Map<string, AssetRecord[]>()
    for (const asset of filteredCatalogAssets) {
      const prefix = asset.source === 'saved' ? 'Saved Media' : asset.source === 'games' ? `Game Images${asset.game ? ` / ${asset.game}` : ''}` : `Project Assets / ${asset.folder}`
      const list = groups.get(prefix)
      if (list) list.push(asset)
      else groups.set(prefix, [asset])
    }
    return Array.from(groups.entries())
      .map(([folder, items]) => ({ folder, items: [...items].sort((left, right) => left.name.localeCompare(right.name)) }))
      .sort((left, right) => left.folder.localeCompare(right.folder))
  }, [filteredCatalogAssets])
  const sortedTransitionLibrary = useMemo(() => (
    [...mediaLibrary].sort((left, right) => getMediaTransitionLabel(left).localeCompare(getMediaTransitionLabel(right)))
  ), [mediaLibrary])
  const filteredSystemTransitions = useMemo(() => {
    const query = transitionSearch.trim().toLowerCase()
    if (!query) return TRANSITION_OPTIONS
    return TRANSITION_OPTIONS.filter((transition) => [transition.id, transition.label].some((value) => value.toLowerCase().includes(query)))
  }, [transitionSearch])
  const filteredTransitionLibrary = useMemo(() => {
    const query = transitionSearch.trim().toLowerCase()
    if (!query) return sortedTransitionLibrary
    return sortedTransitionLibrary.filter((entry) => [entry.name, entry.url, entry.id, getMediaTransitionLabel(entry)].some((value) => value.toLowerCase().includes(query)))
  }, [sortedTransitionLibrary, transitionSearch])
  const selectedCatalogAsset = useMemo(() => (
    filteredCatalogAssets.find((asset) => asset.id === selectedCatalogAssetId)
    ?? filteredCatalogAssets[0]
    ?? null
  ), [filteredCatalogAssets, selectedCatalogAssetId])
  const selectedTransition = useMemo(() => {
    if (!selectedTransitionKey) return filteredSystemTransitions[0] ? { kind: 'system' as const, entry: filteredSystemTransitions[0] } : filteredTransitionLibrary[0] ? { kind: 'user' as const, entry: filteredTransitionLibrary[0] } : null
    if (selectedTransitionKey.startsWith('system:')) {
      const id = selectedTransitionKey.slice('system:'.length)
      const entry = filteredSystemTransitions.find((transition) => transition.id === id)
      return entry ? { kind: 'system' as const, entry } : null
    }
    if (selectedTransitionKey.startsWith('user:')) {
      const id = selectedTransitionKey.slice('user:'.length)
      const entry = filteredTransitionLibrary.find((transition) => transition.id === id)
      return entry ? { kind: 'user' as const, entry } : null
    }
    return null
  }, [filteredSystemTransitions, filteredTransitionLibrary, selectedTransitionKey])
  const filteredSourcePresets = useMemo(() => {
    const query = sourceSearch.trim().toLowerCase()
    if (!query) return sourcePresets
    return sourcePresets.filter((preset) => [preset.label, preset.id, preset.pluginType].some((value) => value.toLowerCase().includes(query)))
  }, [sourcePresets, sourceSearch])
  const usageCountByPreset = useMemo(() => {
    return Object.values(config.scenes).reduce<Record<string, number>>((counts, scene) => {
      for (const source of getSafeSceneSources(scene)) {
        if (!source.sourcePresetId) continue
        counts[source.sourcePresetId] = (counts[source.sourcePresetId] ?? 0) + 1
      }
      return counts
    }, {})
  }, [config.scenes])
  const selectedSourcePreset = useMemo(() => (
    selectedSourcePresetId
      ? sourcePresets.find((preset) => preset.id === selectedSourcePresetId) ?? null
      : null
  ), [selectedSourcePresetId, sourcePresets])
  const editingSourcePreset = sourcePresetDraft?.preset ?? selectedSourcePreset
  const selectedSourceMeta = editingSourcePreset ? findSourceCatalogEntry(editingSourcePreset.pluginType) : undefined
  const sourceDraftCreatesNewPreset = !!sourcePresetDraft && (!sourcePresetDraft.originalId || sourcePresetDraft.originalLabel?.trim() !== sourcePresetDraft.preset.label.trim())
  const selectedSourceUsageCount = selectedSourcePreset ? usageCountByPreset[selectedSourcePreset.id] ?? 0 : 0
  const pendingTransitionKind = useMemo(() => {
    const inferred = inferAssetKindFromUrl(url, 'image')
    return inferred === 'video' ? 'video' : 'image'
  }, [url])

  useEffect(() => {
    if (selectedEventId && !eventDefs.some((def) => def.id === selectedEventId)) {
      setSelectedEventId(null)
    }
  }, [eventDefs, selectedEventId])

  useEffect(() => {
    if (filteredSourcePresets.length === 0) {
      if (selectedSourcePresetId !== null) setSelectedSourcePresetId(null)
      return
    }
    if (sourcePresetDraft && !sourcePresetDraft.originalId) return
    if (!selectedSourcePresetId || !filteredSourcePresets.some((preset) => preset.id === selectedSourcePresetId)) {
      setSelectedSourcePresetId(filteredSourcePresets[0].id)
    }
  }, [filteredSourcePresets, selectedSourcePresetId, sourcePresetDraft])

  useEffect(() => {
    if (!selectedSourcePresetId) return
    const preset = sourcePresets.find((entry) => entry.id === selectedSourcePresetId)
    if (!preset) return
    if (sourcePresetDraft?.originalId === preset.id) return
    setSourcePresetDraft({
      preset: {
        ...preset,
        config: { ...preset.config },
        defaultPosition: preset.defaultPosition ? { ...preset.defaultPosition } : undefined,
      },
      originalId: preset.id,
      originalLabel: preset.label,
    })
  }, [selectedSourcePresetId, sourcePresets, sourcePresetDraft?.originalId])

  useEffect(() => {
    if (filteredCatalogAssets.length === 0) {
      if (selectedCatalogAssetId !== null) setSelectedCatalogAssetId(null)
      return
    }
    if (!selectedCatalogAssetId || !filteredCatalogAssets.some((asset) => asset.id === selectedCatalogAssetId)) {
      setSelectedCatalogAssetId(filteredCatalogAssets[0].id)
    }
  }, [filteredCatalogAssets, selectedCatalogAssetId])

  useEffect(() => {
    const options = [
      ...filteredSystemTransitions.map((transition) => `system:${transition.id}`),
      ...filteredTransitionLibrary.map((transition) => `user:${transition.id}`),
    ]
    if (options.length === 0) {
      if (selectedTransitionKey !== null) setSelectedTransitionKey(null)
      return
    }
    if (!selectedTransitionKey || !options.includes(selectedTransitionKey)) {
      setSelectedTransitionKey(options[0])
    }
  }, [filteredSystemTransitions, filteredTransitionLibrary, selectedTransitionKey])

  const handleSave = async () => {
    if (!url) return
    const durVal = parseFloat(durStr)
    const type = pendingTransitionKind
    const hasDur = type === 'image' && !Number.isNaN(durVal) && durVal > 0
    const entry: MediaEntry = {
      id: 'media-' + Date.now(),
      name: name.trim() || url.split('/').pop() || 'Unnamed',
      type,
      url,
      ...(hasDur ? { duration: durVal } : {}),
    }
    await saveConfig({ mediaLibrary: [...mediaLibrary, entry] })
    resetForm()
  }

  const handleDeleteMediaEntry = async (id: string) => {
    await saveConfig({ mediaLibrary: mediaLibrary.filter((entry) => entry.id !== id) })
  }

  const saveSourcePresets = (nextSourcePresets: SourcePreset[], nextScenes = config.scenes) => {
    void saveConfig({ sourcePresets: nextSourcePresets, scenes: nextScenes })
  }

  const removeSourcePreset = (presetId: string) => {
    const nextSourcePresets = sourcePresets.filter((preset) => preset.id !== presetId)
    const nextScenes = Object.fromEntries(Object.entries(config.scenes).map(([sceneId, scene]) => [
      sceneId,
      {
        ...scene,
        sources: getSafeSceneSources(scene).filter((source) => source.sourcePresetId !== presetId),
      },
    ])) as typeof config.scenes
    saveSourcePresets(nextSourcePresets, nextScenes)
    if (selectedSourcePresetId === presetId) setSelectedSourcePresetId(nextSourcePresets[0]?.id ?? null)
  }

  const createSourcePresetDraft = (entry: typeof SOURCE_CATALOG[number]) => {
    const defaultPosition = entry.defaultPosition ?? { x: 0, y: 0, width: 1920, height: 1080 }
    const newPreset: SourcePreset = {
      id: `${entry.type}-${Date.now()}`,
      label: entry.label,
      pluginType: entry.type,
      config: { ...entry.defaultConfig },
      defaultPosition: { ...defaultPosition },
    }
    setSourcePresetDraft({
      preset: newPreset,
      originalId: null,
      originalLabel: null,
    })
    setSelectedSourcePresetId(null)
    setTab('sources')
  }

  const patchSourcePresetDraft = (updates: Partial<SourcePreset>) => {
    setSourcePresetDraft((current) => {
      if (!current) return current
      return {
        ...current,
        preset: {
          ...current.preset,
          ...updates,
        },
      }
    })
  }

  const saveSourcePresetDraft = () => {
    if (!sourcePresetDraft) return
    const label = sourcePresetDraft.preset.label.trim() || findSourceCatalogEntry(sourcePresetDraft.preset.pluginType)?.label || 'Untitled preset'
    const normalizedPreset: SourcePreset = {
      ...sourcePresetDraft.preset,
      label,
      config: { ...sourcePresetDraft.preset.config },
      defaultPosition: {
        x: sourcePresetDraft.preset.defaultPosition?.x ?? 0,
        y: sourcePresetDraft.preset.defaultPosition?.y ?? 0,
        width: sourcePresetDraft.preset.defaultPosition?.width ?? 1920,
        height: sourcePresetDraft.preset.defaultPosition?.height ?? 1080,
      },
    }

    if (sourcePresetDraft.originalId && sourcePresetDraft.originalLabel?.trim() === label) {
      const nextSourcePresets = sourcePresets.map((preset) => preset.id === sourcePresetDraft.originalId ? { ...normalizedPreset, id: sourcePresetDraft.originalId } : preset)
      saveSourcePresets(nextSourcePresets)
      setSelectedSourcePresetId(sourcePresetDraft.originalId)
      setSourcePresetDraft({
        preset: { ...normalizedPreset, id: sourcePresetDraft.originalId },
        originalId: sourcePresetDraft.originalId,
        originalLabel: label,
      })
      return
    }

    const savedPreset = {
      ...normalizedPreset,
      id: `${normalizedPreset.pluginType}-${Date.now()}`,
    }
    saveSourcePresets([...sourcePresets, savedPreset])
    setSelectedSourcePresetId(savedPreset.id)
    setSourcePresetDraft({
      preset: savedPreset,
      originalId: savedPreset.id,
      originalLabel: savedPreset.label,
    })
  }

  const deleteSourcePresetDraft = () => {
    if (!sourcePresetDraft) return
    if (!sourcePresetDraft.originalId) {
      setSourcePresetDraft(null)
      return
    }
    removeSourcePreset(sourcePresetDraft.originalId)
    setSourcePresetDraft(null)
  }

  const handleDeleteCatalogAsset = async (asset: AssetRecord) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${asset.name}?`)) return
    if (asset.source === 'saved') {
      await handleDeleteMediaEntry(asset.id)
      return
    }
    if (asset.source === 'filesystem') {
      await deleteAssetFile(asset.url)
      await refreshCatalog()
    }
  }

  const createEventDraft = (presetId: EventPresetId = 'blank') => {
    const def = createEventPreset(presetId, {
      widgetIds,
      layoutId: widgetLayouts[0]?.id,
    })
    setTab('events')
    setEventDraft({
      event: def,
      originalId: null,
    })
    setSelectedEventId(null)
  }

  const selectEvent = (eventId: string) => {
    const eventDef = eventDefs.find((entry) => entry.id === eventId)
    if (!eventDef) return
    setSelectedEventId(eventId)
    setEventDraft({
      event: structuredClone(eventDef),
      originalId: eventDef.id,
    })
  }

  const patchEventDraft = (updated: EventDef) => {
    setEventDraft((current) => current ? { ...current, event: updated } : current)
  }

  const saveEventDraft = () => {
    if (!eventDraft) return
    const normalizedEvent: EventDef = {
      ...eventDraft.event,
      label: eventDraft.event.label.trim() || 'New Event',
      icon: eventDraft.event.icon || '⚡',
      desc: eventDraft.event.desc ?? '',
      actions: structuredClone(eventDraft.event.actions ?? []),
      effects: structuredClone(eventDraft.event.effects ?? []),
      auto: { ...eventDraft.event.auto },
    }

    if (eventDraft.originalId) {
      const nextEvents = eventDefs.map((entry) => entry.id === eventDraft.originalId ? { ...normalizedEvent, id: eventDraft.originalId } : entry)
      void saveConfig({ events: nextEvents })
      setSelectedEventId(eventDraft.originalId)
      setEventDraft({ event: { ...normalizedEvent, id: eventDraft.originalId }, originalId: eventDraft.originalId })
      return
    }

    void saveConfig({ events: [...eventDefs, normalizedEvent] })
    setSelectedEventId(normalizedEvent.id)
    setEventDraft({ event: normalizedEvent, originalId: normalizedEvent.id })
  }

  const deleteEventDraft = () => {
    if (!eventDraft) return
    if (!eventDraft.originalId) {
      setEventDraft(null)
      return
    }
    const id = eventDraft.originalId
    const nextEvents = eventDefs.filter((entry) => entry.id !== id)
    if (selectedEventId === id) {
      setSelectedEventId(null)
    }
    void saveConfig({ events: nextEvents })
    setEventDraft(null)
  }

  const handleTriggerEvent = (def: EventDef) => {
    socket.emit('event:preview', def)
    onHide()
  }

  const assetLibraryTabs = [
    { id: 'catalog', label: 'Catalog', icon: '🗂', meta: 'Assets and saved media' },
    { id: 'events', label: 'Events', icon: '⚡', meta: `${eventDefs.length} configured` },
    { id: 'sources', label: 'Sources', icon: '📺', meta: `${sourcePresets.length} configured` },
    { id: 'transitions', label: 'Transitions', icon: '✨', meta: `${sortedTransitionLibrary.length} saved` },
  ] as const

  return (
    <AssetLibraryModal
      isOpen={isOpen}
      onClose={onClose}
      tabs={assetLibraryTabs}
      activeTab={tab}
      onTabChange={(nextTab) => setTab(nextTab as typeof tab)}
      sidebarChildren={(
        <>
          {tab === 'catalog' && (
            <>
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Search</div>
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(event) => setCatalogSearch(event.target.value)}
                  placeholder="Search assets, folders, or game names"
                  className="w-full text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Type Filter</div>
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'image', 'video', 'audio'] as const).map((kind) => (
                    <Button
                      key={kind}
                      type="button"
                      variant={catalogKindFilter === kind ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setCatalogKindFilter(kind)}
                      className="px-2.5 py-1 text-[10px] uppercase tracking-wide"
                    >
                      {kind}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {catalogError && <Notice tone="danger">{catalogError}</Notice>}
                {catalogLoading && <Notice tone="info">Loading asset catalog...</Notice>}
                {!catalogLoading && catalogFolderGroups.length === 0 && (
                  <Notice tone="info">No assets match this filter.</Notice>
                )}
                {catalogFolderGroups.map((group) => (
                  <div key={group.folder} className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{group.folder}</div>
                    <div className="space-y-1">
                      {group.items.map((asset) => {
                        const active = selectedCatalogAsset?.id === asset.id
                        return (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => setSelectedCatalogAssetId(asset.id)}
                            className={'w-full rounded-lg border px-3 py-2 text-left transition-colors ' + (
                              active
                                ? 'border-[var(--color-primary-400)]/35 bg-[var(--color-primary-500)]/12 text-[var(--color-text-primary)]'
                                : 'border-[var(--color-border-default)] bg-[var(--color-bg-base)]/50 text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                            )}
                          >
                            <div className="truncate text-[12px] font-medium">{asset.name}</div>
                            <div className="truncate text-[10px] text-[var(--color-text-muted)]">{asset.relativePath || asset.url}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
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
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Search</div>
                <input
                  type="text"
                  value={transitionSearch}
                  onChange={(event) => setTransitionSearch(event.target.value)}
                  placeholder="Search transitions by name or id"
                  className="w-full text-sm"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Card variant="default" padding="sm" className="text-left">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">System</div>
                  <div className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">{filteredSystemTransitions.length}</div>
                </Card>
                <Card variant="default" padding="sm" className="text-left">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Saved</div>
                  <div className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">{filteredTransitionLibrary.length}</div>
                </Card>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">System Transitions</div>
                  {filteredSystemTransitions.length ? filteredSystemTransitions.map((transition) => {
                    const active = selectedTransition?.kind === 'system' && selectedTransition.entry.id === transition.id
                    return (
                      <button
                        key={transition.id}
                        type="button"
                        onClick={() => setSelectedTransitionKey(`system:${transition.id}`)}
                        className={'w-full rounded-lg border px-3 py-2 text-left transition-colors ' + (
                          active
                            ? 'border-[var(--color-primary-400)]/35 bg-[var(--color-primary-500)]/12 text-[var(--color-text-primary)]'
                            : 'border-[var(--color-border-default)] bg-[var(--color-bg-base)]/50 text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span>{TRANSITION_ICONS[transition.id]}</span>
                          <span className="truncate text-[12px] font-medium">{transition.label}</span>
                        </div>
                        <div className="truncate text-[10px] text-[var(--color-text-muted)]">{transition.id}</div>
                      </button>
                    )
                  }) : <Notice tone="info">No system transitions match this filter.</Notice>}
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">User Transitions</div>
                  {filteredTransitionLibrary.length ? filteredTransitionLibrary.map((entry) => {
                    const active = selectedTransition?.kind === 'user' && selectedTransition.entry.id === entry.id
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedTransitionKey(`user:${entry.id}`)}
                        className={'w-full rounded-lg border px-3 py-2 text-left transition-colors ' + (
                          active
                            ? 'border-[var(--color-primary-400)]/35 bg-[var(--color-primary-500)]/12 text-[var(--color-text-primary)]'
                            : 'border-[var(--color-border-default)] bg-[var(--color-bg-base)]/50 text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                        )}
                      >
                        <div className="truncate text-[12px] font-medium">{getMediaTransitionLabel(entry)}</div>
                        <div className="truncate text-[10px] text-[var(--color-text-muted)]">{entry.url}</div>
                      </button>
                    )
                  }) : <Notice tone="info">No user transitions match this filter.</Notice>}
                </div>
              </div>
            </>
          )}
        </>
      )}
      contentChildren={(
        <>
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
                        <Button type="button" variant="danger" size="sm" onClick={() => { void handleDeleteCatalogAsset(selectedCatalogAsset) }}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_320px]">
                    <div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)]/70 p-4">
                      {selectedCatalogAsset.kind === 'image' && (
                        <img src={selectedCatalogAsset.url} alt={selectedCatalogAsset.name} className="max-h-[70vh] w-full object-contain" />
                      )}
                      {selectedCatalogAsset.kind === 'video' && (
                        <video src={selectedCatalogAsset.url} className="max-h-[70vh] w-full rounded-xl bg-black object-contain" controls muted playsInline preload="metadata" />
                      )}
                      {selectedCatalogAsset.kind === 'audio' && (
                        <div className="w-full max-w-xl space-y-5 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)]/70 p-6 text-center">
                          <div className="text-5xl">🎵</div>
                          <div className="text-sm text-[var(--color-text-secondary)]">Audio preview</div>
                          <audio src={selectedCatalogAsset.url} controls className="w-full" preload="metadata" />
                        </div>
                      )}
                    </div>
                    <Card variant="default" padding="md" className="space-y-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Folder</div>
                        <div className="mt-1 text-sm text-[var(--color-text-primary)]">{selectedCatalogAsset.folder}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Source</div>
                        <div className="mt-1 text-sm text-[var(--color-text-primary)]">{selectedCatalogAsset.source}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Kind</div>
                        <div className="mt-1 text-sm text-[var(--color-text-primary)]">{selectedCatalogAsset.kind}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">URL</div>
                        <div className="mt-1 break-all font-mono text-xs text-[var(--color-text-secondary)]">{selectedCatalogAsset.url}</div>
                      </div>
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
              eventDraftOriginalId={eventDraft?.originalId ?? null}
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
              sourcePresetOriginalId={sourcePresetDraft?.originalId ?? null}
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
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={() => selectedTransition.kind === 'system'
                          ? socket.emit('transition:preview', [{ id: selectedTransition.entry.id }])
                          : socket.emit('transition:preview', [strToStep(encodeMediaTransitionValue(selectedTransition.entry))])}
                      >
                        Test Transition
                      </Button>
                      {selectedTransition.kind === 'user' && (
                        <Button
                          type="button"
                          variant="danger"
                          size="md"
                          onClick={() => { void handleDeleteMediaEntry(selectedTransition.entry.id) }}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Card variant="default" padding="sm" className="text-left">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Type</div>
                      <div className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{selectedTransition.kind === 'system' ? 'System' : selectedTransition.entry.type}</div>
                    </Card>
                    <Card variant="default" padding="sm" className="text-left">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Origin</div>
                      <div className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{selectedTransition.kind === 'system' ? 'Built-in transition' : 'Saved media entry'}</div>
                    </Card>
                    <Card variant="default" padding="sm" className="text-left">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Duration</div>
                      <div className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{selectedTransition.kind === 'user' && selectedTransition.entry.duration != null ? `${selectedTransition.entry.duration}s` : 'Default'}</div>
                    </Card>
                  </div>
                </Card>
              ) : (
                <Notice tone="info" className="py-6 text-center">Select a transition from the left column.</Notice>
              )}

              <ConfigPanel title="Create User Transition">
                <div className="space-y-3">
                  <Notice>
                    Save an image or video as a reusable user transition.
                  </Notice>

                  <Card variant="default" padding="md" className="space-y-3">
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Name (optional)"
                      className="w-full text-sm"
                    />

                    <AssetSelectionInput
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
                          min={0.1}
                          max={120}
                          step={0.5}
                          value={durStr}
                          onChange={(event) => setDurStr(event.target.value)}
                          placeholder="4.0"
                          className="w-28 text-sm font-mono"
                        />
                        <span className="text-xs text-[var(--color-text-muted)]">sec display duration</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={() => void handleSave()}
                        disabled={!url}
                        fullWidth
                      >
                        Save Transition
                      </Button>
                      {(name || url || durStr) && (
                        <Button type="button" variant="ghost" size="md" onClick={resetForm}>
                          Reset
                        </Button>
                      )}
                    </div>
                  </Card>
                </div>
              </ConfigPanel>
            </div>
          )}
        </>
      )}
    />
  )
}
