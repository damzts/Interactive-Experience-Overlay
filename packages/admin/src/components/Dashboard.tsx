import { useEffect, useRef, useState, useCallback } from 'react'
import { DEFAULT_WIDGET_WINDOW_SIZES, STATE, OVERLAY_EVENT, withDesktopConfigDefaults, withLobbyConfigDefaults, withOverlayStyleDefaults } from '@ieom/shared'
import type {
  OverlayStyle, BackgroundType, PatternPreset, ParticlePreset,
  Application, LobbyConfig, DesktopConfig, ApplicationType, Scene, SourceInstance,
  EffectType, EffectConfig, MediaEntry, TransitionStep,
} from '@ieom/shared'
import { socket } from '../socket/client'
import { useAdminStore } from '../store/useAdminStore'
import type { AssetKind } from '../assets/catalog'
import { AssetCatalogPanel, AssetSelectionInput } from './AssetLibrary'
import { Panel, Toggle, Slider, Btn, HexColorInput, isSameDraft, IconGlyph, ConfigApplyBar } from './ui'
import { SettingsPage } from '../pages/SettingsPage'
import { ArchivePanel } from '../pages/ArchivePanel'
import { KeybindEditor } from '../pages/KeybindEditor'
import { AudioPanel }   from '../pages/AudioPanel'
import { AmbiancePanel } from '../pages/AmbiancePanel'

// ── Presets ────────────────────────────────────────────────────────

const GRADIENT_PRESETS = [
  { name: 'Deep Space',   value: 'linear-gradient(135deg, #0c0c1e 0%, #1a0533 50%, #0c0c1e 100%)' },
  { name: 'Cyberpunk',    value: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 40%, #0a1a2e 100%)' },
  { name: 'Forest Night', value: 'linear-gradient(135deg, #080f08 0%, #0a1f0a 60%, #040a04 100%)' },
  { name: 'Blood Moon',   value: 'linear-gradient(135deg, #1a0000 0%, #3d0000 50%, #1a0010 100%)' },
  { name: 'Arctic Abyss', value: 'linear-gradient(135deg, #050f1a 0%, #051525 60%, #020710 100%)' },
  { name: 'Gold Ember',   value: 'linear-gradient(135deg, #1a0f00 0%, #2d1f00 50%, #0d0900 100%)' },
  { name: 'Plasma',       value: 'radial-gradient(ellipse at 20% 20%, #1a0040 0%, #000010 60%, #001a3d 100%)' },
  { name: 'Void',         value: 'radial-gradient(ellipse at center, #0a0a0a 0%, #000000 100%)' },
  { name: 'Amethyst',     value: 'linear-gradient(45deg, #1a0033 0%, #330066 50%, #1a0033 100%)' },
]

const PATTERN_CSS: Record<PatternPreset, React.CSSProperties> = {
  none:       {},
  grid:       { backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '50px 50px', backgroundColor: '#0a0a0f' },
  dots:       { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)', backgroundSize: '28px 28px', backgroundColor: '#0a0a0f' },
  diagonal:   { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.04) 8px, rgba(255,255,255,0.04) 9px)', backgroundColor: '#0a0a0f' },
  honeycomb:  { backgroundSize: '28px 48px', backgroundImage: 'radial-gradient(circle farthest-side at 0% 50%, transparent 23.5%, rgba(255,255,255,.05) 24%, rgba(255,255,255,.05) 26%, transparent 27.75%)', backgroundColor: '#0a0a0f' },
  circuit:    { backgroundImage: 'linear-gradient(rgba(0,204,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,204,255,.05) 1px, transparent 1px)', backgroundSize: '50px 50px', backgroundColor: '#030810' },
  topography: { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.07)' d='M20 40Q40 20 60 40Q80 60 100 40Q120 20 140 40Q160 60 180 40'/%3E%3C/svg%3E\")", backgroundColor: '#0a0a0f' },
}

const PARTICLE_PRESETS: { id: ParticlePreset; icon: string; label: string }[] = [
  { id: 'none',      icon: '○', label: 'None'      },
  { id: 'stars',     icon: '✦', label: 'Stars'     },
  { id: 'snow',      icon: '❄', label: 'Snow'      },
  { id: 'matrix',    icon: '⌥', label: 'Matrix'    },
  { id: 'fireflies', icon: '◉', label: 'Fireflies' },
  { id: 'ash',       icon: '◦', label: 'Ash'       },
]

const GOOGLE_FONTS = [
  { name: 'System Default',  css: 'default'         },
  { name: 'Press Start 2P',  css: 'Press Start 2P'  },
  { name: 'VT323',           css: 'VT323'           },
  { name: 'Orbitron',        css: 'Orbitron'        },
  { name: 'Share Tech Mono', css: 'Share Tech Mono' },
  { name: 'Rajdhani',        css: 'Rajdhani'        },
  { name: 'Audiowide',       css: 'Audiowide'       },
  { name: 'Electrolize',     css: 'Electrolize'     },
]

const ACCENT_SWATCHES = ['#00ff41', '#06b6d4', '#a855f7', '#f97316', '#ec4899', '#eab308', '#ef4444', '#ffffff']


type ThemeAppearance = Pick<OverlayStyle, 'fontFamily' | 'accentColor' | 'textColor'>

