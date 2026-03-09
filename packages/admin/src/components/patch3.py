#!/usr/bin/env python3
"""Patch Dashboard.tsx — multi-effect stacking, persistence, uniform events, media overlay."""
import sys

FILE = '/mnt/c/projects/stream/ieom/packages/admin/src/components/Dashboard.tsx'

with open(FILE, 'r', encoding='utf-8') as f:
    src = f.read()

# ── 1: Update imports ─────────────────────────────────────────────────────────
old = "import { STATE, OVERLAY_EVENT, type EffectConfig, type EffectType } from '@ieom/shared'"
new  = "import { STATE, DEFAULT_CONFIG, type EffectConfig, type EffectType, type EventConfig } from '@ieom/shared'"
assert src.count(old) == 1, 'PATCH 1'
src = src.replace(old, new, 1)
print('✓ 1: imports')

# ── 2: Replace type AutoTrigger + type EventDef ───────────────────────────────
old = """\
type AutoTrigger = { enabled: boolean; mode: 'interval' | 'idle'; intervalMin: number; idleMin: number }
type EventDef    = { id: string; label: string; icon: string; color: string; desc: string; builtIn?: boolean; auto: AutoTrigger; effect: EffectConfig | null }"""
new  = "// EventConfig is imported from @ieom/shared — id, label, icon, color, desc, effects[], auto"
assert src.count(old) == 1, 'PATCH 2'
src = src.replace(old, new, 1)
print('✓ 2: remove local EventDef')

# ── 3: Remove DEFAULT_EVENT_DEFS block (lines 105–115) ───────────────────────
# Find start of the block
idx_start = src.find('\nconst DEFAULT_EVENT_DEFS: EventDef[] = [')
assert idx_start != -1, 'PATCH 3 start'
idx_end = src.find('\n]', idx_start) + 2
old_block = src[idx_start:idx_end]
src = src[:idx_start] + src[idx_end:]
print('✓ 3: remove DEFAULT_EVENT_DEFS')

# ── 4: Replace EFFECT_CATALOG + makeDefaultEffect with updated version ────────
idx_catalog = src.find('\nconst EFFECT_CATALOG:')
idx_make_end = src.find('\n// ── Selected item union', idx_catalog)
assert idx_catalog != -1 and idx_make_end != -1, 'PATCH 4'

NEW_CATALOG = """
// ── Effect catalog ────────────────────────────────────────────────

const EFFECT_CATALOG: { type: EffectType; icon: string; label: string; desc: string; group: string }[] = [
  // Built-in animation wrappers
  { type: 'death-overlay',   icon: '💀', label: 'DEATH',         desc: 'YOU DIED — red vignette fill',                  group: 'Built-in' },
  { type: 'victory-overlay', icon: '🏆', label: 'VICTORY',       desc: 'Win98 dialog: MISSION.LOG saved',               group: 'Built-in' },
  { type: 'revive-overlay',  icon: '❤',  label: 'REVIVE',        desc: 'Terminal: Restarting process...',               group: 'Built-in' },
  // Configurable effects
  { type: 'notification-box', icon: '🗒', label: 'Notification', desc: 'Win98 dialog window, auto-dismisses',           group: 'Visual'   },
  { type: 'terminal-toast',   icon: '💬', label: 'Terminal',     desc: '[SERVER]: messages print at screen edge',       group: 'Visual'   },
  { type: 'floaties',         icon: '✨',  label: 'Floaties',     desc: 'Glowing symbols drift across the screen',      group: 'Visual'   },
  { type: 'corruption-burst', icon: '⚡',  label: 'Corruption',  desc: 'Glitch rects + scanline sweep',                group: 'Visual'   },
  { type: 'network-glitch',   icon: '📡', label: 'Net Glitch',   desc: 'Screen artifact + interruption banner',        group: 'Visual'   },
  { type: 'vignette-pulse',   icon: '🔴', label: 'Vignette',     desc: 'Color vignette floods screen, optional text',  group: 'Visual'   },
  { type: 'screen-shake',     icon: '💥', label: 'Screen Shake', desc: 'Camera shake only, no overlay',                group: 'Camera'   },
  { type: 'typewriter',       icon: '⌨',  label: 'Typewriter',   desc: 'Text types itself at chosen position',         group: 'Camera'   },
  { type: 'static-burst',     icon: '📺', label: 'Static',       desc: 'TV static noise flash',                        group: 'Camera'   },
  // Media overlays
  { type: 'image-overlay', icon: '🖼', label: 'Image Overlay', desc: 'PNG/APNG with transparency over screen',         group: 'Media'    },
  { type: 'video-overlay', icon: '🎬', label: 'Video Overlay', desc: 'WebM with alpha channel over screen',            group: 'Media'    },
]

// Named multi-effect preset sequences
const EFFECT_PRESETS: { icon: string; label: string; desc: string; effects: EffectConfig[] }[] = [
  { icon: '💀',  label: 'Epic Death',    desc: 'Death + heavy screen shake',                      effects: [{ type: 'death-overlay', cfg: {} }, { type: 'screen-shake', cfg: { intensity: 'heavy', duration: 0.5 }, delay: 0.1 }] },
  { icon: '⚡',  label: 'Haunted',       desc: 'Corruption burst + eerie typewriter',             effects: [{ type: 'corruption-burst', cfg: { intensity: 'high', duration: 3 } }, { type: 'typewriter', cfg: { text: 'ERROR: GHOST IN THE MACHINE', position: 'center', color: '#00ff41', fontSize: 26, duration: 5 }, delay: 0.5 }] },
  { icon: '📡', label: 'Broadcast',      desc: 'Network glitch + terminal toast',                 effects: [{ type: 'network-glitch', cfg: { message: '[ BROADCAST INCOMING ]', duration: 2 } }, { type: 'terminal-toast', cfg: { messages: ['[BROADCAST]: incoming transmission'], duration: 6, position: 'bottom-left' }, delay: 0.5 }] },
  { icon: '🔴', label: 'Warning Flash',  desc: 'Red vignette + screen shake',                    effects: [{ type: 'vignette-pulse', cfg: { color: '#ff0000', opacity: 0.7, duration: 2, text: '' } }, { type: 'screen-shake', cfg: { intensity: 'medium', duration: 0.4 } }] },
  { icon: '📺', label: 'Channel Static', desc: 'Static burst only',                              effects: [{ type: 'static-burst', cfg: { opacity: 0.85, duration: 1.2 } }] },
  { icon: '🖥',  label: 'System Alert',  desc: 'Win98 notification + light shake',               effects: [{ type: 'notification-box', cfg: { title: 'SYSTEM ALERT', body: '', icon: '⚠', autoDismiss: 5 } }, { type: 'screen-shake', cfg: { intensity: 'light', duration: 0.3 } }] },
]

function makeDefaultEffect(type: EffectType): EffectConfig {
  switch (type) {
    case 'death-overlay':    return { type, cfg: {} }
    case 'victory-overlay':  return { type, cfg: {} }
    case 'revive-overlay':   return { type, cfg: {} }
    case 'notification-box': return { type, cfg: { title: 'NOTIFICATION', body: '', icon: '🖥', autoDismiss: 5 } }
    case 'terminal-toast':   return { type, cfg: { messages: ['[SERVER]: event triggered'], duration: 5, position: 'bottom-left' } }
    case 'floaties':         return { type, cfg: { count: 10, duration: 10, speed: 1.0 } }
    case 'corruption-burst': return { type, cfg: { intensity: 'medium', duration: 2 } }
    case 'network-glitch':   return { type, cfg: { message: '[ NETWORK INTERRUPTION ]', duration: 2 } }
    case 'vignette-pulse':   return { type, cfg: { color: '#ff0000', opacity: 0.6, duration: 3, text: '' } }
    case 'screen-shake':     return { type, cfg: { intensity: 'medium', duration: 0.5 } }
    case 'typewriter':       return { type, cfg: { text: '', position: 'center', color: '#00ff41', fontSize: 32, duration: 4 } }
    case 'static-burst':     return { type, cfg: { opacity: 0.8, duration: 1.5 } }
    case 'image-overlay':    return { type, cfg: { src: '', duration: 4 } }
    case 'video-overlay':    return { type, cfg: { src: '', duration: 0 } }
  }
}

"""

