import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppConfig, ConfigPreset } from '@ieomlabs/shared'
import {
  fetchPresets, savePreset, applyPreset, deletePreset,
  downloadPresetBundle, importPresetBundle, readPresetBundleFile,
} from '../../api/presetsApi'
import { ConfigPageIntro, ConfigSectionPanel, ConfigCard, ConfigNotice, Btn } from '../../shared/ui'

// ── Section catalog ──────────────────────────────────────────────────

const SECTION_OPTIONS: Array<{ key: keyof AppConfig; label: string; defaultChecked: boolean }> = [
  { key: 'desktopConfig',     label: 'Desktop Theme & Skin',    defaultChecked: true },
  { key: 'desktopAmbiance',   label: 'Desktop Interaction',     defaultChecked: true },
  { key: 'effectStorms',      label: 'Effect Storms',           defaultChecked: true },
  { key: 'desktopThemeDrift', label: 'Theme Rotation',          defaultChecked: true },
  { key: 'audio',             label: 'Audio Engine',            defaultChecked: true },
  { key: 'chatReactions',     label: 'Chat Reactions',          defaultChecked: false },
  { key: 'automationRules',   label: 'Automation Rules',        defaultChecked: false },
  { key: 'sourceEvents',      label: 'Media Effects',           defaultChecked: false },
  { key: 'widgetLayouts',     label: 'Widget Layouts',          defaultChecked: false },
  { key: 'scenes',            label: 'Scenes',                  defaultChecked: false },
  { key: 'applications',      label: 'Widgets/Applications',    defaultChecked: false },
  { key: 'twitch',            label: 'Twitch Integration',      defaultChecked: false },
  { key: 'shows',             label: 'Show Sequencer',          defaultChecked: false },
  { key: 'avatarPresets',     label: 'Persona Avatars',         defaultChecked: false },
]

function defaultSelection(): Record<string, boolean> {
  const sel: Record<string, boolean> = {}
  for (const opt of SECTION_OPTIONS) sel[opt.key] = opt.defaultChecked
  return sel
}

// ── PresetsPanel ──────────────────────────────────────────────────────

