import { useEffect, useState } from 'react'
import type { AvatarPreset, PersonaAvatarConfig } from '@ieomlabs/shared'
import { getPersonaAvatarImages } from '../../api/mediaApi'
import { Btn, ConfigCard, ConfigChoiceButton, ConfigNotice, Slider } from '../../shared/ui'
import { LibraryItemBtn } from './mediaLibraryUi'
import { MediaSearchInput } from './MediaLibraryPanel'

// ── Sidebar ──────────────────────────────────────────────────────────

export function AvatarTabSidebar({
  avatarSearch,
  onAvatarSearchChange,
  filteredAvatarPresets,
  selectedAvatarPresetId,
  onSelectAvatarPreset,
}: {
  avatarSearch: string
  onAvatarSearchChange: (value: string) => void
  filteredAvatarPresets: AvatarPreset[]
  selectedAvatarPresetId: string | null
  onSelectAvatarPreset: (presetId: string) => void
}) {
  return (
    <>
      <MediaSearchInput value={avatarSearch} onChange={onAvatarSearchChange} placeholder="Search avatars…" />
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {filteredAvatarPresets.length ? filteredAvatarPresets.map((preset) => (
          <LibraryItemBtn key={preset.id} active={preset.id === selectedAvatarPresetId} onClick={() => onSelectAvatarPreset(preset.id)}>
            <div className="flex items-center gap-2">
              {preset.images[0] ? (
                <img src={preset.images[0]} alt="" className="h-8 w-6 shrink-0 rounded object-contain" />
              ) : (
                <span className="text-base">🙂</span>
              )}
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{preset.name}</span>
            </div>
            <div className="mt-1 truncate text-[10px] text-zinc-500">
              {preset.mode === 'persistent' ? 'Always visible' : 'Pop-in'} · {preset.images.length} pose{preset.images.length === 1 ? '' : 's'}
            </div>
          </LibraryItemBtn>
        )) : (
          <ConfigNotice tone="info">No avatar presets match this filter.</ConfigNotice>
        )}
      </div>
    </>
  )
}

// ── Editor body (mode/corner/size/poses) ──────────────────────────────

const AVATAR_MODES: Array<{ id: PersonaAvatarConfig['mode']; label: string }> = [
  { id: 'pop-in',     label: 'Pop in when speaking' },
  { id: 'persistent', label: 'Always visible' },
]

const AVATAR_CORNERS: Array<{ id: PersonaAvatarConfig['corner']; label: string }> = [
  { id: 'bottom-right', label: 'Bottom right' },
  { id: 'bottom-left',  label: 'Bottom left' },
  { id: 'top-right',    label: 'Top right' },
  { id: 'top-left',     label: 'Top left' },
]