src = src[:idx_catalog] + NEW_CATALOG + src[idx_make_end:]
print('✓ 4: updated EFFECT_CATALOG + makeDefaultEffect + presets')

# ── 5: Replace the full EventForm section with new multi-effect version ────────
ef_start = src.find('\n// ── EventForm ──')
ef_end   = src.find('\n// ── SceneConfig', ef_start)
assert ef_start != -1 and ef_end != -1, 'PATCH 5'

NEW_EVENTFORM = """
// ── EventForm ──────────────────────────────────────────────────────

// ── Per-type config editors ──────────────────────────────────────

function CfgNotificationBox({ cfg, onChange }: { cfg: import('@ieom/shared').NotificationBoxConfig; onChange: (c: import('@ieom/shared').NotificationBoxConfig) => void }) {
  const u = (p: Partial<import('@ieom/shared').NotificationBoxConfig>) => onChange({ ...cfg, ...p })
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <div className="text-[10px] text-zinc-400 w-12 shrink-0">Icon</div>
        <input type="text" value={cfg.icon} onChange={(e) => u({ icon: e.target.value })} className="w-14 text-center text-lg" />
      </div>
      <div>
        <div className="text-[10px] text-zinc-400 mb-1">Title</div>
        <input type="text" value={cfg.title} onChange={(e) => u({ title: e.target.value })} className="w-full" />
      </div>
      <div>
        <div className="text-[10px] text-zinc-400 mb-1">Body text</div>
        <textarea value={cfg.body} onChange={(e) => u({ body: e.target.value })} rows={2} className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 resize-none" />
      </div>
      <Slider label="Auto-dismiss" value={cfg.autoDismiss} min={0} max={30} step={1} unit="s" onChange={(v) => u({ autoDismiss: v })} />
      <div className="text-[10px] text-zinc-500">0 s = stays until closed manually</div>
    </div>
  )
}

function CfgTerminalToast({ cfg, onChange }: { cfg: import('@ieom/shared').TerminalToastConfig; onChange: (c: import('@ieom/shared').TerminalToastConfig) => void }) {
  const u = (p: Partial<import('@ieom/shared').TerminalToastConfig>) => onChange({ ...cfg, ...p })
  const [newMsg, setNewMsg] = useState('')
  const addMsg = () => { if (newMsg.trim()) { u({ messages: [...cfg.messages, newMsg.trim()] }); setNewMsg('') } }
  return (
    <div className="space-y-2">
      <div>
        <div className="text-[10px] text-zinc-400 mb-1">Messages</div>
        <div className="bg-zinc-900 rounded border border-zinc-700 max-h-28 overflow-y-auto p-1.5 space-y-1">
          {cfg.messages.map((m, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="font-mono text-[10px] text-zinc-300 flex-1 truncate">{m}</span>
              <button onClick={() => u({ messages: cfg.messages.filter((_, j) => j !== i) })} className="text-zinc-600 hover:text-red-400 text-xs px-1">✕</button>
            </div>
          ))}
        </div>
        <div className="flex gap-1 mt-1">
          <input type="text" value={newMsg} onChange={(e) => setNewMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addMsg() }} placeholder="[SERVER]: …  Enter to add" className="flex-1 text-xs" />
          <Btn variant="ghost" className="text-xs px-2 py-0.5" onClick={addMsg}>+</Btn>
        </div>
      </div>
      <Slider label="Duration" value={cfg.duration} min={2} max={20} step={0.5} unit="s" onChange={(v) => u({ duration: v })} />
      <div>
        <div className="text-[10px] text-zinc-400 mb-1">Position</div>
        <div className="grid grid-cols-2 gap-1">
          {(['top-left','top-right','bottom-left','bottom-right'] as const).map((p) => (
            <button key={p} onClick={() => u({ position: p })}
              className={'px-2 py-1 text-[10px] rounded border transition-colors ' + (cfg.position === p ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40' : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:text-zinc-100')}>
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function CfgFloaties({ cfg, onChange }: { cfg: import('@ieom/shared').FloatiesConfig; onChange: (c: import('@ieom/shared').FloatiesConfig) => void }) {
  const u = (p: Partial<import('@ieom/shared').FloatiesConfig>) => onChange({ ...cfg, ...p })
  return (
    <div className="space-y-2">
      <Slider label="Count"    value={cfg.count}    min={3}   max={40}  step={1}   onChange={(v) => u({ count: v })} />
      <Slider label="Duration" value={cfg.duration} min={3}   max={30}  step={1} unit="s" onChange={(v) => u({ duration: v })} />
      <Slider label="Speed"    value={cfg.speed}    min={0.3} max={3.0} step={0.1} onChange={(v) => u({ speed: v })} />
    </div>
  )
}

function CfgCorruption({ cfg, onChange }: { cfg: import('@ieom/shared').CorruptionBurstConfig; onChange: (c: import('@ieom/shared').CorruptionBurstConfig) => void }) {
  const u = (p: Partial<import('@ieom/shared').CorruptionBurstConfig>) => onChange({ ...cfg, ...p })
  return (
    <div className="space-y-2">
      <div>
        <div className="text-[10px] text-zinc-400 mb-1">Intensity</div>
        <div className="flex gap-1">
          {(['low','medium','high'] as const).map((v) => (
            <button key={v} onClick={() => u({ intensity: v })}
              className={'flex-1 px-2 py-1 text-xs rounded border capitalize transition-colors ' + (cfg.intensity === v ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40' : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:text-zinc-100')}>{v}</button>
          ))}
        </div>
      </div>
      <Slider label="Duration" value={cfg.duration} min={0.5} max={6} step={0.5} unit="s" onChange={(v) => u({ duration: v })} />
    </div>
  )
}

function CfgNetworkGlitch({ cfg, onChange }: { cfg: import('@ieom/shared').NetworkGlitchConfig; onChange: (c: import('@ieom/shared').NetworkGlitchConfig) => void }) {
  const u = (p: Partial<import('@ieom/shared').NetworkGlitchConfig>) => onChange({ ...cfg, ...p })
  return (
    <div className="space-y-2">
      <div>
        <div className="text-[10px] text-zinc-400 mb-1">Banner message</div>
        <input type="text" value={cfg.message} onChange={(e) => u({ message: e.target.value })} className="w-full font-mono text-xs" />
      </div>
      <Slider label="Duration" value={cfg.duration} min={0.5} max={6} step={0.5} unit="s" onChange={(v) => u({ duration: v })} />
    </div>
  )
}

function CfgVignette({ cfg, onChange }: { cfg: import('@ieom/shared').VignettePulseConfig; onChange: (c: import('@ieom/shared').VignettePulseConfig) => void }) {
  const u = (p: Partial<import('@ieom/shared').VignettePulseConfig>) => onChange({ ...cfg, ...p })
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="text-[10px] text-zinc-400 w-12 shrink-0">Color</div>
        <input type="color" value={cfg.color} onChange={(e) => u({ color: e.target.value })} className="h-7 w-12 rounded border border-zinc-700 bg-zinc-800 cursor-pointer" />
        <span className="font-mono text-[10px] text-zinc-500">{cfg.color}</span>
      </div>
      <Slider label="Opacity"  value={cfg.opacity}  min={0.1} max={1.0} step={0.05} onChange={(v) => u({ opacity: v })} />
      <Slider label="Duration" value={cfg.duration} min={0.5} max={12}  step={0.5} unit="s" onChange={(v) => u({ duration: v })} />
      <div>
        <div className="text-[10px] text-zinc-400 mb-1">Center text (optional)</div>
        <input type="text" value={cfg.text} onChange={(e) => u({ text: e.target.value })} className="w-full" placeholder="YOU DIED" />
      </div>
    </div>
  )
}

function CfgScreenShake({ cfg, onChange }: { cfg: import('@ieom/shared').ScreenShakeConfig; onChange: (c: import('@ieom/shared').ScreenShakeConfig) => void }) {
  const u = (p: Partial<import('@ieom/shared').ScreenShakeConfig>) => onChange({ ...cfg, ...p })
  return (
    <div className="space-y-2">
      <div>
        <div className="text-[10px] text-zinc-400 mb-1">Intensity</div>
        <div className="flex gap-1">
          {(['light','medium','heavy'] as const).map((v) => (
            <button key={v} onClick={() => u({ intensity: v })}
              className={'flex-1 px-2 py-1 text-xs rounded border capitalize transition-colors ' + (cfg.intensity === v ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40' : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:text-zinc-100')}>{v}</button>
          ))}
        </div>
      </div>
      <Slider label="Duration" value={cfg.duration} min={0.1} max={2.0} step={0.1} unit="s" onChange={(v) => u({ duration: v })} />
    </div>
  )
}

function CfgTypewriter({ cfg, onChange }: { cfg: import('@ieom/shared').TypewriterConfig; onChange: (c: import('@ieom/shared').TypewriterConfig) => void }) {
  const u = (p: Partial<import('@ieom/shared').TypewriterConfig>) => onChange({ ...cfg, ...p })
  return (
    <div className="space-y-2">
      <div>
        <div className="text-[10px] text-zinc-400 mb-1">Text</div>
        <input type="text" value={cfg.text} onChange={(e) => u({ text: e.target.value })} className="w-full" placeholder="LOADING..." />
      </div>
      <div>
        <div className="text-[10px] text-zinc-400 mb-1">Position</div>
        <div className="flex gap-1">
          {(['top','center','bottom'] as const).map((v) => (
            <button key={v} onClick={() => u({ position: v })}
              className={'flex-1 px-2 py-1 text-xs rounded border capitalize transition-colors ' + (cfg.position === v ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40' : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:text-zinc-100')}>{v}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-[10px] text-zinc-400 w-12 shrink-0">Color</div>
        <input type="color" value={cfg.color} onChange={(e) => u({ color: e.target.value })} className="h-7 w-12 rounded border border-zinc-700 bg-zinc-800 cursor-pointer" />
      </div>
      <Slider label="Font size" value={cfg.fontSize} min={16} max={80} step={2} unit="px" onChange={(v) => u({ fontSize: v })} />
      <Slider label="Duration"  value={cfg.duration} min={1}  max={15} step={0.5} unit="s" onChange={(v) => u({ duration: v })} />
    </div>
  )
}

function CfgStaticBurst({ cfg, onChange }: { cfg: import('@ieom/shared').StaticBurstConfig; onChange: (c: import('@ieom/shared').StaticBurstConfig) => void }) {
  const u = (p: Partial<import('@ieom/shared').StaticBurstConfig>) => onChange({ ...cfg, ...p })
  return (
    <div className="space-y-2">
      <Slider label="Opacity"  value={cfg.opacity}  min={0.1} max={1.0} step={0.05} onChange={(v) => u({ opacity: v })} />
      <Slider label="Duration" value={cfg.duration} min={0.3} max={5}   step={0.1} unit="s" onChange={(v) => u({ duration: v })} />
    </div>
  )
}

function CfgImageOverlay({ cfg, onChange }: { cfg: import('@ieom/shared').ImageOverlayConfig; onChange: (c: import('@ieom/shared').ImageOverlayConfig) => void }) {
  const u = (p: Partial<import('@ieom/shared').ImageOverlayConfig>) => onChange({ ...cfg, ...p })
  return (
    <div className="space-y-2">
      <div>
        <div className="text-[10px] text-zinc-400 mb-1">Image URL or /assets/… path</div>
        <input type="url" value={cfg.src} onChange={(e) => u({ src: e.target.value })} className="w-full text-xs font-mono" placeholder="https://… or /assets/images/alert.png" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-zinc-400 mb-1">X (px, blank = centered)</div>
          <input type="number" value={cfg.x ?? ''} onChange={(e) => u({ x: e.target.value !== '' ? Number(e.target.value) : undefined })} className="w-full font-mono text-xs" placeholder="auto" />
        </div>
        <div>
          <div className="text-[10px] text-zinc-400 mb-1">Y (px, blank = centered)</div>
          <input type="number" value={cfg.y ?? ''} onChange={(e) => u({ y: e.target.value !== '' ? Number(e.target.value) : undefined })} className="w-full font-mono text-xs" placeholder="auto" />
        </div>
        <div>
          <div className="text-[10px] text-zinc-400 mb-1">Width (px, blank = auto)</div>
          <input type="number" value={cfg.width ?? ''} onChange={(e) => u({ width: e.target.value !== '' ? Number(e.target.value) : undefined })} className="w-full font-mono text-xs" placeholder="auto" />
        </div>
        <div>
          <div className="text-[10px] text-zinc-400 mb-1">Height (px, blank = auto)</div>
          <input type="number" value={cfg.height ?? ''} onChange={(e) => u({ height: e.target.value !== '' ? Number(e.target.value) : undefined })} className="w-full font-mono text-xs" placeholder="auto" />
        </div>
      </div>
      <Slider label="Opacity"  value={cfg.opacity ?? 1}    min={0.1} max={1.0} step={0.05} onChange={(v) => u({ opacity: v })} />
      <Slider label="Duration" value={cfg.duration}        min={0.5} max={30}  step={0.5} unit="s" onChange={(v) => u({ duration: v })} />
    </div>
  )
}

function CfgVideoOverlay({ cfg, onChange }: { cfg: import('@ieom/shared').VideoOverlayConfig; onChange: (c: import('@ieom/shared').VideoOverlayConfig) => void }) {
  const u = (p: Partial<import('@ieom/shared').VideoOverlayConfig>) => onChange({ ...cfg, ...p })
  return (
    <div className="space-y-2">
      <div>
        <div className="text-[10px] text-zinc-400 mb-1">Video URL or /assets/… path (WebM preferred)</div>
        <input type="url" value={cfg.src} onChange={(e) => u({ src: e.target.value })} className="w-full text-xs font-mono" placeholder="https://… or /assets/videos/alert.webm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-zinc-400 mb-1">X (px, blank = centered)</div>
          <input type="number" value={cfg.x ?? ''} onChange={(e) => u({ x: e.target.value !== '' ? Number(e.target.value) : undefined })} className="w-full font-mono text-xs" placeholder="auto" />
        </div>
        <div>
          <div className="text-[10px] text-zinc-400 mb-1">Y (px, blank = centered)</div>
          <input type="number" value={cfg.y ?? ''} onChange={(e) => u({ y: e.target.value !== '' ? Number(e.target.value) : undefined })} className="w-full font-mono text-xs" placeholder="auto" />
        </div>
        <div>
          <div className="text-[10px] text-zinc-400 mb-1">Width (px, blank = auto)</div>
          <input type="number" value={cfg.width ?? ''} onChange={(e) => u({ width: e.target.value !== '' ? Number(e.target.value) : undefined })} className="w-full font-mono text-xs" placeholder="auto" />
        </div>
        <div>
          <div className="text-[10px] text-zinc-400 mb-1">Height (px, blank = auto)</div>
          <input type="number" value={cfg.height ?? ''} onChange={(e) => u({ height: e.target.value !== '' ? Number(e.target.value) : undefined })} className="w-full font-mono text-xs" placeholder="auto" />
        </div>
      </div>
      <Slider label="Opacity"   value={cfg.opacity ?? 1} min={0.1} max={1.0} step={0.05} onChange={(v) => u({ opacity: v })} />
      <Slider label="Duration"  value={cfg.duration}     min={0}   max={30}  step={0.5}  unit="s" onChange={(v) => u({ duration: v })} />
      <div className="text-[10px] text-zinc-500">Duration 0 = play video to end</div>
      <Toggle checked={cfg.loop ?? false} onChange={(v) => u({ loop: v })} label="Loop" />
    </div>
  )
}

function EffectConfigEditor({ effect, onChange }: { effect: EffectConfig; onChange: (e: EffectConfig) => void }) {
  switch (effect.type) {
    case 'notification-box': return <CfgNotificationBox cfg={effect.cfg} onChange={(c) => onChange({ ...effect, cfg: c })} />
    case 'terminal-toast':   return <CfgTerminalToast   cfg={effect.cfg} onChange={(c) => onChange({ ...effect, cfg: c })} />
    case 'floaties':         return <CfgFloaties         cfg={effect.cfg} onChange={(c) => onChange({ ...effect, cfg: c })} />
    case 'corruption-burst': return <CfgCorruption       cfg={effect.cfg} onChange={(c) => onChange({ ...effect, cfg: c })} />
    case 'network-glitch':   return <CfgNetworkGlitch    cfg={effect.cfg} onChange={(c) => onChange({ ...effect, cfg: c })} />
    case 'vignette-pulse':   return <CfgVignette         cfg={effect.cfg} onChange={(c) => onChange({ ...effect, cfg: c })} />
    case 'screen-shake':     return <CfgScreenShake      cfg={effect.cfg} onChange={(c) => onChange({ ...effect, cfg: c })} />
    case 'typewriter':       return <CfgTypewriter        cfg={effect.cfg} onChange={(c) => onChange({ ...effect, cfg: c })} />
    case 'static-burst':     return <CfgStaticBurst      cfg={effect.cfg} onChange={(c) => onChange({ ...effect, cfg: c })} />
    case 'image-overlay':    return <CfgImageOverlay      cfg={effect.cfg} onChange={(c) => onChange({ ...effect, cfg: c })} />
    case 'video-overlay':    return <CfgVideoOverlay      cfg={effect.cfg} onChange={(c) => onChange({ ...effect, cfg: c })} />
    case 'death-overlay':
    case 'victory-overlay':
    case 'revive-overlay':
      return <div className="text-[10px] text-zinc-500 italic py-1">Fixed animation — no parameters.</div>
  }
}

// ── Effect catalog picker (modal sheet) ───────────────────────────
function EffectCatalogSheet({ onPick, onClose }: { onPick: (type: EffectType) => void; onClose: () => void }) {
  const groups = ['Built-in', 'Visual', 'Camera', 'Media']
  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-end" onClick={onClose}>
      <div className="w-80 bg-zinc-900 border border-zinc-700 rounded-tl-xl shadow-2xl max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-zinc-800 shrink-0">
          <span className="text-xs font-semibold text-zinc-200">Add Effect</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-sm px-1">×</button>
        </div>
        <div className="overflow-y-auto p-2 space-y-3">
          {groups.map((grp) => (
            <div key={grp}>
              <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider px-1 pb-1">{grp}</div>
              {EFFECT_CATALOG.filter((e) => e.group === grp).map(({ type, icon, label, desc }) => (
                <button key={type} onClick={() => { onPick(type); onClose() }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-700/60 border border-transparent hover:border-zinc-600/60 transition-colors text-left">
                  <span className="text-sm w-5 text-center shrink-0">{icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-200">{label}</div>
                    <div className="text-[10px] text-zinc-500 leading-snug">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Preset picker ─────────────────────────────────────────────────
function PresetSheet({ onPick, onClose }: { onPick: (effects: EffectConfig[]) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-end" onClick={onClose}>
      <div className="w-80 bg-zinc-900 border border-zinc-700 rounded-tl-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-zinc-800">
          <span className="text-xs font-semibold text-zinc-200">Effect Presets</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-sm px-1">×</button>
        </div>
        <div className="p-2 space-y-1">
          {EFFECT_PRESETS.map((p) => (
            <button key={p.label} onClick={() => { onPick(p.effects); onClose() }}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded hover:bg-zinc-700/60 border border-transparent hover:border-zinc-600/60 transition-colors text-left">
              <span className="text-sm w-6 text-center shrink-0">{p.icon}</span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-200">{p.label}</div>
                <div className="text-[10px] text-zinc-500 leading-snug">{p.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Single effect row in the stack ────────────────────────────────
function EffectRow({ effect, index, total, onUpdate, onRemove, onMove }: {
  effect: EffectConfig; index: number; total: number
  onUpdate: (e: EffectConfig) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const [open, setOpen] = useState(index === 0)
  const meta  = EFFECT_CATALOG.find((c) => c.type === effect.type)
  const label = meta?.label ?? effect.type
  const icon  = meta?.icon  ?? '⚡'
  const hasConfig = !['death-overlay','victory-overlay','revive-overlay'].includes(effect.type)
  return (
    <div className="rounded border border-zinc-700/60 bg-zinc-800/40 overflow-hidden">
      {/* Row header */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <span className="text-sm w-5 text-center shrink-0">{icon}</span>
        <span className="text-xs font-medium text-zinc-200 flex-1">{label}</span>
        {/* Delay input */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-zinc-600">+</span>
          <input type="number" min={0} max={30} step={0.1}
            value={effect.delay ?? 0}
            onChange={(e) => onUpdate({ ...effect, delay: Number(e.target.value) || undefined })}
            className="w-10 font-mono text-xs text-center px-1 py-0 bg-zinc-900 border border-zinc-700 rounded" />
          <span className="text-[10px] text-zinc-600">s</span>
        </div>
        {/* Move up/down */}
        <button onClick={() => onMove(-1)} disabled={index === 0}           className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 text-xs px-0.5 py-0.5" title="Move up">▲</button>
        <button onClick={() => onMove(1)}  disabled={index === total - 1}   className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 text-xs px-0.5 py-0.5" title="Move down">▼</button>
        {/* Expand toggle */}
        {hasConfig && (
          <button onClick={() => setOpen((o) => !o)} className="text-zinc-600 hover:text-zinc-300 text-xs px-0.5 py-0.5" title={open ? 'Collapse' : 'Expand'}>
            {open ? '▾' : '▸'}
          </button>
        )}
        <button onClick={onRemove} className="text-zinc-700 hover:text-red-400 text-xs px-0.5 transition-colors" title="Remove">✕</button>
      </div>
      {/* Config body */}
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-zinc-700/40">
          <EffectConfigEditor effect={effect} onChange={onUpdate} />
        </div>
      )}
    </div>
  )
}

// ── Import / Export JSON helpers ──────────────────────────────────
function ImportExportPanel({ def, onImport }: { def: EventConfig; onImport: (d: EventConfig) => void }) {
  const [mode, setMode] = useState<'idle' | 'export' | 'import'>('idle')
  const [importText, setImportText] = useState('')
  const [err, setErr] = useState('')
  const json = JSON.stringify(def, null, 2)

  if (mode === 'export') {
    return (
      <div className="space-y-2">
        <textarea readOnly value={json} rows={6} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-[10px] font-mono text-zinc-300 resize-none" />
        <div className="flex gap-1">
          <Btn variant="ghost" className="text-xs flex-1" onClick={() => navigator.clipboard?.writeText(json)}>Copy</Btn>
          <Btn variant="ghost" className="text-xs flex-1" onClick={() => setMode('idle')}>Done</Btn>
        </div>
      </div>
    )
  }

  if (mode === 'import') {
    const tryImport = () => {
      try {
        const parsed = JSON.parse(importText) as EventConfig
        if (!parsed.id || !Array.isArray(parsed.effects)) throw new Error('Invalid event JSON')
        onImport(parsed)
        setMode('idle')
        setErr('')
      } catch (e) {
        setErr(String(e))
      }
    }
    return (
      <div className="space-y-2">
        <div className="text-[10px] text-zinc-400">Paste event JSON:</div>
        <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={5} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-[10px] font-mono text-zinc-300 resize-none" placeholder='{ "id": "...", "effects": [...] }' />
        {err && <div className="text-[10px] text-red-400">{err}</div>}
        <div className="flex gap-1">
          <Btn variant="ghost" className="text-xs flex-1" onClick={tryImport}>Import</Btn>
          <Btn variant="ghost" className="text-xs flex-1" onClick={() => { setMode('idle'); setErr('') }}>Cancel</Btn>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-1">
      <button onClick={() => setMode('export')} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">⬇ Export JSON</button>
      <span className="text-[10px] text-zinc-700">·</span>
      <button onClick={() => setMode('import')} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">⬆ Import JSON</button>
    </div>
  )
}

// ── Main EventForm ─────────────────────────────────────────────────
function EventForm({ def, onUpdate, onDelete }: {
  def: EventConfig
  onUpdate: (d: EventConfig) => void
  onDelete?: () => void
}) {
  const [showCatalog, setShowCatalog] = useState(false)
  const [showPresets, setShowPresets] = useState(false)

  const update = (fn: (d: EventConfig) => void) => {
    const next = structuredClone(def)
    fn(next)
    onUpdate(next)
  }

  const addEffect = (type: EffectType) => {
    update((d) => { d.effects.push(makeDefaultEffect(type)) })
  }

  const removeEffect = (i: number) => {
    update((d) => { d.effects.splice(i, 1) })
  }

  const updateEffect = (i: number, e: EffectConfig) => {
    update((d) => { d.effects[i] = e })
  }

  const moveEffect = (i: number, dir: -1 | 1) => {
    update((d) => {
      const arr = d.effects
      const j = i + dir
      if (j < 0 || j >= arr.length) return
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    })
  }

  const applyPreset = (effects: EffectConfig[]) => {
    update((d) => { d.effects = structuredClone(effects) })
  }

  return (
    <div className="space-y-3">
      {/* Identity */}
      <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/60">
        <span className="text-3xl leading-none">{def.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-zinc-100">{def.label}</div>
          <div className="text-[11px] text-zinc-500 font-mono">{def.id}</div>
          {def.desc && <div className="text-[11px] text-zinc-400 mt-0.5 truncate">{def.desc}</div>}
        </div>
      </div>

      {/* Identity edit */}
      <Panel title="Identity">
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <div className="text-[10px] text-zinc-400 w-12 shrink-0">Icon</div>
            <input type="text" value={def.icon} onChange={(e) => update((d) => { d.icon = e.target.value })} className="w-16 text-center text-lg" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-400 mb-1">Label</div>
            <input type="text" value={def.label} onChange={(e) => update((d) => { d.label = e.target.value })} className="w-full" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-400 mb-1">Description</div>
            <input type="text" value={def.desc} onChange={(e) => update((d) => { d.desc = e.target.value })} className="w-full" />
          </div>
        </div>
      </Panel>

      {/* Effects stack */}
      <Panel title={'Effects Stack (' + def.effects.length + ')'}>
        <div className="space-y-1.5 mb-2">
          {def.effects.length === 0 && (
            <div className="text-[10px] text-zinc-600 italic py-1 text-center">No effects — event fires silently. Add one below.</div>
          )}
          {def.effects.map((eff, i) => (
            <EffectRow key={i} effect={eff} index={i} total={def.effects.length}
              onUpdate={(e) => updateEffect(i, e)}
              onRemove={() => removeEffect(i)}
              onMove={(dir) => moveEffect(i, dir)} />
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setShowCatalog(true)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-dashed border-zinc-600 hover:border-cyan-500/50 text-zinc-400 hover:text-cyan-300 transition-colors">
            + Add Effect
          </button>
          <button onClick={() => setShowPresets(true)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-dashed border-zinc-600 hover:border-purple-500/50 text-zinc-400 hover:text-purple-300 transition-colors">
            📦 From Preset
          </button>
        </div>
      </Panel>

      {/* Auto-trigger */}
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
                      def.auto.mode === m ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40' : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:text-zinc-100'
                    )}>{m}</button>
                ))}
              </div>
            </div>
            {def.auto.mode === 'interval' && (
              <Slider label="Avg every" value={def.auto.intervalMin} min={1} max={60} step={1} unit="min" onChange={(v) => update((d) => { d.auto.intervalMin = v })} />
            )}
            {def.auto.mode === 'idle' && (
              <Slider label="After idle" value={def.auto.idleMin} min={1} max={30} step={1} unit="min" onChange={(v) => update((d) => { d.auto.idleMin = v })} />
            )}
          </div>
        )}
      </Panel>

      {/* Import / Export */}
      <ImportExportPanel def={def} onImport={onUpdate} />

      {/* Delete */}
      {onDelete && (
        <div className="pt-1">
          <Btn variant="danger" onClick={onDelete} className="w-full text-xs">Delete Event</Btn>
        </div>
      )}

      {/* Sheets */}
      {showCatalog && <EffectCatalogSheet onPick={addEffect} onClose={() => setShowCatalog(false)} />}
      {showPresets && <PresetSheet onPick={applyPreset} onClose={() => setShowPresets(false)} />}
    </div>
  )
}

"""

