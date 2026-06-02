import { HexColorInput } from '../../shared/ui'
import { ACCENT_SWATCHES } from './constants'
import type { ThemeAppearance } from './types'
import {
  GOOGLE_FONTS,
} from '../../shared/adminDesktopOptions'
import { ConfigChoiceButton, ConfigSwatchButton } from '../../shared/ui'

export function LabeledHexColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      {label && <label className="text-[11px] text-zinc-400 w-16 shrink-0">{label}</label>}
      <HexColorInput
        value={value}
        onChange={onChange}
        className="flex-1 min-w-0 gap-2"
        pickerClassName="w-7 h-6 shrink-0"
        textClassName="font-mono text-xs flex-1 min-w-0"
      />
    </div>
  )
}

export function ThemeAppearanceFields({
  appearance,
  onChange,
  helperText,
}: {
  appearance: ThemeAppearance
  onChange: (updater: (draft: ThemeAppearance) => void) => void
  helperText?: string
}) {
  const activeFont = GOOGLE_FONTS.find((font) => font.css === appearance.fontFamily) ?? GOOGLE_FONTS[0]

  return (
    <div className="space-y-4">
      {helperText && <div className="text-[10px] text-zinc-500 leading-relaxed">{helperText}</div>}
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Font</div>
          <div className="text-[10px] text-zinc-600 truncate">{activeFont.name}</div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {GOOGLE_FONTS.map((font) => (
            <ConfigChoiceButton
              key={font.css}
              type="button"
              selected={appearance.fontFamily === font.css}
              onClick={() => onChange((d) => { d.fontFamily = font.css })}
              className="min-h-0 justify-start px-2.5 py-1.5 text-left normal-case"
              style={font.css !== 'default' ? { fontFamily: font.css } : undefined}
              title={font.name}
            >
              <span className="min-w-0 truncate text-[10px] font-semibold leading-none">{font.name}</span>
            </ConfigChoiceButton>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Accent</div>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {ACCENT_SWATCHES.map((color) => (
            <ConfigSwatchButton
              key={color}
              type="button"
              color={color}
              selected={appearance.accentColor === color}
              onClick={() => onChange((d) => { d.accentColor = color })}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <HexColorInput
            value={appearance.accentColor}
            onChange={(nextValue) => onChange((d) => { d.accentColor = nextValue })}
            className="gap-2"
            pickerStyle={{ width: 32, height: 28 }}
            textClassName="font-mono text-xs w-28"
          />
        </div>
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Text</div>
        <div className="flex items-center gap-2">
          <HexColorInput
            value={appearance.textColor}
            onChange={(nextValue) => onChange((d) => { d.textColor = nextValue })}
            className="gap-2"
            pickerStyle={{ width: 32, height: 28 }}
            textClassName="font-mono text-xs w-28"
          />
        </div>
      </div>
    </div>
  )
}
