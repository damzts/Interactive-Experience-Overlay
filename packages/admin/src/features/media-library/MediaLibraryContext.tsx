import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_EVENT_DEFS, createBlankEventDef, type EventDef, type EventDraft } from './eventPresets'
import { deleteMediaFile, mediaEntryToRecord, useMediaCatalog, type MediaKind, type MediaRecord } from '../../shared/catalog'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { RENDERER_CATALOG, findRendererCatalogEntry } from '@ieomlabs/shared'
import { getSafeSceneWindows } from '../../shared/windowCatalog'
import type { WindowPreset } from '@ieomlabs/shared'

export type MediaLibraryTab = 'catalog' | 'events' | 'sources'

// ── Per-tab state interfaces ───────────────────────────────────────

export interface CatalogTabState {
  catalogSearch: string
  setCatalogSearch: (v: string) => void
  catalogKindFilter: 'all' | MediaKind
  setCatalogKindFilter: (v: 'all' | MediaKind) => void
  selectedCatalogAsset: MediaRecord | null
  setSelectedCatalogAssetId: (id: string | null) => void
  catalogFolderGroups: Array<{ folder: string; items: MediaRecord[] }>
  catalogLoading: boolean
  catalogError: string | null
  refreshCatalog: () => void
  handleDeleteCatalogAsset: (asset: MediaRecord) => void
  handleDeleteMediaEntry: (id: string) => void
}

export interface EventsTabState {
  eventSearch: string
  setEventSearch: (v: string) => void
  filteredEventDefs: EventDef[]
  selectedEventId: string | null
  editingEvent: EventDraft | null
  eventDraftOriginalId: string | null
  selectEvent: (id: string) => void
  createEventDraft: (presetType: 'effect' | 'action') => void
  patchEventDraft: (updated: EventDraft) => void
  saveEventDraft: () => void
  deleteEventDraft: () => void
  handleTriggerEvent: (def: EventDraft) => void
}

export interface SourcesTabState {
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
}

export interface MediaLibraryContextValue
  extends CatalogTabState,
    EventsTabState,
    SourcesTabState {
  tab: MediaLibraryTab
  setTab: (t: MediaLibraryTab) => void
}

// ── Context + hooks ────────────────────────────────────────────────

const MediaLibraryContext = createContext<MediaLibraryContextValue | null>(null)

export function useMediaLibrary(): MediaLibraryContextValue {
  const ctx = useContext(MediaLibraryContext)
  if (!ctx) throw new Error('useMediaLibrary must be used within MediaLibraryProvider')
  return ctx
}

export function useMediaLibraryOptional(): MediaLibraryContextValue | null {
  return useContext(MediaLibraryContext)
}

// ── Provider ───────────────────────────────────────────────────────