src = src[:ef_start] + NEW_EVENTFORM + src[ef_end:]
print('✓ 5: EventForm replaced with multi-effect stack version')

# ── 6: Update Dashboard component to use config.events ────────────────────────
old = """\
export function Dashboard() {
  const [selected,   setSelected]   = useState<SelectedItem | null>(null)
  const [eventDefs,  setEventDefs]  = useState<EventDef[]>(DEFAULT_EVENT_DEFS)
  const applications = useAdminStore((s) => s.config.applications)"""
new  = """\
export function Dashboard() {
  const [selected,   setSelected]   = useState<SelectedItem | null>(null)
  const saveConfig   = useAdminStore((s) => s.saveConfig)
  const storedEvents = useAdminStore((s) => s.config.events)
  const eventDefs: EventConfig[] = storedEvents ?? DEFAULT_CONFIG.events ?? []
  const applications = useAdminStore((s) => s.config.applications)"""
assert src.count(old) == 1, 'PATCH 6'
src = src.replace(old, new, 1)
print('✓ 6: Dashboard uses config.events')

# ── 7: Update handleAddEvent ──────────────────────────────────────────────────
old = """\
  const handleAddEvent = () => {
    const id  = 'custom-' + Date.now()
    const def: EventDef = { id, label: 'New Event', icon: '⚡', color: 'text-cyan-400', desc: '', auto: { enabled: false, mode: 'interval', intervalMin: 15, idleMin: 5 }, effect: null }
    setEventDefs((prev) => [...prev, def])
    setSelected({ kind: 'event', id })
  }"""
