import { useEffect, useRef, useState, useCallback } from 'react'
import { STATE, OVERLAY_EVENT } from '@ieom/shared'
import type { OverlayStyle, BackgroundType, PatternPreset, ParticlePreset } from '@ieom/shared'
import { socket } from '../socket/client'
import { useAdminStore } from '../store/useAdminStore'
import { Panel, Btn, Toggle, Slider } from './ui'

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

// ── Scene / Overlay controls ───────────────────────────────────────

const SCENE_BTNS: { label: string; state: STATE }[] = [
  { label: 'Lobby',    state: STATE.LOBBY },
  { label: 'Gameplay', state: STATE.GAMEPLAY },
  { label: 'TV Mode',  state: STATE.TV },
  { label: 'Music',    state: STATE.MUSIC },
  { label: 'Archive',  state: STATE.ARCHIVE },
]

const OVERLAY_BTNS: { label: string; event: OVERLAY_EVENT }[] = [
  { label: '💀 Death',   event: OVERLAY_EVENT.DEATH },
  { label: '🏆 Victory', event: OVERLAY_EVENT.VICTORY },
  { label: '❤ Revive',  event: OVERLAY_EVENT.REVIVE },
  { label: '📡 Glitch',  event: OVERLAY_EVENT.NETWORK_GLITCH },
]

// ── PreviewPanel ───────────────────────────────────────────────────

function PreviewPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef     = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const scale = () => {
      const c = containerRef.current
      const f = frameRef.current
      if (!c || !f) return
      const s = Math.min(c.clientWidth / 1920, c.clientHeight / 1080)
      f.style.transform = `scale(${s})`
      f.style.transformOrigin = 'top left'
      f.style.marginLeft = `${(c.clientWidth  - 1920 * s) / 2}px`
      f.style.marginTop  = `${(c.clientHeight - 1080 * s) / 2}px`
    }
    scale()
    const ro = new ResizeObserver(scale)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="relative flex-1 bg-black overflow-hidden rounded-lg border border-zinc-700">
      <iframe
        ref={frameRef}
        src="http://localhost:3001/"
        width={1920}
        height={1080}
        style={{ position: 'absolute', border: 'none', display: 'block' }}
        title="Overlay Preview"
      />
    </div>
  )
}

// ── StyleEditor ────────────────────────────────────────────────────

type StyleTab = 'background' | 'effects' | 'particles' | 'typography'

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
  const [style, setStyle] = useState<OverlayStyle>(() => structuredClone(config.overlayStyle))
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setStyle(structuredClone(config.overlayStyle))
  }, [config.overlayStyle])

  const update = useCallback((updater: (draft: OverlayStyle) => void) => {
    setStyle((prev) => {
      const next = structuredClone(prev)
      updater(next)
      // Auto-apply after 600 ms idle — use next not prev
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        setSaving(true)
        await saveConfig({ overlayStyle: next })
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      }, 600)
      return next
    })
    setSaved(false)
  }, [saveConfig])

  const save = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(true)
    await saveConfig({ overlayStyle: style })
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
      <div className="flex gap-1 p-2 border-b border-zinc-700 bg-zinc-900 shrink-0">
        {(['background', 'effects', 'particles', 'typography'] as StyleTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-2.5 py-1 text-xs rounded capitalize transition-colors ${
              t === tab
                ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-transparent'
            }`}
          >
            {t}
          </button>
        ))}
        <div className="flex-1" />
        {saving && <span className="text-xs text-zinc-500 self-center">saving…</span>}
        {saved  && <span className="text-xs text-emerald-400 self-center">✔</span>}
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

      {/* Apply bar */}
      <div className="p-2 border-t border-zinc-700 shrink-0">
        <Btn variant="primary" className="w-full justify-center" onClick={save} disabled={saving}>
          {saving ? 'Applying…' : saved ? '✔ Applied' : '▶ Apply to Overlay'}
        </Btn>
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────

export function Dashboard() {
  const currentState = useAdminStore((s) => s.currentState)
  const obsConnected = useAdminStore((s) => s.obsConnected)
  const lastError    = useAdminStore((s) => s.lastError)
  const setLastError = useAdminStore((s) => s.setLastError)

  const changeScene = (target: STATE) => {
    setLastError(null)
    socket.emit('scene:change', target, (err: string | null) => {
      if (err) setLastError(err)
    })
  }

  return (
    <div className="flex gap-3" style={{ height: 'calc(100vh - 2rem)' }}>

      {/* Left — controls */}
      <div className="flex flex-col gap-3 w-52 shrink-0">
        <Panel title="System Status">
          <div className="text-sm">Scene: <span className="text-cyan-400 font-mono font-bold">{currentState}</span></div>
          <div className="text-sm mt-1.5">
            OBS: <span className={obsConnected ? 'text-emerald-400' : 'text-red-500'}>
              {obsConnected ? '● Connected' : '○ Disconnected'}
            </span>
          </div>
          {lastError && <div className="mt-2 text-xs text-red-400 bg-red-950/40 rounded px-2 py-1">⚠ {lastError}</div>}
        </Panel>

        <Panel title="Scene Switcher">
          <div className="flex flex-col gap-1">
            {SCENE_BTNS.map(({ label, state }) => (
              <button key={state} onClick={() => changeScene(state)}
                className={`px-3 py-1.5 rounded text-sm text-left transition-colors font-medium ${
                  currentState === state
                    ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40'
                    : 'bg-zinc-700/60 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Overlay Events">
          <div className="grid grid-cols-2 gap-1">
            {OVERLAY_BTNS.map(({ label, event }) => (
              <button key={event} onClick={() => socket.emit('overlay:trigger', event)}
                className="px-2 py-1.5 rounded text-xs bg-zinc-700/60 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </Panel>

        <button onClick={() => socket.emit('panic')}
          className="py-3 rounded bg-red-900 hover:bg-red-700 border border-red-800 text-white font-bold text-sm tracking-widest transition-colors">
          ⚠ PANIC (Esc)
        </button>

        <Panel title="Hotkeys">
          <div className="text-xs text-zinc-400 space-y-0.5 font-mono">
            <div>F1 Lobby · F2 Gameplay</div>
            <div>F3 TV · F4 Music · F5 Archive</div>
            <div>D Death · V Victory · R Revive</div>
          </div>
        </Panel>
      </div>

      {/* Center — Live preview */}
      <div className="flex flex-col flex-1 min-w-0 gap-2">
        <div className="text-xs text-zinc-500 font-mono">
          LIVE PREVIEW <span className="text-zinc-400">localhost:3001</span> · 1920×1080
        </div>
        <PreviewPanel />
      </div>

      {/* Right — Style editor */}
      <div className="flex flex-col w-72 shrink-0 rounded-lg bg-zinc-900 border border-zinc-700 overflow-hidden">
        <div className="px-3 py-2 bg-zinc-800 border-b border-zinc-700 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Overlay Style
        </div>
        <StyleEditor />
      </div>

    </div>
  )
}

