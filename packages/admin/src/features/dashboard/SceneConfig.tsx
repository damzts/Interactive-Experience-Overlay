import { useCallback } from 'react'
import type { WindowInstance, WindowPreset } from '@ieomlabs/shared'
import { resolveWindowInstance } from '@ieomlabs/shared'
import { RENDERER_CATALOG } from '@ieomlabs/shared'
import { Button } from '../../components/atoms'
import { Card } from '../../components/molecules'
import type { TierName } from '@ieomlabs/shared'

// ── WindowsEditor ──────────────────────────────────────────────────────

const TIERS: TierName[] = ['background', 'particles', 'content', 'post', 'transition']

export function SourcesEditor({
  sources,
  windowPresets,
  onChange,
}: {
  sources: WindowInstance[]
  windowPresets: WindowPreset[]
  onChange: (next: WindowInstance[]) => void
}) {
  const normalizeOrder = useCallback((ordered: WindowInstance[]) =>
    ordered.map((w, index) => ({ ...w, zIndex: index })), [])

  const toggle = (id: string) =>
    onChange(sources.map((w) => w.id === id ? { ...w, visible: !w.visible } : w))

  const remove = (id: string) =>
    onChange(sources.filter((w) => w.id !== id))

  const moveUp = (id: string) => {
    const ordered = [...sources].sort((a, b) => a.zIndex - b.zIndex)
    const index = ordered.findIndex((w) => w.id === id)
    if (index <= 0) return
    ;[ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]]
    onChange(normalizeOrder(ordered))
  }

  const moveDown = (id: string) => {
    const ordered = [...sources].sort((a, b) => a.zIndex - b.zIndex)
    const index = ordered.findIndex((w) => w.id === id)
    if (index < 0 || index === ordered.length - 1) return
    ;[ordered[index], ordered[index + 1]] = [ordered[index + 1], ordered[index]]
    onChange(normalizeOrder(ordered))
  }

  const updateTier = (id: string, tier: TierName) =>
    onChange(sources.map((w) => w.id === id ? { ...w, tier } : w))

  const updateWindowPreset = (id: string, presetId: string) =>
    onChange(sources.map((w) => w.id === id ? { ...w, windowPresetId: presetId || undefined, rendererType: undefined } : w))

  const updateRendererType = (id: string, rendererType: string) => {
    const entry = RENDERER_CATALOG.find((c) => c.id === rendererType)
    onChange(sources.map((w) => w.id === id
      ? { ...w, rendererType, windowPresetId: undefined, config: entry?.defaultConfig ?? {} }
      : w))
  }

  const addFromCatalog = (type: string) => {
    const entry = RENDERER_CATALOG.find((c) => c.id === type)
    if (!entry) return
    const isTierWindow = type.startsWith('builtin:')
    const tier: TierName = type === 'builtin:background' ? 'background'
      : type === 'builtin:particles' ? 'particles'
      : type === 'builtin:effects'   ? 'post'
      : 'content'
    const newWindow: WindowInstance = {
      id: `win-${Date.now()}`,
      rendererType: type,
      config: structuredClone(entry.defaultConfig),
      position: entry.defaultPosition ?? { x: 0, y: 0, width: 1920, height: 1080 },
      zIndex: sources.length,
      visible: true,
      ...(isTierWindow ? { tier } : {}),
    }
    onChange([...sources, newWindow])
  }

  const addFromPreset = () => {
    onChange([...sources, {
      id: `win-${Date.now()}`,
      windowPresetId: undefined,
      position: { x: 0, y: 0, width: 1920, height: 1080 },
      zIndex: sources.length,
      visible: true,
    }])
  }

  const sorted = [...sources].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div className="space-y-2">
      {sorted.map((w) => {
        const resolved = resolveWindowInstance(w, windowPresets)
        const rendererType = resolved?.rendererType ?? w.rendererType
        const meta = RENDERER_CATALOG.find((c) => c.id === rendererType)
        const wTier = w.tier
        return (
          <Card key={w.id} variant="default" padding="sm" className="overflow-hidden !p-0">
            <div className="flex items-center gap-2 px-3 py-2">
              {/* Visibility dot */}
              <button type="button" title={w.visible ? 'Hide' : 'Show'} onClick={() => toggle(w.id)}
                className={'w-2 h-2 rounded-full shrink-0 transition-colors ' + (w.visible ? 'bg-[var(--color-success-400)]' : 'bg-[var(--color-text-muted)]')} />

              <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">{meta?.icon ?? '▣'}</span>

              <div className="min-w-0 flex-1 space-y-1">
                {/* Renderer type or preset selector */}
                {w.windowPresetId !== undefined || (!rendererType) ? (
                  <>
                    {w.windowPresetId && !windowPresets.find((p) => p.id === w.windowPresetId) && (
                      <div className="text-[10px] text-[var(--color-danger-400)]">⚠ Preset not found: {w.windowPresetId}</div>
                    )}
                    <select value={w.windowPresetId ?? ''} onChange={(e) => updateWindowPreset(w.id, e.target.value)} className="w-full text-xs">
                      <option value="">— preset —</option>
                      {windowPresets.map((p) => {
                        const m = RENDERER_CATALOG.find((c) => c.id === p.rendererType)
                        return <option key={p.id} value={p.id}>{p.label} · {m?.label ?? p.rendererType}</option>
                      })}
                    </select>
                  </>
                ) : (
                  <select value={rendererType ?? ''} onChange={(e) => updateRendererType(w.id, e.target.value)} className="w-full text-xs">
                    <option value="">— type —</option>
                    {RENDERER_CATALOG.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                    ))}
                  </select>
                )}

                {/* Tier selector */}
                <select
                  value={wTier ?? 'content'}
                  onChange={(e) => updateTier(w.id, e.target.value as TierName)}
                  className="w-full text-[10px] text-[var(--color-text-muted)]"
                >
                  {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                <Button variant="ghost" size="sm" onClick={() => moveUp(w.id)} disabled={sorted[0]?.id === w.id} className="px-2 py-1 text-[10px]">↑</Button>
                <Button variant="ghost" size="sm" onClick={() => moveDown(w.id)} disabled={sorted[sorted.length - 1]?.id === w.id} className="px-2 py-1 text-[10px]">↓</Button>
              </div>
              <Button variant="danger" size="sm" onClick={() => remove(w.id)} className="px-2 py-0.5 text-[10px]">✕</Button>
            </div>
          </Card>
        )
      })}

      {/* Add window: pick a type directly from the catalog */}
      <div className="space-y-1.5 pt-1">
        <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Add window</div>
        <div className="grid grid-cols-4 gap-1">
          {RENDERER_CATALOG.map((entry) => (
            <button
              key={entry.id}
              type="button"
              title={entry.desc}
              onClick={() => addFromCatalog(entry.id)}
              className="flex flex-col items-center gap-0.5 rounded-lg border border-[var(--color-border-strong)] bg-white/[0.02] px-1 py-2 text-center hover:bg-white/[0.06] transition-colors"
            >
              <span className="text-lg leading-none">{entry.icon}</span>
              <span className="text-[9px] text-[var(--color-text-muted)] leading-tight">{entry.label}</span>
            </button>
          ))}
        </div>
        {windowPresets.length > 0 && (
          <Button
            variant="ghost" size="sm"
            onClick={addFromPreset}
            className="w-full border-dashed border-[var(--color-border-strong)] py-2 text-xs justify-center"
          >
            + From saved preset
          </Button>
        )}
      </div>
    </div>
  )
}