function clampWidgetDimension(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function getDefaultWidgetSize(widgetId: string) {
  return DEFAULT_WIDGET_WINDOW_SIZES[widgetId] ?? { width: 260, height: 240 }
}

function resolveWidgetSizeFromConfig(widgetId: string, desktopConfig: DesktopConfig) {
  const defaults = getDefaultWidgetSize(widgetId)
  const raw = desktopConfig.widgetSizes?.[widgetId]
  return {
    width: clampWidgetDimension(raw?.width ?? defaults.width, 180, 1400, defaults.width),
    height: clampWidgetDimension(raw?.height ?? defaults.height, 140, 1000, defaults.height),
  }
}

/** Returns the persisted z-index for a widget, or undefined if not set. */
function resolveWidgetZIndexFromConfig(widgetId: string, desktopConfig: DesktopConfig): number | undefined {
  const v = desktopConfig.widgetZIndices?.[widgetId]
  return Number.isFinite(v) ? (v as number) : undefined
}

function ThemeAppearanceFields({
  appearance,
  onChange,
  helperText,
}: {
  appearance: ThemeAppearance
  onChange: (updater: (draft: ThemeAppearance) => void) => void
  helperText?: string
}) {
  return (
    <div className="space-y-3">
      {helperText && <div className="text-[10px] text-zinc-500 leading-relaxed">{helperText}</div>}
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Font</div>
        <select value={appearance.fontFamily} onChange={(e) => onChange((d) => { d.fontFamily = e.target.value })}
          className="w-full text-xs">
          {GOOGLE_FONTS.map((font) => <option key={font.css} value={font.css}>{font.name}</option>)}
        </select>
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Accent</div>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {ACCENT_SWATCHES.map((color) => (
            <button key={color} type="button" onClick={() => onChange((d) => { d.accentColor = color })}
              className={'w-6 h-6 rounded-full border-2 transition-all ' + (appearance.accentColor === color ? 'border-white scale-110' : 'border-transparent hover:border-zinc-400')}
              style={{ backgroundColor: color }} />
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
function LabeledHexColorRow({
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

const TRANSITION_OPTIONS = [
  { id: 'instant',       label: 'Instant',        desc: 'Immediate cut, no animation' },
  { id: 'fade',          label: 'Fade',           desc: 'Cross-fade through black' },
  { id: 'zoom-in',       label: 'Zoom In',        desc: 'Camera rushes into CRT screen' },
  { id: 'zoom-out',      label: 'Zoom Out',       desc: 'Screen shrinks back to 3D room' },
  { id: 'win98-loading', label: 'Win98 Loading',  desc: 'Windows 98 progress dialog' },
  { id: 'crt-wipe',      label: 'CRT Wipe',       desc: 'Static fills screen then clears' },
  { id: 'channel-sweep', label: 'Channel Sweep',  desc: 'TV channel-change scan-line' },
  { id: 'boot-sequence', label: 'Boot Sequence',  desc: 'BIOS POST text and progress bar' },
  { id: 'glitch-burst',  label: 'Glitch Burst',   desc: 'Digital glitch explosion' },
  { id: 'static-burst',  label: 'Static Burst',   desc: 'TV static fill then clear' },
  { id: 'wipe-left',     label: 'Wipe Left',      desc: 'Black panel sweeps from right' },
  { id: 'wipe-right',    label: 'Wipe Right',     desc: 'Black panel sweeps from left' },
]

// ── Source catalog ────────────────────────────────────────────────
interface FieldDef {
  key: string; label: string
  type: 'text' | 'number' | 'color' | 'boolean' | 'select'
  assetKinds?: AssetKind[]
  options?: string[]; min?: number; max?: number; step?: number; placeholder?: string
}
interface CatalogEntry {
  type: string; label: string; icon: string; desc: string
  defaultConfig: Record<string, unknown>
  fields: FieldDef[]
  defaultPosition?: { x: number; y: number; width: number; height: number }
}
const SOURCE_CATALOG: CatalogEntry[] = [
  {
    type: 'image-slideshow', label: 'Game Slideshow', icon: '🎞', desc: 'Auto-cycling scraped game screenshots',
    defaultConfig: { interval: 6, shuffle: true },
    fields: [
      { key: 'interval', label: 'Interval (s)', type: 'number', min: 1, max: 60, step: 1 },
      { key: 'shuffle',  label: 'Shuffle',      type: 'boolean' },
    ],
  },
  {
    type: 'image-static', label: 'Static Image', icon: '🖼', desc: 'Single image — local path or URL',
    defaultConfig: { url: '', objectFit: 'cover', opacity: 1 },
    fields: [
      { key: 'url',       label: 'URL / Path', type: 'text', assetKinds: ['image'], placeholder: '/assets/backgrounds/name.jpg' },
      { key: 'objectFit', label: 'Fit',        type: 'select', options: ['cover', 'contain', 'fill'] },
      { key: 'opacity',   label: 'Opacity',    type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'video-loop', label: 'Video Loop', icon: '🎬', desc: 'Muted looping video — local path or URL',
    defaultConfig: { url: '', opacity: 1 },
    fields: [
      { key: 'url',     label: 'URL / Path', type: 'text', assetKinds: ['video'], placeholder: '/assets/video/name.mp4' },
      { key: 'opacity', label: 'Opacity',    type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'solid-color', label: 'Solid Color', icon: '⬛', desc: 'Flat opaque color fill',
    defaultConfig: { color: '#000000' },
    fields: [
      { key: 'color', label: 'Color', type: 'color' },
    ],
  },
  {
    type: 'color-overlay', label: 'Color Overlay', icon: '🎨', desc: 'Semi-transparent color wash',
    defaultConfig: { color: '#000000', opacity: 0.5 },
    fields: [
      { key: 'color',   label: 'Color',   type: 'color' },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'crt-effect', label: 'CRT Scanlines', icon: '📺', desc: 'Retro scanline + vignette overlay',
    defaultConfig: { scanlineIntensity: 0.25, vignetteStrength: 0.5 },
    fields: [
      { key: 'scanlineIntensity', label: 'Scanlines', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'vignetteStrength',  label: 'Vignette',  type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'vignette', label: 'Vignette', icon: '◉', desc: 'Edge-darkening radial gradient',
    defaultConfig: { color: '#000000', strength: 0.6 },
    fields: [
      { key: 'color',    label: 'Color',    type: 'color' },
      { key: 'strength', label: 'Strength', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'noise-grain', label: 'Film Grain', icon: '📽', desc: 'Animated film grain noise (overlay blend)',
    defaultConfig: { opacity: 0.08, animated: true },
    fields: [
      { key: 'opacity',  label: 'Opacity',  type: 'number', min: 0, max: 0.5, step: 0.01 },
      { key: 'animated', label: 'Animated', type: 'boolean' },
    ],
  },
  {
    type: 'text-widget', label: 'Text Label', icon: '✍', desc: 'Static or typewriter text block',
    defaultConfig: { content: 'Label', font: 'vt323', fontSize: 28, color: '#ffffff', typewriterMode: false },
    fields: [
      { key: 'content',        label: 'Content',    type: 'text' },
      { key: 'font',           label: 'Font',       type: 'select', options: ['vt323', 'press-start', 'monospace', 'serif'] },
      { key: 'fontSize',       label: 'Size',       type: 'number', min: 8, max: 200, step: 2 },
      { key: 'color',          label: 'Color',      type: 'color' },
      { key: 'typewriterMode', label: 'Typewriter', type: 'boolean' },
    ],
  },
  {
    type: 'clock-widget', label: 'Clock', icon: '🕐', desc: 'Live digital clock display',
    defaultConfig: { format: '24h', color: '#00ff41', fontSize: 36, font: 'vt323' },
    defaultPosition: { x: 1680, y: 20, width: 220, height: 60 },
    fields: [
      { key: 'format',   label: 'Format', type: 'select', options: ['24h', '12h', '24h-sec', '12h-sec'] },
      { key: 'color',    label: 'Color',  type: 'color' },
      { key: 'fontSize', label: 'Size',   type: 'number', min: 8, max: 200, step: 2 },
      { key: 'font',     label: 'Font',   type: 'select', options: ['vt323', 'press-start', 'monospace', 'serif'] },
    ],
  },
]

// ── TransitionPicker ─────────────────────────────────────────────

const TRANSITION_ICONS: Record<string, string> = {
  'instant':       '⚡',
  'fade':          '🌫',
  'zoom-in':       '🔍',
  'zoom-out':      '🔎',
  'win98-loading': '💾',
  'crt-wipe':      '📺',
  'channel-sweep': '📡',
  'boot-sequence': '🖥',
  'glitch-burst':  '⚠',
  'static-burst':  '📻',
  'wipe-left':     '◀',
  'wipe-right':    '▶',
}

function TransitionPicker({
  value,
  onChange,
  placeholder = '— Default —',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen]                   = useState(false)
  const [mediaOpen, setMediaOpen]         = useState(false)
  const [mediaView, setMediaView]         = useState<'library' | 'form'>('library')
  const [saveToLib, setSaveToLib]         = useState(true)
  const [settingsCard, setSettingsCard]   = useState<string | null>(null)
  const [settingsDuration, setSettingsDuration] = useState('')
  const [mediaUrl,  setMediaUrl]          = useState('')
  const [mediaName, setMediaName]         = useState('')
  const [mediaType, setMediaType]         = useState<'image' | 'video'>('image')
  const [mediaDurStr, setMediaDurStr]     = useState('')
  const [previewSrc, setPreviewSrc]       = useState('')
  const [videoDur, setVideoDur]           = useState<number | null>(null)
  const [dragOver, setDragOver]           = useState(false)
  const [pendingFile, setPendingFile]     = useState<File | null>(null)
  const [uploading, setUploading]         = useState(false)
  const [uploadErr, setUploadErr]         = useState('')
  const fileInputRef                      = useRef<HTMLInputElement>(null)

  const mediaLibrary  = useAdminStore((s) => s.config.mediaLibrary ?? [])
  const saveConfig    = useAdminStore((s) => s.saveConfig)
  const fullConfig    = useAdminStore((s) => s.config)

  // Parse a stored media value: media:<type>:<url>||<name>||dur=<N>
  const parseMedia = (v: string) => {
    const body  = v.slice(6)
    const colon = body.indexOf(':')
    const type  = colon >= 0 ? body.slice(0, colon) : body
    const rest  = colon >= 0 ? body.slice(colon + 1) : ''
    const parts = rest.split('||')
    const url   = parts[0] ?? ''
    const name  = parts[1] ?? ''
    const durPart = parts.slice(2).find(p => p.startsWith('dur='))
    const duration = durPart ? parseFloat(durPart.slice(4)) : undefined
    return { type, url, name, duration }
  }

  // Parse a GSAP transition value: id  OR  id?duration=N
  const parseGsap = (v: string) => {
    const qi  = v.indexOf('?')
    const id  = qi >= 0 ? v.slice(0, qi) : v
    const dur = qi >= 0 ? new URLSearchParams(v.slice(qi + 1)).get('duration') : null
    return { id, duration: dur ? parseFloat(dur) : undefined }
  }

  const mediaParsed  = value.startsWith('media:') ? parseMedia(value) : null
  const gsapParsed   = !value.startsWith('media:') ? parseGsap(value) : null
  const selected     = TRANSITION_OPTIONS.find((t) => t.id === (gsapParsed?.id ?? ''))
  const mediaDisplay = mediaParsed?.name || mediaParsed?.url.split('/').pop() || 'Media'
  const displayLabel = selected
    ? selected.label
    : mediaParsed
      ? `🖼 ${mediaDisplay}`
      : placeholder

  const preview = (id: string) => socket.emit('transition:preview', [{ id }])

  // Toggle settings inline-panel for a GSAP card
  const toggleSettings = (id: string) => {
    if (settingsCard === id) { setSettingsCard(null); return }
    const dur = gsapParsed?.id === id ? (gsapParsed?.duration?.toString() ?? '') : ''
    setSettingsDuration(dur)
    setSettingsCard(id)
  }

  const commitSettings = () => {
    if (!settingsCard) return
    const dur = parseFloat(settingsDuration)
    const suffix = !isNaN(dur) && dur > 0 ? `?duration=${dur}` : ''
    onChange(`${settingsCard}${suffix}`)
    setSettingsCard(null)
    // modal stays open
  }

  const openMediaPanel = () => {
    // Always reset preview state first
    setPreviewSrc('')
    setVideoDur(null)
    if (mediaParsed) {
      // Editing an existing media selection → go straight to form
      setMediaType(mediaParsed.type as 'image' | 'video')
      setMediaUrl(mediaParsed.url)
      setMediaName(mediaParsed.name)
      setMediaDurStr(mediaParsed.duration?.toString() ?? '')
      setMediaView('form')
    } else {
      setMediaUrl('')
      setMediaName('')
      setMediaDurStr('')
      setMediaType('image')
      // Show library first if entries exist, otherwise go straight to the form
      setMediaView(mediaLibrary.length > 0 ? 'library' : 'form')
    }
    setSaveToLib(true)
    setMediaOpen(true)
  }

  const applyFile = (file: File) => {
    const isVideo = file.type.startsWith('video/')
    setMediaType(isVideo ? 'video' : 'image')
    setPreviewSrc(URL.createObjectURL(file))
    setVideoDur(null)
    setPendingFile(file)
    setUploadErr('')
    const folder = isVideo ? 'video' : 'images'
    setMediaUrl(`/assets/${folder}/${file.name}`)
    if (!mediaName) setMediaName(file.name.replace(/\.[^.]+$/, ''))
  }

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) applyFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) applyFile(file)
  }

  const commitMedia = async () => {
    setUploadErr('')
    let finalUrl = mediaUrl

    // If the user dropped / picked a local file, upload it first
    if (pendingFile) {
      setUploading(true)
      try {
        const form = new FormData()
        form.append('file', pendingFile)
        const res  = await fetch('/api/upload/asset', { method: 'POST', body: form })
        const json = await res.json() as { url?: string; error?: string }
        if (!res.ok || !json.url) throw new Error(json.error ?? 'Upload failed')
        finalUrl = json.url
        setMediaUrl(finalUrl)
        setPendingFile(null)
      } catch (err) {
        setUploadErr(err instanceof Error ? err.message : 'Upload failed')
        setUploading(false)
        return
      }
      setUploading(false)
    }

    const durVal = parseFloat(mediaDurStr)
    const hasDur = mediaType === 'image' && !isNaN(durVal) && durVal > 0
    let encoded  = `media:${mediaType}:${finalUrl}`
    if (mediaName.trim() || hasDur) encoded += `||${mediaName.trim()}`
    if (hasDur) encoded += `||dur=${durVal}`
    // Optionally persist to library so the entry is available for every scene
    if (saveToLib && finalUrl) {
      const existing = mediaLibrary.find((e) => e.url === finalUrl)
      if (!existing) {
        const entry: MediaEntry = {
          id: 'media-' + Date.now(),
          name: mediaName.trim() || finalUrl.split('/').pop() || 'Unnamed',
          type: mediaType,
          url: finalUrl,
          ...(hasDur ? { duration: durVal } : {}),
        }
        saveConfig({ ...fullConfig, mediaLibrary: [...mediaLibrary, entry] })
      }
    }
    onChange(encoded)
    handleClose()
  }

  /** Pick a saved library entry — immediately commit it as the transition value */
  const commitFromLibrary = (entry: MediaEntry) => {
    const hasDur = entry.type === 'image' && entry.duration != null && entry.duration > 0
    let encoded  = `media:${entry.type}:${entry.url}||${entry.name}`
    if (hasDur) encoded += `||dur=${entry.duration}`
    onChange(encoded)
    handleClose()
  }

  const handleClose = () => { setOpen(false); setMediaOpen(false); setSettingsCard(null); setPendingFile(null); setUploadErr('') }

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded hover:border-zinc-500 transition-colors"
      >
        <span className={selected || value.startsWith('media:') ? 'text-zinc-100' : 'text-zinc-500'}>
          {selected && <span className="mr-1.5">{TRANSITION_ICONS[selected.id]}</span>}
          {displayLabel}
        </span>
        <span className="text-zinc-600 text-[10px]">▼</span>
      </button>

      {/* Modal — fixed size, flex column */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
          onClick={handleClose}
        >
          <div
            className="w-[560px] h-[600px] flex flex-col bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — fixed */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-100">Choose Transition</span>
                {(selected || mediaParsed) && (
                  <span className="text-[10px] text-cyan-400 bg-cyan-900/30 border border-cyan-700/30 rounded px-1.5 py-0.5">
                    {selected ? `${TRANSITION_ICONS[selected.id]} ${selected.label}` : `🖼 ${mediaDisplay}`}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-zinc-500 hover:text-zinc-200 text-lg leading-none ml-3"
              >
                ✕
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* None / default row */}
              <button
                type="button"
                onClick={() => onChange('')}
                className={
                  'w-full text-left px-3 py-2 mb-3 rounded border text-xs transition-colors ' +
                  (!value
                    ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-300'
                    : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800')
                }
              >
                <span className="mr-2 text-zinc-500">—</span> {placeholder}
              </button>

              {/* Transition cards grid */}
              <div className="grid grid-cols-2 gap-2">
                {TRANSITION_OPTIONS.map((t) => {
                  const isActive   = gsapParsed?.id === t.id
                  const isExpanded = settingsCard === t.id
                  return (
                  <div
                    key={t.id}
                    className={
                      'rounded border overflow-hidden transition-colors ' +
                      (isActive
                        ? 'bg-cyan-600/20 border-cyan-500/40'
                        : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600')
                    }
                  >
                    {/* Card row */}
                    <div className="flex">
                      {/* Select area */}
                      <button
                        type="button"
                        onClick={() => onChange(isActive ? '' : t.id)}
                        className="flex-1 text-left px-3 py-2.5 min-w-0"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-base shrink-0">{TRANSITION_ICONS[t.id]}</span>
                          <span className={'text-xs font-medium truncate ' + (isActive ? 'text-cyan-300' : 'text-zinc-200')}>
                            {t.label}
                          </span>
                          {isActive && gsapParsed?.duration && (
                            <span className="ml-auto shrink-0 text-[9px] text-cyan-500/70 font-mono">{gsapParsed.duration}s</span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">{t.desc}</div>
                      </button>
                      {/* Right column: ✕ delete | ☰ settings | ▶ preview */}
                      <div className="w-10 shrink-0 flex flex-col border-l border-zinc-700/50 divide-y divide-zinc-700/50">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); if (isActive) onChange('') }}
                          title={isActive ? 'Remove selection' : ''}
                          className={'flex-1 flex items-center justify-center text-[11px] transition-colors ' +
                            (isActive ? 'text-zinc-600 hover:text-red-400 hover:bg-red-900/20' : 'text-zinc-800 cursor-default')}
                        >
                          ✕
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleSettings(t.id) }}
                          title="Duration settings"
                          className={'flex-1 flex items-center justify-center text-xs transition-colors ' +
                            (isExpanded ? 'text-cyan-400 bg-zinc-700/40' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/30')}
                        >
                          ☰
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); preview(t.id) }}
                          title="Preview on overlay"
                          className="flex-1 flex items-center justify-center text-xs text-zinc-500 hover:text-cyan-400 hover:bg-zinc-700/30 transition-colors"
                        >
                          ▶
                        </button>
                      </div>
                    </div>
                    {/* Inline settings expansion */}
                    {isExpanded && (
                      <div className="border-t border-zinc-700/50 bg-zinc-800/40 px-3 py-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wide w-16 shrink-0">Duration</span>
                          <input
                            type="number"
                            min={0.1}
                            max={60}
                            step={0.1}
                            value={settingsDuration}
                            onChange={(e) => setSettingsDuration(e.target.value)}
                            placeholder="default"
                            className="w-20 text-xs font-mono"
                          />
                          <span className="text-[10px] text-zinc-600">sec</span>
                        </div>
                        <div className="text-[10px] text-zinc-600">Leave empty to use the transition's built-in speed.</div>
                        <div className="flex gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={commitSettings}
                            className="flex-1 py-1 text-[11px] bg-cyan-600/25 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 rounded transition-colors"
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() => setSettingsCard(null)}
                            className="flex-1 py-1 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700 rounded transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  )
                })}

                {/* Image / Video Transition card */}
                <div
                  className={
                    'rounded border overflow-hidden transition-colors ' +
                    (mediaParsed
                      ? 'bg-cyan-600/20 border-cyan-500/40'
                      : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600')
                  }
                >
                  <div className="flex">
                    {/* Info area */}
                    <div className="flex-1 px-3 py-2.5 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-base shrink-0">🖼</span>
                        <span className={'text-xs font-medium truncate ' + (mediaParsed ? 'text-cyan-300' : 'text-zinc-200')}>
                          {mediaParsed ? mediaDisplay : 'Image / Video'}
                        </span>
                        {mediaParsed?.duration && (
                          <span className="ml-auto shrink-0 text-[9px] text-cyan-500/70 font-mono">{mediaParsed.duration}s</span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">
                        {mediaParsed ? mediaParsed.url.split('/').pop() : 'Use a file as the transition'}
                      </div>
                    </div>
                    {/* Right column: ✕ delete | ☰ edit | ▶ preview */}
                    <div className="w-10 shrink-0 flex flex-col border-l border-zinc-700/50 divide-y divide-zinc-700/50">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); if (mediaParsed) { onChange(''); setMediaUrl(''); setMediaName(''); setPreviewSrc('') } }}
                        title={mediaParsed ? 'Remove' : ''}
                        className={'flex-1 flex items-center justify-center text-[11px] transition-colors ' +
                          (mediaParsed ? 'text-zinc-600 hover:text-red-400 hover:bg-red-900/20' : 'text-zinc-800 cursor-default')}
                      >
                        ✕
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openMediaPanel() }}
                        title="Edit or add media"
                        className="flex-1 flex items-center justify-center text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/30 transition-colors"
                      >
                        ☰
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); if (mediaParsed) preview(value) }}
                        title={mediaParsed ? 'Preview' : ''}
                        className={'flex-1 flex items-center justify-center text-xs transition-colors ' +
                          (mediaParsed ? 'text-zinc-500 hover:text-cyan-400 hover:bg-zinc-700/30' : 'text-zinc-800 cursor-default')}
                      >
                        ▶
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fixed footer */}
            <div className="shrink-0 px-4 py-3 border-t border-zinc-800 flex items-center gap-2">
              <button
                type="button"
                onClick={openMediaPanel}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
              >
                <span>＋</span>
                <span>Add media</span>
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-1.5 text-xs bg-cyan-600/20 hover:bg-cyan-600/35 text-cyan-300 border border-cyan-500/30 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>

            {/* Media sub-panel — absolute overlay inside the modal */}
            {mediaOpen && (
              <div className="absolute inset-0 flex flex-col bg-zinc-900 z-10">
                {/* Sub-header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setMediaOpen(false)}
                    className="text-zinc-500 hover:text-zinc-200 text-sm leading-none mr-1"
                  >
                    ←
                  </button>
                  <span className="text-sm font-semibold text-zinc-100">
                    {mediaView === 'library' ? 'Media Library' : 'Image / Video'}
                  </span>
                  {mediaView === 'form' && mediaLibrary.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMediaView('library')}
                      className="ml-auto text-[10px] text-zinc-500 hover:text-zinc-200 transition-colors"
                    >
                      ← Library
                    </button>
                  )}
                </div>

                {/* ── Library view ── */}
                {mediaView === 'library' && (
                  <>
                    <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                      {mediaLibrary.length === 0 ? (
                        <div className="text-xs text-zinc-600 italic text-center py-8">No saved media yet.</div>
                      ) : (
                        mediaLibrary.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => commitFromLibrary(entry)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-zinc-700 bg-zinc-800/50 hover:border-cyan-500/50 hover:bg-cyan-900/20 transition-colors text-left group"
                          >
                            <div className="w-14 h-8 rounded overflow-hidden bg-zinc-950 border border-zinc-700 shrink-0 flex items-center justify-center">
                              {entry.type === 'image'
                                ? <img src={entry.url} alt={entry.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex') }} />
                                : null
                              }
                              <span className="text-base" style={{ display: entry.type === 'image' ? 'none' : 'flex' }}>{entry.type === 'image' ? '🖼' : '🎬'}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-zinc-200 truncate">{entry.name}</div>
                              <div className="text-[10px] text-zinc-500 font-mono truncate">{entry.url}</div>
                              {entry.type === 'image' && entry.duration != null && (
                                <div className="text-[10px] text-zinc-600">{entry.duration}s</div>
                              )}
                            </div>
                            <span className="text-[10px] text-cyan-500 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity">Use</span>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="shrink-0 px-4 py-3 border-t border-zinc-800">
                      <button
                        type="button"
                        onClick={() => {
                          setMediaUrl(''); setMediaName(''); setMediaDurStr(''); setMediaType('image')
                          setPreviewSrc(''); setVideoDur(null); setSaveToLib(true); setPendingFile(null); setUploadErr('')
                          setMediaView('form')
                        }}
                        className="w-full py-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 hover:border-zinc-500 rounded-lg transition-colors"
                      >
                        ＋ Add New Media
                      </button>
                    </div>
                  </>
                )}

                {/* ── Form view ── */}
                {mediaView === 'form' && (
                  <>
                    {/* Sub-body */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">

                      {/* Name */}
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1.5 uppercase tracking-wider">Name</div>
                        <input
                          type="text"
                          value={mediaName}
                          onChange={(e) => setMediaName(e.target.value)}
                          placeholder="My Transition"
                          className="w-full text-xs"
                        />
                      </div>

                      {/* Type toggle */}
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wider">Type</div>
                        <div className="flex gap-2">
                          {(['image', 'video'] as const).map((mt) => (
                            <button
                              key={mt}
                              type="button"
                              onClick={() => { setMediaType(mt); if (previewSrc.startsWith('blob:')) setPreviewSrc('') }}
                              className={
                                'px-4 py-1.5 text-xs rounded border capitalize transition-colors ' +
                                (mediaType === mt
                                  ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40'
                                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200')
                              }
                            >
                              {mt === 'image' ? '🖼 Image' : '🎬 Video'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Drag-and-drop + browse zone */}
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wider">Source</div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          onChange={handleFilePick}
                        />
                        <div
                          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={
                            'w-full h-24 flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed cursor-pointer transition-colors ' +
                            (dragOver
                              ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                              : 'border-zinc-700 bg-zinc-800/30 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300')
                          }
                        >
                          <span className="text-xl">📁</span>
                          <span className="text-xs">Drop a file or <span className="underline">browse</span></span>
                        </div>
                      </div>

                      {/* Path or URL */}
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1.5 uppercase tracking-wider">Path or URL</div>
                        <input
                          type="text"
                          value={mediaUrl}
                          onChange={(e) => { setMediaUrl(e.target.value); setPreviewSrc(''); setPendingFile(null) }}
                          placeholder="/assets/video/wipe.mp4  or  https://…"
                          className="w-full text-xs font-mono"
                        />
                        <div className="text-[10px] mt-1">
                          {pendingFile
                            ? <span className="text-cyan-600">📤 Will be uploaded to server on save</span>
                            : <span className="text-zinc-600">Server-relative path (proxied) or full URL.</span>
                          }
                        </div>
                      </div>

                      {/* Image duration */}
                      {mediaType === 'image' && (
                        <div>
                          <div className="text-[10px] text-zinc-500 mb-1.5 uppercase tracking-wider">Display Duration (seconds)</div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0.1}
                              max={120}
                              step={0.5}
                              value={mediaDurStr}
                              onChange={(e) => setMediaDurStr(e.target.value)}
                              placeholder="4.0"
                              className="w-28 text-xs font-mono"
                            />
                            <span className="text-[10px] text-zinc-600">sec (default 4.0)</span>
                          </div>
                        </div>
                      )}

                      {/* Preview */}
                      {(previewSrc || mediaUrl) && (
                        <div>
                          <div className="text-[10px] text-zinc-500 mb-1.5 uppercase tracking-wider">Preview</div>
                          <div className="relative w-full aspect-video bg-black rounded-lg border border-zinc-700 overflow-hidden">
                            {mediaType === 'image' ? (
                              <img
                                src={previewSrc || mediaUrl}
                                alt="preview"
                                className="w-full h-full object-contain"
                                onError={(e) => { (e.currentTarget.parentElement as HTMLElement).dataset.err = '1'; e.currentTarget.style.display = 'none' }}
                              />
                            ) : (
                              <video
                                key={previewSrc || mediaUrl}
                                src={previewSrc || mediaUrl}
                                className="w-full h-full object-contain"
                                muted
                                loop
                                autoPlay
                                playsInline
                                onLoadedMetadata={(e) => setVideoDur(e.currentTarget.duration)}
                                onError={() => setVideoDur(null)}
                              />
                            )}
                          </div>
                          {mediaType === 'video' && videoDur != null && (
                            <div className="mt-1 text-[10px] text-zinc-500">
                              Duration: <span className="text-zinc-300 font-mono">{videoDur.toFixed(2)}s</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Save to Library toggle */}
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={saveToLib}
                          onChange={(e) => setSaveToLib(e.target.checked)}
                          className="accent-cyan-500"
                        />
                        <span className="text-[11px] text-zinc-400">Save to Library</span>
                        <span className="text-[10px] text-zinc-600">(reuse in any scene)</span>
                      </label>
                    </div>

                    {/* Sub-footer */}
                    <div className="shrink-0 px-4 py-3 border-t border-zinc-800 space-y-2">
                      {uploadErr && (
                        <div className="text-[10px] text-red-400 bg-red-900/20 border border-red-700/40 rounded px-2 py-1">{uploadErr}</div>
                      )}
                      <button
                        type="button"
                        disabled={!mediaUrl || uploading}
                        onClick={commitMedia}
                        className="w-full py-2 text-sm bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {uploading
                          ? 'Uploading…'
                          : pendingFile
                            ? `Upload & Use ${mediaType === 'image' ? 'Image' : 'Video'}`
                            : `Use This ${mediaType === 'image' ? 'Image' : 'Video'}`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}

function SourceField({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] text-zinc-500 w-16 shrink-0">{field.label}</label>
      {field.type === 'color' && (
        <HexColorInput
          value={String(value ?? '#000000')}
          onChange={(nextValue) => onChange(nextValue)}
          className="flex-1 min-w-0 gap-1"
          pickerClassName="w-6 h-5 shrink-0"
          textClassName="flex-1 font-mono text-[10px] min-w-0"
        />
      )}
      {field.type === 'number' && (
        <input type="number" value={Number(value ?? 0)}
          min={field.min} max={field.max} step={field.step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 font-mono text-xs" />
      )}
      {field.type === 'text' && (
        field.assetKinds?.length ? (
          <div className="flex-1 min-w-0">
            <AssetSelectionInput
              value={String(value ?? '')}
              onChange={(nextValue) => onChange(nextValue)}
              kinds={field.assetKinds}
              modalTitle={field.label}
              placeholder={field.placeholder}
              buttonLabel="Browse Assets"
              previewKind={field.assetKinds[0] ?? 'auto'}
            />
          </div>
        ) : (
          <input type="text" value={String(value ?? '')} placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 text-xs" />
        )
      )}
      {field.type === 'boolean' && (
        <input type="checkbox" checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)} />
      )}
      {field.type === 'select' && (
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className="flex-1 text-xs">
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </div>
  )
}

function SourcesEditor({ sceneId }: { sceneId: string }) {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const scene      = config.scenes[sceneId] as (typeof config.scenes)[string] | undefined
  const sources    = (scene?.sources ?? []) as SourceInstance[]
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [showCatalog, setShowCatalog] = useState(false)

  const save = (next: SourceInstance[]) =>
    saveConfig({ scenes: { ...config.scenes, [sceneId]: { ...config.scenes[sceneId], sources: next } } })

  const toggle   = (id: string) => save(sources.map((s) => s.id === id ? { ...s, visible: !s.visible } : s))
  const remove   = (id: string) => { save(sources.filter((s) => s.id !== id)); if (expanded === id) setExpanded(null) }
  const setConfig = (id: string, cfg: Record<string, unknown>) => save(sources.map((s) => s.id === id ? { ...s, config: cfg } : s))
  const setPos   = (id: string, f: keyof SourceInstance['position'], v: number) =>
    save(sources.map((s) => s.id === id ? { ...s, position: { ...s.position, [f]: v } } : s))
  const moveZ    = (id: string, dir: 1 | -1) =>
    save(sources.map((s) => s.id === id ? { ...s, zIndex: s.zIndex + dir } : s))

  const addSource = (entry: CatalogEntry) => {
    const newSrc: SourceInstance = {
      id:         entry.type + '-' + Date.now(),
      pluginType: entry.type,
      config:     { ...entry.defaultConfig },
      position:   entry.defaultPosition ?? { x: 0, y: 0, width: 1920, height: 1080 },
      zIndex:     sources.length,
      visible:    true,
    }
    save([...sources, newSrc])
    setShowCatalog(false)
    setExpanded(newSrc.id)
  }

  const sorted = [...sources].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div className="space-y-1">
      {sorted.length === 0 && (
        <div className="text-[10px] text-zinc-600 italic py-1">No sources. Game capture shows through.</div>
      )}
      {sorted.map((src) => {
        const meta  = SOURCE_CATALOG.find((c) => c.type === src.pluginType)
        const isExp = expanded === src.id
        return (
          <div key={src.id} className="rounded border border-zinc-700/60 bg-zinc-800/40 overflow-hidden">
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <button
                title={src.visible ? 'Hide' : 'Show'}
                onClick={() => toggle(src.id)}
                className={'w-2 h-2 rounded-full shrink-0 transition-colors ' + (src.visible ? 'bg-emerald-400 hover:bg-emerald-600' : 'bg-zinc-600 hover:bg-zinc-400')}
              />
              <span className="text-[10px] text-zinc-500 shrink-0">{meta?.icon ?? '▣'}</span>
              <span className="text-[11px] text-zinc-200 flex-1 truncate font-mono">{src.id}</span>
              <span className="text-[9px] text-zinc-600 shrink-0">{src.pluginType}</span>
              <button onClick={() => setExpanded(isExp ? null : src.id)} className="text-[10px] text-zinc-500 hover:text-zinc-300 px-1">{isExp ? '▲' : '▼'}</button>
              <button onClick={() => remove(src.id)} className="text-[10px] text-red-500 hover:text-red-300 px-1">✕</button>
            </div>
            {isExp && (
              <div className="border-t border-zinc-700/50 px-2 py-2 space-y-2">
                {meta?.fields.map((f) => (
                  <SourceField key={f.key} field={f} value={src.config[f.key]}
                    onChange={(v) => setConfig(src.id, { ...src.config, [f.key]: v })} />
                ))}
                <div>
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">Position (px on 1920×1080)</div>
                  <div className="grid grid-cols-4 gap-1">
                    {(['x', 'y', 'width', 'height'] as const).map((f) => (
                      <div key={f}>
                        <div className="text-[8px] text-zinc-600 mb-0.5">{f}</div>
                        <input type="number" value={src.position[f]}
                          onChange={(e) => setPos(src.id, f, Number(e.target.value))}
                          className="w-full font-mono text-[10px] px-1 py-0.5" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-zinc-600 uppercase tracking-wider">Z-index</span>
                  <span className="font-mono text-[10px] text-zinc-400 w-4 text-center">{src.zIndex}</span>
                  <button onClick={() => moveZ(src.id,  1)} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300">↑</button>
                  <button onClick={() => moveZ(src.id, -1)} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300">↓</button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {showCatalog ? (
        <div className="border border-zinc-700 rounded bg-zinc-900 p-2 mt-1">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Choose source type</span>
            <button onClick={() => setShowCatalog(false)} className="text-zinc-600 hover:text-zinc-300 text-xs">✕</button>
          </div>
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {SOURCE_CATALOG.map((entry) => (
              <button key={entry.type} onClick={() => addSource(entry)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors hover:bg-zinc-700/60 border border-transparent hover:border-zinc-600/50">
                <span className="text-base">{entry.icon}</span>
                <div className="min-w-0">
                  <div className="text-[11px] text-zinc-200 font-medium">{entry.label}</div>
                  <div className="text-[9px] text-zinc-500 truncate">{entry.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button onClick={() => setShowCatalog(true)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60 border border-dashed border-zinc-800 hover:border-zinc-600 transition-colors mt-1">
          <span>+</span><span>Add Source</span>
        </button>
      )}
    </div>
  )
}

const BG_TYPES: { id: BackgroundType; label: string }[] = [
  { id: 'none',      label: 'None'     },
  { id: 'gradient',  label: 'Gradient' },
  { id: 'image-url', label: 'Image'    },
  { id: 'video-url', label: 'Video'    },
  { id: 'pattern',   label: 'Pattern'  },
]

const SCREENSAVER_PRESETS: { id: DesktopConfig['screenSaver']['preset']; label: string }[] = [
  { id: 'starfield',      label: 'Starfield'      },
  { id: 'flying-windows', label: 'Flying Windows' },
  { id: 'marquee',        label: 'Marquee Text'   },
  { id: 'pipes',          label: 'Pipes 3D'       },
  { id: 'gallery-scroll', label: 'Game Gallery'   },
  { id: 'blank',          label: 'Black Screen'   },
]

const DESKTOP_THEMES: { id: DesktopConfig['theme']; label: string }[] = [
  { id: 'win98', label: 'Win98' },
  { id: 'frutiger aero', label: 'Frutiger Aero' },
  { id: 'y2k candy', label: 'Y2K Candy' },
  { id: 'midnight chrome', label: 'Midnight Chrome' },
  { id: 'sunset boulevard', label: 'Sunset Boulevard' },
  { id: 'coastal glass', label: 'Coastal Glass' },
  { id: 'amber terminal', label: 'Amber Terminal' },
  { id: 'custom', label: 'Custom' },
]

const ICON_ANIMATIONS: { id: DesktopConfig['iconAnimation']; label: string }[] = [
  { id: 'none', label: 'Static' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'float', label: 'Float' },
  { id: 'jiggle', label: 'Jiggle' },
  { id: 'drift', label: 'Drift' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'breathe', label: 'Breathe' },
  { id: 'reactive', label: 'Reactive' },
]

const DESKTOP_ICON_SIZES: DesktopConfig['defaultIconSize'][] = ['small', 'normal', 'large']

function iconSizeToSliderValue(size: DesktopConfig['defaultIconSize']) {
  return DESKTOP_ICON_SIZES.indexOf(size)
}

function sliderValueToIconSize(value: number): DesktopConfig['defaultIconSize'] {
  return DESKTOP_ICON_SIZES[Math.max(0, Math.min(DESKTOP_ICON_SIZES.length - 1, Math.round(value)))]
}

function labelizeIconSize(size: DesktopConfig['defaultIconSize']) {
  return size.charAt(0).toUpperCase() + size.slice(1)
}

// ── Events def ─────────────────────────────────────────────────────

type AutoTrigger = { enabled: boolean; mode: 'interval' | 'idle'; intervalMin: number; idleMin: number }
type EventDef    = { id: string; label: string; icon: string; color: string; desc: string; builtIn?: boolean; effects: EffectConfig[]; auto: AutoTrigger; type?: 'overlay' | 'widget-automation'; widgetAutomation?: { availableWidgets?: string[]; toggleChance?: number; openBias?: number } }

const DEFAULT_EVENT_DEFS: EventDef[] = []
// ── Selected item union ────────────────────────────────────────────

type SelectedItem =
  | { kind: 'env';   envState: STATE }
  | { kind: 'scene'; sceneState: string }
  | { kind: 'app';   appId: string }
  | { kind: 'event'; id: string }
  | { kind: 'audio' }
  | { kind: 'keybinds' }
  | { kind: 'archive' }
  | { kind: 'settings' }
  | { kind: 'ambiance' }

function itemKey(item: SelectedItem): string {
  if (item.kind === 'env')   return 'env-' + item.envState
  if (item.kind === 'scene') return 'scene-' + item.sceneState
  if (item.kind === 'app')   return 'app-' + item.appId
  if (item.kind === 'event') return 'event-' + item.id
  if (item.kind === 'ambiance') return 'ambiance'
  return item.kind
}

// ── StyleEditor ────────────────────────────────────────────────────

function StyleEditor({ sceneId }: { sceneId: string }) {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const sourceStyle = structuredClone(withOverlayStyleDefaults((config.scenes[sceneId] as { style?: OverlayStyle } | undefined)?.style, config.overlayStyle))
  const [style, setStyle] = useState<OverlayStyle>(() => sourceStyle)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = !isSameDraft(style, sourceStyle)

  useEffect(() => {
    setStyle(sourceStyle)
    setSaved(false)
  }, [config.scenes, config.overlayStyle, sceneId])

  const update = useCallback((updater: (d: OverlayStyle) => void) => {
    setStyle((prev) => {
      const next = structuredClone(prev)
      updater(next)
      return next
    })
    setSaved(false)
  }, [])

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    const scene = config.scenes[sceneId]
    await saveConfig({ scenes: { ...config.scenes, [sceneId]: { ...scene, style } } })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [dirty, saveConfig, config.scenes, sceneId, style])

  const reset = useCallback(() => {
    setStyle(sourceStyle)
    setSaved(false)
  }, [sourceStyle])

  const bg = style.background
  const fx = style.effects
  const pt = style.particles

  return (
    <div className="space-y-4">
      <ConfigApplyBar label="Scene Style" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} />

      <Panel title="Background">
        <div className="space-y-3">
          <select value={bg.type} onChange={(e) => update((d) => { d.background.type = e.target.value as BackgroundType })}
            className="w-full text-xs">
            {BG_TYPES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>

          {sceneId === STATE.DESKTOP && (
            <div className="text-[10px] text-zinc-500 leading-relaxed">
              Desktop themes only style windows, menus, taskbars, and widgets. Leave Background on None to keep the overlay transparent; choose a background here only when you intentionally want wallpaper behind the desktop.
            </div>
          )}

          {sceneId === STATE.LOBBY && (
            <div className="text-[10px] text-zinc-500 leading-relaxed">
              In the lobby, gradient backgrounds tint the sky dome. Image, video, and pattern backgrounds stay behind the 3D scene and will not replace the sky.
            </div>
          )}

          {bg.type === 'gradient' && <div>
            <div className="grid grid-cols-3 gap-1 mb-2">
              {GRADIENT_PRESETS.map((g) => (
                <button key={g.name} onClick={() => update((d) => { d.background.gradient = g.value })}
                  className={'h-10 rounded text-[10px] transition-all ' + (bg.gradient === g.value ? 'ring-2 ring-cyan-400' : 'hover:ring-1 hover:ring-zinc-400')}
                  style={{ background: g.value }}>
                  <span className="text-white drop-shadow">{g.name}</span>
                </button>
              ))}
            </div>
            <input type="text" value={bg.gradient}
              onChange={(e) => update((d) => { d.background.gradient = e.target.value })}
              placeholder="linear-gradient(…)" className="w-full text-xs" />
          </div>}

          {bg.type === 'image-url' && (
            <AssetSelectionInput
              value={bg.imageUrl}
              onChange={(nextValue) => update((d) => { d.background.imageUrl = nextValue })}
              kinds={['image']}
              modalTitle="Background Image"
              placeholder="/assets/backgrounds/name.jpg or https://..."
              buttonLabel="Choose Image"
              hint="Pick from the unified asset library, game-image catalog, or paste any direct image URL."
              previewKind="image"
            />
          )}

          {bg.type === 'video-url' && (
            <AssetSelectionInput
              value={bg.videoUrl}
              onChange={(nextValue) => update((d) => { d.background.videoUrl = nextValue })}
              kinds={['video']}
              modalTitle="Background Video"
              placeholder="/assets/video/name.mp4 or https://..."
              buttonLabel="Choose Video"
              hint="Use the asset library for local loops or paste any direct MP4/WebM URL."
              previewKind="video"
            />
          )}

          {bg.type === 'pattern' && <div className="grid grid-cols-3 gap-1">
            {(Object.keys(PATTERN_CSS) as PatternPreset[]).map((pat) => (
              <button key={pat} onClick={() => update((d) => { d.background.pattern = pat })}
                className={'h-12 rounded capitalize text-[10px] transition-all flex items-center justify-center ' + (bg.pattern === pat ? 'ring-2 ring-cyan-400' : 'hover:ring-1 hover:ring-zinc-400')}
                style={pat === 'none' ? { backgroundColor: '#111' } : PATTERN_CSS[pat]}>
                <span className="text-white drop-shadow bg-black/40 px-1 rounded">{pat}</span>
              </button>
            ))}
          </div>}

          {bg.type !== 'none' && <div className="space-y-1 pt-2 border-t border-zinc-700">
            <Slider label="Opacity" value={bg.opacity} onChange={(v) => update((d) => { d.background.opacity = v })} />
            <Slider label="Blur" value={bg.blur} min={0} max={20} step={0.5} unit="px" onChange={(v) => update((d) => { d.background.blur = v })} />
          </div>}
        </div>
      </Panel>

      <Panel title="Effects">
        <div className="space-y-2">
          <div>
            <Toggle checked={fx.crt} onChange={(v) => update((d) => { d.effects.crt = v })} label="CRT Scanlines" />
            {fx.crt && <div className="mt-1 pl-11"><Slider label="Intensity" value={fx.scanlineOpacity} onChange={(v) => update((d) => { d.effects.scanlineOpacity = v })} /></div>}
          </div>
          <div>
            <Toggle checked={fx.noise} onChange={(v) => update((d) => { d.effects.noise = v })} label="Film Grain" />
            {fx.noise && <div className="mt-1 pl-11"><Slider label="Grain" value={fx.noiseOpacity} onChange={(v) => update((d) => { d.effects.noiseOpacity = v })} /></div>}
          </div>
          <div>
            <Toggle checked={fx.vignette} onChange={(v) => update((d) => { d.effects.vignette = v })} label="Vignette" />
            {fx.vignette && <div className="mt-1 pl-11"><Slider label="Strength" value={fx.vignetteStrength} onChange={(v) => update((d) => { d.effects.vignetteStrength = v })} /></div>}
          </div>
          <Toggle checked={fx.flicker} onChange={(v) => update((d) => { d.effects.flicker = v })} label="Screen Flicker" />
          <Toggle checked={fx.chromatic} onChange={(v) => update((d) => { d.effects.chromatic = v })} label="Chromatic Aberration" />
        </div>
      </Panel>

      <Panel title="Particles">
        <div className="space-y-3">
          <select value={pt.preset}
            onChange={(e) => update((d) => { d.particles.preset = e.target.value as ParticlePreset; d.particles.enabled = e.target.value !== 'none' })}
            className="w-full text-xs">
            {PARTICLE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
          </select>
          {pt.enabled && pt.preset !== 'none' && <div className="space-y-1">
            <Slider label="Density" value={pt.density} onChange={(v) => update((d) => { d.particles.density = v })} />
            <Slider label="Speed"   value={pt.speed}   onChange={(v) => update((d) => { d.particles.speed   = v })} />
          </div>}
        </div>
      </Panel>
    </div>
  )
}

// ── TransitionList ────────────────────────────────────────────────
// Converts between the TransitionPicker string encoding and TransitionStep.
function stepToStr(step: TransitionStep): string {
  if (step.id.startsWith('media:')) return step.id
  return step.duration ? `${step.id}?duration=${step.duration}` : step.id
}
function strToStep(s: string): TransitionStep {
  if (!s || s.startsWith('media:')) return { id: s }
  const qi  = s.indexOf('?')
  const id  = qi >= 0 ? s.slice(0, qi) : s
  const dur = qi >= 0 ? new URLSearchParams(s.slice(qi + 1)).get('duration') : null
  return { id, ...(dur ? { duration: parseFloat(dur) } : {}) }
}

/** Ordered pipeline editor — each step is a full TransitionPicker row. */
function TransitionList({
  value,
  onChange,
}: {
  value: TransitionStep[]
  onChange: (steps: TransitionStep[]) => void
}) {
  const steps = value ?? []

  const updateStep = (idx: number, str: string) => {
    const next = [...steps]
    next[idx] = strToStep(str)
    onChange(next.filter((s) => s.id))
  }

  const removeStep = (idx: number) => onChange(steps.filter((_, i) => i !== idx))

  const moveUp = (idx: number) => {
    if (idx === 0) return
    const next = [...steps];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange(next)
  }

  const moveDown = (idx: number) => {
    if (idx === steps.length - 1) return
    const next = [...steps];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onChange(next)
  }

  return (
    <div className="space-y-1">
      {steps.map((step, idx) => (
        <div key={idx} className="flex gap-1 items-start">
          <div className="flex-1 min-w-0">
            <TransitionPicker
              value={stepToStr(step)}
              onChange={(str) => updateStep(idx, str)}
              placeholder="— Pick transition —"
            />
          </div>
          <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
            <button
              onClick={() => moveUp(idx)} disabled={idx === 0}
              className="px-1.5 text-[9px] text-zinc-500 hover:text-zinc-200 disabled:opacity-20 leading-none">▲</button>
            <button
              onClick={() => moveDown(idx)} disabled={idx === steps.length - 1}
              className="px-1.5 text-[9px] text-zinc-500 hover:text-zinc-200 disabled:opacity-20 leading-none">▼</button>
          </div>
          <button
            onClick={() => removeStep(idx)}
            className="px-1.5 shrink-0 text-xs text-zinc-500 hover:text-red-400 transition-colors pt-0.5">✕</button>
        </div>
      ))}
      <button
        onClick={() => onChange([...steps, { id: '' }])}
        className="w-full text-[11px] text-zinc-500 hover:text-cyan-300 border border-dashed border-zinc-700 hover:border-cyan-500/40 rounded py-1 mt-1 transition-colors">
        + Add step
      </button>
    </div>
  )
}

// ── LobbyConfigEditor ──────────────────────────────────────────────

function LobbyConfigEditor() {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const lobbyScene = config.scenes[STATE.LOBBY] as { lobbyConfig?: LobbyConfig; introTransitions?: TransitionStep[]; exitTransitions?: TransitionStep[] } | undefined
  const sourceForm = withLobbyConfigDefaults(lobbyScene?.lobbyConfig)
  const sourceIntroTransitions = structuredClone(lobbyScene?.introTransitions)
  const sourceExitTransitions = structuredClone(lobbyScene?.exitTransitions)
  const [form, setForm] = useState<LobbyConfig>(() => sourceForm)
  const [introTransitions, setIntroTransitions] = useState<TransitionStep[]>(sourceIntroTransitions || [])
  const [exitTransitions, setExitTransitions] = useState<TransitionStep[]>(sourceExitTransitions || [])
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = !isSameDraft(form, sourceForm)
    || !isSameDraft(introTransitions, sourceIntroTransitions)
    || !isSameDraft(exitTransitions, sourceExitTransitions)

  useEffect(() => {
    setForm(sourceForm)
    setIntroTransitions(sourceIntroTransitions || [])
    setExitTransitions(sourceExitTransitions || [])
    setSaved(false)
  }, [config.scenes])

  const update = useCallback((updater: (d: LobbyConfig) => void) => {
    setForm((prev) => {
      const next = structuredClone(prev)
      updater(next)
      return next
    })
    setSaved(false)
  }, [])

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    await saveConfig({
      scenes: {
        ...config.scenes,
        [STATE.LOBBY]: {
          ...config.scenes[STATE.LOBBY],
          lobbyConfig: form,
          introTransitions: introTransitions.length ? introTransitions : undefined,
          exitTransitions: exitTransitions.length ? exitTransitions : undefined,
        },
      },
    })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [dirty, saveConfig, config.scenes, form, introTransitions, exitTransitions])

  const reset = useCallback(() => {
    setForm(sourceForm)
    setIntroTransitions(sourceIntroTransitions || [])
    setExitTransitions(sourceExitTransitions || [])
    setSaved(false)
  }, [sourceForm, sourceIntroTransitions, sourceExitTransitions])

  return (
    <div className="space-y-3">
      <ConfigApplyBar label="Lobby Configuration" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} />
      <Panel title="Transitions">
        <div className="space-y-3">
          {([
            { field: 'introTransitions' as const, label: 'Intro (entering)' },
            { field: 'exitTransitions' as const, label: 'Exit (leaving)' },
          ]).map(({ field, label }) => (
            <div key={field}>
              <div className="text-[10px] text-zinc-500 mb-1">{label}</div>
              <TransitionList
                value={field === 'introTransitions' ? introTransitions : exitTransitions}
                onChange={(steps) => {
                  if (field === 'introTransitions') setIntroTransitions(steps)
                  else setExitTransitions(steps)
                  setSaved(false)
                }}
              />
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Ambient Light">
        <LabeledHexColorRow label="" value={form.ambientColor} onChange={(v) => update((d) => { d.ambientColor = v })} />
        <Slider label="Intensity" value={form.ambientIntensity} min={0} max={2} step={0.01} onChange={(v) => update((d) => { d.ambientIntensity = v })} />
      </Panel>
      <Panel title="Fog">
        <LabeledHexColorRow label="" value={form.fogColor} onChange={(v) => update((d) => { d.fogColor = v })} />
        <Slider label="Near" value={form.fogNear} min={1} max={20} step={0.5} onChange={(v) => update((d) => { d.fogNear = v })} />
        <Slider label="Far"  value={form.fogFar}  min={5} max={60} step={1}   onChange={(v) => update((d) => { d.fogFar  = v })} />
      </Panel>
      <Panel title="World">
        <LabeledHexColorRow label="Sky Top" value={form.skyTopColor} onChange={(v) => update((d) => { d.skyTopColor = v })} />
        <LabeledHexColorRow label="Horizon" value={form.skyHorizonColor} onChange={(v) => update((d) => { d.skyHorizonColor = v })} />
        <LabeledHexColorRow label="Floor" value={form.floorColor} onChange={(v) => update((d) => { d.floorColor = v })} />
        <Slider label="Reflectivity" value={form.floorReflectivity} min={0} max={1} step={0.05} onChange={(v) => update((d) => { d.floorReflectivity = v })} />
      </Panel>
      <Panel title="CRT Glow">
        <LabeledHexColorRow label="" value={form.crtGlowColor} onChange={(v) => update((d) => { d.crtGlowColor = v })} />
      </Panel>
      <Panel title="Atmosphere">
        <Toggle checked={form.dustMotes} onChange={(v) => update((d) => { d.dustMotes = v })} label="Dust motes" />
        <div className="mt-2 space-y-1">
          <Slider label="Camera FOV" value={form.cameraFov} min={30} max={120} step={1} onChange={(v) => update((d) => { d.cameraFov = v })} />
          <Slider label="Stars"      value={form.starsCount} min={0} max={2000} step={50} onChange={(v) => update((d) => { d.starsCount = v })} />
        </div>
      </Panel>
      <Panel title="Room Life">
        <div className="space-y-3">
          <div>
            <Toggle checked={form.virtualPet.enabled} onChange={(v) => update((d) => { d.virtualPet.enabled = v })} label="Virtual pet" />
            {form.virtualPet.enabled && (
              <div className="mt-2 space-y-1">
                <LabeledHexColorRow label="Body" value={form.virtualPet.color} onChange={(v) => update((d) => { d.virtualPet.color = v })} />
                <LabeledHexColorRow label="Charm" value={form.virtualPet.accessoryColor} onChange={(v) => update((d) => { d.virtualPet.accessoryColor = v })} />
              </div>
            )}
          </div>
          <div>
            <Toggle checked={form.lavaLamp.enabled} onChange={(v) => update((d) => { d.lavaLamp.enabled = v })} label="Lava lamp" />
            {form.lavaLamp.enabled && (
              <div className="mt-2 space-y-1">
                <LabeledHexColorRow label="Glass" value={form.lavaLamp.glassColor} onChange={(v) => update((d) => { d.lavaLamp.glassColor = v })} />
                <LabeledHexColorRow label="Wax" value={form.lavaLamp.liquidColor} onChange={(v) => update((d) => { d.lavaLamp.liquidColor = v })} />
                <LabeledHexColorRow label="Glow" value={form.lavaLamp.glowColor} onChange={(v) => update((d) => { d.lavaLamp.glowColor = v })} />
              </div>
            )}
          </div>
          <div>
            <Toggle checked={form.fishTank.enabled} onChange={(v) => update((d) => { d.fishTank.enabled = v })} label="Fish tank" />
            {form.fishTank.enabled && (
              <div className="mt-2 space-y-1">
                <LabeledHexColorRow label="Glass" value={form.fishTank.glassColor} onChange={(v) => update((d) => { d.fishTank.glassColor = v })} />
                <LabeledHexColorRow label="Water" value={form.fishTank.waterColor} onChange={(v) => update((d) => { d.fishTank.waterColor = v })} />
                <LabeledHexColorRow label="Fish" value={form.fishTank.fishColor} onChange={(v) => update((d) => { d.fishTank.fishColor = v })} />
                <Slider label="Count" value={form.fishTank.fishCount} min={1} max={8} step={1} onChange={(v) => update((d) => { d.fishTank.fishCount = v })} />
              </div>
            )}
          </div>
        </div>
      </Panel>
    </div>
  )
}

// ── DesktopConfigEditor ────────────────────────────────────────────

function DesktopConfigEditor() {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const desktopScene = config.scenes[STATE.DESKTOP]
  const sourceForm = withDesktopConfigDefaults(config.desktopConfig)
  const sourceStyle = structuredClone(withOverlayStyleDefaults((desktopScene as { style?: OverlayStyle } | undefined)?.style, config.overlayStyle))
  const sourceAppearance: ThemeAppearance = {
    fontFamily: sourceStyle.fontFamily,
    accentColor: sourceStyle.accentColor,
    textColor: sourceStyle.textColor,
  }
  const sourceIntroTransitions = structuredClone(desktopScene?.introTransitions)
  const sourceExitTransitions = structuredClone(desktopScene?.exitTransitions)
  const [form, setForm] = useState<DesktopConfig>(() => sourceForm)
  const [appearance, setAppearance] = useState<ThemeAppearance>(() => sourceAppearance)
  const [introTransitions, setIntroTransitions] = useState<TransitionStep[]>(sourceIntroTransitions || [])
  const [exitTransitions, setExitTransitions] = useState<TransitionStep[]>(sourceExitTransitions || [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notifyTitle, setNotifyTitle] = useState('New follower')
  const [notifyBody, setNotifyBody] = useState('streamfan42 just joined the feed')
  const [notifyIcon, setNotifyIcon] = useState('🎉')
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = !isSameDraft(form, sourceForm)
    || !isSameDraft(appearance, sourceAppearance)
    || !isSameDraft(introTransitions, sourceIntroTransitions)
    || !isSameDraft(exitTransitions, sourceExitTransitions)

  useEffect(() => {
    setForm(sourceForm)
    setAppearance(sourceAppearance)
    setIntroTransitions(sourceIntroTransitions || [])
    setExitTransitions(sourceExitTransitions || [])
    setSaved(false)
  }, [config.desktopConfig, config.scenes])

  const update = useCallback((updater: (d: DesktopConfig) => void) => {
    setForm((prev) => {
      const next = structuredClone(prev)
      updater(next)
      return next
    })
    setSaved(false)
  }, [])

  const updateAppearance = useCallback((updater: (d: ThemeAppearance) => void) => {
    setAppearance((prev) => {
      const next = structuredClone(prev)
      updater(next)
      return next
    })
    setSaved(false)
  }, [])

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    const nextDesktopStyle = structuredClone(sourceStyle)
    nextDesktopStyle.fontFamily = appearance.fontFamily
    nextDesktopStyle.accentColor = appearance.accentColor
    nextDesktopStyle.textColor = appearance.textColor
    await saveConfig({
      desktopConfig: form,
      scenes: {
        ...config.scenes,
        [STATE.DESKTOP]: {
          ...config.scenes[STATE.DESKTOP],
          style: nextDesktopStyle,
          introTransitions: introTransitions.length ? introTransitions : undefined,
          exitTransitions: exitTransitions.length ? exitTransitions : undefined,
        },
      },
    })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [dirty, saveConfig, sourceStyle, appearance, config.scenes, form, introTransitions, exitTransitions])

  const reset = useCallback(() => {
    setForm(sourceForm)
    setAppearance(sourceAppearance)
    setIntroTransitions(sourceIntroTransitions || [])
    setExitTransitions(sourceExitTransitions || [])
    setSaved(false)
  }, [sourceForm, sourceAppearance, sourceIntroTransitions, sourceExitTransitions])

  return (
    <div className="space-y-3">
      <ConfigApplyBar label="Desktop Configuration" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} />
      <Panel title="Transitions">
        <div className="space-y-3">
          {([
            { field: 'introTransitions' as const, label: 'Intro (entering)' },
            { field: 'exitTransitions'  as const, label: 'Exit (leaving)' },
          ]).map(({ field, label }) => (
            <div key={field}>
              <div className="text-[10px] text-zinc-500 mb-1">{label}</div>
              <TransitionList
                value={field === 'introTransitions' ? introTransitions : exitTransitions}
                onChange={(steps) => {
                  if (field === 'introTransitions') setIntroTransitions(steps)
                  else setExitTransitions(steps)
                  setSaved(false)
                }}
              />
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Theme">
        <div className="space-y-4">
          <div className="text-[10px] text-zinc-500 leading-relaxed">
            Theme presets style desktop chrome only. The overlay stays transparent until the desktop Background panel is explicitly set to show wallpaper, gradients, patterns, or video.
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {DESKTOP_THEMES.map((theme) => (
              <button key={theme.id} onClick={() => update((d) => { d.theme = theme.id })}
                className={'px-2.5 py-1.5 text-[11px] rounded border transition-colors ' +
                  (form.theme === theme.id ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-300' : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:text-zinc-100')}>
                {theme.label}
              </button>
            ))}
          </div>
          <div className="border-t border-zinc-800 pt-3">
            <ThemeAppearanceFields
              appearance={appearance}
              onChange={updateAppearance}
              helperText="Font, accent, and text color ride on top of the preset so they are visible without turning the desktop background opaque."
            />
          </div>
          <div className="border-t border-zinc-800 pt-3 space-y-3">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Icons</div>
              <div className="text-[10px] text-zinc-500 leading-relaxed">
                Turn off auto-arrange to drag icons directly on the desktop. Manual dragging saves each application icon position for you.
              </div>
            </div>
            <Slider
              label="Size"
              value={iconSizeToSliderValue(form.defaultIconSize)}
              min={0}
              max={2}
              step={1}
              onChange={(value) => update((d) => { d.defaultIconSize = sliderValueToIconSize(value) })}
            />
            <div className="text-[10px] text-zinc-500 -mt-1 pl-[7rem]">Current default: {labelizeIconSize(form.defaultIconSize)}</div>
            <Toggle checked={form.autoArrangeIcons} onChange={(v) => update((d) => { d.autoArrangeIcons = v })} label="Auto-arrange icons" />
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Ambient motion</div>
              <select
                value={form.iconAnimation}
                onChange={(e) => update((d) => { d.iconAnimation = e.target.value as DesktopConfig['iconAnimation'] })}
                className="w-full text-xs"
              >
                {ICON_ANIMATIONS.map((mode) => (
                  <option key={mode.id} value={mode.id}>{mode.label}</option>
                ))}
              </select>
            </div>
            <Slider
              label="Motion"
              value={Math.round(form.iconMotion * 100)}
              min={0}
              max={300}
              step={5}
              unit="%"
              onChange={(value) => update((d) => { d.iconMotion = value / 100 })}
            />
          </div>
        </div>
      </Panel>
      <Panel title="Sticky Notes">
        <div className="text-[10px] text-zinc-500 mb-1">Default note text</div>
        <textarea value={form.stickyNotes.text}
          onChange={(e) => update((d) => { d.stickyNotes.text = e.target.value })}
          className="w-full min-h-[110px] text-xs font-mono" />
        <div className="mt-3 text-[10px] text-zinc-500 mb-1">Note color</div>
        <HexColorInput
          value={form.stickyNotes.color}
          onChange={(nextValue) => update((d) => { d.stickyNotes.color = nextValue })}
          className="max-w-sm gap-2"
          pickerClassName="w-20 h-9 p-1 shrink-0"
          textClassName="font-mono text-xs flex-1 min-w-0"
        />
      </Panel>
      <Panel title="Recycle Bin">
        <Toggle checked={form.recycleBin.fullOnStart} onChange={(v) => update((d) => { d.recycleBin.fullOnStart = v })} label="Starts full" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Empty icon</div>
            <AssetSelectionInput
              value={form.recycleBin.emptyIcon}
              onChange={(nextValue) => update((d) => { d.recycleBin.emptyIcon = nextValue })}
              kinds={['image']}
              modalTitle="Recycle Bin Empty Icon"
              placeholder="Emoji or /assets/icons/recycle-empty.png"
              buttonLabel="Choose Image"
              previewKind="image"
            />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Full icon</div>
            <AssetSelectionInput
              value={form.recycleBin.fullIcon}
              onChange={(nextValue) => update((d) => { d.recycleBin.fullIcon = nextValue })}
              kinds={['image']}
              modalTitle="Recycle Bin Full Icon"
              placeholder="Emoji or /assets/icons/recycle-full.png"
              buttonLabel="Choose Image"
              previewKind="image"
            />
          </div>
        </div>
      </Panel>
      <Panel title="Screen Saver">
        <Toggle checked={form.screenSaver.enabled} onChange={(v) => update((d) => { d.screenSaver.enabled = v })} label="Enable" />
        {form.screenSaver.enabled && <>
          <div className="mt-2 mb-2">
            <div className="text-[10px] text-zinc-500 mb-1">Idle timeout (min)</div>
            <input type="number" min={1} max={60} value={form.screenSaver.timeoutMinutes}
              onChange={(e) => update((d) => { d.screenSaver.timeoutMinutes = Number(e.target.value) })}
              className="w-20 font-mono text-xs" />
          </div>
          {SCREENSAVER_PRESETS.map((p) => (
            <button key={p.id} onClick={() => update((d) => { d.screenSaver.preset = p.id })}
              className={'w-full text-left px-2.5 py-1.5 rounded text-[11px] border transition-colors mb-0.5 ' +
                (form.screenSaver.preset === p.id ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-300' : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800')}>
              {p.label}
            </button>
          ))}
        </>}
      </Panel>
      <Panel title="System Sounds">
        <div className="text-[10px] text-zinc-500 mb-2">Relative to <span className="font-mono text-zinc-400">assets/sfx/system/</span></div>
        {(['startup', 'error', 'notify', 'click', 'close'] as const).map((key) => (
          <div key={key} className="flex items-center gap-2 mb-1.5">
            <label className="text-[11px] text-zinc-400 w-12 shrink-0 capitalize">{key}</label>
            <input type="text" value={form.systemSounds[key]}
              onChange={(e) => update((d) => { d.systemSounds[key] = e.target.value })}
              placeholder={key + '.wav'} className="flex-1 font-mono text-[11px]" />
          </div>
        ))}
      </Panel>
      <Panel title="Socket Tests">
        <div className="space-y-2">
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Title</div>
            <input type="text" value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} className="w-full text-xs" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Body</div>
            <textarea value={notifyBody} onChange={(e) => setNotifyBody(e.target.value)} className="w-full min-h-[70px] text-xs" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Icon</div>
            <input type="text" value={notifyIcon} onChange={(e) => setNotifyIcon(e.target.value)} className="w-20 text-xs font-mono" />
          </div>
          <div className="text-[10px] text-zinc-600">Desktop notifications are runtime events, not desktop-config settings.</div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Btn variant="primary" onClick={() => socket.emit('desktop:notify', { title: notifyTitle, body: notifyBody, icon: notifyIcon })}>
              Send Notification
            </Btn>
            <Btn onClick={() => socket.emit('desktop:recycle-bin', { full: true })}>Bin Full</Btn>
            <Btn onClick={() => socket.emit('desktop:recycle-bin', { full: false })}>Bin Empty</Btn>
          </div>
        </div>
      </Panel>
    </div>
  )
}

// ── AppForm ────────────────────────────────────────────────────────

function AppForm({ app, onDelete }: { app: Application; onDelete: () => void }) {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const desktopConfig = withDesktopConfigDefaults(config.desktopConfig)
  const initialWidgetSize = resolveWidgetSizeFromConfig(app.id, desktopConfig)
  const [form, setForm] = useState<Application>(app)
  const [widgetSize, setWidgetSize] = useState(initialWidgetSize)
  const [widgetZIndex, setWidgetZIndex] = useState<number | undefined>(
    () => resolveWidgetZIndexFromConfig(app.id, desktopConfig),
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [detectedCameras, setDetectedCameras] = useState<{ deviceId: string; label: string }[]>([])
  const [detectingCameras, setDetectingCameras] = useState(false)
  const [cameraLabelsGranted, setCameraLabelsGranted] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const enumerateCameras = useCallback(async (requestPermission = false) => {
    setDetectingCameras(true)
    try {
      if (requestPermission) {
        const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        probe.getTracks().forEach((t) => t.stop())
        setCameraLabelsGranted(true)
      }
      const all = await navigator.mediaDevices.enumerateDevices()
      const cams = all
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Cámara ${i + 1}` }))
      setDetectedCameras(cams)
      if (cams.some((c) => !c.label.startsWith('Cámara '))) setCameraLabelsGranted(true)
    } catch {
      // permission denied or unavailable — keep whatever we have
    } finally {
      setDetectingCameras(false)
    }
  }, [])

  // Auto-enumerate video devices when this is a camera widget
  useEffect(() => {
    if (app.appType !== 'widget' || !isCameraWidgetId(app.id)) return
    void enumerateCameras(false)
  }, [app.id, app.appType, enumerateCameras])
  const appDirty = !isSameDraft(form, app)
  const sourceWidgetSize = resolveWidgetSizeFromConfig(app.id, desktopConfig)
  const sourceWidgetZIndex = resolveWidgetZIndexFromConfig(app.id, desktopConfig)
  const widgetSizeDirty = form.appType === 'widget' && (
    widgetSize.width !== sourceWidgetSize.width
    || widgetSize.height !== sourceWidgetSize.height
  )
  const widgetZIndexDirty = form.appType === 'widget' && widgetZIndex !== sourceWidgetZIndex
  const dirty = appDirty || widgetSizeDirty || widgetZIndexDirty

  useEffect(() => {
    setForm(app)
    setWidgetSize(resolveWidgetSizeFromConfig(app.id, withDesktopConfigDefaults(config.desktopConfig)))
    setWidgetZIndex(resolveWidgetZIndexFromConfig(app.id, withDesktopConfigDefaults(config.desktopConfig)))
    setSaved(false)
  }, [app, config.desktopConfig])

  const update = (updater: (d: Application) => void) => {
    const next = { ...form }
    updater(next)
    setForm(next)
    setSaved(false)
  }

  const apply = async () => {
    if (!dirty) return
    setSaving(true)
    const apps = [...config.applications]
    const idx  = apps.findIndex((entry) => entry.id === form.id)
    if (idx !== -1) apps[idx] = form
    else apps.push(form)

    const scene = config.scenes[form.targetSceneId]
    const updates: Partial<typeof config> = { applications: apps }
    if (scene) {
      const updatedScene = { ...scene, label: form.label }
      updates.scenes = { ...config.scenes, [form.targetSceneId]: updatedScene }
    }

    if (form.appType === 'widget') {
      const nextDesktop = withDesktopConfigDefaults(config.desktopConfig)
      const normalizedWidth = clampWidgetDimension(widgetSize.width, 180, 1400, sourceWidgetSize.width)
      const normalizedHeight = clampWidgetDimension(widgetSize.height, 140, 1000, sourceWidgetSize.height)
      const defaults = getDefaultWidgetSize(form.id)
      const nextWidgetSizes = { ...(nextDesktop.widgetSizes ?? {}) }
      const nextWidgetZIndices = { ...(nextDesktop.widgetZIndices ?? {}) }

      if (normalizedWidth === defaults.width && normalizedHeight === defaults.height) {
        delete nextWidgetSizes[form.id]
      } else {
        nextWidgetSizes[form.id] = { width: normalizedWidth, height: normalizedHeight }
      }

      if (widgetZIndex === undefined) {
        delete nextWidgetZIndices[form.id]
      } else {
        nextWidgetZIndices[form.id] = Math.max(0, Math.round(widgetZIndex))
      }

      updates.desktopConfig = {
        ...nextDesktop,
        widgetSizes: Object.keys(nextWidgetSizes).length ? nextWidgetSizes : undefined,
        widgetZIndices: Object.keys(nextWidgetZIndices).length ? nextWidgetZIndices : undefined,
      }
    }

    await saveConfig(updates)

    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }

  const reset = () => {
    setForm(app)
    setWidgetSize(resolveWidgetSizeFromConfig(app.id, withDesktopConfigDefaults(config.desktopConfig)))
    setWidgetZIndex(resolveWidgetZIndexFromConfig(app.id, withDesktopConfigDefaults(config.desktopConfig)))
    setSaved(false)
  }

  const defaultWidgetSize = getDefaultWidgetSize(form.id)
  const hasWidgetSizeOverride = !!desktopConfig.widgetSizes?.[form.id]

  return (
    <div className="space-y-3">
      <ConfigApplyBar label="Application Configuration" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} />
      <Panel title="Identity">
        <div className="space-y-2">
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">ID <span className="text-zinc-600">(read-only — used by widget registry)</span></div>
            <input type="text" value={form.id} readOnly className="w-full text-xs font-mono text-zinc-500 cursor-default select-all" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Label</div>
            <input type="text" value={form.label} onChange={(e) => update((d) => { d.label = e.target.value })} className="w-full text-xs" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Icon</div>
            <div className="flex gap-2 items-center">
              <div className="w-11 h-11 flex items-center justify-center bg-zinc-800 rounded border border-zinc-700 overflow-hidden shrink-0">
                <IconGlyph icon={form.icon} label={form.label} size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <AssetSelectionInput
                  value={form.icon}
                  onChange={(nextValue) => update((d) => { d.icon = nextValue })}
                  kinds={['image']}
                  modalTitle="Application Icon"
                  placeholder="Emoji or /assets/icons/custom.png"
                  buttonLabel="Choose Image"
                  hint="Leave an emoji in the field, or use the asset library to assign a custom image icon."
                  inputClassName="font-mono"
                  previewKind="image"
                />
              </div>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Size</div>
            <div className="flex gap-1">
              {(['small', 'normal', 'large'] as const).map((s) => (
                <button key={s} onClick={() => update((d) => { d.iconSize = s })}
                  className={'px-2.5 py-1 text-[11px] rounded border capitalize transition-colors ' +
                    ((form.iconSize ?? 'normal') === s ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40' : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:text-zinc-100')}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Transitions">
        <div className="space-y-3">
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Intro</div>
            <TransitionList
              value={form.introTransitions ?? []}
              onChange={(steps) => update((d) => { d.introTransitions = steps.length ? steps : undefined })}
            />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Exit</div>
            <TransitionList
              value={form.exitTransitions ?? []}
              onChange={(steps) => update((d) => { d.exitTransitions = steps.length ? steps : undefined })}
            />
          </div>
        </div>
      </Panel>

      <Panel title="Position">
        <div className="text-[10px] text-zinc-600 mb-2">1920×1080 canvas, pixels from top-left.</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">X</div>
            <input type="number" min={0} max={1850} value={form.iconPosition?.x ?? 16}
              onChange={(e) => update((d) => { d.iconPosition = { x: Number(e.target.value), y: d.iconPosition?.y ?? 16 } })}
              className="w-full font-mono text-xs" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Y</div>
            <input type="number" min={0} max={990} value={form.iconPosition?.y ?? 16}
              onChange={(e) => update((d) => { d.iconPosition = { x: d.iconPosition?.x ?? 16, y: Number(e.target.value) } })}
              className="w-full font-mono text-xs" />
          </div>
        </div>
        <div className="text-[10px] text-zinc-600 mt-1.5">Tip: X=16, Y increments of 94</div>
        <div className="text-[10px] text-zinc-600 mt-1">Desktop icons can also be dragged live when auto-arrange is off.</div>
      </Panel>

      {form.appType === 'widget' && (
        <Panel title="Widget Window Size">
          <div className="text-[10px] text-zinc-600 mb-2">Configure default window size for this widget.</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Width</div>
              <input
                type="number"
                min={180}
                max={1400}
                value={widgetSize.width}
                onChange={(e) => setWidgetSize((prev) => ({ ...prev, width: Number(e.target.value) }))}
                className="w-full font-mono text-xs"
              />
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Height</div>
              <input
                type="number"
                min={140}
                max={1000}
                value={widgetSize.height}
                onChange={(e) => setWidgetSize((prev) => ({ ...prev, height: Number(e.target.value) }))}
                className="w-full font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="text-[10px] text-zinc-600">
              Default: {defaultWidgetSize.width}x{defaultWidgetSize.height}px
              {hasWidgetSizeOverride ? ' (override active)' : ''}
            </div>
            <button
              type="button"
              onClick={() => setWidgetSize(defaultWidgetSize)}
              className="text-[10px] px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              Reset to Default
            </button>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-700/50">
            <div className="text-[10px] text-zinc-500 mb-1">
              Z-Index
              <span className="text-zinc-600 ml-1">(stacking order — higher = in front; widgets start at 60)</span>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min={0}
                max={999}
                placeholder="auto"
                value={widgetZIndex ?? ''}
                onChange={(e) => {
                  const raw = e.target.value
                  setWidgetZIndex(raw === '' ? undefined : Math.max(0, Math.min(999, Math.round(Number(raw)))))
                }}
                className="w-24 font-mono text-xs"
              />
              {widgetZIndex !== undefined && (
                <button
                  type="button"
                  onClick={() => setWidgetZIndex(undefined)}
                  className="text-[10px] px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="text-[10px] text-zinc-600 mt-1">
              Leave blank for automatic order (last focused = frontmost). Set a fixed value to pin this widget in the stack — e.g. camera PiP at 65, background widget at 61.
            </div>
          </div>
        </Panel>
      )}

      {form.appType === 'widget' && isCameraWidgetId(form.id) && (
        <Panel title="Camera Defaults">
          <div className="space-y-3">
            <div className="text-[10px] text-zinc-400">
              Configura la cámara para este widget. El widget solo muestra el video — sin controles. Abre OBS con <span className="font-mono text-zinc-300">?obs=1</span> en la URL del browser source.
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] text-zinc-500">Dispositivo de cámara</div>
                {!cameraLabelsGranted && (
                  <button
                    type="button"
                    disabled={detectingCameras}
                    onClick={() => void enumerateCameras(true)}
                    className="text-[10px] px-2 py-0.5 rounded border border-zinc-600 text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    {detectingCameras ? 'Detectando...' : '🔓 Obtener nombres reales'}
                  </button>
                )}
              </div>
              {detectingCameras && detectedCameras.length === 0 ? (
                <div className="text-[10px] text-zinc-500 italic">Detectando dispositivos...</div>
              ) : (
                <select
                  value={form.cameraSettings?.preferredDeviceLabel ?? ''}
                  onChange={(e) => update((d) => {
                    d.cameraSettings = { ...(d.cameraSettings ?? {}), preferredDeviceLabel: e.target.value }
                  })}
                  className="w-full text-xs"
                >
                  <option value="">— Sin preferencia (primer dispositivo) —</option>
                  {detectedCameras.map((cam) => (
                    <option key={cam.deviceId} value={cam.label}>{cam.label}</option>
                  ))}
                  {/* Keep saved label as option even if not in current list */}
                  {form.cameraSettings?.preferredDeviceLabel &&
                    !detectedCameras.some((c) => c.label === form.cameraSettings?.preferredDeviceLabel) && (
                    <option value={form.cameraSettings.preferredDeviceLabel}>
                      {form.cameraSettings.preferredDeviceLabel} (guardado)
                    </option>
                  )}
                </select>
              )}
              <div className="text-[10px] text-zinc-600 mt-1">
                {!cameraLabelsGranted && detectedCameras.length > 0
                  ? 'Nombres genéricos — pulsa "Obtener nombres reales" para ver los labels reales del sistema.'
                  : 'El label se guarda en el servidor. OBS lo usa para encontrar la misma cámara automáticamente.'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id={`cam-mirror-${form.id}`}
                type="checkbox"
                checked={form.cameraSettings?.mirror ?? false}
                onChange={(e) => update((d) => {
                  d.cameraSettings = {
                    ...(d.cameraSettings ?? {}),
                    mirror: e.target.checked,
                  }
                })}
              />
              <label htmlFor={`cam-mirror-${form.id}`} className="text-[11px] text-zinc-300 cursor-pointer">
                Espejo (voltear horizontalmente)
              </label>
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Launch Pipeline">
        <div className="text-[10px] text-zinc-500 mb-2">Effects fired before the scene change. Fires in order, each with its own delay.</div>
        <Toggle
          checked={!!form.launchPipeline}
          label="Enable"
          onChange={(v) => update((d) => {
            d.launchPipeline = v ? { effects: [], delayMs: 0 } : undefined
          })}
        />
        {form.launchPipeline && (
          <div className="mt-3 space-y-3">
            <Slider
              label="Scene change delay (ms)"
              value={form.launchPipeline.delayMs}
              min={0} max={5000} step={100}
              onChange={(v) => update((d) => { if (d.launchPipeline) d.launchPipeline.delayMs = v })}
            />
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Effects</div>
              {form.launchPipeline.effects.length === 0 && (
                <div className="text-[10px] text-zinc-600 italic">No effects added.</div>
              )}
              {form.launchPipeline.effects.map((eff, i) => (
                <div key={i} className="flex items-center gap-2 py-1 border-b border-zinc-700/40">
                  <span className="flex-1 text-[11px] font-mono text-zinc-300">{eff.type}</span>
                  <input
                    type="number" min={0} max={10} step={0.1}
                    value={eff.delay ?? 0}
                    onChange={(e) => update((d) => {
                      if (!d.launchPipeline) return
                      d.launchPipeline.effects[i] = { ...d.launchPipeline.effects[i], delay: Number(e.target.value) }
                    })}
                    className="w-16 font-mono text-xs"
                    title="Delay (s)"
                  />
                  <span className="text-[9px] text-zinc-600">s</span>
                  <button
                    onClick={() => update((d) => {
                      if (!d.launchPipeline) return
                      d.launchPipeline.effects.splice(i, 1)
                    })}
                    className="text-[10px] text-red-500 hover:text-red-300 px-1">✕</button>
                </div>
              ))}
              <select
                defaultValue=""
                onChange={(e) => {
                  const type = e.target.value as EffectType
                  if (!type) return
                  e.target.value = ''
                  update((d) => {
                    if (!d.launchPipeline) return
                    d.launchPipeline.effects.push({ type, cfg: {}, delay: 0 } as EffectConfig)
                  })
                }}
                className="w-full text-xs mt-2">
                <option value="">+ Add effect…</option>
                {([
                  'static-burst', 'screen-shake', 'vignette-pulse', 'network-glitch',
                  'death-overlay', 'victory-overlay', 'revive-overlay',
                  'terminal-toast', 'notification-box', 'typewriter',
                  'floaties', 'corruption-burst', 'image-overlay', 'video-overlay',
                ] as EffectType[]).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Panel>

      {form.appType === 'widget' && form.id === 'gallery' && (
        <Panel title="Gallery Settings">
          <div className="space-y-3">
            <Toggle
              checked={form.gallerySettings?.randomOrder ?? true}
              label="Random order"
              onChange={(v) => update((d) => {
                d.gallerySettings = {
                  randomOrder: v,
                  autoPlay: d.gallerySettings?.autoPlay ?? false,
                  intervalSec: d.gallerySettings?.intervalSec ?? 8,
                }
              })}
            />
            <Toggle
              checked={form.gallerySettings?.autoPlay ?? false}
              label="Auto play"
              onChange={(v) => update((d) => {
                d.gallerySettings = {
                  randomOrder: d.gallerySettings?.randomOrder ?? true,
                  autoPlay: v,
                  intervalSec: d.gallerySettings?.intervalSec ?? 8,
                }
              })}
            />
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Auto interval (seconds)</div>
              <input
                type="number"
                min={2}
                max={120}
                value={form.gallerySettings?.intervalSec ?? 8}
                onChange={(e) => update((d) => {
                  d.gallerySettings = {
                    randomOrder: d.gallerySettings?.randomOrder ?? true,
                    autoPlay: d.gallerySettings?.autoPlay ?? false,
                    intervalSec: Math.max(2, Math.min(120, Number(e.target.value) || 8)),
                  }
                })}
                className="w-24 font-mono text-xs"
              />
              <div className="text-[10px] text-zinc-600 mt-1">Playback controls in overlay use Previous / Play / Next.</div>
            </div>
          </div>
        </Panel>
      )}

      <button onClick={onDelete}
        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-900/50 hover:border-red-700 transition-colors">
        Remove
      </button>
    </div>
  )
}

// ── EventForm ──────────────────────────────────────────────────────

function EventForm({ def, onUpdate, onDelete }: {
  def: EventDef
  onUpdate: (d: EventDef) => void
  onDelete?: () => void
}) {
  const update = (fn: (d: EventDef) => void) => {
    const next: EventDef = {
      ...def,
      auto: { ...def.auto },
      effects: def.effects.map((effect) => structuredClone(effect)),
    }
    fn(next)
    onUpdate(next)
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/60">
        <span className="text-3xl">{def.icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-zinc-100">{def.label}</div>
          <div className="text-[11px] text-zinc-500 font-mono">{def.id}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">{def.desc}</div>
        </div>
      </div>

      {!def.builtIn && (
        <Panel title="Edit">
          <div className="space-y-2">
            <div>
              <div className="text-[10px] text-zinc-400 mb-1">Label</div>
              <input type="text" value={def.label} onChange={(e) => update((d) => { d.label = e.target.value })} className="w-full" />
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 mb-1">Icon</div>
              <input type="text" value={def.icon} onChange={(e) => update((d) => { d.icon = e.target.value })} className="w-full" placeholder="⚡" />
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 mb-1">Description</div>
              <input type="text" value={def.desc} onChange={(e) => update((d) => { d.desc = e.target.value })} className="w-full" />
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 mb-1">Type</div>
              <select value={def.type ?? 'overlay'} onChange={(e) => update((d) => { d.type = e.target.value as 'overlay' | 'widget-automation' })} className="w-full">
                <option value="overlay">Overlay</option>
                <option value="widget-automation">Widget Automation</option>
              </select>
            </div>
          </div>
        </Panel>

      )}

      <Panel title="Auto-Trigger">
        <Toggle checked={def.auto.enabled} onChange={(v) => update((d) => { d.auto.enabled = v })} label="Enable auto-trigger" />
        {def.auto.enabled && (
          <div className="mt-3 space-y-2">
            <div>
              <div className="text-[10px] text-zinc-400 mb-1">Mode</div>
              <div className="flex gap-1">
                {(['interval', 'idle'] as const).map((m) => (
                  <button key={m} onClick={() => update((d) => { d.auto.mode = m })}
                    className={'flex-1 px-2 py-1 text-xs rounded border capitalize transition-colors ' + (
                      def.auto.mode === m
                        ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40'
                        : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:text-zinc-100'
                    )}>{m}</button>
                ))}
              </div>
            </div>
            {def.auto.mode === 'interval' && (
              <Slider label="Avg every" value={def.auto.intervalMin} min={1} max={60} step={1} unit="min"
                onChange={(v) => update((d) => { d.auto.intervalMin = v })} />
            )}
            {def.auto.mode === 'idle' && (
              <Slider label="After idle" value={def.auto.idleMin} min={1} max={30} step={1} unit="min"
                onChange={(v) => update((d) => { d.auto.idleMin = v })} />
            )}
          </div>
        )}
      </Panel>

      {def.type === 'widget-automation' && (
        <Panel title="Widget Automation Settings">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-zinc-400 mb-1">Available Widgets</div>
              <div className="text-[10px] text-zinc-500 mb-2">Leave empty to include all widgets</div>
              <div className="flex flex-wrap gap-1">
                {['music', 'chat', 'archive', 'sticky-notes', 'gallery'].map((widgetId) => (
                  <button key={widgetId}
                    onClick={() => update((d) => {
                      if (!d.widgetAutomation) d.widgetAutomation = { availableWidgets: [], toggleChance: 0.8, openBias: 0.6 }
                      const widgets = d.widgetAutomation.availableWidgets ?? []
                      const idx = widgets.indexOf(widgetId)
                      if (idx >= 0) widgets.splice(idx, 1)
                      else widgets.push(widgetId)
                      d.widgetAutomation.availableWidgets = widgets
                    })}
                    className={`px-2 py-1 text-[10px] rounded border ${
                      (def.widgetAutomation?.availableWidgets ?? []).includes(widgetId)
                        ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-100'
                    }`}>
                    {widgetId}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-zinc-400 mb-1">Toggle Chance (0-1)</div>
                <input type="number" min={0} max={1} step={0.1} 
                  value={def.widgetAutomation?.toggleChance ?? 0.8}
                  onChange={(e) => update((d) => {
                    if (!d.widgetAutomation) d.widgetAutomation = { availableWidgets: [], toggleChance: 0.8, openBias: 0.6 }
                    d.widgetAutomation.toggleChance = Number(e.target.value)
                  })}
                  className="w-full font-mono text-xs" />
                <div className="text-[9px] text-zinc-500 mt-0.5">Probability of toggling when triggered</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-400 mb-1">Open Bias (0-1)</div>
                <input type="number" min={0} max={1} step={0.1} 
                  value={def.widgetAutomation?.openBias ?? 0.6}
                  onChange={(e) => update((d) => {
                    if (!d.widgetAutomation) d.widgetAutomation = { availableWidgets: [], toggleChance: 0.8, openBias: 0.6 }
                    d.widgetAutomation.openBias = Number(e.target.value)
                  })}
                  className="w-full font-mono text-xs" />
                <div className="text-[9px] text-zinc-500 mt-0.5">Bias toward opening (0.5 = equal)</div>
              </div>
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Effects">
        <div className="space-y-2">
          {def.effects.length === 0 && (
            <div className="text-[10px] text-zinc-600 italic">No effects configured.</div>
          )}
          {def.effects.map((eff, index) => (
            <div key={`${def.id}-effect-${index}`} className="flex items-center gap-2 py-1 border-b border-zinc-700/40">
              <span className="flex-1 text-[11px] font-mono text-zinc-300">{eff.type}</span>
              <input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={eff.delay ?? 0}
                onChange={(e) => update((d) => {
                  d.effects[index] = { ...d.effects[index], delay: Number(e.target.value) }
                })}
                className="w-16 font-mono text-xs"
                title="Delay (s)"
              />
              <span className="text-[9px] text-zinc-600">s</span>
              <button
                onClick={() => update((d) => { d.effects.splice(index, 1) })}
                className="text-[10px] text-red-500 hover:text-red-300 px-1"
              >✕</button>
            </div>
          ))}
          <select
            defaultValue=""
            onChange={(e) => {
              const type = e.target.value as EffectType
              if (!type) return
              e.target.value = ''
              update((d) => {
                d.effects.push({ type, cfg: {}, delay: 0 } as EffectConfig)
              })
            }}
            className="w-full text-xs"
          >
            <option value="">+ Add effect…</option>
            {([
              'static-burst', 'screen-shake', 'vignette-pulse', 'network-glitch',
              'death-overlay', 'victory-overlay', 'revive-overlay',
              'terminal-toast', 'notification-box', 'typewriter',
              'floaties', 'corruption-burst', 'image-overlay', 'video-overlay',
            ] as EffectType[]).map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </Panel>

      {!def.builtIn && onDelete && (
        <div className="pt-1">
          <Btn variant="danger" onClick={onDelete} className="w-full text-xs">Delete Event</Btn>
        </div>
      )}
    </div>
  )
}

// ── SceneConfig ────────────────────────────────────────────────────

function SceneConfig({ sceneId }: { sceneId: string }) {
  const config      = useAdminStore((s) => s.config)
  const saveConfig  = useAdminStore((s) => s.saveConfig)
  const linkedApp   = config.applications.find((a) => a.targetSceneId === sceneId)

  const updateAppTransitions = (key: 'introTransitions' | 'exitTransitions', steps: TransitionStep[]) => {
    if (!linkedApp) return
    const apps = config.applications.map((a) =>
      a.id === linkedApp.id ? { ...a, [key]: steps.length ? steps : undefined } : a
    )
    saveConfig({ applications: apps })
  }

  return (
    <div className="space-y-3">
      <Panel title="Sources">
        <SourcesEditor sceneId={sceneId} />
      </Panel>
      {linkedApp && (
      <Panel title="Transitions">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Intro (entering)</div>
              <TransitionList
                value={linkedApp.introTransitions ?? []}
                onChange={(steps) => updateAppTransitions('introTransitions', steps)}
              />
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Exit (leaving)</div>
              <TransitionList
                value={linkedApp.exitTransitions ?? []}
                onChange={(steps) => updateAppTransitions('exitTransitions', steps)}
              />
            </div>
          </div>
        </Panel>
      )}
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1 mb-1">Visual Style</div>
      <StyleEditor sceneId={sceneId} />

      <Panel title="Background Music">
        <div className="text-[10px] text-zinc-500 mb-2">Loop a music track while this scene is active. Leave blank for silence.</div>
        <input
          type="text"
          placeholder="/assets/audio/music/ambient/track.mp3"
          value={config.scenes[sceneId]?.musicTrack ?? ''}
          onChange={(e) => {
            const val = e.target.value.trim() || undefined
            saveConfig({ scenes: { ...config.scenes, [sceneId]: { ...config.scenes[sceneId], musicTrack: val } } })
          }}
          className="w-full font-mono text-xs"
        />
        <div className="text-[10px] text-zinc-600 mt-1">Crossfade: 1.5 s</div>
      </Panel>
    </div>
  )
}

// ── AssetLibraryPanel ──────────────────────────────────────────────

function AssetLibraryPanel({ onClose }: { onClose: () => void }) {
  const mediaLibrary = useAdminStore((s) => s.config.mediaLibrary ?? [])
  const saveConfig   = useAdminStore((s) => s.saveConfig)

  const [tab, setTab] = useState<'catalog' | 'transitions'>('catalog')
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'image' | 'video'>('image')
  const [url, setUrl] = useState('')
  const [durStr, setDurStr] = useState('')

  const resetForm = () => { setName(''); setType('image'); setUrl(''); setDurStr('') }

  const handleSave = async () => {
    if (!url) return
    const durVal = parseFloat(durStr)
    const hasDur = type === 'image' && !isNaN(durVal) && durVal > 0
    const entry: MediaEntry = {
      id: 'media-' + Date.now(),
      name: name.trim() || url.split('/').pop() || 'Unnamed',
      type,
      url,
      ...(hasDur ? { duration: durVal } : {}),
    }
    await saveConfig({ mediaLibrary: [...mediaLibrary, entry] })
    resetForm()
    setAddOpen(false)
  }

  const handleDelete = async (id: string) => {
    await saveConfig({ mediaLibrary: mediaLibrary.filter((entry) => entry.id !== id) })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="w-[720px] h-[85vh] max-h-[780px] flex flex-col bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Modal header */}
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-zinc-800 shrink-0">
          <span className="text-base">🗂</span>
          <span className="text-sm font-semibold text-zinc-100">Asset Library</span>
          <div className="flex-1" />
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-xl leading-none transition-colors">✕</button>
        </div>

        {/* Modal body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-800/50 rounded-lg">
        {(['catalog', 'transitions'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={'flex-1 py-1 text-xs rounded capitalize transition-colors ' +
              (tab === t ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-200')}
          >
            {t === 'catalog' ? '🗂 Catalog' : '✨ Transitions'}
          </button>
        ))}
      </div>

      {tab === 'catalog' && (
        <div className="space-y-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-800/20 px-3 py-2 text-xs text-zinc-500">
            The catalog indexes the full assets folder, the scraped game-image feed, and your saved media presets in one place.
          </div>

          <AssetCatalogPanel
            kinds={['image', 'video', 'audio']}
            onDeleteSavedEntry={(asset) => { void handleDelete(asset.id) }}
          />

          {addOpen && (
            <div className="border border-zinc-700 rounded-lg p-3 space-y-3 bg-zinc-800/20">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">New Saved Media Entry</div>

              <div>
                <div className="text-[10px] text-zinc-600 mb-1">Name</div>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Scene opener" className="w-full text-xs" />
              </div>

              <div className="flex gap-2">
                {(['image', 'video'] as const).map((mt) => (
                  <button key={mt} type="button"
                    onClick={() => setType(mt)}
                    className={'px-3 py-1 text-xs rounded border transition-colors ' +
                      (type === mt ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40' : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200')}>
                    {mt === 'image' ? '🖼 Image' : '🎬 Video'}
                  </button>
                ))}
              </div>

              <AssetSelectionInput
                value={url}
                onChange={setUrl}
                kinds={[type]}
                modalTitle={type === 'image' ? 'Saved Media Image' : 'Saved Media Video'}
                placeholder={type === 'image' ? '/assets/images/entry.png' : '/assets/video/entry.mp4'}
                buttonLabel="Choose Asset"
                previewKind={type}
              />

              {type === 'image' && (
                <div className="flex items-center gap-2">
                  <input type="number" min={0.1} max={120} step={0.5} value={durStr}
                    onChange={(e) => setDurStr(e.target.value)} placeholder="4.0"
                    className="w-24 text-xs font-mono" />
                  <span className="text-[10px] text-zinc-600">sec display duration</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => void handleSave()} disabled={!url}
                  className="flex-1 py-1.5 text-xs bg-cyan-600/25 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/40 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Save Preset
                </button>
                <button type="button" onClick={() => { resetForm(); setAddOpen(false) }}
                  className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700 rounded transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!addOpen && (
            <button type="button" onClick={() => setAddOpen(true)}
              className="w-full py-2 text-xs border border-dashed border-zinc-700 hover:border-zinc-500 text-zinc-600 hover:text-zinc-300 rounded-lg transition-colors">
              ＋ Add Saved Media Entry
            </button>
          )}
        </div>
      )}

      {/* ── Transitions tab ── */}
      {tab === 'transitions' && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-zinc-500 px-0.5 pb-1">All available GSAP transitions. Set custom durations per-scene in each transition picker.</div>
          {TRANSITION_OPTIONS.map((t) => (
            <div key={t.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded border border-zinc-800 bg-zinc-800/20">
              <span className="text-base w-5 text-center shrink-0">{TRANSITION_ICONS[t.id]}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-zinc-200">{t.label}</div>
                <div className="text-[10px] text-zinc-500 font-mono">{t.id}</div>
              </div>
              <button type="button" onClick={() => socket.emit('transition:preview', [{ id: t.id }])}
                className="shrink-0 text-[10px] text-zinc-600 hover:text-cyan-400 px-1 transition-colors" title="Preview">
                ▶
              </button>
            </div>
          ))}
        </div>
      )}

        </div>
      </div>
    </div>
  )
}

// ── LivePreview ────────────────────────────────────────────────────

function LivePreview() {
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef     = useRef<HTMLIFrameElement>(null)
  const previewTarget = useAdminStore((s) => s.previewTarget)
  const previewUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:${previewTarget === 'runtime' ? 3000 : 3001}`
    : 'http://localhost:3000'
  const previewLabel = previewTarget === 'runtime' ? 'Runtime 3000' : 'Direct Dev 3001'
  const previewBackdropStyle: React.CSSProperties = {
    backgroundColor: '#111827',
    backgroundImage: [
      'linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.05) 75%, rgba(255,255,255,0.05))',
      'linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.05) 75%, rgba(255,255,255,0.05))',
    ].join(', '),
    backgroundPosition: '0 0, 16px 16px',
    backgroundSize: '32px 32px',
  }

  useEffect(() => {
    const scale = () => {
      const c = containerRef.current
      const f = frameRef.current
      if (!c || !f) return
      const s = Math.min(c.clientWidth / 1920, c.clientHeight / 1080)
      f.style.transform       = 'scale(' + s + ')'
      f.style.transformOrigin = 'top left'
      f.style.marginLeft      = ((c.clientWidth  - 1920 * s) / 2) + 'px'
      f.style.marginTop       = ((c.clientHeight - 1080 * s) / 2) + 'px'
    }
    scale()
    const ro = new ResizeObserver(scale)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden min-w-0" style={previewBackdropStyle}>
      <div className="absolute left-3 top-3 z-10 pointer-events-none">
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] backdrop-blur ${previewTarget === 'runtime'
          ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
          : 'border-amber-400/40 bg-amber-500/15 text-amber-100'}`}>
          <span className={`h-2 w-2 rounded-full ${previewTarget === 'runtime' ? 'bg-emerald-300' : 'bg-amber-300'}`} />
          <span>{previewLabel}</span>
        </div>
      </div>
      <div className="absolute right-3 bottom-3 z-10 pointer-events-none rounded-full border border-zinc-700/70 bg-zinc-950/75 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-400 backdrop-blur">
        Transparent background preview
      </div>
      <iframe
        ref={frameRef}
        src={previewUrl}
        width={1920}
        height={1080}
        allow="camera; microphone"
        style={{ position: 'absolute', border: 'none', display: 'block' }}
        title="Overlay Preview"
      />
    </div>
  )
}

// ── RightPane ──────────────────────────────────────────────────────

function EnvironmentLiveNotice({ targetState, label }: { targetState: STATE; label: string }) {
  const currentState = useAdminStore((s) => s.currentState)
  const setLastError = useAdminStore((s) => s.setLastError)

  if (currentState === targetState) return null

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold text-amber-200">{label} preview is not live</div>
          <div className="text-[10px] text-amber-100/80 leading-relaxed">
            Current state is <span className="font-mono">{currentState}</span>. Switch the runtime to <span className="font-mono">{targetState}</span> to see this editor reflected in the preview.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setLastError(null)
            socket.emit('scene:change', targetState, (err: string | null) => { if (err) setLastError(err) })
          }}
          className="shrink-0 rounded border border-amber-300/40 bg-amber-200/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100 transition-colors hover:bg-amber-200/25"
        >
          Show {label}
        </button>
      </div>
    </div>
  )
}

function RightPaneContent({ selected, onDeleted, eventDefs, onUpdateEvent, onDeleteEvent }: {
  selected: SelectedItem; onDeleted: () => void
  eventDefs: EventDef[]; onUpdateEvent: (d: EventDef) => void; onDeleteEvent: (id: string) => void
}) {
  const saveConfig   = useAdminStore((s) => s.saveConfig)
  const applications = useAdminStore((s) => s.config.applications)

  if (selected.kind === 'env') {
    if (selected.envState === STATE.LOBBY) return (
      <div className="space-y-5">
        <EnvironmentLiveNotice targetState={STATE.LOBBY} label="Lobby" />
        <LobbyConfigEditor />
        <div className="border-t border-zinc-800 pt-4">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3">Background & Style</div>
          <StyleEditor sceneId={STATE.LOBBY} />
        </div>
      </div>
    )
    return (
      <div className="space-y-5">
        <EnvironmentLiveNotice targetState={STATE.DESKTOP} label="Desktop" />
        <DesktopConfigEditor />
        <div className="border-t border-zinc-800 pt-4">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3">Background & Style</div>
          <StyleEditor sceneId={STATE.DESKTOP} />
        </div>
      </div>
    )
  }

  if (selected.kind === 'scene') return <SceneConfig sceneId={selected.sceneState as STATE} />

  if (selected.kind === 'app') {
    const app = applications.find((a) => a.id === selected.appId)
    if (!app) return <div className="text-zinc-600 text-xs italic p-4">App not found.</div>
    return (
      <AppForm app={app} onDelete={() => {
        saveConfig({ applications: applications.filter((a) => a.id !== selected.appId) })
        onDeleted()
      }} />
    )
  }

  if (selected.kind === 'event') {
    const def = eventDefs.find((e) => e.id === selected.id)
    if (!def) return <div className="text-zinc-600 text-xs italic p-4">Event not found.</div>
    return <EventForm def={def} onUpdate={onUpdateEvent} onDelete={() => onDeleteEvent(def.id)} />
  }
  if (selected.kind === 'audio')       return <AudioPanel />
  if (selected.kind === 'keybinds')    return <KeybindEditor />
  if (selected.kind === 'archive')     return <ArchivePanel />
  if (selected.kind === 'settings')    return <SettingsPage />
  if (selected.kind === 'ambiance')    return <AmbiancePanel />

  return null
}

function RightPane({ selected, onClose, eventDefs, onUpdateEvent, onDeleteEvent }: {
  selected: SelectedItem | null; onClose: () => void
  eventDefs: EventDef[]; onUpdateEvent: (d: EventDef) => void; onDeleteEvent: (id: string) => void
}) {
  const currentState = useAdminStore((s) => s.currentState)
  const setLastError = useAdminStore((s) => s.setLastError)
  const applications = useAdminStore((s) => s.config.applications)

  const triggerScene = (state: string) => {
    setLastError(null)
    socket.emit('scene:change', state, (err: string | null) => { if (err) setLastError(err) })
  }

  if (!selected) {
    return (
      <div className="w-80 shrink-0 border-l border-zinc-800 flex items-center justify-center bg-zinc-950">
        <div className="text-center text-zinc-700 px-6 select-none">
          <div className="text-3xl mb-2 opacity-40">←</div>
          <div className="text-xs">Select any item to configure</div>
        </div>
      </div>
    )
  }

  // Build header info
  let headerIcon: React.ReactNode = ''
  let headerLabel = ''
  let actionLabel = ''
  let actionFn: (() => void) | null = null
  let isLive = false

  if (selected.kind === 'env') {
    headerIcon  = selected.envState === STATE.LOBBY ? '🖥' : '💾'
    headerLabel = selected.envState === STATE.LOBBY ? 'Lobby' : 'Desktop'
    isLive      = currentState === selected.envState
    actionLabel = isLive ? '● Live' : '▶ Go Live'
    actionFn    = () => triggerScene(selected.envState)
  } else if (selected.kind === 'scene') {
    const parts = selected.sceneState.split(' ')
    headerIcon  = parts[0]
    headerLabel = parts.slice(1).join(' ') || selected.sceneState
    isLive      = currentState === selected.sceneState
    actionLabel = isLive ? '● Live' : '▶ Go Live'
    actionFn    = () => triggerScene(selected.sceneState)
  } else if (selected.kind === 'app') {
    const app   = applications.find((a) => a.id === selected.appId)
    headerIcon  = app ? <IconGlyph icon={app.icon} label={app.label} /> : '🎮'
    headerLabel = app?.label ?? 'Application'
    isLive      = app ? currentState === app.targetSceneId : false
    actionLabel = app?.appType === 'widget' ? '▶ Open' : app?.appType === 'scene' ? '▶ Launch' : 'Decoration'
    // Widgets do not transition — they are floating windows. Only scene apps emit scene:change.
    actionFn    = (app && app.appType === 'scene') ? () => { socket.emit('scene:change', app.targetSceneId); setLastError(null) } : null
  } else if (selected.kind === 'event') {
    const def   = eventDefs.find((e) => e.id === selected.id)
    headerIcon  = def?.icon  ?? '⚡'
    headerLabel = def?.label ?? 'Event'
    isLive      = def?.auto.enabled ?? false
    actionLabel = '▶ Fire Now'
    actionFn    = () => {
      if (!def) return
      socket.emit('overlay:trigger', { id: def.id, effects: def.effects })
    }
  } else if (selected.kind === 'audio')       { headerIcon = '🔊'; headerLabel = 'Audio' }
  else if (selected.kind === 'keybinds')    { headerIcon = '⌨';  headerLabel = 'Keybinds' }
  else if (selected.kind === 'archive')     { headerIcon = '📁'; headerLabel = 'Archive' }
  else if (selected.kind === 'settings')    { headerIcon = '⚙';  headerLabel = 'Settings' }

  return (
    <div className="w-80 shrink-0 border-l border-zinc-800 flex flex-col overflow-hidden bg-zinc-950">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 shrink-0">
        <span className="text-sm shrink-0">{headerIcon}</span>
        <span className="text-xs font-semibold text-zinc-200 flex-1 truncate">{headerLabel}</span>
        {actionFn && (
          <button onClick={actionFn}
            className={'text-xs px-2.5 py-1 rounded border transition-colors ' +
              (isLive ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300' : 'bg-zinc-700 hover:bg-zinc-600 border-zinc-600 text-zinc-100')}>
            {actionLabel}
          </button>
        )}
        <button onClick={onClose}
          className="text-zinc-600 hover:text-zinc-300 text-base px-1.5 ml-0.5 transition-colors leading-none">
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <RightPaneContent selected={selected} onDeleted={onClose} eventDefs={eventDefs} onUpdateEvent={onUpdateEvent} onDeleteEvent={onDeleteEvent} />
      </div>
    </div>
  )
}

// ── SocketLogConsole ────────────────────────────────────────────────

type LogEntry = { id: number; time: string; dir: '←' | '→'; event: string; summary: string }
const logListeners: ((e: LogEntry) => void)[] = []
let logSeq = 0

function formatLogData(args: unknown[]): string {
  if (args.length === 0) return ''
  try {
    const data = args[0]
    // For transition:play strip verbose from/to, show only transitionType
    if (data && typeof data === 'object' && 'transitionType' in (data as object)) {
      const t = (data as Record<string, unknown>).transitionType
      return String(t)
    }
    const s = JSON.stringify(data)
    // Strip outer quotes for simple strings
    if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1)
    return s.length > 60 ? s.slice(0, 60) + '…' : s
  } catch { return String(args[0]) }
}

function pushLog(dir: '←' | '→', event: string, args: unknown[]) {
  const now = new Date()
  const time = now.toTimeString().slice(0, 8)
  const entry: LogEntry = { id: ++logSeq, time, dir, event, summary: formatLogData(args) }
  logListeners.forEach((fn) => fn(entry))
}

// Wire up socket event capture at module level
const LOG_SKIP = new Set(['obs:status'])
socket.onAny((event, ...args) => { if (!LOG_SKIP.has(event)) pushLog('←', event, args as unknown[]) })
socket.onAnyOutgoing((event, ...args) => pushLog('→', event, args as unknown[]))

function SocketLogConsole() {
  const [entries,   setEntries] = useState<LogEntry[]>([])
  const [copied,    setCopied]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    const text = entries.map(en => `${en.time} ${en.dir} ${en.event}${en.summary ? ' ' + en.summary : ''}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEntries([])
  }

  useEffect(() => {
    const handler = (e: LogEntry) =>
      setEntries((prev) => [...prev.slice(-99), e])
    logListeners.push(handler)
    return () => { const i = logListeners.indexOf(handler); if (i >= 0) logListeners.splice(i, 1) }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  return (
    <div className="shrink-0 border-t border-zinc-800">
      <div className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left bg-zinc-900/70 border-b border-zinc-800">
        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest flex-1">Console</span>
        {entries.length > 0 && (
          <span className="text-[10px] font-mono text-zinc-600 truncate max-w-[100px]">
            {entries[entries.length - 1].dir} {entries[entries.length - 1].event}
          </span>
        )}
        {entries.length > 0 && (
          <>
            <button
              type="button"
              onClick={handleCopy}
              title="Copy log"
              className="text-[10px] text-zinc-600 hover:text-zinc-300 px-1 transition-colors"
            >{copied ? '✓' : '⎘'}</button>
            <button
              type="button"
              onClick={handleClear}
              title="Clear log"
              className="text-[10px] text-zinc-600 hover:text-red-400 px-1 transition-colors"
            >✕</button>
          </>
        )}
      </div>
      <div className="h-[150px] overflow-y-auto bg-zinc-950/60 px-2 py-1 space-y-0.5">
        {entries.length === 0 && (
          <div className="text-[10px] text-zinc-700 italic pt-2 text-center">No events yet.</div>
        )}
        {entries.map((e) => (
          <div key={e.id} className="flex gap-1.5 items-baseline font-mono">
            <span className="text-[9px] text-zinc-700 shrink-0">{e.time}</span>
            <span className={'text-[10px] shrink-0 ' + (e.dir === '→' ? 'text-cyan-600' : 'text-emerald-600')}>{e.dir}</span>
            <span className="text-[10px] text-zinc-300 shrink-0 truncate max-w-[70px]">{e.event}</span>
            {e.summary && <span className="text-[10px] text-zinc-600 truncate">{e.summary}</span>}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ── LeftSidebar ────────────────────────────────────────────────────

function SidebarBtn({ icon, label, live, statusLabel, statusClassName, active, onClick, onDoubleClick }: {
  icon: React.ReactNode; label: string; live?: boolean; statusLabel?: string; statusClassName?: string; active: boolean
  onClick: () => void; onDoubleClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={onDoubleClick ? 'Click to configure · Double-click to activate' : undefined}
      className={'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors mb-0.5 text-left border ' +
        (active ? 'bg-zinc-700/90 text-zinc-100 border-zinc-600' : 'text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/70 border-transparent')}>
      <span className="text-sm w-4 h-4 flex items-center justify-center shrink-0 leading-none">{icon}</span>
      <span className="flex-1 truncate font-medium">{label}</span>
      {live && <span className="text-[9px] font-bold text-emerald-400 tracking-widest shrink-0">LIVE</span>}
      {!live && statusLabel && <span className={`text-[9px] font-bold tracking-widest shrink-0 ${statusClassName ?? 'text-zinc-500'}`}>{statusLabel}</span>}
    </button>
  )
}

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60 border border-dashed border-zinc-800 hover:border-zinc-600 transition-colors mb-0.5">
      <span className="text-sm w-4 text-center shrink-0">+</span>
      <span>{label}</span>
    </button>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider px-2.5 pt-3 pb-1">
      {children}
    </div>
  )
}

const SUPPORTED_WIDGET_IDS = new Set(['music', 'archive', 'chat', 'sticky-notes', 'gallery', 'camera', 'spotify', 'browser'])

function isSupportedWidgetId(widgetId: string) {
  if (SUPPORTED_WIDGET_IDS.has(widgetId)) return true
  return /^camera(?:[-:_].+)?$/.test(widgetId)
}

function isCameraWidgetId(widgetId: string) {
  return /^camera(?:[-:_].+)?$/.test(widgetId)
}

function LeftSidebar({ selected, onSelect, onActivate, onLibrary, eventDefs, onAddEvent }: {
  selected: SelectedItem | null; onSelect: (item: SelectedItem) => void; onActivate: (item: SelectedItem) => void
  onLibrary: () => void
  eventDefs: EventDef[]; onAddEvent: () => void
}) {
  const currentState = useAdminStore((s) => s.currentState)
  const saveConfig   = useAdminStore((s) => s.saveConfig)
  const applications = useAdminStore((s) => s.config.applications)
  const scenes       = useAdminStore((s) => s.config.scenes)
  const overlayStyle = useAdminStore((s) => s.config.overlayStyle)
  const openWidgetIds = useAdminStore((s) => s.openWidgetIds)

  const sceneApps      = applications.filter((a) => (a.appType ?? 'scene') === 'scene')
  const widgetApps     = applications.filter((a) => a.appType === 'widget' && isSupportedWidgetId(a.id))
  const decorationApps = applications.filter((a) => a.appType === 'decoration')
  const hasWidget = (id: string) => applications.some((app) => app.id === id && app.appType === 'widget' && isSupportedWidgetId(app.id))

  const createNextCameraWidget = () => {
    const existingIds = new Set(applications.filter((app) => app.appType === 'widget').map((app) => app.id))

    let id = 'camera'
    let suffix = 2
    while (existingIds.has(id)) {
      id = `camera-${suffix}`
      suffix += 1
    }

    const labelSuffix = id === 'camera' ? '' : ` ${id.replace('camera-', '')}`
    const app: Application = {
      id,
      label: `Camera${labelSuffix}`,
      icon: '📷',
      appType: 'widget',
      targetSceneId: STATE.DESKTOP,
      transitionType: 'default',
    }

    saveConfig({ applications: [...applications, app] })
    onSelect({ kind: 'app', appId: app.id })
  }

  const isActive = (item: SelectedItem) => selected ? itemKey(item) === itemKey(selected) : false

  return (
    <div className="w-52 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      {/* Scrollable nav area */}
      <div className="flex-1 overflow-y-auto pb-1">

      <SectionLabel>Environments</SectionLabel>
      <SidebarBtn icon="🖥" label="Lobby"   live={currentState === STATE.LOBBY}   active={isActive({ kind: 'env', envState: STATE.LOBBY })}   onClick={() => onSelect({ kind: 'env', envState: STATE.LOBBY })}   onDoubleClick={() => onActivate({ kind: 'env', envState: STATE.LOBBY })} />
      <SidebarBtn icon="💾" label="Desktop" live={currentState === STATE.DESKTOP} active={isActive({ kind: 'env', envState: STATE.DESKTOP })} onClick={() => onSelect({ kind: 'env', envState: STATE.DESKTOP })} onDoubleClick={() => onActivate({ kind: 'env', envState: STATE.DESKTOP })} />

      <div className="mx-2 mt-2 border-t border-zinc-800/80" />

      <SectionLabel>Scenes</SectionLabel>
      {sceneApps.map((app) => {
        const sc = scenes[app.targetSceneId]
        if (!sc) return null
        return (
          <SidebarBtn key={sc.id} icon={<IconGlyph icon={app.icon} label={sc.label} />} label={sc.label}
            live={currentState === sc.id}
            active={isActive({ kind: 'scene', sceneState: sc.id })}
            onClick={() => onSelect({ kind: 'scene', sceneState: sc.id })}
            onDoubleClick={() => onActivate({ kind: 'scene', sceneState: sc.id })} />
        )
      })}

      <div className="mx-2 mt-2 border-t border-zinc-800/80" />

      <SectionLabel>Applications</SectionLabel>
      {sceneApps.map((app) => (
        <SidebarBtn key={app.id} icon={<IconGlyph icon={app.icon} label={app.label} />} label={app.label}
          live={currentState === app.targetSceneId}
          active={isActive({ kind: 'app', appId: app.id })}
          onClick={() => onSelect({ kind: 'app', appId: app.id })}
          onDoubleClick={() => onActivate({ kind: 'app', appId: app.id })} />
      ))}
      <AddBtn label="New Application" onClick={() => {
        const sceneId = 'SCENE_' + Date.now()
        const a: Application = { id: 'app-' + Date.now(), label: 'New App', icon: '🎮', appType: 'scene', targetSceneId: sceneId, transitionType: 'desktop-to-gameplay', introTransition: 'desktop-to-gameplay', exitTransition: 'gameplay-to-desktop' }
        const newScene: Scene = {
          id: sceneId,
          label: 'New App',
          backgroundOpaque: false,
          sources: [],
          style: {
            ...overlayStyle,
            background: {
              ...overlayStyle.background,
              type: 'none',
              opacity: 0,
            },
          },
        }
        saveConfig({ applications: [...applications, a], scenes: { ...scenes, [sceneId]: newScene } })
        onSelect({ kind: 'app', appId: a.id })
      }} />

      <div className="mx-2 mt-2 border-t border-zinc-800/80" />

      <SectionLabel>Widgets</SectionLabel>
      {widgetApps.map((app) => (
        <SidebarBtn key={app.id} icon={<IconGlyph icon={app.icon} label={app.label} />} label={app.label}
          statusLabel={openWidgetIds.includes(app.id) ? 'OPEN' : 'CLOSED'}
          statusClassName={openWidgetIds.includes(app.id) ? 'text-cyan-300' : 'text-zinc-600'}
          active={isActive({ kind: 'app', appId: app.id })}
          onClick={() => onSelect({ kind: 'app', appId: app.id })}
          onDoubleClick={() => onActivate({ kind: 'app', appId: app.id })} />
      ))}
      {!hasWidget('music') && <AddBtn label="Add Music Widget" onClick={() => {
        const a: Application = { id: 'music', label: 'Music', icon: '🎵', appType: 'widget', targetSceneId: STATE.DESKTOP, transitionType: 'default' }
        saveConfig({ applications: [...applications, a] })
        onSelect({ kind: 'app', appId: a.id })
      }} />}
      {!hasWidget('archive') && <AddBtn label="Add Archive Widget" onClick={() => {
        const a: Application = { id: 'archive', label: 'Archive', icon: '📚', appType: 'widget', targetSceneId: STATE.DESKTOP, transitionType: 'default' }
        saveConfig({ applications: [...applications, a] })
        onSelect({ kind: 'app', appId: a.id })
      }} />}
      {!hasWidget('chat') && <AddBtn label="Add Chat Widget" onClick={() => {
        const a: Application = { id: 'chat', label: 'Chat', icon: '💬', appType: 'widget', targetSceneId: STATE.DESKTOP, transitionType: 'default' }
        saveConfig({ applications: [...applications, a] })
        onSelect({ kind: 'app', appId: a.id })
      }} />}
      {!hasWidget('sticky-notes') && <AddBtn label="Add Sticky Notes Widget" onClick={() => {
        const a: Application = { id: 'sticky-notes', label: 'Sticky Notes', icon: '🗒', appType: 'widget', targetSceneId: STATE.DESKTOP, transitionType: 'default' }
        saveConfig({ applications: [...applications, a] })
        onSelect({ kind: 'app', appId: a.id })
      }} />}
      {!hasWidget('gallery') && <AddBtn label="Add Gallery Widget" onClick={() => {
        const a: Application = { id: 'gallery', label: 'Gallery', icon: '🖼', appType: 'widget', targetSceneId: STATE.DESKTOP, transitionType: 'default' }
        saveConfig({ applications: [...applications, a] })
        onSelect({ kind: 'app', appId: a.id })
      }} />}
      <AddBtn label="Add Camera Widget" onClick={createNextCameraWidget} />

      <div className="mx-2 mt-2 border-t border-zinc-800/80" />

      <SectionLabel>Decorations</SectionLabel>
      {decorationApps.map((app) => (
        <SidebarBtn key={app.id} icon={<IconGlyph icon={app.icon} label={app.label} />} label={app.label}
          live={false}
          active={isActive({ kind: 'app', appId: app.id })}
          onClick={() => onSelect({ kind: 'app', appId: app.id })}
          onDoubleClick={() => onActivate({ kind: 'app', appId: app.id })} />
      ))}
      <AddBtn label="New Decoration" onClick={() => {
        const a: Application = { id: 'decor-' + Date.now(), label: 'New Decoration', icon: '🖼', appType: 'decoration', targetSceneId: STATE.DESKTOP, transitionType: 'instant' }
        saveConfig({ applications: [...applications, a] })
        onSelect({ kind: 'app', appId: a.id })
      }} />

      <div className="mx-2 mt-2 border-t border-zinc-800/80" />

      <SectionLabel>Events</SectionLabel>
      {eventDefs.map((def) => (
        <SidebarBtn key={def.id} icon={def.icon} label={def.label}
          statusLabel={def.auto.enabled ? 'AUTO' : undefined}
          statusClassName="text-amber-300"
          active={isActive({ kind: 'event', id: def.id })}
          onClick={() => onSelect({ kind: 'event', id: def.id })}
          onDoubleClick={() => onActivate({ kind: 'event', id: def.id })} />
      ))}
      <AddBtn label="New Event" onClick={onAddEvent} />

      <div className="flex-1" />
      <div className="mx-2 mt-2 border-t border-zinc-800/80" />

      <SectionLabel>Utilities</SectionLabel>
      <SidebarBtn icon="📁" label="Archive"       active={isActive({ kind: 'archive' })}     onClick={() => onSelect({ kind: 'archive' })} />
      <SidebarBtn icon="🌌" label="Ambiance"      active={isActive({ kind: 'ambiance' })}    onClick={() => onSelect({ kind: 'ambiance' })} />
      <SidebarBtn icon="🗂" label="Asset Library" active={false}                              onClick={onLibrary} />
      </div>{/* end scrollable nav */}
      <SocketLogConsole />
    </div>
  )
}

// ── TopBar ─────────────────────────────────────────────────────────

function TopBar({ onSettings }: { onSettings: () => void }) {
  const obsConnected = useAdminStore((s) => s.obsConnected)
  const currentState = useAdminStore((s) => s.currentState)
  const clientCount  = useAdminStore((s) => s.clientCount)
  const lastError    = useAdminStore((s) => s.lastError)
  const setLastError = useAdminStore((s) => s.setLastError)
  const simulationLeaderId = useAdminStore((s) => s.simulationLeaderId)
  const ambianceAcceptedCount = useAdminStore((s) => s.ambianceAcceptedCount)
  const ambianceRejectedCount = useAdminStore((s) => s.ambianceRejectedCount)

  const handlePanic = () => {
    setLastError(null)
    socket.emit('scene:change', STATE.DESKTOP, (err: string | null) => {
      if (err) setLastError(err)
    })
  }

  return (
    <div className="flex items-center gap-3 px-3 h-10 bg-zinc-900 border-b border-zinc-800 shrink-0">
      <span className="text-cyan-400 font-bold font-mono text-sm tracking-widest">IEOM</span>
      <div className="w-px h-4 bg-zinc-700" />
      <span className={'text-xs font-mono ' + (obsConnected ? 'text-emerald-400' : 'text-zinc-600')}>
        {obsConnected ? '● OBS' : '○ OBS'}
      </span>
      {clientCount > 0 && (
        <span className="text-[10px] text-zinc-600 font-mono">{clientCount}c</span>
      )}
      <span className="text-xs font-mono text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded">{currentState}</span>
      <div className="inline-flex items-center gap-2 rounded border border-zinc-800 bg-zinc-950/65 px-2 py-0.5">
        <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">SIM</span>
        <span className="text-[10px] font-mono text-zinc-300" title={simulationLeaderId ?? 'none'}>
          L:{simulationLeaderId ? simulationLeaderId.slice(0, 8) : 'none'}
        </span>
        <span className="text-[10px] font-mono text-emerald-300">A:{ambianceAcceptedCount}</span>
        <span className="text-[10px] font-mono text-rose-300">R:{ambianceRejectedCount}</span>
      </div>
      {lastError && (
        <span className="text-[10px] text-red-400 font-mono truncate max-w-[200px]" title={lastError}>{lastError}</span>
      )}
      <div className="flex-1" />
      <button
        onClick={onSettings}
        className="text-zinc-500 hover:text-zinc-200 text-base px-1.5 py-1 rounded hover:bg-zinc-800 transition-colors"
        title="Settings">
        ⚙
      </button>
      <button
        onClick={handlePanic}
        className="px-3 py-1 rounded bg-red-900 hover:bg-red-700 border border-red-800 text-white text-xs font-bold tracking-widest transition-colors"
        title="Reset to Desktop">
        PANIC
      </button>
    </div>
  )
}

type SettingsTab = 'general' | 'audio' | 'keybinds'

function SettingsModal({ tab, onTabChange, onClose }: {
  tab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
  onClose: () => void
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-sm">
      <div className="w-[min(1100px,calc(100vw-48px))] h-[min(760px,calc(100vh-48px))] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
          <span className="text-sm font-semibold text-zinc-100">Settings</span>
          <div className="flex gap-1 ml-4">
            {([
              ['general', 'General'],
              ['audio', 'Audio'],
              ['keybinds', 'Keybinds'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={'px-3 py-1.5 rounded text-xs border transition-colors ' + (
                  tab === id
                    ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-lg leading-none px-2 py-1">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'general' && <SettingsPage />}
          {tab === 'audio' && <AudioPanel />}
          {tab === 'keybinds' && <KeybindEditor />}
        </div>
      </div>
    </div>
  )
}

// ── Dashboard ──────────────────────────────────────────────────────

export function Dashboard() {
  const [selected,     setSelected]     = useState<SelectedItem | null>(null)
  const [libraryOpen,  setLibraryOpen]  = useState(false)
  const eventDefs = useAdminStore((s) => (s.config.events ?? DEFAULT_EVENT_DEFS) as EventDef[])
  const applications = useAdminStore((s) => s.config.applications)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const settingsTab: SettingsTab | null = selected?.kind === 'settings'
    ? 'general'
    : selected?.kind === 'audio'
      ? 'audio'
      : selected?.kind === 'keybinds'
        ? 'keybinds'
        : null

  // Clear selection when selected app is removed
  useEffect(() => {
    if (selected?.kind === 'app' && !applications.find((a) => a.id === selected.appId)) {
      setSelected(null)
    }
  }, [applications, selected])

  const handleSelect = (item: SelectedItem) => {
    if (selected && itemKey(item) === itemKey(selected)) {
      setSelected(null)
    } else {
      setSelected(item)
    }
  }

  const handleActivate = (item: SelectedItem) => {
    // Ensure item is selected first
    setSelected(item)
    if (item.kind === 'env') {
      socket.emit('scene:change', item.envState)
    } else if (item.kind === 'scene') {
      socket.emit('scene:change', item.sceneState)
    } else if (item.kind === 'app') {
      const app = applications.find((a) => a.id === item.appId)
      if (!app) return
      if (app.appType === 'widget') {
        // Widgets are floating windows — tell the overlay to toggle them, no scene change.
        socket.emit('widget:toggle', app.id)
      } else if (app.appType === 'scene') {
        socket.emit('scene:change', app.targetSceneId)
      }
    } else if (item.kind === 'event') {
      const def = eventDefs.find((eventDef) => eventDef.id === item.id)
      if (!def) return
      socket.emit('overlay:trigger', { id: def.id, effects: def.effects })
    }
  }

  const handleAddEvent = () => {
    const id  = 'custom-' + Date.now()
    const def: EventDef = { id, label: 'New Event', icon: '⚡', color: 'text-cyan-400', desc: '', effects: [], auto: { enabled: false, mode: 'interval', intervalMin: 15, idleMin: 5 } }
    saveConfig({ events: [...eventDefs, def] })
    setSelected({ kind: 'event', id })
  }

  const handleUpdateEvent = (updated: EventDef) => {
    saveConfig({ events: eventDefs.map((e) => e.id === updated.id ? updated : e) })
    // Keep selected up to date (label/icon may have changed)
    if (selected?.kind === 'event' && selected.id === updated.id) {
      setSelected({ kind: 'event', id: updated.id })
    }
  }

  const handleDeleteEvent = (id: string) => {
    saveConfig({ events: eventDefs.filter((e) => e.id !== id) })
    if (selected?.kind === 'event' && selected.id === id) setSelected(null)
  }

  return (
    <div className="relative flex flex-col h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <TopBar onSettings={() => handleSelect({ kind: 'settings' })} />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar selected={selected} onSelect={handleSelect} onActivate={handleActivate} onLibrary={() => setLibraryOpen(true)} eventDefs={eventDefs} onAddEvent={handleAddEvent} />
        <LivePreview />
        {!settingsTab && <RightPane selected={selected} onClose={() => setSelected(null)} eventDefs={eventDefs} onUpdateEvent={handleUpdateEvent} onDeleteEvent={handleDeleteEvent} />}
      </div>
      {libraryOpen && <AssetLibraryPanel onClose={() => setLibraryOpen(false)} />}
      {settingsTab && (
        <SettingsModal
          tab={settingsTab}
          onTabChange={(tab) => setSelected(tab === 'general' ? { kind: 'settings' } : tab === 'audio' ? { kind: 'audio' } : { kind: 'keybinds' })}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
