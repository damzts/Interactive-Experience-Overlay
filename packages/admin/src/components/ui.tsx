// Deep compare for config objects
export function isSameDraft(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a == null || b == null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isSameDraft(a[i], b[i])) return false;
    }
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!bKeys.includes(k)) return false;
    if (!isSameDraft(a[k], b[k])) return false;
  }
  return true;
}

// Simple icon renderer for app icons
export function IconGlyph({ icon, label, size = 24 }: { icon: string; label: string; size?: number }) {
  const normalizedIcon = icon.trim().toLowerCase()
  const isImageIcon = !!normalizedIcon && (
    normalizedIcon.startsWith('data:image/')
    || normalizedIcon.startsWith('/assets/')
    || normalizedIcon.startsWith('/media/')
    || /^(https?:\/\/|\/|\.\/|\.\.\/).+\.(png|jpe?g|gif|webp|svg|avif)(?:\?.*)?$/i.test(normalizedIcon)
  )

  if (isImageIcon) {
    return (
      <span
        title={label}
        className="inline-flex items-center justify-center overflow-hidden align-middle"
        style={{ width: size, height: size, verticalAlign: 'middle' }}
        aria-label={label}
      >
        <img src={icon} alt={label} className="h-full w-full object-contain" />
      </span>
    )
  }

  return (
    <span
      title={label}
      style={{ fontSize: size, display: 'inline-block', verticalAlign: 'middle', lineHeight: 1 }}
      aria-label={label}
    >
      {icon}
    </span>
  );
}