new  = """\
  const handleAddEvent = () => {
    const id: string = 'event-' + Date.now()
    const def: EventConfig = { id, label: 'New Event', icon: '⚡', color: 'text-cyan-400', desc: '', effects: [], auto: { enabled: false, mode: 'interval', intervalMin: 15, idleMin: 5 } }
    saveConfig({ events: [...eventDefs, def] })
    setSelected({ kind: 'event', id })
  }"""
assert src.count(old) == 1, 'PATCH 7'
src = src.replace(old, new, 1)
print('✓ 7: handleAddEvent uses saveConfig')

# ── 8: Update handleUpdateEvent ───────────────────────────────────────────────
old = """\
  const handleUpdateEvent = (updated: EventDef) => {
    setEventDefs((prev) => prev.map((e) => e.id === updated.id ? updated : e))
    // Keep selected up to date (label/icon may have changed)
    if (selected?.kind === 'event' && selected.id === updated.id) {
      setSelected({ kind: 'event', id: updated.id })
    }
  }"""
new  = """\
  const handleUpdateEvent = (updated: EventConfig) => {
    saveConfig({ events: eventDefs.map((e) => e.id === updated.id ? updated : e) })
    if (selected?.kind === 'event' && selected.id === updated.id) {
      setSelected({ kind: 'event', id: updated.id })
    }
  }"""
