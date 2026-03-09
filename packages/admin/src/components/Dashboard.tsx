import { useEffect, useRef, useState, useCallback } from 'react'
import { STATE, OVERLAY_EVENT } from '@ieom/shared'
import type {
  OverlayStyle, BackgroundType, PatternPreset, ParticlePreset,
  Application, LobbyConfig, DesktopConfig, ApplicationType, Scene, SourceInstance,
} from '@ieom/shared'
import { socket } from '../socket/client'
import { useAdminStore } from '../store/useAdminStore'
import { Panel, Toggle, Slider, Btn } from './ui'
import { SettingsPage } from '../pages/SettingsPage'
import { ArchivePanel } from '../pages/ArchivePanel'
import { KeybindEditor } from '../pages/KeybindEditor'
import { AudioPanel }   from '../pages/AudioPanel'

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

const IMAGE_PRESETS = [
  { name: 'Galaxy',      thumb: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=200&h=113&fit=crop', url: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1920&h=1080&fit=crop&q=80' },
  { name: 'Nebula',      thumb: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=200&h=113&fit=crop', url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920&h=1080&fit=crop&q=80' },
  { name: 'Neon City',   thumb: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=200&h=113&fit=crop', url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1920&h=1080&fit=crop&q=80' },
  { name: 'Dark Forest', thumb: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=200&h=113&fit=crop', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&h=1080&fit=crop&q=80' },
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

const TRANSITION_OPTIONS = [
  { id: 'instant',             label: 'Instant',       desc: 'Immediate cut' },
  { id: 'fade',                label: 'Fade',          desc: 'Cross-fade through black' },
  { id: 'desktop-to-lobby',    label: 'Zoom Out',      desc: 'Glitch flash + desktop shrinks' },
  { id: 'lobby-to-desktop',    label: 'Boot Rush',     desc: 'Camera rushes into CRT' },
  { id: 'desktop-to-gameplay', label: 'Win98 Loading', desc: 'Windows 98 progress dialog' },
  { id: 'gameplay-to-desktop', label: 'CRT Dissolve',  desc: 'Static wipe back to desktop' },
  { id: 'desktop-to-tv',       label: 'Channel Sweep', desc: 'TV channel-change sweep' },
  { id: 'tv-to-desktop',       label: 'Channel Back',  desc: 'TV channel-change reverse' },
  { id: 'glitch-burst',        label: 'Glitch Burst',  desc: 'Digital glitch explosion' },
  { id: 'static-burst',        label: 'Static Burst',  desc: 'TV static fill then clear' },
  { id: 'wipe-left',           label: 'Wipe Left',     desc: 'Panel sweeps from right' },
  { id: 'wipe-right',          label: 'Wipe Right',    desc: 'Panel sweeps from left' },
]

// ── Source catalog ────────────────────────────────────────────────
interface FieldDef {
  key: string; label: string
  type: 'text' | 'number' | 'color' | 'boolean' | 'select'
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
      { key: 'url',       label: 'URL / Path', type: 'text', placeholder: '/assets/backgrounds/name.jpg' },
      { key: 'objectFit', label: 'Fit',        type: 'select', options: ['cover', 'contain', 'fill'] },
      { key: 'opacity',   label: 'Opacity',    type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'video-loop', label: 'Video Loop', icon: '🎬', desc: 'Muted looping video — local path or URL',
    defaultConfig: { url: '', opacity: 1 },
    fields: [
      { key: 'url',     label: 'URL / Path', type: 'text', placeholder: '/assets/video/name.mp4' },
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

function SourceField({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] text-zinc-500 w-16 shrink-0">{field.label}</label>
      {field.type === 'color' && (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <input type="color" value={String(value ?? '#000000')} onChange={(e) => onChange(e.target.value)} className="w-6 h-5 shrink-0" />
          <input type="text"  value={String(value ?? '')}        onChange={(e) => onChange(e.target.value)} className="flex-1 font-mono text-[10px] min-w-0" />
        </div>
      )}
      {field.type === 'number' && (
        <input type="number" value={Number(value ?? 0)}
          min={field.min} max={field.max} step={field.step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 font-mono text-xs" />
      )}
      {field.type === 'text' && (
        <input type="text" value={String(value ?? '')} placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-xs" />
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
    saveConfig({ scenes: { ...config.scenes, [sceneId]: { ...scene, sources: next } } })

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
  { id: 'color',     label: 'Color'    },
  { id: 'image-url', label: 'Image'    },
  { id: 'video-url', label: 'Video'    },
  { id: 'pattern',   label: 'Pattern'  },
]

const SCREENSAVER_PRESETS: { id: DesktopConfig['screenSaver']['preset']; label: string }[] = [
  { id: 'starfield',      label: 'Starfield'      },
  { id: 'flying-windows', label: 'Flying Windows' },
  { id: 'marquee',        label: 'Marquee Text'   },
  { id: 'pipes',          label: 'Pipes 3D'       },
  { id: 'blank',          label: 'Black Screen'   },
]

// ── Events def ─────────────────────────────────────────────────────

type AutoTrigger = { enabled: boolean; mode: 'interval' | 'idle'; intervalMin: number; idleMin: number }
type EventDef    = { id: string; label: string; icon: string; color: string; desc: string; builtIn?: boolean; auto: AutoTrigger }

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

function itemKey(item: SelectedItem): string {
  if (item.kind === 'env')   return 'env-' + item.envState
  if (item.kind === 'scene') return 'scene-' + item.sceneState
  if (item.kind === 'app')   return 'app-' + item.appId
  if (item.kind === 'event') return 'event-' + item.id
  return item.kind
}

// ── StyleEditor ────────────────────────────────────────────────────

type StyleTab = 'background' | 'effects' | 'particles' | 'typography'
const STYLE_TABS: { id: StyleTab; label: string }[] = [
  { id: 'background', label: 'Background' },
  { id: 'effects',    label: 'Effects'    },
  { id: 'particles',  label: 'Particles'  },
  { id: 'typography', label: 'Type'       },
]

function StyleEditor({ sceneId }: { sceneId: string }) {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const [tab,   setTab]   = useState<StyleTab>('background')
  const [style, setStyle] = useState<OverlayStyle>(() =>
    structuredClone((config.scenes[sceneId] as { style?: OverlayStyle } | undefined)?.style ?? config.overlayStyle)
  )
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setStyle(structuredClone((config.scenes[sceneId] as { style?: OverlayStyle } | undefined)?.style ?? config.overlayStyle))
  }, [config.scenes, config.overlayStyle, sceneId])

  const update = useCallback((updater: (d: OverlayStyle) => void) => {
    setStyle((prev) => {
      const next = structuredClone(prev)
      updater(next)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        setSaving(true)
        const scene = config.scenes[sceneId]
        await saveConfig({ scenes: { ...config.scenes, [sceneId]: { ...scene, style: next } } })
        setSaving(false); setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      }, 600)
      return next
    })
    setSaved(false)
  }, [saveConfig, config.scenes, sceneId])

  const bg = style.background
  const fx = style.effects
  const pt = style.particles

  return (
    <div>
      <div className="flex gap-0.5 border-b border-zinc-700 mb-3">
        {STYLE_TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={'px-2.5 py-1.5 text-[11px] rounded-t border-b-2 -mb-px transition-colors ' +
              (id === tab ? 'text-cyan-300 border-cyan-500' : 'text-zinc-500 border-transparent hover:text-zinc-200')}>
            {label}
          </button>
        ))}
        <div className="flex-1" />
        {saving && <span className="text-[10px] text-zinc-500 self-center pr-1">saving…</span>}
        {saved  && <span className="text-[10px] text-emerald-400 self-center pr-1">✔</span>}
      </div>

      <div className="space-y-3">
        {tab === 'background' && <>
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Type</div>
            <div className="flex flex-wrap gap-1">
              {BG_TYPES.map(({ id, label }) => (
                <button key={id} onClick={() => update((d) => { d.background.type = id })}
                  className={'px-2 py-1 text-[11px] rounded border transition-colors ' +
                    (bg.type === id ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40' : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:text-zinc-100')}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {bg.type === 'gradient' && <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Presets</div>
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

          {bg.type === 'color' && <div className="flex items-center gap-2">
            <input type="color" value={bg.color} onChange={(e) => update((d) => { d.background.color = e.target.value })} />
            <input type="text" value={bg.color} onChange={(e) => update((d) => { d.background.color = e.target.value })} className="font-mono text-xs w-24" />
          </div>}

          {bg.type === 'image-url' && <div>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {IMAGE_PRESETS.map((img) => (
                <button key={img.name} onClick={() => update((d) => { d.background.imageUrl = img.url })}
                  className={'relative rounded overflow-hidden h-14 transition-all ' + (bg.imageUrl === img.url ? 'ring-2 ring-cyan-400' : 'hover:ring-1 hover:ring-zinc-400')}>
                  <img src={img.thumb} alt={img.name} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-black/30 flex items-end p-1">
                    <span className="text-[10px] text-white font-medium">{img.name}</span>
                  </div>
                </button>
              ))}
            </div>
            <input type="url" value={bg.imageUrl}
              onChange={(e) => update((d) => { d.background.imageUrl = e.target.value })}
              placeholder="https://…" className="w-full text-xs" />
          </div>}

          {bg.type === 'video-url' && <div>
            <input type="url" value={bg.videoUrl}
              onChange={(e) => update((d) => { d.background.videoUrl = e.target.value })}
              placeholder="https://… (.mp4 / .webm)" className="w-full text-xs" />
            <div className="text-[10px] text-zinc-600 mt-1">Local: <span className="font-mono text-zinc-400">/assets/videos/file.mp4</span></div>
          </div>}

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
        </>}

        {tab === 'effects' && <div className="space-y-2">
          <Panel title="CRT Scanlines">
            <Toggle checked={fx.crt} onChange={(v) => update((d) => { d.effects.crt = v })} label="Enable" />
            {fx.crt && <div className="mt-2"><Slider label="Intensity" value={fx.scanlineOpacity} onChange={(v) => update((d) => { d.effects.scanlineOpacity = v })} /></div>}
          </Panel>
          <Panel title="Film Grain">
            <Toggle checked={fx.noise} onChange={(v) => update((d) => { d.effects.noise = v })} label="Enable" />
            {fx.noise && <div className="mt-2"><Slider label="Grain" value={fx.noiseOpacity} onChange={(v) => update((d) => { d.effects.noiseOpacity = v })} /></div>}
          </Panel>
          <Panel title="Vignette">
            <Toggle checked={fx.vignette} onChange={(v) => update((d) => { d.effects.vignette = v })} label="Enable" />
            {fx.vignette && <div className="mt-2"><Slider label="Strength" value={fx.vignetteStrength} onChange={(v) => update((d) => { d.effects.vignetteStrength = v })} /></div>}
          </Panel>
          <Panel title="Other">
            <Toggle checked={fx.flicker} onChange={(v) => update((d) => { d.effects.flicker = v })} label="Screen flicker" />
            <div className="mt-2">
              <Toggle checked={fx.chromatic} onChange={(v) => update((d) => { d.effects.chromatic = v })} label="Chromatic aberration" />
            </div>
          </Panel>
        </div>}

        {tab === 'particles' && <div className="space-y-3">
          <Toggle checked={pt.enabled} onChange={(v) => update((d) => { d.particles.enabled = v })} label="Enable particles" />
          <div className="grid grid-cols-3 gap-1">
            {PARTICLE_PRESETS.map((p) => (
              <button key={p.id}
                onClick={() => update((d) => { d.particles.preset = p.id; d.particles.enabled = p.id !== 'none' })}
                className={'py-2.5 rounded text-sm border transition-colors flex flex-col items-center gap-0.5 ' +
                  (pt.preset === p.id ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-100')}>
                <span>{p.icon}</span>
                <span className="text-[10px]">{p.label}</span>
              </button>
            ))}
          </div>
          {pt.enabled && pt.preset !== 'none' && <div className="space-y-1">
            <Slider label="Density" value={pt.density} onChange={(v) => update((d) => { d.particles.density = v })} />
            <Slider label="Speed"   value={pt.speed}   onChange={(v) => update((d) => { d.particles.speed   = v })} />
          </div>}
        </div>}

        {tab === 'typography' && <div className="space-y-3">
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Font</div>
            <div className="space-y-0.5 max-h-40 overflow-y-auto">
              {GOOGLE_FONTS.map((f) => (
                <button key={f.css} onClick={() => update((d) => { d.fontFamily = f.css })}
                  className={'block w-full text-left px-2.5 py-1.5 rounded text-xs border transition-colors ' +
                    (style.fontFamily === f.css ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-300' : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800')}
                  style={{ fontFamily: f.css === 'default' ? undefined : '"' + f.css + '", sans-serif' }}>
                  {f.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Accent</div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {ACCENT_SWATCHES.map((c) => (
                <button key={c} onClick={() => update((d) => { d.accentColor = c })}
                  className={'w-6 h-6 rounded-full border-2 transition-all ' + (style.accentColor === c ? 'border-white scale-110' : 'border-transparent hover:border-zinc-400')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="color" value={style.accentColor} onChange={(e) => update((d) => { d.accentColor = e.target.value })} style={{ width: 32, height: 28 }} />
              <input type="text" value={style.accentColor} onChange={(e) => update((d) => { d.accentColor = e.target.value })} className="font-mono text-xs w-20" />
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Text</div>
            <div className="flex items-center gap-2">
              <input type="color" value={style.textColor} onChange={(e) => update((d) => { d.textColor = e.target.value })} style={{ width: 32, height: 28 }} />
              <input type="text" value={style.textColor} onChange={(e) => update((d) => { d.textColor = e.target.value })} className="font-mono text-xs w-20" />
            </div>
          </div>
        </div>}
      </div>
    </div>
  )
}

// ── LobbyConfigEditor ──────────────────────────────────────────────

const DEFAULT_LOBBY: LobbyConfig = {
  ambientColor: '#1e1a3a', ambientIntensity: 0.28,
  fogColor: '#080810', fogNear: 6, fogFar: 22,
  wallColor: '#0f0f16', floorColor: '#0d0d14', floorReflectivity: 0.6,
  crtGlowColor: '#00c8e0', neonStrips: true, neonColors: ['#00c8ff', '#8000ff'],
  dustMotes: true, cameraFov: 62, starsCount: 400,
}

function LobbyConfigEditor() {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const [form, setForm] = useState<LobbyConfig>(() =>
    structuredClone((config.scenes[STATE.LOBBY] as { lobbyConfig?: LobbyConfig } | undefined)?.lobbyConfig ?? DEFAULT_LOBBY)
  )
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const lc = (config.scenes[STATE.LOBBY] as { lobbyConfig?: LobbyConfig } | undefined)?.lobbyConfig
    if (lc) setForm(structuredClone(lc))
  }, [config.scenes])

  const update = useCallback((updater: (d: LobbyConfig) => void) => {
    setForm((prev) => {
      const next = structuredClone(prev)
      updater(next)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        setSaving(true)
        await saveConfig({ scenes: { ...config.scenes, [STATE.LOBBY]: { ...config.scenes[STATE.LOBBY], lobbyConfig: next } } })
        setSaving(false); setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      }, 600)
      return next
    })
    setSaved(false)
  }, [saveConfig, config.scenes])

  const ColorRow = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div className="flex items-center gap-2 mb-2">
      {label && <label className="text-[11px] text-zinc-400 w-16 shrink-0">{label}</label>}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-7 h-6 shrink-0" />
      <input type="text"  value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs flex-1" />
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-[10px]">
        <span className="text-zinc-500 uppercase tracking-wider">3D Room</span>
        {saving && <span className="text-zinc-500">saving…</span>}
        {saved  && <span className="text-emerald-400">✔</span>}
      </div>
      <Panel title="Transitions">
        <div className="space-y-2">
          {([
            { field: 'introTransition' as const, label: 'Intro (entering)' },
            { field: 'exitTransition'  as const, label: 'Exit (leaving)' },
          ]).map(({ field, label }) => (
            <div key={field}>
              <div className="text-[10px] text-zinc-500 mb-1">{label}</div>
              <select
                value={(config.scenes[STATE.LOBBY] as Record<string, string> | undefined)?.[field] ?? ''}
                onChange={(e) => {
                  const val = e.target.value || undefined
                  saveConfig({ scenes: { ...config.scenes, [STATE.LOBBY]: { ...config.scenes[STATE.LOBBY], [field]: val } } })
                }}
                className="w-full text-xs">
                <option value="">— None —</option>
                {TRANSITION_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>)}
              </select>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Ambient Light">
        <ColorRow label="" value={form.ambientColor} onChange={(v) => update((d) => { d.ambientColor = v })} />
        <Slider label="Intensity" value={form.ambientIntensity} min={0} max={2} step={0.01} onChange={(v) => update((d) => { d.ambientIntensity = v })} />
      </Panel>
      <Panel title="Fog">
        <ColorRow label="" value={form.fogColor} onChange={(v) => update((d) => { d.fogColor = v })} />
        <Slider label="Near" value={form.fogNear} min={1} max={20} step={0.5} onChange={(v) => update((d) => { d.fogNear = v })} />
        <Slider label="Far"  value={form.fogFar}  min={5} max={60} step={1}   onChange={(v) => update((d) => { d.fogFar  = v })} />
      </Panel>
      <Panel title="Surfaces">
        <ColorRow label="Walls" value={form.wallColor}  onChange={(v) => update((d) => { d.wallColor  = v })} />
        <ColorRow label="Floor" value={form.floorColor} onChange={(v) => update((d) => { d.floorColor = v })} />
        <Slider label="Reflectivity" value={form.floorReflectivity} min={0} max={1} step={0.05} onChange={(v) => update((d) => { d.floorReflectivity = v })} />
      </Panel>
      <Panel title="CRT Glow">
        <ColorRow label="" value={form.crtGlowColor} onChange={(v) => update((d) => { d.crtGlowColor = v })} />
      </Panel>
      <Panel title="Neon Strips">
        <Toggle checked={form.neonStrips} onChange={(v) => update((d) => { d.neonStrips = v })} label="Enable" />
        {form.neonStrips && <div className="mt-2 space-y-1">
          <ColorRow label="Strip 1" value={form.neonColors[0]} onChange={(v) => update((d) => { d.neonColors = [v, d.neonColors[1]] })} />
          <ColorRow label="Strip 2" value={form.neonColors[1]} onChange={(v) => update((d) => { d.neonColors = [d.neonColors[0], v] })} />
        </div>}
      </Panel>
      <Panel title="Atmosphere">
        <Toggle checked={form.dustMotes} onChange={(v) => update((d) => { d.dustMotes = v })} label="Dust motes" />
        <div className="mt-2 space-y-1">
          <Slider label="Camera FOV" value={form.cameraFov} min={30} max={120} step={1} onChange={(v) => update((d) => { d.cameraFov = v })} />
          <Slider label="Stars"      value={form.starsCount} min={0} max={2000} step={50} onChange={(v) => update((d) => { d.starsCount = v })} />
        </div>
      </Panel>
    </div>
  )
}

// ── DesktopConfigEditor ────────────────────────────────────────────

const DEFAULT_DESKTOP_CONFIG: DesktopConfig = {
  defaultIconSize: 'normal', autoArrangeIcons: false,
  screenSaver: { enabled: false, timeoutMinutes: 5, preset: 'starfield' },
  systemSounds: { startup: '', error: '', notify: '', click: '', close: '' },
}

function DesktopConfigEditor() {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const [form, setForm] = useState<DesktopConfig>(() =>
    structuredClone(config.desktopConfig ?? DEFAULT_DESKTOP_CONFIG)
  )
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setForm(structuredClone(config.desktopConfig ?? DEFAULT_DESKTOP_CONFIG))
  }, [config.desktopConfig])

  const update = useCallback((updater: (d: DesktopConfig) => void) => {
    setForm((prev) => {
      const next = structuredClone(prev)
      updater(next)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        await saveConfig({ desktopConfig: next })
        setSaved(true); setTimeout(() => setSaved(false), 1500)
      }, 500)
      return next
    })
  }, [saveConfig])

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-[10px]">
        <span className="text-zinc-500 uppercase tracking-wider">Win98 Desktop</span>
        {saved && <span className="text-emerald-400">✔</span>}
      </div>
      <Panel title="Transitions">
        <div className="space-y-2">
          {([
            { field: 'introTransition' as const, label: 'Intro (entering)' },
            { field: 'exitTransition'  as const, label: 'Exit (leaving)' },
          ]).map(({ field, label }) => (
            <div key={field}>
              <div className="text-[10px] text-zinc-500 mb-1">{label}</div>
              <select
                value={(config.scenes[STATE.DESKTOP] as Record<string, string> | undefined)?.[field] ?? ''}
                onChange={(e) => {
                  const val = e.target.value || undefined
                  saveConfig({ scenes: { ...config.scenes, [STATE.DESKTOP]: { ...config.scenes[STATE.DESKTOP], [field]: val } } })
                }}
                className="w-full text-xs">
                <option value="">— None —</option>
                {TRANSITION_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>)}
              </select>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Icons">
        <div className="mb-3">
          <div className="text-[10px] text-zinc-500 mb-1.5">Default size</div>
          <div className="flex gap-1">
            {(['small', 'normal', 'large'] as const).map((s) => (
              <button key={s} onClick={() => update((d) => { d.defaultIconSize = s })}
                className={'px-2.5 py-1 text-[11px] rounded border capitalize transition-colors ' +
                  (form.defaultIconSize === s ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40' : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:text-zinc-100')}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <Toggle checked={form.autoArrangeIcons} onChange={(v) => update((d) => { d.autoArrangeIcons = v })} label="Auto-arrange" />
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
    </div>
  )
}

// ── AppForm ────────────────────────────────────────────────────────

function AppForm({ app, onDelete }: { app: Application; onDelete: () => void }) {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const [form, setForm] = useState<Application>(app)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setForm(app) }, [app])

  const autoSave = (updated: Application) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const apps = [...config.applications]
      const idx  = apps.findIndex((a) => a.id === updated.id)
      if (idx !== -1) apps[idx] = updated; else apps.push(updated)
      // Keep the scene label in sync with the application label
      const scene = config.scenes[updated.targetSceneId]
      if (scene) {
        const updatedScene = { ...scene, label: updated.label }
        saveConfig({ applications: apps, scenes: { ...config.scenes, [updated.targetSceneId]: updatedScene } })
      } else {
        saveConfig({ applications: apps })
      }
    }, 400)
  }

  const update = (updater: (d: Application) => void) => {
    const next = { ...form }; updater(next); setForm(next); autoSave(next)
  }

  return (
    <div className="space-y-3">
      <Panel title="Identity">
        <div className="space-y-2">
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Label</div>
            <input type="text" value={form.label} onChange={(e) => update((d) => { d.label = e.target.value })} className="w-full text-xs" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Icon</div>
            <div className="flex gap-2 items-center">
              <span className="text-2xl p-1.5 bg-zinc-800 rounded border border-zinc-700">{form.icon}</span>
              <input type="text" value={form.icon} onChange={(e) => update((d) => { d.icon = e.target.value })} className="flex-1 font-mono text-xs" />
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
        <div className="space-y-2">
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Intro</div>
            <select value={form.introTransition ?? ''}
              onChange={(e) => update((d) => { d.introTransition = e.target.value || undefined })}
              className="w-full text-xs">
              <option value="">— Default —</option>
              {TRANSITION_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Exit</div>
            <select value={form.exitTransition ?? ''}
              onChange={(e) => update((d) => { d.exitTransition = e.target.value || undefined })}
              className="w-full text-xs">
              <option value="">— Default —</option>
              {TRANSITION_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>)}
            </select>
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
      </Panel>

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
    const next = { ...def, auto: { ...def.auto } }
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

  const updateAppTransition = (key: 'introTransition' | 'exitTransition', val: string) => {
    if (!linkedApp) return
    const apps = config.applications.map((a) =>
      a.id === linkedApp.id ? { ...a, [key]: val || undefined } : a
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
          <div className="space-y-2">
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Intro (entering)</div>
              <select value={linkedApp.introTransition ?? ''}
                onChange={(e) => updateAppTransition('introTransition', e.target.value)}
                className="w-full text-xs">
                <option value="">— Default —</option>
                {TRANSITION_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Exit (leaving)</div>
              <select value={linkedApp.exitTransition ?? ''}
                onChange={(e) => updateAppTransition('exitTransition', e.target.value)}
                className="w-full text-xs">
                <option value="">— Default —</option>
                {TRANSITION_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>)}
              </select>
            </div>
          </div>
        </Panel>
      )}
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1 mb-1">Visual Style</div>
      <StyleEditor sceneId={sceneId} />
    </div>
  )
}

// ── LivePreview ────────────────────────────────────────────────────

function LivePreview() {
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef     = useRef<HTMLIFrameElement>(null)

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
    <div ref={containerRef} className="relative flex-1 bg-black overflow-hidden min-w-0">
      <iframe
        ref={frameRef}
        src="/overlay"
        width={1920}
        height={1080}
        style={{ position: 'absolute', border: 'none', display: 'block' }}
        title="Overlay Preview"
      />
    </div>
  )
}

// ── RightPane ──────────────────────────────────────────────────────

function RightPaneContent({ selected, onDeleted, eventDefs, onUpdateEvent, onDeleteEvent }: {
  selected: SelectedItem; onDeleted: () => void
  eventDefs: EventDef[]; onUpdateEvent: (d: EventDef) => void; onDeleteEvent: (id: string) => void
}) {
  const saveConfig   = useAdminStore((s) => s.saveConfig)
  const applications = useAdminStore((s) => s.config.applications)

  if (selected.kind === 'env') {
    if (selected.envState === STATE.LOBBY) return <LobbyConfigEditor />
    return (
      <div className="space-y-5">
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
  let headerIcon  = ''
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
    const labels: Record<string, string> = { [STATE.GAMEPLAY]: '🎮 Gameplay', [STATE.TV]: '📺 TV' }
    const parts = (labels[selected.sceneState] ?? selected.sceneState).split(' ')
    headerIcon  = parts[0]
    headerLabel = parts.slice(1).join(' ') || selected.sceneState
    isLive      = currentState === selected.sceneState
    actionLabel = isLive ? '● Live' : '▶ Go Live'
    actionFn    = () => triggerScene(selected.sceneState)
  } else if (selected.kind === 'app') {
    const app   = applications.find((a) => a.id === selected.appId)
    headerIcon  = app?.icon  ?? '🎮'
    headerLabel = app?.label ?? 'Application'
    isLive      = app ? currentState === app.targetSceneId : false
    actionLabel = app?.appType === 'widget' ? '▶ Open' : '▶ Launch'
    actionFn    = app ? () => { socket.emit('scene:change', app.targetSceneId); setLastError(null) } : null
  } else if (selected.kind === 'event') {
    const def   = eventDefs.find((e) => e.id === selected.id)
    headerIcon  = def?.icon  ?? '⚡'
    headerLabel = def?.label ?? 'Event'
    isLive      = def?.auto.enabled ?? false
    actionLabel = '▶ Fire Now'
    actionFn    = () => socket.emit('overlay:trigger', selected.id)
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

// ── LeftSidebar ────────────────────────────────────────────────────

function SidebarBtn({ icon, label, live, active, onClick, onDoubleClick }: {
  icon: string; label: string; live?: boolean; active: boolean
  onClick: () => void; onDoubleClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={onDoubleClick ? 'Click to configure · Double-click to activate' : undefined}
      className={'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors mb-0.5 text-left border ' +
        (active ? 'bg-zinc-700/90 text-zinc-100 border-zinc-600' : 'text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/70 border-transparent')}>
      <span className="text-sm w-4 text-center shrink-0 leading-none">{icon}</span>
      <span className="flex-1 truncate font-medium">{label}</span>
      {live && <span className="text-[9px] font-bold text-emerald-400 tracking-widest shrink-0">LIVE</span>}
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

function LeftSidebar({ selected, onSelect, onActivate, eventDefs, onAddEvent }: {
  selected: SelectedItem | null; onSelect: (item: SelectedItem) => void; onActivate: (item: SelectedItem) => void
  eventDefs: EventDef[]; onAddEvent: () => void
}) {
  const currentState = useAdminStore((s) => s.currentState)
  const saveConfig   = useAdminStore((s) => s.saveConfig)
  const applications = useAdminStore((s) => s.config.applications)
  const scenes       = useAdminStore((s) => s.config.scenes)

  const sceneApps  = applications.filter((a) => (a.appType ?? 'scene') === 'scene')
  const widgetApps = applications.filter((a) => a.appType === 'widget')

  const isActive = (item: SelectedItem) => selected ? itemKey(item) === itemKey(selected) : false

  return (
    <div className="w-52 shrink-0 bg-zinc-900 border-r border-zinc-800 overflow-y-auto flex flex-col pb-2">

      <SectionLabel>Environments</SectionLabel>
      <SidebarBtn icon="🖥" label="Lobby"   live={currentState === STATE.LOBBY}   active={isActive({ kind: 'env', envState: STATE.LOBBY })}   onClick={() => onSelect({ kind: 'env', envState: STATE.LOBBY })}   onDoubleClick={() => onActivate({ kind: 'env', envState: STATE.LOBBY })} />
      <SidebarBtn icon="💾" label="Desktop" live={currentState === STATE.DESKTOP} active={isActive({ kind: 'env', envState: STATE.DESKTOP })} onClick={() => onSelect({ kind: 'env', envState: STATE.DESKTOP })} onDoubleClick={() => onActivate({ kind: 'env', envState: STATE.DESKTOP })} />

      <div className="mx-2 mt-2 border-t border-zinc-800/80" />

      <SectionLabel>Scenes</SectionLabel>
      {sceneApps.map((app) => {
        const sc = scenes[app.targetSceneId]
        if (!sc) return null
        return (
          <SidebarBtn key={sc.id} icon={app.icon} label={sc.label}
            live={currentState === sc.id}
            active={isActive({ kind: 'scene', sceneState: sc.id })}
            onClick={() => onSelect({ kind: 'scene', sceneState: sc.id })}
            onDoubleClick={() => onActivate({ kind: 'scene', sceneState: sc.id })} />
        )
      })}

      <div className="mx-2 mt-2 border-t border-zinc-800/80" />

      <SectionLabel>Applications</SectionLabel>
      {sceneApps.map((app) => (
        <SidebarBtn key={app.id} icon={app.icon} label={app.label}
          live={currentState === app.targetSceneId}
          active={isActive({ kind: 'app', appId: app.id })}
          onClick={() => onSelect({ kind: 'app', appId: app.id })}
          onDoubleClick={() => onActivate({ kind: 'app', appId: app.id })} />
      ))}
      <AddBtn label="New Application" onClick={() => {
        const sceneId = 'SCENE_' + Date.now()
        const a: Application = { id: 'app-' + Date.now(), label: 'New App', icon: '🎮', appType: 'scene', targetSceneId: sceneId, transitionType: 'desktop-to-gameplay', introTransition: 'desktop-to-gameplay', exitTransition: 'gameplay-to-desktop' }
        const newScene: Scene = { id: sceneId, label: 'New App', backgroundOpaque: false, sources: [] }
        saveConfig({ applications: [...applications, a], scenes: { ...scenes, [sceneId]: newScene } })
        onSelect({ kind: 'app', appId: a.id })
      }} />

      <div className="mx-2 mt-2 border-t border-zinc-800/80" />

      <SectionLabel>Widgets</SectionLabel>
      {widgetApps.map((app) => (
        <SidebarBtn key={app.id} icon={app.icon} label={app.label}
          live={currentState === app.targetSceneId}
          active={isActive({ kind: 'app', appId: app.id })}
          onClick={() => onSelect({ kind: 'app', appId: app.id })}
          onDoubleClick={() => onActivate({ kind: 'app', appId: app.id })} />
      ))}
      <AddBtn label="New Widget" onClick={() => {
        const a: Application = { id: 'widget-' + Date.now(), label: 'New Widget', icon: '▣', appType: 'widget', targetSceneId: STATE.MUSIC, transitionType: 'default' }
        saveConfig({ applications: [...applications, a] })
        onSelect({ kind: 'app', appId: a.id })
      }} />

      <div className="mx-2 mt-2 border-t border-zinc-800/80" />

      <SectionLabel>Events</SectionLabel>
      {eventDefs.map((def) => (
        <SidebarBtn key={def.id} icon={def.icon} label={def.label}
          live={def.auto.enabled}
          active={isActive({ kind: 'event', id: def.id })}
          onClick={() => onSelect({ kind: 'event', id: def.id })}
          onDoubleClick={() => onActivate({ kind: 'event', id: def.id })} />
      ))}
      <AddBtn label="New Event" onClick={onAddEvent} />

      <div className="flex-1" />
      <div className="mx-2 mt-2 border-t border-zinc-800/80" />

      <SectionLabel>Studio</SectionLabel>
      <SidebarBtn icon="🔊" label="Audio"       active={isActive({ kind: 'audio' })}       onClick={() => onSelect({ kind: 'audio' })} />
      <SidebarBtn icon="⌨"  label="Keybinds"    active={isActive({ kind: 'keybinds' })}    onClick={() => onSelect({ kind: 'keybinds' })} />
      <SidebarBtn icon="📁" label="Archive"     active={isActive({ kind: 'archive' })}     onClick={() => onSelect({ kind: 'archive' })} />
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

// ── Dashboard ──────────────────────────────────────────────────────

export function Dashboard() {
  const [selected,   setSelected]   = useState<SelectedItem | null>(null)
  const [eventDefs,  setEventDefs]  = useState<EventDef[]>(DEFAULT_EVENT_DEFS)
  const applications = useAdminStore((s) => s.config.applications)

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
      if (app) socket.emit('scene:change', app.targetSceneId)
    } else if (item.kind === 'event') {
      socket.emit('overlay:trigger', item.id as never)
    }
  }

  const handleAddEvent = () => {
    const id  = 'custom-' + Date.now()
    const def: EventDef = { id, label: 'New Event', icon: '⚡', color: 'text-cyan-400', desc: '', auto: { enabled: false, mode: 'interval', intervalMin: 15, idleMin: 5 } }
    setEventDefs((prev) => [...prev, def])
    setSelected({ kind: 'event', id })
  }

  const handleUpdateEvent = (updated: EventDef) => {
    setEventDefs((prev) => prev.map((e) => e.id === updated.id ? updated : e))
    // Keep selected up to date (label/icon may have changed)
    if (selected?.kind === 'event' && selected.id === updated.id) {
      setSelected({ kind: 'event', id: updated.id })
    }
  }

  const handleDeleteEvent = (id: string) => {
    setEventDefs((prev) => prev.filter((e) => e.id !== id))
    if (selected?.kind === 'event' && selected.id === id) setSelected(null)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <TopBar onSettings={() => handleSelect({ kind: 'settings' })} />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar selected={selected} onSelect={handleSelect} onActivate={handleActivate} eventDefs={eventDefs} onAddEvent={handleAddEvent} />
        <LivePreview />
        <RightPane selected={selected} onClose={() => setSelected(null)} eventDefs={eventDefs} onUpdateEvent={handleUpdateEvent} onDeleteEvent={handleDeleteEvent} />
      </div>
    </div>
  )
}
