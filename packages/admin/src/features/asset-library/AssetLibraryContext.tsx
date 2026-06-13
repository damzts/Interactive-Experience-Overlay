import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_EVENT_DEFS, EVENT_PRESET_OPTIONS, createEventPreset, type EventDef, type EventPresetId } from './eventPresets'
import { deleteAssetFile, inferAssetKindFromUrl, mediaEntryToAsset, useAssetCatalog, type AssetKind, type AssetRecord } from '../../shared/catalog'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { RENDERER_CATALOG, findRendererCatalogEntry } from '@ieomlabs/shared'
import { getSafeSceneWindows } from '../../shared/windowCatalog'
import { TRANSITION_OPTIONS, getMediaTransitionLabel } from '../../shared/transitionLibrary'
import type { MediaEntry, WindowPreset } from '@ieomlabs/shared'

export type AssetLibraryTab = 'catalog' | 'events' | 'sources' | 'transitions'

export interface AssetLibraryContextValue {
  tab: AssetLibraryTab
  setTab: (t: AssetLibraryTab) => void
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
  sourceSearch: string
  setSourceSearch: (v: string) => void
  filteredSourcePresets: WindowPreset[]
  selectedSourcePresetId: string | null
  setSelectedSourcePresetId: (id: string | null) => void
  editingSourcePreset: WindowPreset | null
  selectedSourceMeta: ReturnType<typeof findRendererCatalogEntry>
  sourcePresetOriginalId: string | null
  sourceDraftCreatesNewPreset: boolean
  selectedSourceUsageCount: number
  usageCountByPreset: Record<string, number>
  createSourcePresetDraft: (entry: typeof RENDERER_CATALOG[number]) => void
  patchSourcePresetDraft: (updates: Partial<WindowPreset>) => void
  saveSourcePresetDraft: () => void
  deleteSourcePresetDraft: () => void
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

export function useAssetLibraryOptional(): AssetLibraryContextValue | null {
  return useContext(AssetLibraryContext)
}

export function AssetLibraryProvider({ children }: { children: ReactNode }) {
  const config      = useAdminStore((s) => s.config)
  const sourceMedia = useAdminStore((s) => s.config.sourceMedia ?? [])
  const eventDefs   = useAdminStore((s) => (s.config.sourceEvents ?? DEFAULT_EVENT_DEFS) as EventDef[])
  const widgetIds   = useAdminStore((s) => s.config.applications.map((a) => a.id))
  const widgetLayouts = useAdminStore((s) => s.config.widgetLayouts ?? [])
  const saveConfig  = useAdminStore((s) => s.saveConfig)
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
  const [selectedSourcePresetId, setSelectedSourcePresetId] = useState<string | null>((useAdminStore.getState().config.windowPresets ?? [])[0]?.id ?? null)
  const [sourcePresetDraft, setSourcePresetDraft] = useState<{ preset: WindowPreset; originalId: string | null; originalLabel: string | null } | null>(null)
  const [transitionSearch, setTransitionSearch] = useState('')
  const [selectedTransitionKey, setSelectedTransitionKey] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const sourcePresets = config.windowPresets ?? []
  const resetForm = () => { setName(''); setUrl(''); setDurStr('') }

  const filteredEventDefs = useMemo(() => {
    const q = eventSearch.trim().toLowerCase()
    if (!q) return eventDefs
    return eventDefs.filter((d) => [d.label, d.desc, d.id].some((v) => v.toLowerCase().includes(q)))
  }, [eventDefs, eventSearch])

  const filteredEventPresets = useMemo(() => {
    const q = eventSearch.trim().toLowerCase()
    return EVENT_PRESET_OPTIONS.filter((p) => p.id !== 'blank' && (!q || [p.label, p.description, p.id].some((v) => v.toLowerCase().includes(q))))
  }, [eventSearch])

  const catalogSavedAssets = useMemo(() => sourceMedia.map(mediaEntryToAsset), [sourceMedia])
  const filteredCatalogAssets = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase()
    const matches = (a: AssetRecord) => {
      if (catalogKindFilter !== 'all' && a.kind !== catalogKindFilter) return false
      if (!q) return true
      return [a.name, a.url, a.folder, a.relativePath, a.game ?? ''].some((v) => v.toLowerCase().includes(q))
    }
    return [...catalogSavedAssets, ...catalogAssets].filter(matches)
  }, [catalogAssets, catalogKindFilter, catalogSavedAssets, catalogSearch])

  const catalogFolderGroups = useMemo(() => {
    const groups = new Map<string, AssetRecord[]>()
    for (const asset of filteredCatalogAssets) {
      const prefix = asset.source === 'saved' ? 'Saved Media' : asset.source === 'games' ? `Game Images${asset.game ? ` / ${asset.game}` : ''}` : `Project Assets / ${asset.folder}`
      const list = groups.get(prefix); if (list) list.push(asset); else groups.set(prefix, [asset])
    }
    return Array.from(groups.entries())
      .map(([folder, items]) => ({ folder, items: [...items].sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.folder.localeCompare(b.folder))
  }, [filteredCatalogAssets])

  const sortedTransitionLibrary = useMemo(() => (
    [...sourceMedia].sort((a, b) => getMediaTransitionLabel(a).localeCompare(getMediaTransitionLabel(b)))
  ), [sourceMedia])

  const filteredSystemTransitions = useMemo(() => {
    const q = transitionSearch.trim().toLowerCase()
    if (!q) return TRANSITION_OPTIONS
    return TRANSITION_OPTIONS.filter((t) => [t.id, t.label].some((v) => v.toLowerCase().includes(q)))
  }, [transitionSearch])

  const filteredTransitionLibrary = useMemo(() => {
    const q = transitionSearch.trim().toLowerCase()
    if (!q) return sortedTransitionLibrary
    return sortedTransitionLibrary.filter((e) => [e.name, e.url, e.id, getMediaTransitionLabel(e)].some((v) => v.toLowerCase().includes(q)))
  }, [sortedTransitionLibrary, transitionSearch])

  const selectedCatalogAsset = useMemo(() => (
    filteredCatalogAssets.find((a) => a.id === selectedCatalogAssetId) ?? filteredCatalogAssets[0] ?? null
  ), [filteredCatalogAssets, selectedCatalogAssetId])

  const selectedTransition = useMemo(() => {
    if (!selectedTransitionKey) return filteredSystemTransitions[0] ? { kind: 'system' as const, entry: filteredSystemTransitions[0] } : filteredTransitionLibrary[0] ? { kind: 'user' as const, entry: filteredTransitionLibrary[0] } : null
    if (selectedTransitionKey.startsWith('system:')) {
      const entry = filteredSystemTransitions.find((t) => t.id === selectedTransitionKey.slice(7))
      return entry ? { kind: 'system' as const, entry } : null
    }
    const entry = filteredTransitionLibrary.find((t) => t.id === selectedTransitionKey.slice(5))
    return entry ? { kind: 'user' as const, entry } : null
  }, [filteredSystemTransitions, filteredTransitionLibrary, selectedTransitionKey])

  const filteredSourcePresets = useMemo(() => {
    const q = sourceSearch.trim().toLowerCase()
    if (!q) return sourcePresets
    return sourcePresets.filter((p) => [p.label, p.id, p.rendererType].some((v) => v.toLowerCase().includes(q)))
  }, [sourcePresets, sourceSearch])

  const usageCountByPreset = useMemo(() => (
    Object.values(config.scenes).reduce<Record<string, number>>((counts, scene) => {
      for (const w of getSafeSceneWindows(scene)) {
        if (!w.windowPresetId) continue
        counts[w.windowPresetId] = (counts[w.windowPresetId] ?? 0) + 1
      }
      return counts
    }, {})
  ), [config.scenes])

  const selectedSourcePreset = useMemo(() => (
    selectedSourcePresetId ? sourcePresets.find((p) => p.id === selectedSourcePresetId) ?? null : null
  ), [selectedSourcePresetId, sourcePresets])

  const editingSourcePreset = sourcePresetDraft?.preset ?? selectedSourcePreset
  const selectedSourceMeta = editingSourcePreset ? findRendererCatalogEntry(editingSourcePreset.rendererType) : undefined
  const sourceDraftCreatesNewPreset = !!sourcePresetDraft && (!sourcePresetDraft.originalId || sourcePresetDraft.originalLabel?.trim() !== sourcePresetDraft.preset.label.trim())
  const selectedSourceUsageCount = selectedSourcePreset ? usageCountByPreset[selectedSourcePreset.id] ?? 0 : 0

  const pendingTransitionKind = useMemo(() => {
    const inferred = inferAssetKindFromUrl(url, 'image')
    return inferred === 'video' ? 'video' : 'image'
  }, [url])

  const editingEvent = eventDraft?.event ?? null

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
    if (!preset || sourcePresetDraft?.originalId === preset.id) return
    setSourcePresetDraft({ preset: { ...preset, config: { ...preset.config }, defaultPosition: preset.defaultPosition ? { ...preset.defaultPosition } : undefined }, originalId: preset.id, originalLabel: preset.label })
  }, [selectedSourcePresetId, sourcePresets, sourcePresetDraft?.originalId])

  useEffect(() => {
    if (filteredCatalogAssets.length === 0) { if (selectedCatalogAssetId !== null) setSelectedCatalogAssetId(null); return }
    if (!selectedCatalogAssetId || !filteredCatalogAssets.some((a) => a.id === selectedCatalogAssetId)) setSelectedCatalogAssetId(filteredCatalogAssets[0].id)
  }, [filteredCatalogAssets, selectedCatalogAssetId])

  useEffect(() => {
    const options = [...filteredSystemTransitions.map((t) => `system:${t.id}`), ...filteredTransitionLibrary.map((t) => `user:${t.id}`)]
    if (options.length === 0) { if (selectedTransitionKey !== null) setSelectedTransitionKey(null); return }
    if (!selectedTransitionKey || !options.includes(selectedTransitionKey)) setSelectedTransitionKey(options[0])
  }, [filteredSystemTransitions, filteredTransitionLibrary, selectedTransitionKey])

  // ── Handlers ───────────────────────────────────────────────────

  const handleSave = async () => {
    if (!url) return
    const durVal = parseFloat(durStr)
    const type = pendingTransitionKind
    const hasDur = type === 'image' && !Number.isNaN(durVal) && durVal > 0
    const entry: MediaEntry = { id: 'media-' + Date.now(), name: name.trim() || url.split('/').pop() || 'Unnamed', type, url, ...(hasDur ? { duration: durVal } : {}) }
    await saveConfig({ sourceMedia: [...sourceMedia, entry] })
    resetForm()
  }

  const handleDeleteMediaEntry = async (id: string) => {
    await saveConfig({ sourceMedia: sourceMedia.filter((e) => e.id !== id) })
  }

  const saveSourcePresets = (next: WindowPreset[]) => {
    void saveConfig({ windowPresets: next })
  }

  const removeSourcePreset = (presetId: string) => {
    saveSourcePresets(sourcePresets.filter((p) => p.id !== presetId))
    if (selectedSourcePresetId === presetId) setSelectedSourcePresetId((sourcePresets.filter((p) => p.id !== presetId))[0]?.id ?? null)
  }

  const createSourcePresetDraft = (entry: typeof RENDERER_CATALOG[number]) => {
    const defaultPosition = entry.defaultPosition ?? { x: 0, y: 0, width: 1920, height: 1080 }
    const newPreset: WindowPreset = { id: `${entry.id}-${Date.now()}`, label: entry.label, rendererType: entry.id, config: { ...entry.defaultConfig }, defaultPosition: { ...defaultPosition } }
    setSourcePresetDraft({ preset: newPreset, originalId: null, originalLabel: null })
    setSelectedSourcePresetId(null)
    setTab('sources')
  }

  const patchSourcePresetDraft = (updates: Partial<WindowPreset>) => {
    setSourcePresetDraft((cur) => cur ? { ...cur, preset: { ...cur.preset, ...updates } } : cur)
  }

  const saveSourcePresetDraft = () => {
    if (!sourcePresetDraft) return
    const label = sourcePresetDraft.preset.label.trim() || findRendererCatalogEntry(sourcePresetDraft.preset.rendererType)?.label || 'Untitled preset'
    const normalizedPreset: WindowPreset = { ...sourcePresetDraft.preset, label, config: { ...sourcePresetDraft.preset.config }, defaultPosition: { x: sourcePresetDraft.preset.defaultPosition?.x ?? 0, y: sourcePresetDraft.preset.defaultPosition?.y ?? 0, width: sourcePresetDraft.preset.defaultPosition?.width ?? 1920, height: sourcePresetDraft.preset.defaultPosition?.height ?? 1080 } }
    if (sourcePresetDraft.originalId && sourcePresetDraft.originalLabel?.trim() === label) {
      const next = sourcePresets.map((p) => p.id === sourcePresetDraft.originalId ? { ...normalizedPreset, id: sourcePresetDraft.originalId } : p)
      saveSourcePresets(next)
      setSelectedSourcePresetId(sourcePresetDraft.originalId)
      setSourcePresetDraft({ preset: { ...normalizedPreset, id: sourcePresetDraft.originalId }, originalId: sourcePresetDraft.originalId, originalLabel: label })
      return
    }
    const savedPreset = { ...normalizedPreset, id: `${normalizedPreset.rendererType}-${Date.now()}` }
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
    const def = eventDefs.find((e) => e.id === eventId)
    if (!def) return
    setSelectedEventId(eventId)
    setEventDraft({ event: structuredClone(def), originalId: def.id })
  }

  const patchEventDraft = (updated: EventDef) => {
    setEventDraft((cur) => cur ? { ...cur, event: updated } : cur)
  }

  const saveEventDraft = () => {
    if (!eventDraft) return
    const normalizedEvent: EventDef = { ...eventDraft.event, label: eventDraft.event.label.trim() || 'New Event', icon: eventDraft.event.icon || '⚡', desc: eventDraft.event.desc ?? '', actions: structuredClone(eventDraft.event.actions ?? []), effects: structuredClone(eventDraft.event.effects ?? []), auto: { ...eventDraft.event.auto } }
    if (eventDraft.originalId) {
      void saveConfig({ sourceEvents: eventDefs.map((e) => e.id === eventDraft.originalId ? { ...normalizedEvent, id: eventDraft.originalId } : e) })
      setSelectedEventId(eventDraft.originalId)
      setEventDraft({ event: { ...normalizedEvent, id: eventDraft.originalId }, originalId: eventDraft.originalId })
      return
    }
    void saveConfig({ sourceEvents: [...eventDefs, normalizedEvent] })
    setSelectedEventId(normalizedEvent.id)
    setEventDraft({ event: normalizedEvent, originalId: normalizedEvent.id })
  }

  const deleteEventDraft = () => {
    if (!eventDraft) return
    if (!eventDraft.originalId) { setEventDraft(null); return }
    const id = eventDraft.originalId
    if (selectedEventId === id) setSelectedEventId(null)
    void saveConfig({ sourceEvents: eventDefs.filter((e) => e.id !== id) })
    setEventDraft(null)
  }

  const handleTriggerEvent = (def: EventDef) => socket.emit('event:preview', def)

  const value: AssetLibraryContextValue = {
    tab, setTab,
    catalogSearch, setCatalogSearch, catalogKindFilter, setCatalogKindFilter,
    selectedCatalogAsset, setSelectedCatalogAssetId,
    catalogFolderGroups, catalogLoading, catalogError, refreshCatalog, handleDeleteCatalogAsset,
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
    name, setName, url, setUrl, durStr, setDurStr, pendingTransitionKind, resetForm,
  }

  return <AssetLibraryContext.Provider value={value}>{children}</AssetLibraryContext.Provider>
}
