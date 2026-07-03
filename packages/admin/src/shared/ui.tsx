/**
 * @deprecated This file is part of the legacy shared UI library.
 *
 * The following components have been replaced by the new component library
 * at `../components/` and should no longer be imported from here:
 *   - `Btn` → use `Button` from `../components/atoms/Button`
 *   - `Toggle` → use `Toggle` from `../components/atoms/Toggle`
 *   - `ConfigCard` → use `Card` from `../components/molecules/Card`
 *   - `ConfigNotice` → use `Toast` from `../components/molecules/Toast`
 *   - `ConfigSectionPanel` → use `ConfigPanel` from `../components/organisms/ConfigPanel`
 *
 * Remaining exports (Slider, isSameDraft, IconGlyph, ConfigApplyBar,
 * ConfigPageIntro, ConfigTable, ConfigToolbar, ConfigChoiceButton, Field)
 * do not yet have replacements in the new design system and may still be
 * imported from this file until migration is complete.
 */

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

// ConfigApplyBar: full-width floating save bar pinned to the bottom of its scroll container
export function ConfigApplyBar({ dirty, saving, saved, onApply, onReset, alwaysShow = false, label: _label }: {
  label?: string;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  onApply: () => void;
  onReset: () => void;
  alwaysShow?: boolean;
}) {
  if (!alwaysShow && !dirty && !saved) return null
  return (
    <div className="sticky bottom-0 z-30 -mx-5 -mb-5 mt-6 border-t border-white/[0.05] bg-[rgba(4,4,6,0.25)] px-6 py-5 backdrop-blur-2xl">
      <div className="flex items-center justify-center gap-4">
        {saved && !dirty && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-6 py-3">
            <span>✅</span>
            <span className="text-sm font-medium text-emerald-300">Saved</span>
          </div>
        )}
        {(dirty || (alwaysShow && !saved)) && (
          <>
            <button type="button" onClick={onApply} disabled={saving || !dirty}
              className="flex flex-1 max-w-xs items-center justify-center gap-2.5 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-8 py-3.5 text-base font-semibold text-amber-200 transition-colors hover:border-amber-400/50 hover:bg-amber-500/20 disabled:opacity-40">
              <span>💾</span>
              <span>{saving ? 'Saving…' : 'Save'}</span>
            </button>
            <button type="button" onClick={onReset} disabled={!dirty}
              className="flex flex-1 max-w-[160px] items-center justify-center gap-2.5 rounded-2xl border border-zinc-600/30 bg-zinc-800/20 px-6 py-3.5 text-base font-medium text-zinc-400 transition-colors hover:border-zinc-500/50 hover:bg-zinc-700/20 disabled:opacity-40">
              <span>↩︎</span>
              <span>Restore</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'

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
    <div className={`pointer-events-none fixed inset-0 flex items-center justify-center px-3 py-3 ${layerClassName}`.trim()}>
      <div
        className={`pointer-events-auto flex w-[calc(100vw-24px)] max-w-[1100px] flex-col overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900 shadow-2xl ${frameClassName}`.trim()}
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
  bodyClassName = 'p-8',
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
    <section>
      {!first && <hr style={{ border: 'none', borderTop: '1px solid rgba(34,211,238,0.2)', margin: '0 0 1.25rem 0' }} />}
      <div style={{ marginBottom: '0.75rem' }}>
        <span className="admin-text-kicker inline-flex rounded-md border border-cyan-400/35 bg-cyan-500/12 px-2.5 py-0.5 font-semibold uppercase tracking-[0.22em] text-cyan-200">
          {label}
        </span>
      </div>
      <Panel className={className} bodyClassName="p-8">{children}</Panel>
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
  description,
  icon,
  eyebrow = 'Control Surface',
  className = '',
}: {
  title: string
  children?: ReactNode
  description?: string
  icon?: string
  eyebrow?: string
  className?: string
}) {
  return (
    <div className={`mb-4 rounded-2xl border border-cyan-500/18 bg-[linear-gradient(180deg,rgba(10,10,12,0.88),rgba(16,16,20,0.72))] px-5 py-4 shadow-[0_18px_54px_rgba(0,0,0,0.28)] backdrop-blur ${className}`.trim()}>
      <div className="admin-text-kicker font-semibold uppercase tracking-[0.22em] text-cyan-300/80">{eyebrow}</div>
      <div className="admin-text-display mt-1 font-semibold text-zinc-100">{icon ? `${icon} ` : null}{title}</div>
      <div className="admin-text-body mt-1 max-w-prose text-zinc-400">{description ?? children}</div>
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
    <div className={`admin-text-body rounded-xl border px-5 py-4.5 shadow-[0_12px_34px_rgba(0,0,0,0.22)] backdrop-blur ${CONFIG_NOTICE_TONES[tone]} ${className}`.trim()}>
      {children}
    </div>
  )
}

export function ConfigToolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-5 py-4.5 shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur ${className}`.trim()}>
      {children}
    </div>
  )
}

export function ConfigCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/8 bg-white/[0.03] p-8 shadow-[0_12px_28px_rgba(0,0,0,0.18)] backdrop-blur-sm ${className}`.trim()}>
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
  default: 'border border-white/10 bg-white/[0.04] text-zinc-100 hover:border-cyan-400/20 hover:bg-white/[0.07]',
  primary: 'border border-cyan-400/30 bg-cyan-500/12 text-cyan-50 font-semibold hover:border-cyan-300/45 hover:bg-cyan-500/18',
  danger:  'border border-red-500/25 bg-red-500/10 text-red-50 font-semibold hover:border-red-400/40 hover:bg-red-500/16',
  ghost:   'border border-transparent text-zinc-400 hover:border-white/8 hover:bg-white/[0.04] hover:text-zinc-100',
  active:  'border border-cyan-400/35 bg-cyan-500/16 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]',
  warning: 'border border-amber-400/30 bg-amber-500/12 text-amber-100 font-semibold hover:border-amber-300/45 hover:bg-amber-500/18',
}

