import { useCallback, useState } from 'react'
import type { SourceInstance, SourcePreset } from '@ieomlabs/shared'
import { resolveSourceInstance } from '@ieomlabs/shared'
import { SOURCE_CATALOG } from '../../shared/sourceCatalog'
import { Button } from '../../components/atoms'
import { Card } from '../../components/molecules'
import type { TierName } from '@ieomlabs/shared'

// ── Notice ─────────────────────────────────────────────────────────────

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm rounded-xl border border-[var(--color-primary-500)]/25 bg-[var(--color-primary-500)]/10 text-[var(--color-primary-100)] px-3 py-2.5">
      {children}
    </div>
  )
}

// ── SourcesEditor ──────────────────────────────────────────────────────

const TIERS: TierName[] = ['background', 'particles', 'content', 'post', 'transition']

export function SourcesEditor({
  sources,
  sourcePresets,
  onChange,
}: {
  sources: SourceInstance[]
  sourcePresets: SourcePreset[]
  onChange: (next: SourceInstance[]) => void
}) {
  const [addMode, setAddMode] = useState<'catalog' | 'preset'>('catalog')

  const normalizeOrder = useCallback((ordered: SourceInstance[]) =>
    ordered.map((source, index) => ({ ...source, zIndex: index })), [])

  const toggle = (id: string) =>
    onChange(sources.map((s) => s.id === id ? { ...s, visible: !s.visible } : s))

  const remove = (id: string) =>
    onChange(sources.filter((s) => s.id !== id))

  const moveUp = (id: string) => {
    const ordered = [...sources].sort((a, b) => a.zIndex - b.zIndex)
    const index = ordered.findIndex((s) => s.id === id)
    if (index <= 0) return
    ;[ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]]
    onChange(normalizeOrder(ordered))
  }

  const moveDown = (id: string) => {
    const ordered = [...sources].sort((a, b) => a.zIndex - b.zIndex)
    const index = ordered.findIndex((s) => s.id === id)
    if (index < 0 || index === ordered.length - 1) return
    ;[ordered[index], ordered[index + 1]] = [ordered[index + 1], ordered[index]]
    onChange(normalizeOrder(ordered))
  }

  const updateTier = (id: string, tier: TierName) =>
    onChange(sources.map((s) => s.id === id ? { ...s, tier } : s))

  const updateSourcePreset = (id: string, presetId: string) =>
    onChange(sources.map((s) => s.id === id ? { ...s, sourcePresetId: presetId || undefined, pluginType: undefined } : s))

  const updatePluginType = (id: string, pluginType: string) => {
    const entry = SOURCE_CATALOG.find((c) => c.type === pluginType)
    onChange(sources.map((s) => s.id === id
      ? { ...s, pluginType, sourcePresetId: undefined, config: entry?.defaultConfig ?? {} }
      : s))
  }

  const addFromCatalog = (type: string) => {
    const entry = SOURCE_CATALOG.find((c) => c.type === type)
    if (!entry) return
    const isTierSource = type.startsWith('builtin:')
    const tier: TierName = type === 'builtin:background' ? 'background'
      : type === 'builtin:particles' ? 'particles'
      : type === 'builtin:effects'   ? 'post'
      : 'content'
    const newSrc: SourceInstance & { tier?: TierName } = {
      id: `src-${Date.now()}`,
      pluginType: type,
      config: structuredClone(entry.defaultConfig),
      position: entry.defaultPosition ?? { x: 0, y: 0, width: 1920, height: 1080 },
      zIndex: sources.length,
      visible: true,
      ...(isTierSource ? { tier } : {}),
    }
    onChange([...sources, newSrc as SourceInstance])
  }

  const addFromPreset = () => {
    onChange([...sources, {
      id: `src-${Date.now()}`,
      sourcePresetId: undefined,
      position: { x: 0, y: 0, width: 1920, height: 1080 },
      zIndex: sources.length,
      visible: true,
    }])
  }

  const sorted = [...sources].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div className="space-y-2">
      {sorted.map((src) => {
        const resolved = resolveSourceInstance(src, sourcePresets)
        const pluginType = resolved?.pluginType ?? (src as any).pluginType ?? src.pluginType
        const meta = SOURCE_CATALOG.find((c) => c.type === pluginType)
        const srcTier = (src as any).tier as TierName | undefined
        return (
          <Card key={src.id} variant="default" padding="sm" className="overflow-hidden !p-0">
            <div className="flex items-center gap-2 px-3 py-2">
              {/* Visibility dot */}
              <button type="button" title={src.visible ? 'Hide' : 'Show'} onClick={() => toggle(src.id)}
                className={'w-2 h-2 rounded-full shrink-0 transition-colors ' + (src.visible ? 'bg-[var(--color-success-400)]' : 'bg-[var(--color-text-muted)]')} />

              <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">{meta?.icon ?? '▣'}</span>

              <div className="min-w-0 flex-1 space-y-1">
                {/* Plugin type or preset selector */}
                {src.sourcePresetId !== undefined || (!pluginType) ? (
                  <>
                    {src.sourcePresetId && !sourcePresets.find((p) => p.id === src.sourcePresetId) && (
                      <div className="text-[10px] text-[var(--color-danger-400)]">⚠ Preset not found: {src.sourcePresetId}</div>
                    )}
                    <select value={src.sourcePresetId ?? ''} onChange={(e) => updateSourcePreset(src.id, e.target.value)} className="w-full text-xs">
                      <option value="">— preset —</option>
                      {sourcePresets.map((p) => {
                        const m = SOURCE_CATALOG.find((c) => c.type === p.pluginType)
                        return <option key={p.id} value={p.id}>{p.label} · {m?.label ?? p.pluginType}</option>
                      })}
                    </select>
                  </>
                ) : (
                  <select value={pluginType ?? ''} onChange={(e) => updatePluginType(src.id, e.target.value)} className="w-full text-xs">
                    <option value="">— type —</option>
                    {SOURCE_CATALOG.map((c) => (
                      <option key={c.type} value={c.type}>{c.icon} {c.label}</option>
                    ))}
                  </select>
                )}

                {/* Tier selector */}
                <select
                  value={srcTier ?? 'content'}
                  onChange={(e) => updateTier(src.id, e.target.value as TierName)}
                  className="w-full text-[10px] text-[var(--color-text-muted)]"
                >
                  {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                <Button variant="ghost" size="sm" onClick={() => moveUp(src.id)} disabled={sorted[0]?.id === src.id} className="px-2 py-1 text-[10px]">↑</Button>
                <Button variant="ghost" size="sm" onClick={() => moveDown(src.id)} disabled={sorted[sorted.length - 1]?.id === src.id} className="px-2 py-1 text-[10px]">↓</Button>
              </div>
              <Button variant="danger" size="sm" onClick={() => remove(src.id)} className="px-2 py-0.5 text-[10px]">✕</Button>
            </div>
          </Card>
        )
      })}

      {/* Add controls */}
      <div className="flex gap-1 pt-1">
        <Button
          variant="ghost" size="sm"
          onClick={() => { setAddMode('catalog'); addFromCatalog('solid-color') }}
          className="flex-1 border-dashed border-[var(--color-border-strong)] py-2 text-xs justify-center"
        >
          + From catalog
        </Button>
        {sourcePresets.length > 0 && (
          <Button
            variant="ghost" size="sm"
            onClick={() => { setAddMode('preset'); addFromPreset() }}
            className="flex-1 border-dashed border-[var(--color-border-strong)] py-2 text-xs justify-center"
          >
            + From preset
          </Button>
        )}
      </div>

      {/* Quick-add catalog grid */}
      <div className="grid grid-cols-4 gap-1">
        {SOURCE_CATALOG.map((entry) => (
          <button
            key={entry.type}
            type="button"
            title={entry.desc}
            onClick={() => addFromCatalog(entry.type)}
            className="flex flex-col items-center gap-0.5 rounded-lg border border-[var(--color-border-strong)] bg-white/[0.02] px-1 py-2 text-center hover:bg-white/[0.06] transition-colors"
          >
            <span className="text-lg leading-none">{entry.icon}</span>
            <span className="text-[9px] text-[var(--color-text-muted)] leading-tight">{entry.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
