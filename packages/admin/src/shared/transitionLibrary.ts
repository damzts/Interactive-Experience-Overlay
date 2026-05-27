import type { MediaEntry, TransitionStep } from '@ieom/shared'

export const TRANSITION_OPTIONS = [
  { id: 'instant', label: 'Instant', desc: 'Immediate cut, no animation' },
  { id: 'fade', label: 'Fade', desc: 'Cross-fade through black' },
  { id: 'zoom-in', label: 'Zoom In', desc: 'Camera rushes into CRT screen' },
  { id: 'zoom-out', label: 'Zoom Out', desc: 'Screen shrinks back to 3D room' },
  { id: 'win98-loading', label: 'Win98 Loading', desc: 'Windows 98 progress dialog' },
  { id: 'crt-wipe', label: 'CRT Wipe', desc: 'Static fills screen then clears' },
  { id: 'channel-sweep', label: 'Channel Sweep', desc: 'TV channel-change scan-line' },
  { id: 'boot-sequence', label: 'Boot Sequence', desc: 'BIOS POST text and progress bar' },
  { id: 'glitch-burst', label: 'Glitch Burst', desc: 'Digital glitch explosion' },
  { id: 'static-burst', label: 'Static Burst', desc: 'TV static fill then clear' },
  { id: 'wipe-left', label: 'Wipe Left', desc: 'Black panel sweeps from right' },
  { id: 'wipe-right', label: 'Wipe Right', desc: 'Black panel sweeps from left' },
]

export const TRANSITION_ICONS: Record<string, string> = {
  instant: '⚡',
  fade: '🌫',
  'zoom-in': '🔍',
  'zoom-out': '🔎',
  'win98-loading': '💾',
  'crt-wipe': '📺',
  'channel-sweep': '📡',
  'boot-sequence': '🖥',
  'glitch-burst': '⚠',
  'static-burst': '📻',
  'wipe-left': '◀',
  'wipe-right': '▶',
}

export const TRANSITION_TEST_BUTTON_CLASS = 'rounded border border-cyan-500/40 bg-cyan-600/25 px-3 py-1.5 text-xs text-cyan-300 transition-colors hover:bg-cyan-600/40 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-700'

export function encodeMediaTransitionValue(entry: Pick<MediaEntry, 'type' | 'url' | 'name' | 'duration'>) {
  const trimmedName = entry.name.trim()
  const hasDur = entry.type === 'image' && entry.duration != null && entry.duration > 0
  let encoded = `media:${entry.type}:${entry.url}`
  if (trimmedName || hasDur) encoded += `||${trimmedName}`
  if (hasDur) encoded += `||dur=${entry.duration}`
  return encoded
}

export function parseMediaTransitionValue(value: string) {
  const body = value.slice(6)
  const colon = body.indexOf(':')
  const type = colon >= 0 ? body.slice(0, colon) : body
  const rest = colon >= 0 ? body.slice(colon + 1) : ''
  const parts = rest.split('||')
  const url = parts[0] ?? ''
  const name = parts[1] ?? ''
  const durPart = parts.slice(2).find((part) => part.startsWith('dur='))
  const duration = durPart ? parseFloat(durPart.slice(4)) : undefined
  return {
    type: type as MediaEntry['type'],
    url,
    name,
    duration,
  }
}

export function parseBuiltInTransitionValue(value: string) {
  const queryIndex = value.indexOf('?')
  const id = queryIndex >= 0 ? value.slice(0, queryIndex) : value
  const duration = queryIndex >= 0 ? new URLSearchParams(value.slice(queryIndex + 1)).get('duration') : null
  return {
    id,
    duration: duration ? parseFloat(duration) : undefined,
  }
}

export function formatBuiltInTransitionValue(id: string, durationDraft: string) {
  const duration = parseFloat(durationDraft)
  return Number.isFinite(duration) && duration > 0 ? `${id}?duration=${duration}` : id
}

export function getMediaTransitionLabel(entry: Pick<MediaEntry, 'name' | 'url'>) {
  return entry.name.trim() || entry.url.split('/').pop() || 'Untitled transition'
}

export function stepToStr(step: TransitionStep): string {
  if (step.id.startsWith('media:')) return step.id
  return step.duration ? `${step.id}?duration=${step.duration}` : step.id
}

export function strToStep(value: string): TransitionStep {
  if (!value || value.startsWith('media:')) return { id: value }
  const queryIndex = value.indexOf('?')
  const id = queryIndex >= 0 ? value.slice(0, queryIndex) : value
  const duration = queryIndex >= 0 ? new URLSearchParams(value.slice(queryIndex + 1)).get('duration') : null
  return { id, ...(duration ? { duration: parseFloat(duration) } : {}) }
}