export function PresetsPanel() {
  const [presets, setPresets] = useState<ConfigPreset[]>([])
  const [label, setLabel] = useState('')
  const [selection, setSelection] = useState<Record<string, boolean>>(defaultSelection)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importNotice, setImportNotice] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const refresh = useCallback(async () => {
    try {
      const list = await fetchPresets()
      setPresets(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load presets')
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const toggleSection = (key: keyof AppConfig) => {
    setSelection((s) => ({ ...s, [key]: !s[key] }))
  }

  async function handleSave() {
    const sectionKeys = SECTION_OPTIONS.map((o) => o.key).filter((key) => selection[key])
    if (!label.trim() || sectionKeys.length === 0) {
      setError('Enter a name and select at least one section.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await savePreset(label.trim(), sectionKeys)
      setLabel('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preset')
    } finally {
      setSaving(false)
    }
  }

  async function handleApply(id: string) {
    setBusyId(id)
    setError(null)
    try {
      await applyPreset(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply preset')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id)
    setError(null)
    try {
      await deletePreset(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete preset')
    } finally {
      setBusyId(null)
    }
  }

  async function handleExport(preset: ConfigPreset) {
    setBusyId(preset.id)
    setError(null)
    try {
      await downloadPresetBundle(preset.id, preset.label)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export preset')
    } finally {
      setBusyId(null)
    }
  }

  function handlePickImportFile() {
    setImportNotice(null)
    setError(null)
    fileInputRef.current?.click()
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setImporting(true)
    setError(null)
    setImportNotice(null)
    try {
      const bundle = await readPresetBundleFile(file)
      if (!bundle?.preset?.label || !bundle.preset.sections) {
        throw new Error('That file does not look like a valid preset bundle.')
      }
      const result = await importPresetBundle(bundle)
      const assetCount = result.assets.written
      const skippedCount = result.assets.skipped
      setImportNotice(
        `Imported "${result.preset.label}"${assetCount ? ` with ${assetCount} asset${assetCount === 1 ? '' : 's'}` : ''}` +
        `${skippedCount ? ` (${skippedCount} asset${skippedCount === 1 ? '' : 's'} skipped)` : ''}.`,
      )
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import preset bundle')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <ConfigPageIntro title="Config Presets" eyebrow="System">
        Save the current configuration — theme/skin, ambiance, sounds, or any other section —
        as a named preset, then load it later to reconfigure the whole system in one shot.
        A preset only knows about the config values it stores; it has no notion of what those
        values represent. Export a preset to share your setup with friends — the file bundles
        the config together with every image/video/audio file it references under /assets/, so
        it works out of the box for whoever imports it, with no broken paths.
      </ConfigPageIntro>

      {error && (
        <ConfigNotice tone="warning" className="px-3 py-2 text-[11px]">{error}</ConfigNotice>
      )}
      {importNotice && (
        <ConfigNotice tone="info" className="px-3 py-2 text-[11px]">{importNotice}</ConfigNotice>
      )}

      <ConfigSectionPanel label="Save current as preset">
        <div className="space-y-3">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Preset name (e.g. Ene, Chill Stream, Hype Mode)"
            className="w-full rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none"
          />

          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {SECTION_OPTIONS.map((opt) => (
              <label key={opt.key} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!selection[opt.key]}
                  onChange={() => toggleSection(opt.key)}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-cyan-400"
                />
                <span className="text-xs text-[var(--color-text-primary)]">{opt.label}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end">
            <Btn type="button" variant="active" onClick={() => { void handleSave() }} disabled={saving} className="px-3 py-1.5 text-xs">
              {saving ? 'Saving…' : 'Save Preset'}
            </Btn>
          </div>
        </div>
      </ConfigSectionPanel>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => { void handleImportFile(e) }}
      />

      <div className="flex justify-end">
        <Btn type="button" variant="default" onClick={handlePickImportFile} disabled={importing} className="px-3 py-1.5 text-xs">
          {importing ? 'Importing…' : '⭱ Import Preset File'}
        </Btn>
      </div>

      <ConfigSectionPanel label={`Saved Presets${presets.length ? ` (${presets.length})` : ''}`}>
        {presets.length === 0 && (
          <div className="text-[10px] text-zinc-600 italic">No presets saved yet.</div>
        )}
        <div className="space-y-2">
          {presets.map((preset) => (
            <ConfigCard key={preset.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-zinc-200 truncate">{preset.label}</div>
                <div className="mt-0.5 text-[10px] text-zinc-600">
                  {Object.keys(preset.sections).length} section{Object.keys(preset.sections).length === 1 ? '' : 's'}
                  {' · '}
                  {new Date(preset.createdAt).toLocaleString()}
                </div>
              </div>
              <Btn
                type="button"
                variant="default"
                onClick={() => { void handleExport(preset) }}
                disabled={busyId === preset.id}
                className="px-3 py-1.5 text-xs shrink-0"
              >
                {busyId === preset.id ? '…' : '⭳ Export'}
              </Btn>
              <Btn
                type="button"
                variant="default"
                onClick={() => { void handleApply(preset.id) }}
                disabled={busyId === preset.id}
                className="px-3 py-1.5 text-xs shrink-0"
              >
                {busyId === preset.id ? '…' : 'Load'}
              </Btn>
              <button
                type="button"
                onClick={() => { void handleDelete(preset.id) }}
                disabled={busyId === preset.id}
                className="text-zinc-600 hover:text-red-400 transition-colors text-sm shrink-0"
              >
                ✕
              </button>
            </ConfigCard>
          ))}
        </div>
      </ConfigSectionPanel>
    </div>
  )
}