function AvatarConfigEditor({
  avatar,
  onChange,
}: {
  avatar: PersonaAvatarConfig
  onChange: (patch: Partial<PersonaAvatarConfig>) => void
}) {
  const [available, setAvailable] = useState<string[]>([])
  const [manualUrl, setManualUrl] = useState('')

  useEffect(() => {
    let cancelled = false
    getPersonaAvatarImages()
      .then((images) => { if (!cancelled) setAvailable(images) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const toggleImage = (url: string) =>
    onChange({
      images: avatar.images.includes(url)
        ? avatar.images.filter((u) => u !== url)
        : [...avatar.images, url],
    })

  const addManual = () => {
    const url = manualUrl.trim()
    if (!url || avatar.images.includes(url)) return
    onChange({ images: [...avatar.images, url] })
    setManualUrl('')
  }

  // Picker shows everything on disk plus any configured URLs not found by the scan.
  const gallery = [...available, ...avatar.images.filter((u) => !available.includes(u))]

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Mode</div>
        <div className="flex gap-1.5">
          {AVATAR_MODES.map((mode) => (
            <ConfigChoiceButton key={mode.id} selected={avatar.mode === mode.id} onClick={() => onChange({ mode: mode.id })}>
              {mode.label}
            </ConfigChoiceButton>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Corner</div>
        <div className="flex gap-1.5">
          {AVATAR_CORNERS.map((corner) => (
            <ConfigChoiceButton key={corner.id} selected={avatar.corner === corner.id} onClick={() => onChange({ corner: corner.id })}>
              {corner.label}
            </ConfigChoiceButton>
          ))}
        </div>
      </div>

      <Slider label="Width" value={avatar.widthPx} min={120} max={520} step={10} unit="px" onChange={(v) => onChange({ widthPx: v })} />
      {avatar.mode === 'pop-in' && (
        <Slider label="Linger after speaking" value={avatar.lingerMs} min={0} max={10_000} step={500} unit="ms" onChange={(v) => onChange({ lingerMs: v })} />
      )}

      <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3 space-y-2">
        <div className="text-[11px] font-semibold text-zinc-300">
          Poses <span className="font-normal text-zinc-500">— click to select; a random selected pose is used per appearance</span>
        </div>

        {gallery.length === 0 && (
          <div className="text-[10px] italic text-zinc-600">
            No images found under <span className="font-mono">assets/persona/</span>.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {gallery.map((url) => {
            const selected = avatar.images.includes(url)
            return (
              <button
                key={url}
                type="button"
                onClick={() => toggleImage(url)}
                title={url}
                className={`relative h-24 w-20 overflow-hidden rounded-lg border transition-colors ${
                  selected ? 'border-sky-400/80 bg-sky-400/10' : 'border-white/10 bg-white/5 hover:border-white/25'
                }`}
              >
                <img src={url} alt="" loading="lazy" className="h-full w-full object-contain" />
                {selected && (
                  <span className="absolute right-1 top-1 rounded bg-sky-400/90 px-1 text-[9px] font-bold text-zinc-900">✓</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addManual() }}
            placeholder="/assets/persona/ene/pose.webp"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-mono text-zinc-200 outline-none focus:border-white/25"
          />
          <button
            type="button"
            onClick={addManual}
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-white/25"
          >
            + Add URL
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Content (list-create-edit-delete a named avatar preset) ───────────

export function AvatarTabContent({
  editingAvatarPreset,
  avatarPresetOriginalId,
  createAvatarPresetDraft,
  patchAvatarPresetDraft,
  saveAvatarPresetDraft,
  deleteAvatarPresetDraft,
}: {
  editingAvatarPreset: AvatarPreset | null
  avatarPresetOriginalId: string | null
  createAvatarPresetDraft: () => void
  patchAvatarPresetDraft: (updates: Partial<AvatarPreset>) => void
  saveAvatarPresetDraft: () => void
  deleteAvatarPresetDraft: () => void
}) {
  return (
    <div className="flex min-h-0 flex-col gap-4 pt-0.5">
      {editingAvatarPreset ? (
        <>
          <ConfigCard className="space-y-4 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editingAvatarPreset.name}
                onChange={(e) => patchAvatarPresetDraft({ name: e.target.value })}
                placeholder="Avatar name"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-white/25"
              />
            </div>

            <AvatarConfigEditor
              avatar={editingAvatarPreset}
              onChange={(patch) => patchAvatarPresetDraft(patch)}
            />

            <div className="flex items-center justify-between border-t border-white/6 pt-4">
              {avatarPresetOriginalId ? (
                <Btn type="button" variant="danger" onClick={deleteAvatarPresetDraft}>Delete Avatar</Btn>
              ) : <span />}
              <Btn type="button" variant="primary" onClick={saveAvatarPresetDraft}>
                {avatarPresetOriginalId ? 'Save Avatar' : 'Create Avatar'}
              </Btn>
            </div>
          </ConfigCard>
        </>
      ) : (
        <ConfigCard className="space-y-3 p-5 sm:p-6">
          <div className="text-sm text-zinc-300">No avatar selected.</div>
          <div className="text-[10px] text-zinc-500">
            Pick one from the list, or create a new one — avatars built here can be referenced by any
            Persona profile in Ambiance → Persona.
          </div>
          <Btn type="button" variant="primary" onClick={createAvatarPresetDraft}>+ New Avatar</Btn>
        </ConfigCard>
      )}
    </div>
  )
}
