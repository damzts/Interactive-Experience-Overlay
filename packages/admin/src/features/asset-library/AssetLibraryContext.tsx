import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_EVENT_DEFS, EVENT_PRESET_OPTIONS, createEventPreset, type EventDef, type EventPresetId } from './eventPresets'
import { deleteAssetFile, inferAssetKindFromUrl, mediaEntryToAsset, useAssetCatalog, type AssetKind, type AssetRecord } from '../../shared/catalog'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { SOURCE_CATALOG, findSourceCatalogEntry, getSafeSceneSources } from '../../shared/sourceCatalog'
import { TRANSITION_OPTIONS, getMediaTransitionLabel } from '../../shared/transitionLibrary'
import { withDesktopConfigDefaults } from '@ieom/shared'
import type { MediaEntry, SourcePreset } from '@ieom/shared'

export type AssetLibraryTab = 'catalog' | 'events' | 'sources' | 'transitions'

// Context shape — all state + actions needed by Sidebar and Content
export interface AssetLibraryContextValue {
  tab: AssetLibraryTab
  setTab: (t: AssetLibraryTab) => void

  // catalog
  catalogSearch: string
  setCatalogSearch: (v: string) => void
  catalogKindFilter: 'all' | AssetKind
  setCatalogKindFilter: (v: 'all' | AssetKind) => void
  selectedCatalogAsset: AssetRecord | null
  setSelectedCatalogAssetId: (id: string | null) => void
  catalogFolderGroups: Array<{ folder: string; items: AssetRecord[] }>
  catalogLoading: boolean
  catalogError: string | null
  refreshCatalog: () => void
  handleDeleteCatalogAsset: (asset: AssetRecord) => void

  // events
  eventSearch: string
  setEventSearch: (v: string) => void
  filteredEventDefs: EventDef[]
  filteredEventPresets: typeof EVENT_PRESET_OPTIONS
  selectedEventId: string | null
  editingEvent: EventDef | null
  eventDraftOriginalId: string | null
  selectEvent: (id: string) => void
  createEventDraft: (presetId?: EventPresetId) => void
  patchEventDraft: (updated: EventDef) => void
  saveEventDraft: () => void
  deleteEventDraft: () => void
  handleTriggerEvent: (def: EventDef) => void

  // sources
  sourceSearch: string
  setSourceSearch: (v: string) => void
  filteredSourcePresets: SourcePreset[]
  selectedSourcePresetId: string | null
  setSelectedSourcePresetId: (id: string | null) => void
  editingSourcePreset: SourcePreset | null
  selectedSourceMeta: ReturnType<typeof findSourceCatalogEntry>
  sourcePresetOriginalId: string | null
  sourceDraftCreatesNewPreset: boolean
  selectedSourceUsageCount: number
  usageCountByPreset: Record<string, number>
  createSourcePresetDraft: (entry: typeof SOURCE_CATALOG[number]) => void
  patchSourcePresetDraft: (updates: Partial<SourcePreset>) => void
  saveSourcePresetDraft: () => void
  deleteSourcePresetDraft: () => void

  // transitions
  transitionSearch: string
  setTransitionSearch: (v: string) => void
  filteredSystemTransitions: typeof TRANSITION_OPTIONS
  filteredTransitionLibrary: MediaEntry[]
  selectedTransition: { kind: 'system'; entry: typeof TRANSITION_OPTIONS[number] } | { kind: 'user'; entry: MediaEntry } | null
  setSelectedTransitionKey: (k: string | null) => void
  handleSave: () => void
  handleDeleteMediaEntry: (id: string) => void
  name: string
  setName: (v: string) => void
  url: string
  setUrl: (v: string) => void
  durStr: string
  setDurStr: (v: string) => void
  pendingTransitionKind: 'image' | 'video'
  resetForm: () => void
}

const AssetLibraryContext = createContext<AssetLibraryContextValue | null>(null)

export function useAssetLibrary(): AssetLibraryContextValue {
  const ctx = useContext(AssetLibraryContext)
  if (!ctx) throw new Error('useAssetLibrary must be used within AssetLibraryProvider')
  return ctx
}

/** Returns null if no provider is present — useful for optional rendering */
export function useAssetLibraryOptional(): AssetLibraryContextValue | null {
  return useContext(AssetLibraryContext)
}

