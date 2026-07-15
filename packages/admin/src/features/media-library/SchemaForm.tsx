/**
 * SchemaForm — renders a config editor from a FieldDef[] schema.
 *
 * The generic form behind every effect editor (fields come from the shared
 * EFFECT_CATALOG) and — since the manifest unification — any plugin kind
 * that declares FieldDef fields. No per-type editor code: labels, ranges,
 * enums, media pickers, and conditional visibility all come from the schema.
 */
import { useState } from 'react'
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
const WIDE_TYPES = new Set(['textarea', 'text-list', 'color-list', 'media', 'camera-device'])

// ── Camera device picker ──────────────────────────────────────────────────────

interface CameraDevice { deviceId: string; label: string }

export function CameraDeviceField({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const [devices, setDevices]       = useState<CameraDevice[]>([])
  const [loading, setLoading]       = useState(false)
  const [permGranted, setPermGranted] = useState(false)
  const currentLabel = typeof value === 'string' ? value : ''

  const enumerate = async (requestPermission: boolean) => {
    setLoading(true)
    let probe: MediaStream | null = null
    try {
      if (requestPermission) {
        probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      }
      const all = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = all.filter((d) => d.kind === 'videoinput')
      const labelsAvailable = videoInputs.some((d) => d.label.trim().length > 0)
      setDevices(videoInputs.map((d, i) => ({
        deviceId: d.deviceId,
        label:    d.label.trim() || `Camera ${i + 1}`,
      })))
      setPermGranted(requestPermission || labelsAvailable)
    } catch {
      // permission denied — keep whatever we have
    } finally {
      probe?.getTracks().forEach((t) => t.stop())
      setLoading(false)
    }
  }

  // Enumerate on first render (no permission request — labels may already be
  // available if permission was previously granted this session).
  const [enumerated, setEnumerated] = useState(false)
  if (!enumerated) {
    setEnumerated(true)
    void enumerate(false)
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">Camera Device</span>
        {!permGranted && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void enumerate(true)}
            className="text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline disabled:opacity-50"
          >
            {loading ? 'Detecting…' : '🔓 Get real names'}
          </button>
        )}
      </div>

      {devices.length > 0 ? (
        <select
          value={currentLabel}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-xs"
        >
          <option value="">— Default (first device) —</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.label}>{d.label}</option>
          ))}
          {/* Keep saved label visible even if not in enumerated list */}
          {currentLabel && !devices.some((d) => d.label === currentLabel) && (
            <option value={currentLabel}>{currentLabel} (saved)</option>
          )}
        </select>
      ) : (
        <div className="text-[10px] text-zinc-600 italic">
          {loading ? 'Detecting cameras…' : 'No cameras detected. Click "Get real names" to request permission.'}
        </div>
      )}

      <div className="mt-1 text-[10px] text-zinc-600">
        {permGranted
          ? 'Label saved on the server — used to find the same camera automatically.'
          : 'Generic names shown — click "Get real names" to see actual device labels.'}
      </div>
    </div>
  )
}

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

    case 'camera-device':
      return <CameraDeviceField value={value} onChange={onChange} />

    default:
      return null
  }
}
