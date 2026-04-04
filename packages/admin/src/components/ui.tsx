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
    <div className="sticky top-0 z-20 -mx-3 -mt-3 mb-3 border-b border-zinc-800/70 bg-zinc-950/92 px-3 pt-3 pb-2 backdrop-blur-sm">
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="admin-text-kicker font-semibold uppercase tracking-[0.22em] text-zinc-500">{label}</span>
          <div className="flex-1" />
          <SaveBar
            dirty={dirty}
            saving={saving}
            saved={saved}
            onSave={onApply}
            onRevert={onReset}
            alwaysShow={alwaysShow}
            showDivider={false}
          />
        </div>
      </div>
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

export function FloatingWindowShell({
  children,
  frameClassName = '',
  layerClassName = 'z-[60]',
}: {
  children: ReactNode
  frameClassName?: string
  layerClassName?: string
}) {
  return (
    <div className={`pointer-events-none fixed inset-0 flex items-center justify-center px-6 py-6 ${layerClassName}`.trim()}>
      <div
        className={`pointer-events-auto flex w-[min(1100px,calc(100vw-48px))] flex-col overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900 shadow-2xl ${frameClassName}`.trim()}
      >
        {children}
      </div>
    </div>
  )
}

export function FloatingWindowHeader({
  title,
  onClose,
  icon,
  actions,
}: {
  title: ReactNode
  onClose: () => void
  icon?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-zinc-800 px-5 py-3.5 shrink-0">
      {icon && <span className="text-base shrink-0">{icon}</span>}
      <span className="admin-text-title font-semibold text-zinc-100 min-w-0 truncate">{title}</span>
      <div className="flex-1" />
      {actions}
      <button
        onClick={onClose}
        className="admin-text-body rounded-md border border-zinc-800/80 bg-zinc-950/60 px-2 py-0.5 leading-none text-zinc-500 transition-colors hover:border-zinc-700/80 hover:text-zinc-100"
      >
        ✕
      </button>
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
    <div className={`overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/70 shadow-lg shadow-black/20 backdrop-blur-sm ${className}`}>
      {title && (
        <div className="admin-text-kicker border-b border-zinc-800/80 bg-zinc-950/50 px-3.5 py-2 font-semibold uppercase tracking-[0.2em] text-zinc-500">
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
      <div className={first ? 'mb-2 px-0.5' : 'mb-2 border-t border-cyan-500/20 px-0.5 pt-2'}>
        <span className="admin-text-kicker inline-flex rounded-md border border-cyan-400/35 bg-cyan-500/12 px-2.5 py-0.5 font-semibold uppercase tracking-[0.22em] text-cyan-200">
          {label}
        </span>
      </div>
      <Panel className={className} bodyClassName="p-2.5">{children}</Panel>
    </section>
  )
}

type ConfigNoticeTone = 'info' | 'warning' | 'danger' | 'success'

const CONFIG_NOTICE_TONES: Record<ConfigNoticeTone, string> = {
  info: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-50',
  warning: 'border-amber-500/30 bg-amber-500/12 text-amber-50',
  danger: 'border-red-500/30 bg-red-500/12 text-red-50',
  success: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-50',
}

export function ConfigPageIntro({
  title,
  children,
  eyebrow = 'Control Surface',
  className = '',
}: {
  title: string
  children: ReactNode
  eyebrow?: string
  className?: string
}) {
  return (
    <div className={`mb-4 rounded-xl border border-cyan-500/18 bg-zinc-950/65 px-4 py-3 shadow-lg shadow-black/20 ${className}`.trim()}>
      <div className="admin-text-kicker font-semibold uppercase tracking-[0.22em] text-cyan-300/80">{eyebrow}</div>
      <div className="admin-text-display mt-1 font-semibold text-zinc-100">{title}</div>
      <div className="admin-text-body mt-1 max-w-prose text-zinc-400">{children}</div>
    </div>
  )
}

export function ConfigNotice({
  tone = 'info',
  children,
  className = '',
}: {
  tone?: ConfigNoticeTone
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`admin-text-body rounded-lg border px-3 py-2 ${CONFIG_NOTICE_TONES[tone]} ${className}`.trim()}>
      {children}
    </div>
  )
}

export function ConfigToolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-2.5 rounded-lg border border-zinc-800/80 bg-zinc-950/55 px-3 py-2 ${className}`.trim()}>
      {children}
    </div>
  )
}

export function ConfigCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-zinc-800/80 bg-zinc-950/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] ${className}`.trim()}>
      {children}
    </div>
  )
}

