/**
 * SchemaForm — renders a config editor from a FieldDef[] schema.
 *
 * The generic form behind every effect editor (fields come from the shared
 * EFFECT_CATALOG) and — since the manifest unification — any plugin kind
 * that declares FieldDef fields. No per-type editor code: labels, ranges,
 * enums, media pickers, and conditional visibility all come from the schema.
 */
import { HexColorInput, Slider, Toggle } from '../../shared/ui'
import { MediaSelectionInput } from './MediaLibrary'
import { RefSelect } from './RefSelect'
import type { FieldDef } from '@ieomlabs/shared'

export interface SchemaFormProps {
  fields: readonly FieldDef[]
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  /** Grid columns for compact fields (text/number/slider/etc.). Default 2. */
  columns?: 2 | 3
}

function isVisible(field: FieldDef, values: Record<string, unknown>): boolean {
  if (!field.showIf) return true
  return values[field.showIf.key] === field.showIf.equals
}

/** Full-width field types (span all grid columns). */
const WIDE_TYPES = new Set(['textarea', 'text-list', 'color-list', 'media'])

export function SchemaForm({ fields, values, onChange, columns = 2 }: SchemaFormProps) {
  const visible = fields.filter((f) => isVisible(f, values))
  if (!visible.length) return null

  return (
    <div className={`grid ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
      {visible.map((field) => (
        <div key={field.key} className={WIDE_TYPES.has(field.type) ? 'col-span-full' : undefined}>
          <SchemaField field={field} value={values[field.key]} onChange={(v) => onChange(field.key, v)} />
        </div>
      ))}
    </div>
  )
}

function SchemaField({ field, value, onChange }: {
  field: FieldDef
  value: unknown
  onChange: (value: unknown) => void
}) {
  const label = <div className="mb-1 text-[10px] text-zinc-500">{field.label}</div>
  const hint = field.hint ? <div className="mt-1 text-[10px] text-zinc-600">{field.hint}</div> : null

  switch (field.type) {
    case 'text':
      return (
        <div>
          {label}
          <input
            type="text"
            value={(value as string) ?? ''}
            placeholder={field.placeholder}
            onChange={(e) => onChange(field.optional && e.target.value === '' ? undefined : e.target.value)}
            className="w-full text-xs"
          />
          {hint}
        </div>
      )

    case 'textarea':
      return (
        <div>
          {label}
          <textarea
            value={(value as string) ?? ''}
            placeholder={field.placeholder}
            onChange={(e) => onChange(field.optional && e.target.value === '' ? undefined : e.target.value)}
            className="min-h-[72px] w-full text-xs"
          />
          {hint}
        </div>
      )

    case 'number':
      return (
        <div>
          {label}
          <input
            type="number"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={typeof value === 'number' ? value : ''}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value === '' ? (field.optional ? undefined : 0) : Number(e.target.value))}
            className="w-full font-mono text-xs"
          />
          {hint}
        </div>
      )

    case 'slider':
      return (
        <div>
          <Slider
            label={field.label}
            value={typeof value === 'number' ? value : field.min ?? 0}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            unit={field.unit}
            onChange={(v) => onChange(v)}
          />
          {hint}
        </div>
      )

    case 'color':
      return (
        <div>
          {label}
          <HexColorInput value={(value as string) ?? '#ffffff'} onChange={(v) => onChange(v)} />
          {hint}
        </div>
      )

    case 'boolean':
      return (
        <div className="flex items-end pb-1">
          <Toggle label={field.label} checked={Boolean(value)} onChange={(v) => onChange(v)} />
        </div>
      )

    case 'select':
      return (
        <div>
          {label}
          <select
            value={(value as string) ?? field.options?.[0] ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full text-xs"
          >
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {hint}
        </div>
      )

    case 'text-list':
    case 'color-list': {
      const list = Array.isArray(value) ? (value as string[]) : []
      return (
        <div>
          {label}
          <textarea
            value={list.join('\n')}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))}
            className="min-h-[72px] w-full font-mono text-xs"
          />
          {hint}
        </div>
      )
    }

    case 'ref':
      return (
        <div>
          {label}
          <RefSelect
            refKind={field.refKind ?? 'scene'}
            value={(value as string) ?? ''}
            onChange={(v) => onChange(field.optional && v === undefined ? undefined : v ?? '')}
            optional={field.optional}
            placeholder={field.placeholder}
          />
          {hint}
        </div>
      )

    case 'media':
      return (
        <div>
          {label}
          <MediaSelectionInput
            value={(value as string) ?? ''}
            onChange={(v) => onChange(v)}
            kinds={field.mediaKinds ?? ['image']}
            modalTitle={`Select ${field.label.toLowerCase()}`}
            placeholder={field.placeholder}
            buttonLabel="Browse"
            hint={field.hint}
            previewKind={field.mediaKinds?.[0] === 'video' ? 'video' : 'image'}
          />
        </div>
      )

    default:
      return null
  }
}
