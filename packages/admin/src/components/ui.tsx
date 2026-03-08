import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from 'react'

/** Dark card / panel replacing Win98 .window */
export function Panel({
  title,
  children,
  className = '',
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-lg bg-zinc-800/60 border border-zinc-700/60 overflow-hidden ${className}`}>
      {title && (
        <div className="px-3 py-2 bg-zinc-800 border-b border-zinc-700/60 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          {title}
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
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
}: {
  dirty: boolean
  saving: boolean
  saved: boolean
  onSave: () => void
  onRevert?: () => void
}) {
  if (!dirty && !saved) return null
  return (
    <div className="flex items-center gap-3 mt-4 pt-3 border-t border-zinc-700">
      {saved && <span className="text-xs text-emerald-400">✔ Saved</span>}
      {dirty && (
        <>
          <Btn variant="primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : '💾 Save Changes'}
          </Btn>
          {onRevert && (
            <Btn variant="ghost" onClick={onRevert}>↺ Revert</Btn>
          )}
        </>
      )}
    </div>
  )
}
