import { useCallback } from 'react'
import type { SourceInstance, SourcePreset } from '@ieom/shared'
import { resolveSourceInstance } from '@ieom/shared'
import { SOURCE_CATALOG } from '../sourceCatalog'
import { Btn, ConfigCard, ConfigNotice } from '../ui'

// ── SourcesEditor ─────────────────────────────────────────────────────

export function SourcesEditor({
  sources,
  sourcePresets,
  onChange,
}: {
  sources: SourceInstance[]
  sourcePresets: SourcePreset[]
  onChange: (next: SourceInstance[]) => void
}) {
  const normalizeOrder = useCallback((ordered: SourceInstance[]) =>
    ordered.map((source, index) => ({ ...source, zIndex: index })), [])

  const toggle = (id: string) =>
    onChange(sources.map((s) => s.id === id ? { ...s, visible: !s.visible } : s))

  const remove = (id: string) =>
    onChange(sources.filter((s) => s.id !== id))

  const updateSourcePreset = (id: string, presetId: string) =>
    onChange(sources.map((s) => s.id === id ? { ...s, sourcePresetId: presetId || undefined } : s))

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

  const addSource = () => {
    const newSrc: SourceInstance = {
      id: `scene-source-${Date.now()}`,
      sourcePresetId: undefined,
      position: { x: 0, y: 0, width: 1920, height: 1080 },
      zIndex: sources.length,
      visible: true,
    }
    onChange([...sources, newSrc])
  }

  const sorted = [...sources].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div className="space-y-2">
      {sorted.map((src) => {
        const resolved = resolveSourceInstance(src, sourcePresets)
        const meta = SOURCE_CATALOG.find((c) => c.type === resolved?.pluginType)
        return (
          <ConfigCard key={src.id} className="overflow-hidden p-0">
            <div className="flex items-center gap-2 px-3 py-2">
              <button type="button" title={src.visible ? 'Hide' : 'Show'} onClick={() => toggle(src.id)}
                className={'w-2 h-2 rounded-full shrink-0 transition-colors ' + (src.visible ? 'bg-emerald-400 hover:bg-emerald-600' : 'bg-zinc-600 hover:bg-zinc-400')} />
              <span className="text-[10px] text-zinc-500 shrink-0">{meta?.icon ?? '▣'}</span>
              <div className="min-w-0 flex-1">
                <select value={src.sourcePresetId ?? ''} onChange={(e) => updateSourcePreset(src.id, e.target.value)} className="w-full text-xs">
                  <option value="">-- Pick source preset --</option>
                  {sourcePresets.map((preset) => {
                    const sourceMeta = SOURCE_CATALOG.find((entry) => entry.type === preset.pluginType)
                    return <option key={preset.id} value={preset.id}>{preset.label} · {sourceMeta?.label ?? preset.pluginType}</option>
                  })}
                </select>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Btn type="button" variant="ghost" onClick={() => moveUp(src.id)} disabled={sorted[0]?.id === src.id} className="px-2 py-1 text-[10px]">Up</Btn>
                <Btn type="button" variant="ghost" onClick={() => moveDown(src.id)} disabled={sorted[sorted.length - 1]?.id === src.id} className="px-2 py-1 text-[10px]">Down</Btn>
              </div>
              <Btn type="button" variant="danger" onClick={() => remove(src.id)} className="px-2 py-0.5 text-[10px]">Delete</Btn>
            </div>
          </ConfigCard>
        )
      })}

      {sourcePresets.length ? (
        <Btn type="button" onClick={addSource} variant="ghost"
          className="mt-1 w-full justify-center border-dashed border-zinc-700/80 py-2 text-xs text-zinc-400 hover:text-cyan-200">
          Add
        </Btn>
      ) : (
        <ConfigNotice tone="info">No source presets yet. Create them from the Asset Library Sources tab first.</ConfigNotice>
      )}
    </div>
  )
}