export function MediaLibraryProvider({ children }: { children: ReactNode }) {
  const config        = useAdminStore((s) => s.config)
  const sourceMedia   = useAdminStore((s) => s.config.sourceMedia ?? [])
  const eventDefs     = useAdminStore((s) => (s.config.sourceEvents ?? DEFAULT_EVENT_DEFS) as EventDef[])
  const saveConfig    = useAdminStore((s) => s.saveConfig)
  const { assets: catalogAssets, loading: catalogLoading, error: catalogError, refresh: refreshCatalog } = useMediaCatalog()

  const [tab, setTab]                       = useState<MediaLibraryTab>('sources')
  const [catalogSearch, setCatalogSearch]   = useState('')
  const [catalogKindFilter, setCatalogKindFilter] = useState<'all' | MediaKind>('all')
  const [selectedCatalogAssetId, setSelectedCatalogAssetId] = useState<string | null>(null)
  const [eventSearch, setEventSearch]       = useState('')
  const [eventDraft, setEventDraft]         = useState<{ event: EventDraft; originalId: string | null } | null>(null)
  const [sourceSearch, setSourceSearch]     = useState('')
  const [selectedSourcePresetId, setSelectedSourcePresetId] = useState<string | null>(
    (useAdminStore.getState().config.windowPresets ?? [])[0]?.id ?? null
  )
  const [sourcePresetDraft, setSourcePresetDraft] = useState<{
    preset: WindowPreset
    originalId: string | null
    originalLabel: string | null
  } | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const sourcePresets = config.windowPresets ?? []

  // ── Derived: Events ──────────────────────────────────────────────

  const filteredEventDefs = useMemo(() => {
    const q = eventSearch.trim().toLowerCase()
    if (!q) return eventDefs
    return eventDefs.filter((d) => [d.label, d.desc, d.id].some((v) => v.toLowerCase().includes(q)))
  }, [eventDefs, eventSearch])

  // ── Derived: Catalog ─────────────────────────────────────────────

  const catalogSavedAssets = useMemo(() => sourceMedia.map(mediaEntryToRecord), [sourceMedia])

  const filteredCatalogAssets = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase()
    const matches = (a: MediaRecord) => {
      if (catalogKindFilter !== 'all' && a.kind !== catalogKindFilter) return false
      if (!q) return true
      return [a.name, a.url, a.folder, a.relativePath, a.game ?? ''].some((v) => v.toLowerCase().includes(q))
    }
    return [...catalogSavedAssets, ...catalogAssets].filter(matches)
  }, [catalogAssets, catalogKindFilter, catalogSavedAssets, catalogSearch])

  const catalogFolderGroups = useMemo(() => {
    const groups = new Map<string, MediaRecord[]>()
    for (const asset of filteredCatalogAssets) {
      const prefix =
        asset.source === 'saved'
          ? 'Saved Media'
          : asset.source === 'games'
          ? `Game Images${asset.game ? ` / ${asset.game}` : ''}`
          : `Project Assets / ${asset.folder}`
      const list = groups.get(prefix)
      if (list) list.push(asset)
      else groups.set(prefix, [asset])
    }
    return Array.from(groups.entries())
      .map(([folder, items]) => ({ folder, items: [...items].sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.folder.localeCompare(b.folder))
  }, [filteredCatalogAssets])

  const selectedCatalogAsset = useMemo(
    () => filteredCatalogAssets.find((a) => a.id === selectedCatalogAssetId) ?? filteredCatalogAssets[0] ?? null,
    [filteredCatalogAssets, selectedCatalogAssetId]
  )

  // ── Derived: Sources ─────────────────────────────────────────────

  const filteredSourcePresets = useMemo(() => {
    const q = sourceSearch.trim().toLowerCase()
    if (!q) return sourcePresets
    return sourcePresets.filter((p) => [p.label, p.id, p.rendererType].some((v) => v.toLowerCase().includes(q)))
  }, [sourcePresets, sourceSearch])

  const usageCountByPreset = useMemo(
    () =>
      Object.values(config.scenes).reduce<Record<string, number>>((counts, scene) => {
        for (const w of getSafeSceneWindows(scene)) {
          if (!w.windowPresetId) continue
          counts[w.windowPresetId] = (counts[w.windowPresetId] ?? 0) + 1
        }
        return counts
      }, {}),
    [config.scenes]
  )

  const selectedSourcePreset = useMemo(
    () => (selectedSourcePresetId ? sourcePresets.find((p) => p.id === selectedSourcePresetId) ?? null : null),
    [selectedSourcePresetId, sourcePresets]
  )

  const editingSourcePreset = sourcePresetDraft?.preset ?? selectedSourcePreset
  const selectedSourceMeta  = editingSourcePreset ? findRendererCatalogEntry(editingSourcePreset.rendererType) : undefined
  const sourceDraftCreatesNewPreset =
    !!sourcePresetDraft &&
    (!sourcePresetDraft.originalId || sourcePresetDraft.originalLabel?.trim() !== sourcePresetDraft.preset.label.trim())
  const selectedSourceUsageCount = selectedSourcePreset ? usageCountByPreset[selectedSourcePreset.id] ?? 0 : 0

  const editingEvent = eventDraft?.event ?? null

  // ── Sync effects ─────────────────────────────────────────────────

  useEffect(() => {
    if (selectedEventId && !eventDefs.some((d) => d.id === selectedEventId)) setSelectedEventId(null)
  }, [eventDefs, selectedEventId])

  useEffect(() => {
    if (filteredSourcePresets.length === 0) {
      if (selectedSourcePresetId !== null) setSelectedSourcePresetId(null)
      return
    }
    if (sourcePresetDraft && !sourcePresetDraft.originalId) return
    if (!selectedSourcePresetId || !filteredSourcePresets.some((p) => p.id === selectedSourcePresetId)) {
      setSelectedSourcePresetId(filteredSourcePresets[0].id)
    }
  }, [filteredSourcePresets, selectedSourcePresetId, sourcePresetDraft])

  useEffect(() => {
    if (!selectedSourcePresetId) return
    const preset = sourcePresets.find((e) => e.id === selectedSourcePresetId)
    if (!preset || sourcePresetDraft?.originalId === preset.id) return
    setSourcePresetDraft({
      preset: { ...preset, config: { ...preset.config }, defaultPosition: preset.defaultPosition ? { ...preset.defaultPosition } : undefined },
      originalId: preset.id,
      originalLabel: preset.label,
    })
  }, [selectedSourcePresetId, sourcePresets, sourcePresetDraft?.originalId])

  useEffect(() => {
    if (filteredCatalogAssets.length === 0) {
      if (selectedCatalogAssetId !== null) setSelectedCatalogAssetId(null)
      return
    }
    if (!selectedCatalogAssetId || !filteredCatalogAssets.some((a) => a.id === selectedCatalogAssetId)) {
      setSelectedCatalogAssetId(filteredCatalogAssets[0].id)
    }
  }, [filteredCatalogAssets, selectedCatalogAssetId])

  // ── Handlers ─────────────────────────────────────────────────────

  const handleDeleteMediaEntry = async (id: string) => {
    await saveConfig({ sourceMedia: sourceMedia.filter((e) => e.id !== id) })
  }

  const saveSourcePresets = (next: WindowPreset[]) => { void saveConfig({ windowPresets: next }) }

  const removeSourcePreset = (presetId: string) => {
    saveSourcePresets(sourcePresets.filter((p) => p.id !== presetId))
    if (selectedSourcePresetId === presetId)
      setSelectedSourcePresetId((sourcePresets.filter((p) => p.id !== presetId))[0]?.id ?? null)
  }

  const createSourcePresetDraft = (entry: typeof RENDERER_CATALOG[number]) => {
    const defaultPosition = entry.defaultPosition ?? { x: 0, y: 0, width: 1920, height: 1080 }
    const newPreset: WindowPreset = {
      id: `${entry.id}-${Date.now()}`,
      label: entry.label,
      rendererType: entry.id,
      config: { ...entry.defaultConfig },
      defaultPosition: { ...defaultPosition },
    }
    setSourcePresetDraft({ preset: newPreset, originalId: null, originalLabel: null })
    setSelectedSourcePresetId(null)
    setTab('sources')
  }

  const patchSourcePresetDraft = (updates: Partial<WindowPreset>) => {
    setSourcePresetDraft((cur) => (cur ? { ...cur, preset: { ...cur.preset, ...updates } } : cur))
  }

  const saveSourcePresetDraft = () => {
    if (!sourcePresetDraft) return
    const label =
      sourcePresetDraft.preset.label.trim() ||
      findRendererCatalogEntry(sourcePresetDraft.preset.rendererType)?.label ||
      'Untitled preset'
    const normalizedPreset: WindowPreset = {
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
      const next = sourcePresets.map((p) =>
        p.id === sourcePresetDraft.originalId ? { ...normalizedPreset, id: sourcePresetDraft.originalId } : p
      )
      saveSourcePresets(next)
      setSelectedSourcePresetId(sourcePresetDraft.originalId)
      setSourcePresetDraft({
        preset: { ...normalizedPreset, id: sourcePresetDraft.originalId },
        originalId: sourcePresetDraft.originalId,
        originalLabel: label,
      })
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

  const handleDeleteCatalogAsset = async (asset: MediaRecord) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${asset.name}?`)) return
    if (asset.source === 'saved') { await handleDeleteMediaEntry(asset.id); return }
    if (asset.source === 'filesystem') { await deleteMediaFile(asset.url); await refreshCatalog() }
  }

  const createEventDraft = (presetType: 'effect' | 'action') => {
    const def = createBlankEventDef(presetType)
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

  const patchEventDraft = (updated: EventDraft) => {
    setEventDraft((cur) => (cur ? { ...cur, event: updated } : cur))
  }

  const saveEventDraft = () => {
    if (!eventDraft) return
    // Blank (not-yet-typed) action/effect rows are intentionally persisted as-is —
    // scene.ts's action executor and the overlay's dispatchEffect both no-op on an
    // empty kind/type, same as a scene window with no rendererType set.
    // A typed preset (presetType set) only ever persists its own section —
    // the editor already only renders one, but this keeps a stale section
    // from a pre-split legacy preset from surviving an edit+save round trip.
    const presetType = eventDraft.event.presetType
    const defaultLabel = presetType === 'effect' ? 'New Effect' : presetType === 'action' ? 'New Action' : 'New Event'
    const normalizedEvent = {
      ...eventDraft.event,
      label:   eventDraft.event.label.trim() || defaultLabel,
      icon:    eventDraft.event.icon || '⚡',
      desc:    eventDraft.event.desc ?? '',
      actions: presetType === 'effect' ? [] : structuredClone(eventDraft.event.actions ?? []),
      effects: presetType === 'action' ? [] : structuredClone(eventDraft.event.effects ?? []),
      auto:    { ...eventDraft.event.auto },
    } as EventDef
    if (eventDraft.originalId) {
      void saveConfig({
        sourceEvents: eventDefs.map((e) =>
          e.id === eventDraft.originalId ? { ...normalizedEvent, id: eventDraft.originalId } : e
        ),
      })
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

  const handleTriggerEvent = (def: EventDraft) => socket.emit('event:preview', def)

  // ── Context value ─────────────────────────────────────────────────

  const value: MediaLibraryContextValue = {
    tab, setTab,
    // catalog
    catalogSearch, setCatalogSearch, catalogKindFilter, setCatalogKindFilter,
    selectedCatalogAsset, setSelectedCatalogAssetId,
    catalogFolderGroups, catalogLoading, catalogError, refreshCatalog, handleDeleteCatalogAsset,
    handleDeleteMediaEntry,
    // events
    eventSearch, setEventSearch, filteredEventDefs,
    selectedEventId, editingEvent, eventDraftOriginalId: eventDraft?.originalId ?? null,
    selectEvent, createEventDraft, patchEventDraft, saveEventDraft, deleteEventDraft, handleTriggerEvent,
    // sources
    sourceSearch, setSourceSearch, filteredSourcePresets, selectedSourcePresetId, setSelectedSourcePresetId,
    editingSourcePreset, selectedSourceMeta, sourcePresetOriginalId: sourcePresetDraft?.originalId ?? null,
    sourceDraftCreatesNewPreset, selectedSourceUsageCount, usageCountByPreset,
    createSourcePresetDraft, patchSourcePresetDraft, saveSourcePresetDraft, deleteSourcePresetDraft,
  }

  return <MediaLibraryContext.Provider value={value}>{children}</MediaLibraryContext.Provider>
}
