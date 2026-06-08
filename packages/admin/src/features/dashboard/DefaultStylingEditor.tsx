import type { RecycleBinSettings, StickyNotesSettings } from '@ieomlabs/shared'
import { AssetSelectionInput } from '../asset-library/AssetLibrary'
import { ConfigSectionPanel, HexColorInput, Toggle } from '../../shared/ui'


// ── StickyNotesConfigSection ──────────────────────────────────────────

export function StickyNotesConfigSection({
  value,
  onChange,
}: {
  value: StickyNotesSettings
  onChange: (updater: (draft: StickyNotesSettings) => void) => void
}) {
  return (
    <ConfigSectionPanel label="Sticky Notes">
      <div className="text-[10px] text-zinc-500 mb-1">Default note text</div>
      <textarea value={value.text} onChange={(e) => onChange((draft) => { draft.text = e.target.value })}
        className="w-full min-h-[110px] text-xs font-mono" />
      <div className="mt-3 text-[10px] text-zinc-500 mb-1">Note color</div>
      <HexColorInput value={value.color} onChange={(nextValue) => onChange((draft) => { draft.color = nextValue })}
        className="max-w-sm gap-2" pickerClassName="w-20 h-9 p-1 shrink-0" textClassName="font-mono text-xs flex-1 min-w-0" />
    </ConfigSectionPanel>
  )
}

// ── RecycleBinConfigSection ───────────────────────────────────────────

export function RecycleBinConfigSection({
  settings,
  fullOnStart,
  onSettingsChange,
  onFullOnStartChange,
}: {
  settings: RecycleBinSettings
  fullOnStart: boolean
  onSettingsChange: (updater: (draft: RecycleBinSettings) => void) => void
  onFullOnStartChange: (nextValue: boolean) => void
}) {
  return (
    <ConfigSectionPanel label="Recycle Bin">
      <Toggle checked={fullOnStart} onChange={onFullOnStartChange} label="Starts full" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">Empty icon</div>
          <AssetSelectionInput value={settings.emptyIcon}
            onChange={(nextValue) => onSettingsChange((draft) => { draft.emptyIcon = nextValue })}
            kinds={['image']} modalTitle="Recycle Bin Empty Icon"
            placeholder="Emoji or /assets/icons/recycle-empty.png" buttonLabel="Choose Image" previewKind="image" />
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">Full icon</div>
          <AssetSelectionInput value={settings.fullIcon}
            onChange={(nextValue) => onSettingsChange((draft) => { draft.fullIcon = nextValue })}
            kinds={['image']} modalTitle="Recycle Bin Full Icon"
            placeholder="Emoji or /assets/icons/recycle-full.png" buttonLabel="Choose Image" previewKind="image" />
        </div>
      </div>
    </ConfigSectionPanel>
  )
}