export function Btn({
  variant = 'default',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      className={`admin-text-body inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${BTN_VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`admin-text-meta mb-1 text-zinc-400/90 ${className}`}>{children}</div>
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
        className={`relative h-5 w-9 rounded-full border transition-colors ${checked ? 'border-cyan-300/30 bg-cyan-500/70' : 'border-white/10 bg-white/10'}`}
      >
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
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
        className="flex-1 accent-cyan-400"
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
    <div className={`space-y-2 ${showDivider ? 'mt-4 border-t border-white/8 pt-3' : ''} ${className}`.trim()}>
      {(dirty || alwaysShow) && (
        <div className="flex gap-2">
          <button type="button" onClick={onSave} disabled={saving || !dirty}
            className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-5 py-2.5 text-sm font-medium text-amber-200 transition-colors hover:border-amber-400/50 hover:bg-amber-500/20 disabled:opacity-40">
            <span>💾</span>
            <span>{saving ? 'Saving…' : 'Save'}</span>
          </button>
          {onRevert && (
            <button type="button" onClick={onRevert} disabled={!dirty}
              className="flex items-center gap-2 rounded-xl border border-zinc-600/30 bg-zinc-800/30 px-5 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-500/50 hover:bg-zinc-700/30 disabled:opacity-40">
              <span>↩︎</span>
              <span>Restore</span>
            </button>
          )}
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
          <span className="text-sm">✅</span>
          <span className="text-[11px] font-medium text-emerald-300">Saved</span>
        </div>
      )}
    </div>
  )
}

// ── OverlayCanvas ─────────────────────────────────────────────────────
// Generic drag+resize canvas. Items are positioned in 1920×1080 space.
// Use this for any editable overlay preview (widget layouts, sources, etc.)

export interface OverlayCanvasItem {
  id: string
  x: number
  y: number
  width: number
  height: number
}

type CanvasCorner = 'nw' | 'ne' | 'sw' | 'se'

export function OverlayCanvas<T extends OverlayCanvasItem>({
  items,
  selectedId,
  onSelect,
  onChange,
  readonly = false,
  renderItem,
  emptyMessage,
}: {
  items: T[]
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  onChange?: (id: string, patch: Partial<Pick<T, 'x' | 'y' | 'width' | 'height'>>) => void
  readonly?: boolean
  renderItem?: (item: T, selected: boolean) => ReactNode
  emptyMessage?: string
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<{ id: string; pointerId: number; startClientX: number; startClientY: number; startX: number; startY: number } | null>(null)
  const [resizing, setResizing] = useState<{ id: string; corner: CanvasCorner; pointerId: number; startClientX: number; startClientY: number; startX: number; startY: number; startW: number; startH: number } | null>(null)
  const movedRef = useRef(false)

  const getScale = () => {
    const rect = stageRef.current?.getBoundingClientRect()
    return rect ? { sx: 1920 / rect.width, sy: 1080 / rect.height } : { sx: 1, sy: 1 }
  }

  const CORNERS: { corner: CanvasCorner; style: React.CSSProperties }[] = [
    { corner: 'nw', style: { top: 0, left: 0, cursor: 'nw-resize', transform: 'translate(-50%,-50%)' } },
    { corner: 'ne', style: { top: 0, right: 0, cursor: 'ne-resize', transform: 'translate(50%,-50%)' } },
    { corner: 'sw', style: { bottom: 0, left: 0, cursor: 'sw-resize', transform: 'translate(-50%,50%)' } },
    { corner: 'se', style: { bottom: 0, right: 0, cursor: 'se-resize', transform: 'translate(50%,50%)' } },
  ]

  return (
    <OverlayPreview stageRef={stageRef}>
      {items.map((item) => {
        const isSelected = selectedId === item.id
        const isDragging = dragging?.id === item.id
        return (
          <OverlayPreviewItem
            key={item.id}
            x={item.x} y={item.y} width={item.width} height={item.height}
            className={['rounded-lg border select-none',
              isSelected ? 'border-cyan-400/60 bg-cyan-500/12 shadow-[0_0_0_1px_rgba(34,211,238,0.25)] z-10' : 'border-zinc-600/50 bg-zinc-900/40',
              readonly ? 'cursor-default' : isDragging ? 'cursor-grabbing' : 'cursor-grab',
            ].join(' ')}
            onPointerDown={(e) => {
              if (readonly || !onChange) return
              e.preventDefault(); e.stopPropagation()
              e.currentTarget.setPointerCapture(e.pointerId)
              movedRef.current = false
              onSelect?.(item.id)
              setDragging({ id: item.id, pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, startX: item.x, startY: item.y })
            }}
            onPointerMove={(e) => {
              if (dragging?.id === item.id && dragging.pointerId === e.pointerId) {
                const { sx, sy } = getScale()
                const dx = (e.clientX - dragging.startClientX) * sx
                const dy = (e.clientY - dragging.startClientY) * sy
                if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true
                onChange?.(item.id, { x: Math.max(0, Math.min(1920 - item.width, Math.round(dragging.startX + dx))), y: Math.max(0, Math.min(1080 - item.height, Math.round(dragging.startY + dy))) } as any)
              }
              if (resizing?.id === item.id && resizing.pointerId === e.pointerId) {
                const { sx, sy } = getScale()
                const dx = (e.clientX - resizing.startClientX) * sx
                const dy = (e.clientY - resizing.startClientY) * sy
                const { corner, startX, startY, startW, startH } = resizing
                let x = startX, y = startY, w = startW, h = startH
                if (corner === 'se') { w = startW + dx; h = startH + dy }
                if (corner === 'sw') { x = startX + dx; w = startW - dx; h = startH + dy }
                if (corner === 'ne') { y = startY + dy; w = startW + dx; h = startH - dy }
                if (corner === 'nw') { x = startX + dx; y = startY + dy; w = startW - dx; h = startH - dy }
                onChange?.(item.id, { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)), width: Math.max(80, Math.min(1920, Math.round(w))), height: Math.max(48, Math.min(1080, Math.round(h))) } as any)
              }
            }}
            onPointerUp={(e) => {
              if (dragging?.pointerId === e.pointerId) { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); setDragging(null) }
              if (resizing?.pointerId === e.pointerId) { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); setResizing(null) }
              if (!movedRef.current) onSelect?.(isSelected ? null : item.id)
            }}
            onPointerCancel={() => { setDragging(null); setResizing(null) }}
          >
            {renderItem?.(item, isSelected)}
            {isSelected && !readonly && CORNERS.map(({ corner, style }) => (
              <div key={corner} style={{ position: 'absolute', width: 12, height: 12, borderRadius: 3, border: '2px solid rgba(34,211,238,0.8)', background: '#09090b', zIndex: 20, ...style }}
                onPointerDown={(e) => {
                  e.preventDefault(); e.stopPropagation()
                  e.currentTarget.setPointerCapture(e.pointerId)
                  setResizing({ id: item.id, corner, pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, startX: item.x, startY: item.y, startW: item.width, startH: item.height })
                }}
              />
            ))}
          </OverlayPreviewItem>
        )
      })}
      {items.length === 0 && emptyMessage && (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-zinc-600">{emptyMessage}</div>
      )}
    </OverlayPreview>
  )
}

// ── OverlayPreview ────────────────────────────────────────────────────
// Generic 16:9 stage (1920×1080 coordinate space). Renders children
// as positioned items. Use OverlayPreviewItem to place content.

export interface OverlayPreviewItemProps {
  /** Position + size in 1920×1080 space */
  x: number
  y: number
  width: number
  height: number
  children?: ReactNode
  className?: string
  style?: CSSProperties
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerCancel?: (e: React.PointerEvent<HTMLDivElement>) => void
}

export function OverlayPreviewItem({
  x, y, width, height, children, className = '', style, ...handlers
}: OverlayPreviewItemProps) {
  return (
    <div
      className={`absolute overflow-hidden ${className}`}
      style={{
        left: `${(x / 1920) * 100}%`,
        top: `${(y / 1080) * 100}%`,
        width: `${(width / 1920) * 100}%`,
        height: `${(height / 1080) * 100}%`,
        ...style,
      }}
      {...handlers}
    >
      {children}
    </div>
  )
}

export function OverlayPreview({
  children,
  className = '',
  stageRef: externalRef,
  resizable = false,
}: {
  children?: ReactNode
  className?: string
  stageRef?: React.RefObject<HTMLDivElement>
  resizable?: boolean
}) {
  const internalRef = useRef<HTMLDivElement>(null)
  const ref = externalRef ?? internalRef
  const stage = (
    <div
      ref={ref}
      className={`relative aspect-video overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_40%),linear-gradient(135deg,#111827,#020617)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '8.333% 11.111%' }} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_30%)]" />
      {children}
    </div>
  )
  if (!resizable) return stage
  return (
    <div style={{ resize: 'horizontal', overflow: 'hidden', width: '60%', minWidth: '200px', maxWidth: '100%' }}>
      {stage}
    </div>
  )
}