export function ConfigTable({
  children,
  className = '',
  compact = false,
}: {
  children: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div className={`admin-config-table ${compact ? 'admin-config-table--compact' : ''} ${className}`.trim()}>
      {children}
    </div>
  )
}

export function ConfigChoiceButton({
  selected = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      className={[
        'admin-text-body inline-flex items-center justify-center rounded-lg border px-2.5 py-1.5 font-medium capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        selected
          ? 'border-cyan-400/35 bg-cyan-500/14 text-cyan-100'
          : 'border-zinc-800/80 bg-zinc-950/55 text-zinc-400 hover:border-zinc-700/80 hover:bg-zinc-900/75 hover:text-zinc-100',
        className,
      ].join(' ').trim()}
      {...props}
    />
  )
}

export function ConfigPreviewButton({
  selected = false,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; children: ReactNode }) {
  return (
    <button
      className={[
        'relative overflow-hidden rounded-xl border p-0 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40',
        selected
          ? 'border-cyan-400/45 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]'
          : 'border-zinc-800/80 hover:border-zinc-700/80',
        className,
      ].join(' ').trim()}
      {...props}
    >
      {children}
    </button>
  )
}

export function ConfigSwatchButton({
  color,
  selected = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { color: string; selected?: boolean }) {
  return (
    <button
      className={[
        'h-7 w-7 rounded-full border-2 transition-all',
        selected
          ? 'border-cyan-200 shadow-[0_0_0_1px_rgba(34,211,238,0.35)] scale-105'
          : 'border-zinc-900/70 hover:border-zinc-500',
        className,
      ].join(' ').trim()}
      style={{ backgroundColor: color }}
      {...props}
    />
  )
}

type BtnVariant = 'default' | 'primary' | 'danger' | 'ghost' | 'active' | 'warning'

const BTN_VARIANTS: Record<BtnVariant, string> = {
  default: 'border border-zinc-700/80 bg-zinc-950/70 text-zinc-100 hover:border-zinc-600/90 hover:bg-zinc-800/80',
  primary: 'border border-cyan-400/35 bg-cyan-500/12 text-cyan-50 font-semibold hover:border-cyan-300/45 hover:bg-cyan-500/20',
  danger:  'border border-red-500/30 bg-red-500/10 text-red-50 font-semibold hover:border-red-400/40 hover:bg-red-500/18',
  ghost:   'border border-transparent text-zinc-400 hover:border-zinc-700/60 hover:bg-zinc-900/75 hover:text-zinc-100',
  active:  'border border-cyan-400/40 bg-cyan-500/18 text-cyan-200',
  warning: 'border border-amber-400/35 bg-amber-500/14 text-amber-100 font-semibold hover:border-amber-300/45 hover:bg-amber-500/22',
}

export function Btn({
  variant = 'default',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      className={`admin-text-body inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${BTN_VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`admin-text-meta text-zinc-400 mb-1 ${className}`}>{children}</div>
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
      {label && <span className="admin-text-body text-zinc-300">{label}</span>}
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
  const renderedDisplay = unit && display.endsWith(unit) ? display : `${display}${unit}`
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="admin-text-body text-zinc-400 w-28 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
      />
      <span className="admin-text-body text-zinc-300 w-10 text-right shrink-0">
        {renderedDisplay}
      </span>
    </div>
  )
}

export function StatusDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`admin-text-body font-mono ${on ? 'text-emerald-400' : 'text-red-500'}`}>
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
  showDivider = true,
  className = '',
}: {
  dirty: boolean
  saving: boolean
  saved: boolean
  onSave: () => void
  onRevert?: () => void
  alwaysShow?: boolean
  showDivider?: boolean
  className?: string
}) {
  if (!alwaysShow && !dirty && !saved) return null
  return (
    <div className={`flex flex-wrap items-center gap-3 ${showDivider ? 'mt-4 border-t border-zinc-800/80 pt-3' : ''} ${className}`.trim()}>
      {saved && <span className="admin-text-body text-emerald-300">✔ Saved</span>}
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
