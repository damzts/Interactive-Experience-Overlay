import { useEffect, useRef, useState, useCallback } from 'react'
import { STATE, OVERLAY_EVENT } from '@ieom/shared'
import type { OverlayStyle, BackgroundType, PatternPreset, ParticlePreset, Application, LobbyConfig } from '@ieom/shared'
import { socket } from '../socket/client'
import { useAdminStore } from '../store/useAdminStore'
import { Panel, Toggle, Slider } from './ui'
import { SettingsPage } from '../pages/SettingsPage'
import { ArchivePanel } from '../pages/ArchivePanel'
import { KeybindEditor } from '../pages/KeybindEditor'
import { AudioPanel }    from '../pages/AudioPanel'
import { EventsPanel }   from '../pages/EventsPanel'

// ── Curated presets ────────────────────────────────────────────────

const GRADIENT_PRESETS: { name: string; value: string }[] = [
  { name: 'Deep Space',   value: 'linear-gradient(135deg, #0c0c1e 0%, #1a0533 50%, #0c0c1e 100%)' },
  { name: 'Cyberpunk',    value: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 40%, #0a1a2e 100%)' },
  { name: 'Forest Night', value: 'linear-gradient(135deg, #080f08 0%, #0a1f0a 60%, #040a04 100%)' },
  { name: 'Blood Moon',   value: 'linear-gradient(135deg, #1a0000 0%, #3d0000 50%, #1a0010 100%)' },
  { name: 'Arctic Abyss', value: 'linear-gradient(135deg, #050f1a 0%, #051525 60%, #020710 100%)' },
  { name: 'Twilight',     value: 'linear-gradient(135deg, #1a0c2e 0%, #2e1448 50%, #0c0a1e 100%)' },
  { name: 'Gold Ember',   value: 'linear-gradient(135deg, #1a0f00 0%, #2d1f00 50%, #0d0900 100%)' },
  { name: 'Bio Hazard',   value: 'linear-gradient(135deg, #001800 0%, #002d0a 50%, #000d02 100%)' },
  { name: 'Plasma',       value: 'radial-gradient(ellipse at 20% 20%, #1a0040 0%, #000010 60%, #001a3d 100%)' },
  { name: 'Void',         value: 'radial-gradient(ellipse at center, #0a0a0a 0%, #000000 100%)' },
  { name: 'Amethyst',     value: 'linear-gradient(45deg, #1a0033 0%, #330066 50%, #1a0033 100%)' },
  { name: 'Coral Reef',   value: 'linear-gradient(180deg, #001a1a 0%, #002d33 50%, #001520 100%)' },
]

const IMAGE_PRESETS: { name: string; thumb: string; url: string }[] = [
  {
    name: 'Galaxy',
    thumb: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=200&h=113&fit=crop&auto=format',
    url:   'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1920&h=1080&fit=crop&auto=format&q=80',
  },
  {
    name: 'Nebula',
    thumb: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=200&h=113&fit=crop&auto=format',
    url:   'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920&h=1080&fit=crop&auto=format&q=80',
  },
  {
    name: 'Star Field',
    thumb: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=200&h=113&fit=crop&auto=format',
    url:   'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&h=1080&fit=crop&auto=format&q=80',
  },
  {
    name: 'Earth Orbit',
    thumb: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=200&h=113&fit=crop&auto=format',
    url:   'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&h=1080&fit=crop&auto=format&q=80',
  },
  {
    name: 'Neon City',
    thumb: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=200&h=113&fit=crop&auto=format',
    url:   'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1920&h=1080&fit=crop&auto=format&q=80',
  },
  {
    name: 'Dark Forest',
    thumb: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=200&h=113&fit=crop&auto=format',
    url:   'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&h=1080&fit=crop&auto=format&q=80',
  },
  {
    name: 'Mountain Mist',
    thumb: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=200&h=113&fit=crop&auto=format',
    url:   'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=1920&h=1080&fit=crop&auto=format&q=80',
  },
  {
    name: 'Dark Ocean',
    thumb: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=200&h=113&fit=crop&auto=format',
    url:   'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1920&h=1080&fit=crop&auto=format&q=80',
  },
]

const PATTERN_CSS: Record<PatternPreset, React.CSSProperties> = {
  none: {},
  grid: {
    backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)',
    backgroundSize: '50px 50px',
    backgroundColor: '#0a0a0f',
  },
  dots: {
    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)',
    backgroundSize: '28px 28px',
    backgroundColor: '#0a0a0f',
  },
  diagonal: {
    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.04) 8px, rgba(255,255,255,0.04) 9px)',
    backgroundColor: '#0a0a0f',
  },
  honeycomb: {
    backgroundSize: '28px 48px',
    backgroundImage: 'radial-gradient(circle farthest-side at 0% 50%, transparent 23.5%, rgba(255,255,255,.05) 24%, rgba(255,255,255,.05) 26%, transparent 27.75%), linear-gradient(rgba(255,255,255,.04) 14.75%, rgba(255,255,255,.04) 85%, transparent 85.25%)',
    backgroundColor: '#0a0a0f',
  },
  circuit: {
    backgroundImage: 'linear-gradient(rgba(0,204,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,204,255,.05) 1px, transparent 1px)',
    backgroundSize: '50px 50px',
    backgroundColor: '#030810',
  },
  topography: {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.07)' d='M20 40Q40 20 60 40Q80 60 100 40Q120 20 140 40Q160 60 180 40'/%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.05)' d='M0 70Q20 50 40 70Q60 90 80 70Q100 50 120 70Q140 90 160 70Q180 50 200 70'/%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.06)' d='M20 100Q40 80 60 100Q80 120 100 100Q120 80 140 100Q160 120 180 100'/%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.04)' d='M0 130Q20 110 40 130Q60 150 80 130Q100 110 120 130Q140 150 160 130Q180 110 200 130'/%3E%3C/svg%3E")`,
    backgroundColor: '#0a0a0f',
  },
}