export function AssetLibraryProvider({ children }: { children: ReactNode }) {
  const config = useAdminStore((state) => state.config)
  const mediaLibrary = useAdminStore((state) => state.config.mediaLibrary ?? [])
  const eventDefs = useAdminStore((state) => (state.config.events ?? DEFAULT_EVENT_DEFS) as EventDef[])
  const widgetIds = useAdminStore((state) => state.config.applications.filter((app) => app.appType === 'widget').map((app) => app.id))
  const widgetLayouts = useAdminStore((state) => withDesktopConfigDefaults(state.config.desktopConfig).widgetLayouts ?? [])
  const saveConfig = useAdminStore((state) => state.saveConfig)
  const { assets: catalogAssets, loading: catalogLoading, error: catalogError, refresh: refreshCatalog } = useAssetCatalog()

  const [tab, setTab] = useState<AssetLibraryTab>('catalog')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [durStr, setDurStr] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogKindFilter, setCatalogKindFilter] = useState<'all' | AssetKind>('all')
  const [selectedCatalogAssetId, setSelectedCatalogAssetId] = useState<string | null>(null)
  const [eventSearch, setEventSearch] = useState('')
  const [eventDraft, setEventDraft] = useState<{ event: EventDef; originalId: string | null } | null>(null)
  const [sourceSearch, setSourceSearch] = useState('')
  const [selectedSourcePresetId, setSelectedSourcePresetId] = useState<string | null>((useAdminStore.getState().config.sourcePresets ?? [])[0]?.id ?? null)
  const [sourcePresetDraft, setSourcePresetDraft] = useState<{ preset: SourcePreset; originalId: string | null; originalLabel: string | null } | null>(null)
  const [transitionSearch, setTransitionSearch] = useState('')
  const [selectedTransitionKey, setSelectedTransitionKey] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const sourcePresets = config.sourcePresets ?? []

  const resetForm = () => { setName(''); setUrl(''); setDurStr('') }

  const filteredEventDefs = useMemo(() => {
    const query = eventSearch.trim().toLowerCase()
    if (!query) return eventDefs
    return eventDefs.filter((def) => [def.label, def.desc, def.id].some((v) => v.toLowerCase().includes(query)))
  }, [eventDefs, eventSearch])

  const filteredEventPresets = useMemo(() => {
    const query = eventSearch.trim().toLowerCase()
    return EVENT_PRESET_OPTIONS.filter((p) => p.id !== 'blank' && (!query || [p.label, p.description, p.id].some((v) => v.toLowerCase().includes(query))))
  }, [eventSearch])

  const catalogSavedAssets = useMemo(() => mediaLibrary.map(mediaEntryToAsset), [mediaLibrary])
  const filteredCatalogAssets = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase()
    const matches = (asset: AssetRecord) => {
      if (catalogKindFilter !== 'all' && asset.kind !== catalogKindFilter) return false
      if (!query) return true
      return [asset.name, asset.url, asset.folder, asset.relativePath, asset.game ?? ''].some((v) => v.toLowerCase().includes(query))
    }
    return [...catalogSavedAssets, ...catalogAssets].filter(matches)
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
      .map(([folder, items]) => ({ folder, items: [...items].sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.folder.localeCompare(b.folder))
  }, [filteredCatalogAssets])

  const sortedTransitionLibrary = useMemo(() => (
    [...mediaLibrary].sort((a, b) => getMediaTransitionLabel(a).localeCompare(getMediaTransitionLabel(b)))
  ), [mediaLibrary])

  const filteredSystemTransitions = useMemo(() => {
    const query = transitionSearch.trim().toLowerCase()
    if (!query) return TRANSITION_OPTIONS
    return TRANSITION_OPTIONS.filter((t) => [t.id, t.label].some((v) => v.toLowerCase().includes(query)))
  }, [transitionSearch])

  const filteredTransitionLibrary = useMemo(() => {
    const query = transitionSearch.trim().toLowerCase()
    if (!query) return sortedTransitionLibrary
    return sortedTransitionLibrary.filter((e) => [e.name, e.url, e.id, getMediaTransitionLabel(e)].some((v) => v.toLowerCase().includes(query)))
  }, [sortedTransitionLibrary, transitionSearch])

  const selectedCatalogAsset = useMemo(() => (
    filteredCatalogAssets.find((a) => a.id === selectedCatalogAssetId) ?? filteredCatalogAssets[0] ?? null
  ), [filteredCatalogAssets, selectedCatalogAssetId])

  const selectedTransition = useMemo(() => {
    if (!selectedTransitionKey) return filteredSystemTransitions[0] ? { kind: 'system' as const, entry: filteredSystemTransitions[0] } : filteredTransitionLibrary[0] ? { kind: 'user' as const, entry: filteredTransitionLibrary[0] } : null
    if (selectedTransitionKey.startsWith('system:')) {
      const id = selectedTransitionKey.slice('system:'.length)
      const entry = filteredSystemTransitions.find((t) => t.id === id)
      return entry ? { kind: 'system' as const, entry } : null
    }
    if (selectedTransitionKey.startsWith('user:')) {
      const id = selectedTransitionKey.slice('user:'.length)
      const entry = filteredTransitionLibrary.find((t) => t.id === id)
      return entry ? { kind: 'user' as const, entry } : null
    }
    return null
  }, [filteredSystemTransitions, filteredTransitionLibrary, selectedTransitionKey])

  const filteredSourcePresets = useMemo(() => {
    const query = sourceSearch.trim().toLowerCase()
    if (!query) return sourcePresets
    return sourcePresets.filter((p) => [p.label, p.id, p.pluginType].some((v) => v.toLowerCase().includes(query)))
  }, [sourcePresets, sourceSearch])

  const usageCountByPreset = useMemo(() => (
    Object.values(config.scenes).reduce<Record<string, number>>((counts, scene) => {
      for (const source of getSafeSceneSources(scene)) {
        if (!source.sourcePresetId) continue
        counts[source.sourcePresetId] = (counts[source.sourcePresetId] ?? 0) + 1
      }
      return counts
    }, {})
  ), [config.scenes])

  const selectedSourcePreset = useMemo(() => (
    selectedSourcePresetId ? sourcePresets.find((p) => p.id === selectedSourcePresetId) ?? null : null
  ), [selectedSourcePresetId, sourcePresets])

  const editingSourcePreset = sourcePresetDraft?.preset ?? selectedSourcePreset
  const selectedSourceMeta = editingSourcePreset ? findSourceCatalogEntry(editingSourcePreset.pluginType) : undefined
  const sourceDraftCreatesNewPreset = !!sourcePresetDraft && (!sourcePresetDraft.originalId || sourcePresetDraft.originalLabel?.trim() !== sourcePresetDraft.preset.label.trim())
  const selectedSourceUsageCount = selectedSourcePreset ? usageCountByPreset[selectedSourcePreset.id] ?? 0 : 0

  const pendingTransitionKind = useMemo(() => {
    const inferred = inferAssetKindFromUrl(url, 'image')
    return inferred === 'video' ? 'video' : 'image'
  }, [url])

  const editingEvent = eventDraft?.event ?? null

  // Effects
  useEffect(() => {
    if (selectedEventId && !eventDefs.some((d) => d.id === selectedEventId)) setSelectedEventId(null)
  }, [eventDefs, selectedEventId])

  useEffect(() => {
    if (filteredSourcePresets.length === 0) { if (selectedSourcePresetId !== null) setSelectedSourcePresetId(null); return }
    if (sourcePresetDraft && !sourcePresetDraft.originalId) return
    if (!selectedSourcePresetId || !filteredSourcePresets.some((p) => p.id === selectedSourcePresetId)) {
      setSelectedSourcePresetId(filteredSourcePresets[0].id)
    }
  }, [filteredSourcePresets, selectedSourcePresetId, sourcePresetDraft])

  useEffect(() => {
    if (!selectedSourcePresetId) return
    const preset = sourcePresets.find((e) => e.id === selectedSourcePresetId)
    if (!preset) return
    if (sourcePresetDraft?.originalId === preset.id) return
    setSourcePresetDraft({ preset: { ...preset, config: { ...preset.config }, defaultPosition: preset.defaultPosition ? { ...preset.defaultPosition } : undefined }, originalId: preset.id, originalLabel: preset.label })
  }, [selectedSourcePresetId, sourcePresets, sourcePresetDraft?.originalId])

  useEffect(() => {
    if (filteredCatalogAssets.length === 0) { if (selectedCatalogAssetId !== null) setSelectedCatalogAssetId(null); return }
    if (!selectedCatalogAssetId || !filteredCatalogAssets.some((a) => a.id === selectedCatalogAssetId)) {
      setSelectedCatalogAssetId(filteredCatalogAssets[0].id)
    }
  }, [filteredCatalogAssets, selectedCatalogAssetId])

  useEffect(() => {
    const options = [...filteredSystemTransitions.map((t) => `system:${t.id}`), ...filteredTransitionLibrary.map((t) => `user:${t.id}`)]
    if (options.length === 0) { if (selectedTransitionKey !== null) setSelectedTransitionKey(null); return }
    if (!selectedTransitionKey || !options.includes(selectedTransitionKey)) setSelectedTransitionKey(options[0])
  }, [filteredSystemTransitions, filteredTransitionLibrary, selectedTransitionKey])

  // Handlers
  const handleSave = async () => {
    if (!url) return
    const durVal = parseFloat(durStr)
    const type = pendingTransitionKind
    const hasDur = type === 'image' && !Number.isNaN(durVal) && durVal > 0
    const entry: MediaEntry = { id: 'media-' + Date.now(), name: name.trim() || url.split('/').pop() || 'Unnamed', type, url, ...(hasDur ? { duration: durVal } : {}) }
    await saveConfig({ mediaLibrary: [...mediaLibrary, entry] })
    resetForm()
  }

  const handleDeleteMediaEntry = async (id: string) => {
    await saveConfig({ mediaLibrary: mediaLibrary.filter((e) => e.id !== id) })
  }

  const saveSourcePresets = (nextSourcePresets: SourcePreset[], nextScenes = config.scenes) => {
    void saveConfig({ sourcePresets: nextSourcePresets, scenes: nextScenes })
  }

  const removeSourcePreset = (presetId: string) => {
    const nextSourcePresets = sourcePresets.filter((p) => p.id !== presetId)
    const nextScenes = Object.fromEntries(Object.entries(config.scenes).map(([sceneId, scene]) => [
      sceneId, { ...scene, sources: getSafeSceneSources(scene).filter((s) => s.sourcePresetId !== presetId) },
    ])) as typeof config.scenes
    saveSourcePresets(nextSourcePresets, nextScenes)
    if (selectedSourcePresetId === presetId) setSelectedSourcePresetId(nextSourcePresets[0]?.id ?? null)
  }

  const createSourcePresetDraft = (entry: typeof SOURCE_CATALOG[number]) => {
    const defaultPosition = entry.defaultPosition ?? { x: 0, y: 0, width: 1920, height: 1080 }
    const newPreset: SourcePreset = { id: `${entry.type}-${Date.now()}`, label: entry.label, pluginType: entry.type, config: { ...entry.defaultConfig }, defaultPosition: { ...defaultPosition } }
    setSourcePresetDraft({ preset: newPreset, originalId: null, originalLabel: null })
    setSelectedSourcePresetId(null)
    setTab('sources')
  }

  const patchSourcePresetDraft = (updates: Partial<SourcePreset>) => {
    setSourcePresetDraft((cur) => cur ? { ...cur, preset: { ...cur.preset, ...updates } } : cur)
  }

  const saveSourcePresetDraft = () => {
    if (!sourcePresetDraft) return
    const label = sourcePresetDraft.preset.label.trim() || findSourceCatalogEntry(sourcePresetDraft.preset.pluginType)?.label || 'Untitled preset'
    const normalizedPreset: SourcePreset = { ...sourcePresetDraft.preset, label, config: { ...sourcePresetDraft.preset.config }, defaultPosition: { x: sourcePresetDraft.preset.defaultPosition?.x ?? 0, y: sourcePresetDraft.preset.defaultPosition?.y ?? 0, width: sourcePresetDraft.preset.defaultPosition?.width ?? 1920, height: sourcePresetDraft.preset.defaultPosition?.height ?? 1080 } }
    if (sourcePresetDraft.originalId && sourcePresetDraft.originalLabel?.trim() === label) {
      const next = sourcePresets.map((p) => p.id === sourcePresetDraft.originalId ? { ...normalizedPreset, id: sourcePresetDraft.originalId } : p)
      saveSourcePresets(next)
      setSelectedSourcePresetId(sourcePresetDraft.originalId)
      setSourcePresetDraft({ preset: { ...normalizedPreset, id: sourcePresetDraft.originalId }, originalId: sourcePresetDraft.originalId, originalLabel: label })
      return
    }
    const savedPreset = { ...normalizedPreset, id: `${normalizedPreset.pluginType}-${Date.now()}` }
    saveSourcePresets([...sourcePresets, savedPreset])
    setSelectedSourcePresetId(savedPreset.id)
    setSourcePresetDraft({ preset: savedPreset, originalId: savedPreset.id, originalLabel: savedPreset.label })
  }

  const deleteSourcePresetDraft = () => {
    if (!sourcePresetDraft) return
    if (!sourcePresetDraft.originalId) { setSourcePresetDraft(null); return }
    removeSourcePreset(sourcePresetDraft.originalId)
    setSourcePresetDraft(null)
  }

  const handleDeleteCatalogAsset = async (asset: AssetRecord) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${asset.name}?`)) return
    if (asset.source === 'saved') { await handleDeleteMediaEntry(asset.id); return }
    if (asset.source === 'filesystem') { await deleteAssetFile(asset.url); await refreshCatalog() }
  }

  const createEventDraft = (presetId: EventPresetId = 'blank') => {
    const def = createEventPreset(presetId, { widgetIds, layoutId: widgetLayouts[0]?.id })
    setTab('events')
    setEventDraft({ event: def, originalId: null })
    setSelectedEventId(null)
  }

  const selectEvent = (eventId: string) => {
    const eventDef = eventDefs.find((e) => e.id === eventId)
    if (!eventDef) return
    setSelectedEventId(eventId)
    setEventDraft({ event: structuredClone(eventDef), originalId: eventDef.id })
  }

  const patchEventDraft = (updated: EventDef) => {
    setEventDraft((cur) => cur ? { ...cur, event: updated } : cur)
  }

  const saveEventDraft = () => {
    if (!eventDraft) return
    const normalizedEvent: EventDef = { ...eventDraft.event, label: eventDraft.event.label.trim() || 'New Event', icon: eventDraft.event.icon || '⚡', desc: eventDraft.event.desc ?? '', actions: structuredClone(eventDraft.event.actions ?? []), effects: structuredClone(eventDraft.event.effects ?? []), auto: { ...eventDraft.event.auto } }
    if (eventDraft.originalId) {
      const nextEvents = eventDefs.map((e) => e.id === eventDraft.originalId ? { ...normalizedEvent, id: eventDraft.originalId } : e)
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
    if (!eventDraft.originalId) { setEventDraft(null); return }
    const id = eventDraft.originalId
    if (selectedEventId === id) setSelectedEventId(null)
    void saveConfig({ events: eventDefs.filter((e) => e.id !== id) })
    setEventDraft(null)
  }

  const handleTriggerEvent = (def: EventDef) => { socket.emit('event:preview', def) }

  const value: AssetLibraryContextValue = {
    tab, setTab,
    catalogSearch, setCatalogSearch, catalogKindFilter, setCatalogKindFilter,
    selectedCatalogAsset, setSelectedCatalogAssetId,
    catalogFolderGroups, catalogLoading, catalogError, refreshCatalog,
    handleDeleteCatalogAsset,
    eventSearch, setEventSearch, filteredEventDefs, filteredEventPresets,
    selectedEventId, editingEvent, eventDraftOriginalId: eventDraft?.originalId ?? null,
    selectEvent, createEventDraft, patchEventDraft, saveEventDraft, deleteEventDraft, handleTriggerEvent,
    sourceSearch, setSourceSearch, filteredSourcePresets, selectedSourcePresetId, setSelectedSourcePresetId,
    editingSourcePreset, selectedSourceMeta, sourcePresetOriginalId: sourcePresetDraft?.originalId ?? null,
    sourceDraftCreatesNewPreset, selectedSourceUsageCount, usageCountByPreset,
    createSourcePresetDraft, patchSourcePresetDraft, saveSourcePresetDraft, deleteSourcePresetDraft,
    transitionSearch, setTransitionSearch, filteredSystemTransitions, filteredTransitionLibrary,
    selectedTransition, setSelectedTransitionKey,
    handleSave, handleDeleteMediaEntry,
    name, setName, url, setUrl, durStr, setDurStr,
    pendingTransitionKind, resetForm,
  }

  return <AssetLibraryContext.Provider value={value}>{children}</AssetLibraryContext.Provider>
}