assert src.count(old) == 1, 'PATCH 8'
src = src.replace(old, new, 1)
print('✓ 8: handleUpdateEvent uses saveConfig')

# ── 9: Update handleDeleteEvent ───────────────────────────────────────────────
old = """\
  const handleDeleteEvent = (id: string) => {
    setEventDefs((prev) => prev.filter((e) => e.id !== id))
    if (selected?.kind === 'event' && selected.id === id) setSelected(null)
  }"""
new  = """\
  const handleDeleteEvent = (id: string) => {
    saveConfig({ events: eventDefs.filter((e) => e.id !== id) })
    if (selected?.kind === 'event' && selected.id === id) setSelected(null)
  }"""
assert src.count(old) == 1, 'PATCH 9'
src = src.replace(old, new, 1)
print('✓ 9: handleDeleteEvent uses saveConfig')

# ── 10: update Fire Now actionFn ──────────────────────────────────────────────
old = "    actionFn    = () => socket.emit('overlay:trigger', { id: selected.id, effect: def?.effect ?? null })"
new  = "    actionFn    = () => socket.emit('overlay:trigger', { id: selected.id, effects: def?.effects ?? [] })"
assert src.count(old) == 1, 'PATCH 10'
src = src.replace(old, new, 1)
print('✓ 10: Fire Now emits effects[]')