const PARTICLE_PRESETS: { id: ParticlePreset; icon: string; label: string }[] = [
  { id: 'none',      icon: '○', label: 'None' },
  { id: 'stars',     icon: '✦', label: 'Stars' },
  { id: 'snow',      icon: '❄', label: 'Snow' },
  { id: 'matrix',    icon: '⌥', label: 'Matrix' },
  { id: 'fireflies', icon: '◉', label: 'Fireflies' },
  { id: 'ash',       icon: '◦', label: 'Ash' },
]

const GOOGLE_FONTS: { name: string; css: string }[] = [
  { name: 'System Default',     css: 'default' },
  { name: 'Press Start 2P',     css: 'Press Start 2P' },
  { name: 'VT323',              css: 'VT323' },
  { name: 'Orbitron',           css: 'Orbitron' },
  { name: 'Share Tech Mono',    css: 'Share Tech Mono' },
  { name: 'Rajdhani',           css: 'Rajdhani' },
  { name: 'Exo 2',              css: 'Exo 2' },
  { name: 'Audiowide',          css: 'Audiowide' },
  { name: 'Electrolize',        css: 'Electrolize' },
  { name: 'Play',               css: 'Play' },
  { name: 'Major Mono Display', css: 'Major Mono Display' },
  { name: 'Courier Prime',      css: 'Courier Prime' },
]

const ACCENT_SWATCHES = ['#00ff41', '#06b6d4', '#a855f7', '#f97316', '#ec4899', '#eab308', '#ef4444', '#ffffff']

const TRANSITION_OPTIONS: { id: string; label: string; desc: string }[] = [
  { id: 'instant',             label: 'Instant',           desc: 'Immediate cut, no animation' },
  { id: 'fade',                label: 'Fade',              desc: 'Cross-fade through black' },
  { id: 'lobby-to-desktop',    label: 'Boot Rush',         desc: 'Camera rushes into CRT + boot sequence' },
  { id: 'desktop-to-gameplay', label: 'Win98 Loading',     desc: 'Windows 98 progress dialog' },
  { id: 'gameplay-to-desktop', label: 'CRT Dissolve',      desc: 'Static wipe back to desktop' },
  { id: 'desktop-to-tv',       label: 'Channel Sweep → TV',   desc: 'TV channel-change effect' },
  { id: 'tv-to-desktop',       label: 'Channel Back',      desc: 'TV channel-change effect' },
  { id: 'glitch-burst',        label: 'Glitch Burst',      desc: 'Digital glitch explosion' },
  { id: 'static-burst',        label: 'Static Burst',      desc: 'Full TV static then clear' },
  { id: 'wipe-left',           label: 'Wipe Left',         desc: 'Black panel sweeps from right' },
  { id: 'wipe-right',          label: 'Wipe Right',        desc: 'Black panel sweeps from left' },
]

// ── Scene / Overlay controls ───────────────────────────────────────

// ── Inspector view ────────────────────────────────────────────────
type InspectorView =
  | 'scene'
  | 'application'
  | 'event-detail'
  | 'auto-events'
  | 'audio'
  | 'archive'
  | 'keybinds'
  | 'settings'

// ── Concept definitions displayed in the Inspector panel header ───
/** Each key maps to a title + one-sentence definition shown to the admin */
const INSPECTOR_DEFS: Record<string, { title: string; desc: string }> = {
  'scene': {
    title: 'Scene',
    desc:  'A broadcast state — the full visual context shown to viewers at a given moment. Each scene owns its plugin sources, layout, and transition.',
  },
  'application': {
    title: 'Application',
    desc:  'A Win98 .exe shortcut on the desktop. Launching it switches the active scene or stacks on top of it.',
  },
  'event-detail': {
    title: 'Event',
    desc:  'An overlay animation that plays on top of the current scene without changing it.',
  },
  'auto-events': {
    title: 'Auto-Events',
    desc:  'Condition-based overlay animations that fire automatically — idle detection, random glitch, system messages.',
  },
  'audio': {
    title: 'Audio',
    desc:  'Master, SFX, and music volume levels for all overlay audio layers.',
  },
  'archive': {
    title: 'Archive',
    desc:  'Recorded stream sessions and event logs captured server-side.',
  },
  'keybinds': {
    title: 'Keybinds',
    desc:  'Keyboard shortcuts for instant scene switches and event triggers during live gameplay.',
  },
  'settings': {
    title: 'Settings',
    desc:  'OBS WebSocket connection URL, password, and server-side configuration.',
  },
}

/** Left-sidebar section header with an optional one-line description */
function SectionHeader({ label, desc }: { label: string; desc?: string }) {
  return (
    <div className="px-1 mb-1.5 mt-0.5">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold leading-none">{label}</div>
      {desc && <div className="text-[9px] text-zinc-700 leading-tight mt-0.5">{desc}</div>}
    </div>
  )
}

// ── Scene + event definitions ─────────────────────────────────
const SCENE_DEFS: { label: string; state: STATE; icon: string }[] = [
  { label: 'LOBBY',   state: STATE.LOBBY,   icon: '🖥' },
  { label: 'DESKTOP', state: STATE.DESKTOP, icon: '💾' },
]

const EVENT_DEFS: { label: string; event: OVERLAY_EVENT; icon: string; color: string }[] = [
  { label: 'DEATH',   event: OVERLAY_EVENT.DEATH,          icon: '💀', color: 'text-red-400'     },
  { label: 'VICTORY', event: OVERLAY_EVENT.VICTORY,        icon: '🏆', color: 'text-yellow-400'  },
  { label: 'REVIVE',  event: OVERLAY_EVENT.REVIVE,         icon: '❤',  color: 'text-emerald-400' },
  { label: 'GLITCH',  event: OVERLAY_EVENT.NETWORK_GLITCH, icon: '📡', color: 'text-purple-400'  },
]

// ── StyleEditor ────────────────────────────────────────────────────

type StyleTab = 'background' | 'effects' | 'particles' | 'typography'

