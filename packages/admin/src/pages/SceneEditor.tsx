import { useState } from 'react'
import type { Scene, SourceInstance } from '@ieom/shared'
import { useAdminStore } from '../store/useAdminStore'
import { Panel, Btn, HexColorInput, FloatingWindowHeader, FloatingWindowShell } from '../components/ui'

/** Renders editable form fields for a source's config Record */
function ConfigFieldEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
}) {
  const update = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Object.entries(config).map(([key, val]) => {
        const isColor =
          typeof val === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(val)
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ width: 140, fontSize: 11, flexShrink: 0 }}>{key}</label>
            {typeof val === 'boolean' ? (
              <input
                type="checkbox"
                checked={val}
                onChange={(e) => update(key, e.target.checked)}
              />
            ) : isColor ? (
              <HexColorInput
                value={String(val)}
                onChange={(nextValue) => update(key, nextValue)}
                className="flex-1 min-w-0 gap-2"
                pickerStyle={{ width: 40, height: 24, padding: 0, border: '1px solid #888' }}
                textClassName="font-mono text-xs flex-1 min-w-0"
              />
            ) : typeof val === 'number' ? (
              <input
                type="number"
                value={val}
                step={val < 2 ? 0.01 : 1}
                onChange={(e) => update(key, Number(e.target.value))}
                style={{ width: 80 }}
              />
            ) : (
              <input
                type="text"
                value={String(val)}
                onChange={(e) => update(key, e.target.value)}
                style={{ flex: 1, minWidth: 0 }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

const PLUGIN_TYPES = [
  { type: 'image-slideshow', label: 'Image Slideshow', defaultConfig: { source: 'scraped-games', interval: 8, transition: 'crossfade' } },
  { type: 'crt-effect',      label: 'CRT Effect',       defaultConfig: { scanlineIntensity: 0.25, flickerRate: 0.015, vignetteStrength: 0.5 } },
  { type: 'text-widget',     label: 'Text Widget',      defaultConfig: { content: 'Hello', font: 'vt323', fontSize: 24, color: '#ffffff', typewriterMode: false } },
  {
    type: 'camera',
    label: '📷 Camera',
    defaultConfig: {
      deviceLabel: 'default',
      mirror:      true,
      shape:       'circle',
      frameUrl:    '',
      brightness:  1,
      contrast:    1,
      saturation:  1,
      opacity:     1,
      objectFit:   'cover',
    },
  },
]

export function SceneEditor() {
  const config = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)

  const [selectedSceneId, setSelectedSceneId] = useState<string>(
    Object.keys(config.scenes)[0] ?? 'LOBBY',
  )
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [scenes, setScenes] = useState(() => structuredClone(config.scenes))
  const [saving, setSaving] = useState(false)
  const [showAddSource, setShowAddSource] = useState(false)

  const scene: Scene | undefined = scenes[selectedSceneId]
  const selectedSource = scene?.sources.find((s) => s.id === selectedSourceId) ?? null

  const updateSource = (sourceId: string, updates: Partial<SourceInstance>) => {
    setScenes((prev) => {
      const updated = structuredClone(prev)
      const src = updated[selectedSceneId]?.sources.find((s) => s.id === sourceId)
      if (src) Object.assign(src, updates)
      return updated
    })
    setDirty(true)
  }

  const removeSource = (sourceId: string) => {
    setScenes((prev) => {
      const updated = structuredClone(prev)
      if (updated[selectedSceneId]) {
        updated[selectedSceneId].sources = updated[selectedSceneId].sources.filter(
          (s) => s.id !== sourceId,
        )
      }
      return updated
    })
    if (selectedSourceId === sourceId) setSelectedSourceId(null)
    setDirty(true)
  }

  const addSource = (pluginType: string) => {
    const pluginDef = PLUGIN_TYPES.find((p) => p.type === pluginType)
    if (!pluginDef) return
    const newSource: SourceInstance = {
      id: `source-${Date.now()}`,
      pluginType,
      config: { ...pluginDef.defaultConfig },
      position: { x: 0, y: 0, width: 1920, height: 1080 },
      zIndex: (scene?.sources.length ?? 0) * 5,
      visible: true,
    }
    setScenes((prev) => {
      const updated = structuredClone(prev)
      updated[selectedSceneId]?.sources.push(newSource)
      return updated
    })
    setSelectedSourceId(newSource.id)
    setDirty(true)
    setShowAddSource(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await saveConfig({ scenes })
    setDirty(false)
    setSaving(false)
  }

  return (
    <div className="grid gap-3 h-full" style={{ gridTemplateColumns: '180px 260px 1fr' }}>

      {/* Scene list */}
      <Panel title="Scenes" className="overflow-auto">
        {Object.values(scenes).map((s) => (
          <button
            key={s.id}
            onClick={() => { setSelectedSceneId(s.id); setSelectedSourceId(null) }}
            className={`block w-full text-left px-3 py-1.5 rounded mb-1 text-sm transition-colors ${
              s.id === selectedSceneId
                ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40'
                : 'hover:bg-zinc-700 text-zinc-300 border border-transparent'
            }`}
          >
            {s.label}
            <span className="text-xs opacity-50 ml-1">({s.sources.length})</span>
          </button>
        ))}
      </Panel>

      {/* Source list */}
      <Panel title={`${scene?.label ?? '—'} — Sources`} className="overflow-auto">
        {scene?.sources.length === 0 && (
          <div className="text-xs text-zinc-500 px-1 py-0.5">No sources</div>
        )}
        {scene?.sources.map((src) => (
          <div
            key={src.id}
            onClick={() => setSelectedSourceId(src.id)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer mb-1 transition-colors ${
              src.id === selectedSourceId
                ? 'bg-cyan-600/30 text-cyan-300'
                : 'hover:bg-zinc-700 text-zinc-300'
            }`}
          >
            <input
              type="checkbox"
              checked={src.visible}
              onChange={(e) => { e.stopPropagation(); updateSource(src.id, { visible: e.target.checked }) }}
              className="shrink-0"
            />
            <span className="flex-1 text-xs truncate">{src.pluginType}</span>
            <span className="text-[10px] opacity-50">z{src.zIndex}</span>
          </div>
        ))}
        <div className="flex gap-2 mt-3">
          <Btn className="flex-1 text-center" onClick={() => setShowAddSource(true)}>+ Add</Btn>
          {selectedSourceId && (
            <Btn variant="danger" className="flex-1 text-center" onClick={() => removeSource(selectedSourceId)}>🗑</Btn>
          )}
        </div>
      </Panel>

      {/* Source config */}
      <Panel title={`Source Config${dirty ? ' ●' : ''}`} className="overflow-auto">
        {!selectedSource && (
          <div className="text-sm text-zinc-500">Select a source to configure it.</div>
        )}
        {selectedSource && (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-zinc-400 mb-1">Type</div>
              <input type="text" readOnly value={selectedSource.pluginType} className="w-full opacity-60" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 mb-1">Position / Size (px)</div>
              <div className="grid grid-cols-4 gap-2">
                {(['x', 'y', 'width', 'height'] as const).map((k) => (
                  <div key={k}>
                    <div className="text-[10px] text-zinc-500 mb-0.5">{k}</div>
                    <input type="number" value={selectedSource.position[k]}
                      onChange={(e) => updateSource(selectedSource.id, {
                        position: { ...selectedSource.position, [k]: Number(e.target.value) },
                      })}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-400 mb-1">Z-Index</div>
              <input type="number" value={selectedSource.zIndex}
                onChange={(e) => updateSource(selectedSource.id, { zIndex: Number(e.target.value) })}
                style={{ width: 80 }}
              />
            </div>
            <div>
              <div className="text-xs text-zinc-400 mb-2">Plugin Config</div>
              <ConfigFieldEditor
                config={selectedSource.config}
                onChange={(updated) => updateSource(selectedSource.id, { config: updated })}
              />
            </div>
            {dirty && (
              <Btn variant="primary" className="w-full justify-center" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : '💾 Save Scene Changes'}
              </Btn>
            )}
          </div>
        )}
      </Panel>

      {/* Add Source modal */}
      {showAddSource && (
        <FloatingWindowShell frameClassName="w-80" layerClassName="z-[60]">
          <FloatingWindowHeader icon="＋" title="Add Source" onClose={() => setShowAddSource(false)} />
          <div className="p-4">
            <p className="text-sm text-zinc-400 mb-3">Select a source plugin type:</p>
            <div className="flex flex-col gap-2">
              {PLUGIN_TYPES.map((p) => (
                <Btn key={p.type} className="text-left" onClick={() => addSource(p.type)}>{p.label}</Btn>
              ))}
            </div>
            <Btn variant="ghost" className="mt-3 w-full justify-center" onClick={() => setShowAddSource(false)}>Cancel</Btn>
          </div>
        </FloatingWindowShell>
      )}
    </div>
  )
}