# ── 11: Update RightPaneContent to pass EventConfig ───────────────────────────
old = "function RightPaneContent({ selected, onDeleted, eventDefs, onUpdateEvent, onDeleteEvent }: {\n  selected: SelectedItem; onDeleted: () => void\n  eventDefs: EventDef[]; onUpdateEvent: (d: EventDef) => void; onDeleteEvent: (id: string) => void\n})"
new  = "function RightPaneContent({ selected, onDeleted, eventDefs, onUpdateEvent, onDeleteEvent }: {\n  selected: SelectedItem; onDeleted: () => void\n  eventDefs: EventConfig[]; onUpdateEvent: (d: EventConfig) => void; onDeleteEvent: (id: string) => void\n})"
assert src.count(old) == 1, 'PATCH 11'
src = src.replace(old, new, 1)
print('✓ 11: RightPaneContent uses EventConfig')

# ── 12: Update RightPane signature ────────────────────────────────────────────
old = "function RightPane({ selected, onClose, eventDefs, onUpdateEvent, onDeleteEvent }: {\n  selected: SelectedItem | null; onClose: () => void\n  eventDefs: EventDef[]; onUpdateEvent: (d: EventDef) => void; onDeleteEvent: (id: string) => void\n})"
new  = "function RightPane({ selected, onClose, eventDefs, onUpdateEvent, onDeleteEvent }: {\n  selected: SelectedItem | null; onClose: () => void\n  eventDefs: EventConfig[]; onUpdateEvent: (d: EventConfig) => void; onDeleteEvent: (id: string) => void\n})"
assert src.count(old) == 1, 'PATCH 12'
src = src.replace(old, new, 1)
print('✓ 12: RightPane uses EventConfig')

# ── 13: Update LeftSidebar signature ──────────────────────────────────────────
old = "function LeftSidebar({ selected, onSelect, eventDefs, onAddEvent }: {\n  selected: SelectedItem | null; onSelect: (item: SelectedItem) => void\n  eventDefs: EventDef[]; onAddEvent: () => void\n})"
new  = "function LeftSidebar({ selected, onSelect, eventDefs, onAddEvent }: {\n  selected: SelectedItem | null; onSelect: (item: SelectedItem) => void\n  eventDefs: EventConfig[]; onAddEvent: () => void\n})"
assert src.count(old) == 1, 'PATCH 13'
src = src.replace(old, new, 1)
print('✓ 13: LeftSidebar uses EventConfig')

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(src)

print(f'\n✓ Written {src.count(chr(10))+1} lines to {FILE}')