// ConfigApplyBar: wrapper for SaveBar with custom labels
export function ConfigApplyBar({ label, dirty, saving, saved, onApply, onReset, alwaysShow = false }: {
  label: string;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  onApply: () => void;
  onReset: () => void;
  alwaysShow?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 mt-2 mb-2">
      <span className="text-xs text-zinc-400 font-semibold">{label}</span>
      <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={onApply} onRevert={onReset} alwaysShow={alwaysShow} />
    </div>
  );
}
import { useEffect, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

function expandHexColor(value: string) {
  if (value.length === 4 || value.length === 5) {
    const body = value.slice(1).split('').map((char) => char + char).join('')
    return `#${body}`
  }
  return value
}

function getOpaqueHexColor(value: string, fallback = '#000000') {
  if (!HEX_COLOR_PATTERN.test(value)) return fallback
  const expanded = expandHexColor(value)
  return expanded.length === 9 ? expanded.slice(0, 7) : expanded
}

function getAlphaHex(value: string) {
  if (!HEX_COLOR_PATTERN.test(value)) return ''
  const expanded = expandHexColor(value)
  return expanded.length === 9 ? expanded.slice(7, 9) : ''
}

interface HexColorInputProps {
  value: string
  onChange: (value: string) => void
  className?: string
  pickerClassName?: string
  textClassName?: string
  pickerStyle?: CSSProperties
  placeholder?: string
}

export function HexColorInput({
  value,
  onChange,
  className = '',
  pickerClassName = '',
  textClassName = '',
  pickerStyle,
  placeholder = '#RRGGBB or #RRGGBBAA',
}: HexColorInputProps) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const commitPickerValue = (rgbValue: string) => {
    const alpha = getAlphaHex(draft.trim()) || getAlphaHex(value.trim())
    const nextValue = `${rgbValue}${alpha}`
    setDraft(nextValue)
    onChange(nextValue)
  }

  const handleTextChange = (nextValue: string) => {
    setDraft(nextValue)
    const trimmed = nextValue.trim()
    if (HEX_COLOR_PATTERN.test(trimmed)) {
      onChange(trimmed)
    }
  }

  const handleBlur = () => {
    const trimmed = draft.trim()
    if (HEX_COLOR_PATTERN.test(trimmed)) {
      setDraft(trimmed)
      return
    }
    setDraft(value)
  }

  const previewValue = getOpaqueHexColor(HEX_COLOR_PATTERN.test(draft.trim()) ? draft.trim() : value.trim())

  return (
    <div className={`flex items-center ${className}`}>
      <input
        type="color"
        value={previewValue}
        onInput={(event) => commitPickerValue(event.currentTarget.value)}
        onChange={(event) => commitPickerValue(event.target.value)}
        className={pickerClassName}
        style={pickerStyle}
      />
      <input
        type="text"
        value={draft}
        onChange={(event) => handleTextChange(event.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={textClassName}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
    </div>
  )
}

/** Dark card / panel replacing Win98 .window */
export function Panel({
  title,
  children,
  className = '',
  bodyClassName = 'p-3',
}: {
  title?: string
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <div className={`rounded-lg bg-zinc-800/60 border border-zinc-700/60 overflow-hidden ${className}`}>
      {title && (
        <div className="px-3 py-2 bg-zinc-800 border-b border-zinc-700/60 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          {title}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  )
}

export function ConfigSectionPanel({
  label,
  children,
  first = false,
  className = '',
}: {
  label: string
  children: ReactNode
  first?: boolean
  className?: string
}) {
  return (
    <section className={first ? 'px-0.5 pt-0.5' : 'mt-6 px-0.5'}>
      <div className={first ? 'mb-2 px-0.5' : 'mb-2 border-t border-cyan-500/25 px-0.5 pt-2'}>
        <span className="inline-flex rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
          {label}
        </span>
      </div>
      <Panel className={className} bodyClassName="p-2.5">{children}</Panel>
    </section>
  )
}

type BtnVariant = 'default' | 'primary' | 'danger' | 'ghost' | 'active'

const BTN_VARIANTS: Record<BtnVariant, string> = {
  default: 'bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 text-zinc-100',
  primary: 'bg-cyan-700 hover:bg-cyan-600 border border-cyan-600 text-white font-semibold',
  danger:  'bg-red-800 hover:bg-red-700 border border-red-700 text-white font-semibold',
  ghost:   'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-transparent',
  active:  'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300',
}

export function Btn({
  variant = 'default',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      className={`px-3 py-1.5 text-sm rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${BTN_VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`text-xs text-zinc-400 mb-1 ${className}`}>{children}</div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-cyan-600' : 'bg-zinc-600'}`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </div>
      {label && <span className="text-sm text-zinc-300">{label}</span>}
    </label>
  )
}

export function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  unit = '',
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  const display = step >= 1 ? value.toFixed(0) : max <= 1 ? `${Math.round(value * 100)}%` : value.toFixed(1)
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-xs text-zinc-400 w-28 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
      />
      <span className="text-xs text-zinc-300 w-10 text-right shrink-0">
        {display}{unit}
      </span>
    </div>
  )
}

export function StatusDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`text-xs font-mono ${on ? 'text-emerald-400' : 'text-red-500'}`}>
      {on ? '●' : '○'} {label}
    </span>
  )
}

export function SaveBar({
  dirty,
  saving,
  saved,
  onSave,
  onRevert,
  alwaysShow = false,
}: {
  dirty: boolean
  saving: boolean
  saved: boolean
  onSave: () => void
  onRevert?: () => void
  alwaysShow?: boolean
}) {
  if (!alwaysShow && !dirty && !saved) return null
  return (
    <div className="flex items-center gap-3 mt-4 pt-3 border-t border-zinc-700">
      {saved && <span className="text-xs text-emerald-400">✔ Saved</span>}
      {(dirty || alwaysShow) && (
        <>
          <Btn variant="primary" onClick={onSave} disabled={saving || !dirty}>
            {saving ? 'Saving…' : '💾 Save Changes'}
          </Btn>
          {onRevert && dirty && (
            <Btn variant="ghost" onClick={onRevert}>↺ Revert</Btn>
          )}
        </>
      )}
    </div>
  )
}