const STYLE_TABS: { id: StyleTab; icon: string; label: string; desc: string }[] = [
  { id: 'background', icon: '▣', label: 'Background', desc: 'Gradient, solid color, image, video, or CSS pattern behind all sources' },
  { id: 'effects',    icon: '⊡', label: 'Effects',    desc: 'CRT scanlines, film grain, vignette, flicker, chromatic aberration' },
  { id: 'particles',  icon: '✦', label: 'Particles',  desc: 'Ambient particle system — stars, snow, matrix rain, fireflies, ash' },
  { id: 'typography', icon: 'T', label: 'Type',        desc: 'Font family, accent color, and text color applied to all overlay text' },
]

const BG_TYPES: { id: BackgroundType; label: string }[] = [
  { id: 'none',      label: 'None' },
  { id: 'gradient',  label: 'Gradient' },
  { id: 'color',     label: 'Color' },
  { id: 'image-url', label: 'Image' },
  { id: 'video-url', label: 'Video' },
  { id: 'pattern',   label: 'Pattern' },
]

function StyleEditor() {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const [tab,   setTab]   = useState<StyleTab>('background')
  const [style, setStyle] = useState<OverlayStyle>(() =>
    structuredClone((config.scenes[STATE.DESKTOP] as { style?: OverlayStyle } | undefined)?.style ?? config.overlayStyle)
  )
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setStyle(structuredClone((config.scenes[STATE.DESKTOP] as { style?: OverlayStyle } | undefined)?.style ?? config.overlayStyle))
  }, [config.scenes, config.overlayStyle])

  const update = useCallback((updater: (draft: OverlayStyle) => void) => {
    setStyle((prev) => {
      const next = structuredClone(prev)
      updater(next)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        setSaving(true)
        const desktopScene = config.scenes[STATE.DESKTOP]
        await saveConfig({ scenes: { ...config.scenes, [STATE.DESKTOP]: { ...desktopScene, style: next } } })
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      }, 600)
      return next
    })
    setSaved(false)
  }, [saveConfig, config.scenes])

  const save = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(true)
    const desktopScene = config.scenes[STATE.DESKTOP]
    await saveConfig({ scenes: { ...config.scenes, [STATE.DESKTOP]: { ...desktopScene, style } } })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const bg = style.background
  const fx = style.effects
  const pt = style.particles

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex gap-0.5 px-2 pt-2 pb-0 border-b border-zinc-700 bg-zinc-900 shrink-0">
        {STYLE_TABS.map(({ id, icon, label, desc }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            title={desc}
            className={`flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-t transition-colors border-b-2 -mb-px ${
              id === tab
                ? 'text-cyan-300 border-cyan-500 bg-zinc-800/60'
                : 'text-zinc-500 border-transparent hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <span className="opacity-60 text-[10px]">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
        <div className="flex-1" />
        {saving && <span className="text-[10px] text-zinc-600 self-center pb-1.5">saving…</span>}
        {saved  && <span className="text-[10px] text-emerald-400 self-center pb-1.5">✔ saved</span>}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* ── Background ── */}
        {tab === 'background' && (
          <>
            <div>
              <div className="text-xs text-zinc-400 mb-2 uppercase tracking-wider">Type</div>
              <div className="flex flex-wrap gap-1">
                {BG_TYPES.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => update((d) => { d.background.type = id })}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                      bg.type === id
                        ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40'
                        : 'text-zinc-400 hover:text-zinc-100 bg-zinc-800 border-zinc-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {bg.type === 'gradient' && (
              <div>
                <div className="text-xs text-zinc-400 mb-2 uppercase tracking-wider">Preset Gradients</div>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {GRADIENT_PRESETS.map((g) => (
                    <button
                      key={g.name}
                      onClick={() => update((d) => { d.background.gradient = g.value })}
                      className={`h-12 rounded text-xs font-medium transition-all ${
                        bg.gradient === g.value ? 'ring-2 ring-cyan-400' : 'hover:ring-1 hover:ring-zinc-400'
                      }`}
                      style={{ background: g.value }}
                      title={g.name}
                    >
                      <span className="text-white drop-shadow text-[10px]">{g.name}</span>
                    </button>
                  ))}
                </div>
                <div className="text-xs text-zinc-400 mb-1">Custom CSS gradient</div>
                <input
                  type="text"
                  value={bg.gradient}
                  onChange={(e) => update((d) => { d.background.gradient = e.target.value })}
                  placeholder="linear-gradient(135deg, #000 0%, #111 100%)"
                />
              </div>
            )}

            {bg.type === 'color' && (
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={bg.color}
                  onChange={(e) => update((d) => { d.background.color = e.target.value })}
                />
                <input
                  type="text"
                  value={bg.color}
                  onChange={(e) => update((d) => { d.background.color = e.target.value })}
                  className="font-mono"
                  style={{ width: 100 }}
                />
              </div>
            )}

            {bg.type === 'image-url' && (
              <div>
                <div className="text-xs text-zinc-400 mb-2 uppercase tracking-wider">Curated — Unsplash</div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {IMAGE_PRESETS.map((img) => (
                    <button
                      key={img.name}
                      onClick={() => update((d) => { d.background.imageUrl = img.url })}
                      className={`relative rounded overflow-hidden h-16 transition-all ${
                        bg.imageUrl === img.url ? 'ring-2 ring-cyan-400' : 'hover:ring-1 hover:ring-zinc-400'
                      }`}
                    >
                      <img src={img.thumb} alt={img.name} className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-black/30 flex items-end p-1">
                        <span className="text-[10px] text-white font-medium">{img.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="text-xs text-zinc-400 mb-1">Custom URL</div>
                <input
                  type="url"
                  value={bg.imageUrl}
                  onChange={(e) => update((d) => { d.background.imageUrl = e.target.value })}
                  placeholder="https://… (direct image URL)"
                />
                <div className="text-xs text-zinc-500 mt-1">
                  Free images: unsplash.com · pexels.com · pixabay.com
                </div>
              </div>
            )}

            {bg.type === 'video-url' && (
              <div>
                <div className="text-xs text-zinc-400 mb-1">Video URL (direct MP4/WebM)</div>
                <input
                  type="url"
                  value={bg.videoUrl}
                  onChange={(e) => update((d) => { d.background.videoUrl = e.target.value })}
                  placeholder="https://… (.mp4 or .webm)"
                />
                <div className="text-xs text-zinc-500 mt-2 space-y-1 bg-zinc-900 rounded p-2">
                  <div className="text-zinc-400 font-medium">Free looping videos:</div>
                  <div>pexels.com/videos — download or right-click video → copy URL</div>
                  <div>Place local files in <span className="font-mono text-zinc-300">ieom/assets/videos/</span> and use <span className="font-mono text-zinc-300">/assets/videos/file.mp4</span></div>
                </div>
              </div>
            )}

            {bg.type === 'pattern' && (
              <div>
                <div className="text-xs text-zinc-400 mb-2 uppercase tracking-wider">CSS Pattern (no external dep)</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(PATTERN_CSS) as PatternPreset[]).map((pat) => (
                    <button
                      key={pat}
                      onClick={() => update((d) => { d.background.pattern = pat })}
                      className={`h-14 rounded capitalize text-xs transition-all flex items-center justify-center ${
                        bg.pattern === pat ? 'ring-2 ring-cyan-400' : 'hover:ring-1 hover:ring-zinc-400'
                      }`}
                      style={pat === 'none' ? { backgroundColor: '#111' } : PATTERN_CSS[pat]}
                    >
                      <span className="text-white drop-shadow text-[10px] bg-black/40 px-1 rounded">{pat}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {bg.type !== 'none' && (
              <div className="space-y-1 pt-2 border-t border-zinc-700">
                <Slider label="Opacity" value={bg.opacity}
                  onChange={(v) => update((d) => { d.background.opacity = v })} />
                <Slider label="Blur" value={bg.blur} min={0} max={20} step={0.5} unit="px"
                  onChange={(v) => update((d) => { d.background.blur = v })} />
              </div>
            )}
          </>
        )}

        {/* ── Effects ── */}
        {tab === 'effects' && (
          <div className="space-y-3">
            <Panel title="CRT Scanlines">
              <Toggle checked={fx.crt} onChange={(v) => update((d) => { d.effects.crt = v })} label="Enable" />
              {fx.crt && <div className="mt-3"><Slider label="Intensity" value={fx.scanlineOpacity}
                onChange={(v) => update((d) => { d.effects.scanlineOpacity = v })} /></div>}
            </Panel>
            <Panel title="Film Grain">
              <Toggle checked={fx.noise} onChange={(v) => update((d) => { d.effects.noise = v })} label="Enable" />
              {fx.noise && <div className="mt-3"><Slider label="Grain intensity" value={fx.noiseOpacity}
                onChange={(v) => update((d) => { d.effects.noiseOpacity = v })} /></div>}
            </Panel>
            <Panel title="Vignette">
              <Toggle checked={fx.vignette} onChange={(v) => update((d) => { d.effects.vignette = v })} label="Enable" />
              {fx.vignette && <div className="mt-3"><Slider label="Strength" value={fx.vignetteStrength}
                onChange={(v) => update((d) => { d.effects.vignetteStrength = v })} /></div>}
            </Panel>
            <Panel title="Other">
              <div className="space-y-3">
                <Toggle checked={fx.flicker} onChange={(v) => update((d) => { d.effects.flicker = v })} label="Screen flicker" />
                <Toggle checked={fx.chromatic} onChange={(v) => update((d) => { d.effects.chromatic = v })} label="Chromatic aberration" />
              </div>
            </Panel>
          </div>
        )}

        {/* ── Particles ── */}
        {tab === 'particles' && (
          <div className="space-y-4">
            <Toggle checked={pt.enabled} onChange={(v) => update((d) => { d.particles.enabled = v })} label="Enable particles" />
            <div>
              <div className="text-xs text-zinc-400 mb-2 uppercase tracking-wider">Preset</div>
              <div className="grid grid-cols-3 gap-1.5">
                {PARTICLE_PRESETS.map((p) => (
                  <button key={p.id}
                    onClick={() => update((d) => { d.particles.preset = p.id; d.particles.enabled = p.id !== 'none' })}
                    className={`py-3 rounded text-sm border transition-colors flex flex-col items-center gap-1 ${
                      pt.preset === p.id
                        ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    <span className="text-lg">{p.icon}</span>
                    <span className="text-xs">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {pt.enabled && pt.preset !== 'none' && (
              <div className="space-y-1">
                <Slider label="Density" value={pt.density} onChange={(v) => update((d) => { d.particles.density = v })} />
                <Slider label="Speed"   value={pt.speed}   onChange={(v) => update((d) => { d.particles.speed   = v })} />
              </div>
            )}
          </div>
        )}

        {/* ── Typography ── */}
        {tab === 'typography' && (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-zinc-400 mb-2 uppercase tracking-wider">Font Family</div>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {GOOGLE_FONTS.map((f) => (
                  <button key={f.css}
                    onClick={() => update((d) => { d.fontFamily = f.css })}
                    className={`block w-full text-left px-3 py-1.5 rounded text-sm border transition-colors ${
                      style.fontFamily === f.css
                        ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800'
                    }`}
                    style={{ fontFamily: f.css === 'default' ? undefined : `"${f.css}", sans-serif` }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
              <div className="text-xs text-zinc-500 mt-1.5">Loaded from Google Fonts CDN.</div>
            </div>
            <div>
              <div className="text-xs text-zinc-400 mb-2 uppercase tracking-wider">Accent Color</div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {ACCENT_SWATCHES.map((c) => (
                  <button key={c} onClick={() => update((d) => { d.accentColor = c })}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      style.accentColor === c ? 'border-white scale-110' : 'border-transparent hover:border-zinc-400'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="color" value={style.accentColor}
                  onChange={(e) => update((d) => { d.accentColor = e.target.value })}
                  style={{ width: 40, height: 32 }} />
                <input type="text" value={style.accentColor}
                  onChange={(e) => update((d) => { d.accentColor = e.target.value })}
                  className="font-mono" style={{ width: 90 }} />
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-400 mb-2 uppercase tracking-wider">Text Color</div>
              <div className="flex items-center gap-2">
                <input type="color" value={style.textColor}
                  onChange={(e) => update((d) => { d.textColor = e.target.value })}
                  style={{ width: 40, height: 32 }} />
                <input type="text" value={style.textColor}
                  onChange={(e) => update((d) => { d.textColor = e.target.value })}
                  className="font-mono" style={{ width: 90 }} />
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

// -- LobbyConfigEditor --------------------------------------------------
function LobbyConfigEditor() {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const DEFAULT_LOBBY_ENV: LobbyConfig = {
    ambientColor: '#1e1a3a', ambientIntensity: 0.28,
    fogColor: '#080810', fogNear: 6, fogFar: 22,
    wallColor: '#0f0f16', floorColor: '#0d0d14', floorReflectivity: 0.6,
    crtGlowColor: '#00c8e0',
    neonStrips: true, neonColors: ['#00c8ff', '#8000ff'],
    dustMotes: true, cameraFov: 62, starsCount: 400,
  }
  const [form, setForm] = useState<LobbyConfig>(() =>
    structuredClone((config.scenes[STATE.LOBBY] as { lobbyConfig?: LobbyConfig } | undefined)?.lobbyConfig ?? DEFAULT_LOBBY_ENV)
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
        const lobbyScene = { ...config.scenes[STATE.LOBBY], lobbyConfig: next }
        await saveConfig({ scenes: { ...config.scenes, [STATE.LOBBY]: lobbyScene } })
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
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-8 h-7 shrink-0" />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="font-mono flex-1" />
    </div>
  )

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">3D Room Environment</div>
        <div className="flex gap-1.5 text-[10px]">
          {saving && <span className="text-zinc-600">saving…</span>}
          {saved  && <span className="text-emerald-400">✔ saved</span>}
        </div>
      </div>

      <Panel title="Ambient Light">
        <ColorRow label="" value={form.ambientColor} onChange={(v) => update((d) => { d.ambientColor = v })} />
        <Slider label="Intensity" value={form.ambientIntensity} min={0} max={2} step={0.01}
          onChange={(v) => update((d) => { d.ambientIntensity = v })} />
      </Panel>

      <Panel title="Fog">
        <ColorRow label="" value={form.fogColor} onChange={(v) => update((d) => { d.fogColor = v })} />
        <Slider label="Near" value={form.fogNear} min={1} max={20} step={0.5}
          onChange={(v) => update((d) => { d.fogNear = v })} />
        <Slider label="Far" value={form.fogFar} min={5} max={60} step={1}
          onChange={(v) => update((d) => { d.fogFar = v })} />
      </Panel>

      <Panel title="Room Surfaces">
        <ColorRow label="Walls" value={form.wallColor} onChange={(v) => update((d) => { d.wallColor = v })} />
        <ColorRow label="Floor" value={form.floorColor} onChange={(v) => update((d) => { d.floorColor = v })} />
        <Slider label="Floor reflectivity" value={form.floorReflectivity} min={0} max={1} step={0.05}
          onChange={(v) => update((d) => { d.floorReflectivity = v })} />
      </Panel>

      <Panel title="CRT Monitor Glow">
        <ColorRow label="" value={form.crtGlowColor} onChange={(v) => update((d) => { d.crtGlowColor = v })} />
      </Panel>

      <Panel title="Neon Strips">
        <Toggle checked={form.neonStrips} onChange={(v) => update((d) => { d.neonStrips = v })} label="Enabled" />
        {form.neonStrips && (
          <div className="mt-2 space-y-1">
            <ColorRow label="Strip 1" value={form.neonColors[0]}
              onChange={(v) => update((d) => { d.neonColors = [v, d.neonColors[1]] })} />
            <ColorRow label="Strip 2" value={form.neonColors[1]}
              onChange={(v) => update((d) => { d.neonColors = [d.neonColors[0], v] })} />
          </div>
        )}
      </Panel>

      <Panel title="Atmosphere">
        <Toggle checked={form.dustMotes} onChange={(v) => update((d) => { d.dustMotes = v })} label="Floating dust motes" />
        <div className="mt-2 space-y-1">
          <Slider label="Camera FOV" value={form.cameraFov} min={30} max={120} step={1}
            onChange={(v) => update((d) => { d.cameraFov = v })} />
          <Slider label="Star count" value={form.starsCount} min={0} max={2000} step={50}
            onChange={(v) => update((d) => { d.starsCount = v })} />
        </div>
      </Panel>
    </div>
  )
}

// -- AppInspector --------------------------------------------------------
function AppInspector({ app }: { app: Application | null }) {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const [form, setForm] = useState<Application | null>(app)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setForm(app) }, [app])

  if (!form) return (
    <div className="p-4 text-zinc-500 text-sm italic">Click an application to inspect it.</div>
  )

  const autoSave = (updated: Application) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const apps = [...config.applications]
      const idx  = apps.findIndex((a) => a.id === updated.id)
      if (idx !== -1) apps[idx] = updated; else apps.push(updated)
      saveConfig({ applications: apps })
    }, 400)
  }

  const update = (updater: (d: Application) => void) => {
    const next = { ...form }
    updater(next)
    setForm(next)
    autoSave(next)
  }

  return (
    <div className="p-3 space-y-3">
      <div>
        <div className="text-xs text-zinc-400 mb-1 uppercase tracking-wider">Name</div>
        <input type="text" value={form.label}
          onChange={(e) => update((d) => { d.label = e.target.value })}
          className="w-full" />
      </div>
      <div>
        <div className="text-xs text-zinc-400 mb-1 uppercase tracking-wider">Icon (emoji or URL)</div>
        <input type="text" value={form.icon}
          onChange={(e) => update((d) => { d.icon = e.target.value })}
          className="w-full font-mono" />
      </div>
      <div>
        <div className="text-xs text-zinc-400 mb-1 uppercase tracking-wider">Target Scene</div>
        <select value={form.targetSceneId}
          onChange={(e) => update((d) => { d.targetSceneId = e.target.value })}
          className="w-full">
          {[STATE.GAMEPLAY, STATE.TV, STATE.MUSIC, STATE.ARCHIVE].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="text-xs text-zinc-400 mb-1 uppercase tracking-wider">Intro Transition</div>
        <div className="text-[10px] text-zinc-600 mb-1.5">Desktop → this app (entering)</div>
        <select value={form.introTransition ?? ''}
          onChange={(e) => update((d) => { d.introTransition = e.target.value || undefined })}
          className="w-full">
          <option value="">— Use default —</option>
          {TRANSITION_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="text-xs text-zinc-400 mb-1 uppercase tracking-wider">Exit Transition</div>
        <div className="text-[10px] text-zinc-600 mb-1.5">This app → Desktop (leaving)</div>
        <select value={form.exitTransition ?? ''}
          onChange={(e) => update((d) => { d.exitTransition = e.target.value || undefined })}
          className="w-full">
          <option value="">— Use default —</option>
          {TRANSITION_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>
          ))}
        </select>
      </div>
      <div className="pt-2 border-t border-zinc-800">
        <button
          onClick={() => {
            const apps = config.applications.filter((a) => a.id !== form.id)
            saveConfig({ applications: apps })
          }}
          className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded border border-red-900/50 hover:border-red-700"
        >
          Remove Application
        </button>
      </div>
    </div>
  )
}

// -- EventInspector -------------------------------------------------------
function EventInspector({ event }: { event: OVERLAY_EVENT | null }) {
  if (!event) return (
    <div className="p-4 text-zinc-500 text-sm italic">Click an event to inspect it.</div>
  )
  const def = EVENT_DEFS.find((e) => e.event === event)
  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{def?.icon}</span>
        <div>
          <div className="text-sm font-bold text-zinc-100">{def?.label}</div>
          <div className="text-xs text-zinc-500 font-mono">{event}</div>
        </div>
      </div>
      <button
        onClick={() => socket.emit('overlay:trigger', event)}
        className="w-full px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 text-xs font-mono tracking-wider text-zinc-100 transition-colors"
      >
        ▶ Fire Now
      </button>
      <div className="border-t border-zinc-800 pt-3 space-y-1">
        <div className="text-xs text-zinc-400 uppercase tracking-wider">Trigger Type</div>
        <div className="text-sm text-zinc-300">Manual / Hotkey</div>
        <div className="text-xs text-zinc-600 italic pt-1">
          Full event configuration (animation, SFX, text overrides) coming soon.
        </div>
      </div>
    </div>
  )
}

// -- SceneInspector -------------------------------------------------------
type SceneTab = 'sources' | 'style' | 'env-3d'

function SceneInspector({ scene }: { scene: STATE | null }) {
  const config = useAdminStore((s) => s.config)
  const [tab, setTab] = useState<SceneTab>(() =>
    scene === STATE.LOBBY ? 'env-3d' : 'sources'
  )

  useEffect(() => {
    setTab(scene === STATE.LOBBY ? 'env-3d' : 'sources')
  }, [scene])

  if (!scene) return (
    <div className="p-4 text-zinc-500 text-sm italic">Select a scene from the left panel.</div>
  )
  const sceneConfig = (config.scenes as Record<string, { sources?: { id: string; pluginType: string; visible: boolean }[]; backgroundOpaque?: boolean }>)[scene]
  if (!sceneConfig) return <div className="p-4 text-zinc-500 text-sm">Scene not configured.</div>
  const sources = sceneConfig.sources ?? []

  const tabDefs: { id: SceneTab; label: string }[] =
    scene === STATE.LOBBY
      ? [{ id: 'env-3d', label: '3D Environment' }, { id: 'sources', label: 'Sources' }]
      : scene === STATE.DESKTOP
        ? [{ id: 'sources', label: 'Sources' }, { id: 'style', label: 'Style' }]
        : [{ id: 'sources', label: 'Sources' }]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex gap-0.5 px-2 pt-2 pb-0 border-b border-zinc-700 bg-zinc-900 shrink-0">
        {tabDefs.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-1.5 text-[11px] rounded-t transition-colors border-b-2 -mb-px ${
              id === tab
                ? 'text-cyan-300 border-cyan-500 bg-zinc-800/60'
                : 'text-zinc-500 border-transparent hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >{label}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'sources' && (
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Sources</span>
              <span className="text-[10px] text-zinc-600 font-mono">{sources.length} plugin{sources.length !== 1 ? 's' : ''}</span>
            </div>
            <p className="text-[10px] text-zinc-600 leading-snug mb-2">
              Plugin instances rendered on this scene — text widgets, image slideshows, CRT effects, etc.
            </p>
            {sources.length === 0 ? (
              <div className="text-[10px] text-zinc-700 italic p-2.5 bg-zinc-800/40 rounded border border-zinc-800">
                No sources added yet. Use the Source Library to add plugins to this scene.
              </div>
            ) : (
              <div className="space-y-1">
                {sources.map((src) => (
                  <div key={src.id} className="flex items-center gap-2 px-2.5 py-2 rounded bg-zinc-800/60 border border-zinc-700/60 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${src.visible ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    <span className="text-zinc-300 flex-1 font-mono text-[11px] truncate">{src.id}</span>
                    <span className="text-[10px] text-zinc-600 shrink-0 px-1.5 py-0.5 bg-zinc-900 rounded font-mono">{src.pluginType}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === 'style'  && <StyleEditor />}
        {tab === 'env-3d' && <LobbyConfigEditor />}
      </div>
    </div>
  )
}

// -- Inspector ------------------------------------------------------------
function Inspector({ view, selectedScene, selectedApp, selectedEvent, onViewChange }: {
  view: InspectorView
  selectedScene: STATE | null
  selectedApp: Application | null
  selectedEvent: OVERLAY_EVENT | null
  onViewChange: (v: InspectorView) => void
}) {
  const def   = INSPECTOR_DEFS[view] ?? { title: view, desc: '' }
  const title = view === 'scene'       && selectedScene ? `${def.title} · ${selectedScene}`
              : view === 'application' && selectedApp   ? `${def.title} · ${selectedApp.label}`
              : def.title
  return (
    <div className="w-80 shrink-0 bg-zinc-900 border-l border-zinc-800 flex flex-col overflow-hidden">
      <div className="px-3 pt-2.5 pb-2 border-b border-zinc-800 shrink-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-[11px] text-zinc-200 uppercase tracking-widest font-bold leading-snug">{title}</span>
        </div>
        {def.desc && <p className="text-[10px] text-zinc-600 leading-snug">{def.desc}</p>}
      </div>
      <div className="flex-1 overflow-y-auto">
        {view === 'scene'         && <SceneInspector scene={selectedScene} />}
        {view === 'application'   && <AppInspector app={selectedApp} />}
        {view === 'event-detail'  && <EventInspector event={selectedEvent} />}
        {view === 'auto-events'   && <EventsPanel />}
        {view === 'audio'         && <AudioPanel />}
        {view === 'archive'       && <ArchivePanel />}
        {view === 'keybinds'      && <KeybindEditor />}
        {view === 'settings'      && <SettingsPage />}
      </div>
    </div>
  )
}

// -- PreviewColumn --------------------------------------------------------
function PreviewColumn() {
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef     = useRef<HTMLIFrameElement>(null)
  const obsConnected = useAdminStore((s) => s.obsConnected)
  const currentState = useAdminStore((s) => s.currentState)
  const lastError    = useAdminStore((s) => s.lastError)

  useEffect(() => {
    const scale = () => {
      const c = containerRef.current
      const f = frameRef.current
      if (!c || !f) return
      const s = Math.min(c.clientWidth / 1920, c.clientHeight / 1080)
      f.style.transform       = `scale(${s})`
      f.style.transformOrigin = 'top left'
      f.style.marginLeft      = `${(c.clientWidth  - 1920 * s) / 2}px`
      f.style.marginTop       = `${(c.clientHeight - 1080 * s) / 2}px`
    }
    scale()
    const ro = new ResizeObserver(scale)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <div ref={containerRef} className="relative flex-1 bg-black overflow-hidden">
        <iframe
          ref={frameRef}
          src="http://localhost:3001/"
          width={1920}
          height={1080}
          style={{ position: 'absolute', border: 'none', display: 'block' }}
          title="Overlay Preview"
        />
      </div>
      <div className="flex items-center gap-4 px-3 py-1.5 bg-zinc-900 border-t border-zinc-800 text-xs shrink-0">
        <span className={obsConnected ? 'text-emerald-400' : 'text-zinc-600'}>
          {obsConnected ? '\u25cf OBS Connected' : '\u25cb OBS Disconnected'}
        </span>
        <span className="text-cyan-400 font-mono">{currentState}</span>
        {lastError && <span className="text-red-400 truncate">{lastError}</span>}
        <span className="flex-1" />
        <span className="text-zinc-600 font-mono text-[10px]">localhost:3001 &middot; 1920x1080</span>
      </div>
    </div>
  )
}

// -- ControlPanel ---------------------------------------------------------
function ControlPanel({ view, selectedScene, selectedApp, selectedEvent, onViewChange, onSceneSelect, onAppSelect, onEventSelect }: {
  view: InspectorView
  selectedScene: STATE | null
  selectedApp: Application | null
  selectedEvent: OVERLAY_EVENT | null
  onViewChange: (v: InspectorView) => void
  onSceneSelect: (s: STATE) => void
  onAppSelect: (app: Application) => void
  onEventSelect: (event: OVERLAY_EVENT) => void
}) {
  const currentState = useAdminStore((s) => s.currentState)
  const setLastError = useAdminStore((s) => s.setLastError)
  const saveConfig   = useAdminStore((s) => s.saveConfig)
  const applications = useAdminStore((s) => s.config.applications)

  const triggerScene = (state: STATE) => {
    setLastError(null)
    socket.emit('scene:change', state, (err: string | null) => { if (err) setLastError(err) })
  }

  return (
    <div className="flex flex-col w-60 shrink-0 bg-zinc-900 border-r border-zinc-800 overflow-y-auto">

      {/* ── Scenes ───────────────────────────────── */}
      <div className="p-2 pt-3">
        <SectionHeader label="Scenes" desc="Hardcoded broadcast states — click to switch and inspect" />
        {SCENE_DEFS.map(({ label, state, icon }) => {
          const isActive   = currentState === state
          const isSelected = selectedScene === state && view === 'scene'
          return (
            <div
              key={state}
              onClick={() => { triggerScene(state); onSceneSelect(state) }}
              title={`Switch to ${label} and inspect`}
              className={`flex items-center gap-2 px-2.5 py-2 rounded cursor-pointer transition-colors mb-0.5 border ${
                isSelected
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25'
                  : isActive
                    ? 'text-emerald-200 bg-emerald-950/20 border-emerald-900/40'
                    : 'text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 border-transparent'
              }`}
            >
              <span className="text-sm shrink-0">{icon}</span>
              <span className="flex-1 font-mono text-xs font-semibold tracking-wide">{label}</span>
              {isActive && (
                <span className="text-[9px] text-emerald-400 font-bold tracking-widest shrink-0">LIVE</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="mx-2 border-t border-zinc-800/80" />

      {/* ── Applications ─────────────────────────── */}
      <div className="p-2 pt-2.5">
        <SectionHeader
          label="Applications"
          desc="Win98 .exe shortcuts — click to launch and inspect"
        />
        <div className="space-y-0.5">
          {applications.map((app) => {
            const isActive     = currentState === app.targetSceneId
            const isSelected   = selectedApp?.id === app.id && view === 'application'
            const needsDesktop = !isActive && currentState !== STATE.DESKTOP
            return (
              <div
                key={app.id}
                onClick={() => { socket.emit('scene:change', app.targetSceneId); onAppSelect(app) }}
                title={`Launch ${app.label} → ${app.targetSceneId}`}
                className={`flex items-center gap-2 px-2.5 py-2 rounded cursor-pointer transition-colors mb-0.5 border ${
                  isSelected
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25'
                    : isActive
                      ? 'text-emerald-200 bg-emerald-950/20 border-emerald-900/40'
                      : 'text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 border-transparent'
                }`}
              >
                <span className="text-sm shrink-0">{app.icon}</span>
                <span className="flex-1 font-mono text-xs font-semibold tracking-wide truncate">{app.label}</span>
                {isActive    && <span className="text-[9px] text-emerald-400 font-bold tracking-widest shrink-0">LIVE</span>}
                {needsDesktop && <span className="text-[8px] text-amber-500 font-bold tracking-wider shrink-0">DESKTOP</span>}
              </div>
            )
          })}
        </div>
        <button
          onClick={() => {
            const newApp: Application = {
              id: `app-${Date.now()}`,
              label: 'New App',
              icon: '📁',
              targetSceneId: STATE.GAMEPLAY,
              transitionType: 'desktop-to-gameplay',
            }
            saveConfig({ applications: [...applications, newApp] })
            onAppSelect(newApp)
          }}
          className="w-full mt-1.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 border border-dashed border-zinc-700/60 hover:border-zinc-500 transition-colors"
        >
          <span>+</span>
          <span>New Application</span>
        </button>
      </div>

      <div className="mx-2 border-t border-zinc-800/80" />

      {/* ── Events ───────────────────────────────── */}
      <div className="p-2 pt-2.5">
        <SectionHeader label="Events" desc="Click to fire and inspect" />
        <div className="space-y-0.5">
          {EVENT_DEFS.map(({ label, event, icon, color }) => {
            const isSelected = selectedEvent === event && view === 'event-detail'
            return (
              <div
                key={event}
                onClick={() => { socket.emit('overlay:trigger', event); onEventSelect(event) }}
                className={`flex items-center gap-2 px-2.5 py-2 rounded cursor-pointer transition-colors border ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-500/25'
                    : 'hover:bg-zinc-800 border-transparent'
                } ${color}`}
              >
                <span className="text-sm shrink-0">{icon}</span>
                <span className="flex-1 font-mono text-xs font-semibold tracking-wide">{label}</span>
                <span className="text-[9px] text-zinc-600">▶</span>
              </div>
            )
          })}
        </div>
        <button
          disabled
          className="w-full mt-1.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-zinc-700 border border-dashed border-zinc-800 cursor-not-allowed"
        >
          <span>+</span>
          <span>New Event</span>
        </button>
      </div>

      <div className="mx-2 border-t border-zinc-800/80" />

      <div className="flex-1" />

      {/* ── Studio ───────────────────────────────── */}
      <div className="border-t border-zinc-800 px-2 py-2">
        <div className="text-[9px] text-zinc-700 uppercase tracking-wider px-1 mb-1.5 font-semibold">Studio</div>
        {([
          { id: 'audio'       as InspectorView, icon: '🔊', label: 'Audio'       },
          { id: 'auto-events' as InspectorView, icon: '⚡', label: 'Auto-Events' },
          { id: 'keybinds'    as InspectorView, icon: '⌨', label: 'Keybinds'    },
          { id: 'archive'     as InspectorView, icon: '📁', label: 'Archive'     },
          { id: 'settings'    as InspectorView, icon: '⚙', label: 'Settings'    },
        ] as { id: InspectorView; icon: string; label: string }[]).map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-xs transition-colors border mb-0.5 ${
              view === id
                ? 'bg-zinc-700/80 text-zinc-100 border-zinc-600'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 border-transparent'
            }`}
          >
            <span className="text-sm leading-none w-4 text-center">{icon}</span>
            <span className="font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// -- TopBar ---------------------------------------------------------------
function TopBar() {
  const obsConnected = useAdminStore((s) => s.obsConnected)
  const currentState = useAdminStore((s) => s.currentState)
  return (
    <div className="flex items-center gap-3 px-3 h-10 bg-zinc-900 border-b border-zinc-800 shrink-0">
      <span className="text-cyan-400 font-bold font-mono text-sm tracking-widest">IEOM</span>
      <div className="w-px h-4 bg-zinc-700" />
      <span className={`text-xs font-mono ${obsConnected ? 'text-emerald-400' : 'text-zinc-600'}`}>
        {obsConnected ? '\u25cf OBS' : '\u25cb OBS'}
      </span>
      <span className="text-xs font-mono text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded">{currentState}</span>
      <div className="flex-1" />
      <button
        onClick={() => socket.emit('panic')}
        className="px-3 py-1 rounded bg-red-900 hover:bg-red-700 border border-red-800 text-white text-xs font-bold tracking-widest transition-colors"
      >
        PANIC
      </button>
    </div>
  )
}

// -- Dashboard (Studio root) ----------------------------------------------
export function Dashboard() {
  const [view, setView]                   = useState<InspectorView>('audio')
  const [selectedScene, setSelectedScene] = useState<STATE | null>(null)
  const [selectedApp, setSelectedApp]     = useState<Application | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<OVERLAY_EVENT | null>(null)

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <ControlPanel
          view={view}
          selectedScene={selectedScene}
          selectedApp={selectedApp}
          selectedEvent={selectedEvent}
          onViewChange={setView}
          onSceneSelect={(s) => { setSelectedScene(s); setView('scene') }}
          onAppSelect={(app) => { setSelectedApp(app); setView('application') }}
          onEventSelect={(event) => { setSelectedEvent(event); setView('event-detail') }}
        />
        <PreviewColumn />
        <Inspector
          view={view}
          selectedScene={selectedScene}
          selectedApp={selectedApp}
          selectedEvent={selectedEvent}
          onViewChange={setView}
        />
      </div>
    </div>
  )
}
