#!/usr/bin/env python3
"""Patch Dashboard.tsx — full event system redesign with EffectConfig."""

FILE = '/mnt/c/projects/stream/ieom/packages/admin/src/components/Dashboard.tsx'

with open(FILE, 'r', encoding='utf-8') as f:
    src = f.read()

# ── 1: Update import from @ieom/shared to include EffectConfig + EffectType ──
old_import = "import { STATE, OVERLAY_EVENT } from '@ieom/shared'"
new_import  = "import { STATE, OVERLAY_EVENT, type EffectConfig, type EffectType } from '@ieom/shared'"
assert src.count(old_import) == 1, "PATCH 1"
src = src.replace(old_import, new_import, 1)
print("✓ 1: import updated")

# ── 2: Update EventDef type to add effect field ──
old_typedef = "type EventDef    = { id: string; label: string; icon: string; color: string; desc: string; builtIn?: boolean; auto: AutoTrigger }"
new_typedef  = "type EventDef    = { id: string; label: string; icon: string; color: string; desc: string; builtIn?: boolean; auto: AutoTrigger; effect: EffectConfig | null }"
assert src.count(old_typedef) == 1, "PATCH 2"
src = src.replace(old_typedef, new_typedef, 1)
print("✓ 2: EventDef type updated")

# ── 3: Update DEFAULT_EVENT_DEFS with effect configs ──
old_defs_start = "const DEFAULT_EVENT_DEFS: EventDef[] = ["
idx = src.find(old_defs_start)
assert idx != -1, "PATCH 3 start"
# Find the closing ] on its own line
end_idx = src.find("\n]", idx) + 2
old_defs_block = src[idx:end_idx]

new_defs_block = """const DEFAULT_EVENT_DEFS: EventDef[] = [
  { id: OVERLAY_EVENT.DEATH,          label: 'DEATH',       icon: '\U0001f480', color: 'text-red-400',     desc: 'Red vignette + YOU DIED overlay',                builtIn: true, auto: { enabled: false, mode: 'interval', intervalMin: 20, idleMin: 5 }, effect: null },
  { id: OVERLAY_EVENT.VICTORY,        label: 'VICTORY',     icon: '\U0001f3c6', color: 'text-yellow-400',  desc: 'Win98 dialog: MISSION.LOG saved',                builtIn: true, auto: { enabled: false, mode: 'interval', intervalMin: 30, idleMin: 5 }, effect: null },
  { id: OVERLAY_EVENT.REVIVE,         label: 'REVIVE',      icon: '\u2764',     color: 'text-emerald-400', desc: 'Terminal: Restarting process...',                 builtIn: true, auto: { enabled: false, mode: 'interval', intervalMin: 25, idleMin: 5 }, effect: null },
  { id: OVERLAY_EVENT.NETWORK_GLITCH, label: 'GLITCH',      icon: '\U0001f4e1', color: 'text-purple-400',  desc: 'Full-screen artifact burst',                    builtIn: true, auto: { enabled: false, mode: 'interval', intervalMin: 15, idleMin: 5 }, effect: null },
  { id: 'idle-tv',       label: 'IDLE FLOATIES', icon: '\u2728', color: 'text-cyan-400',   desc: 'Random floating elements drift over screen',      auto: { enabled: false, mode: 'idle',     intervalMin: 15, idleMin: 5 }, effect: { type: 'floaties',         cfg: { count: 10, duration: 10, speed: 1.0 } } },
  { id: 'sys-message',   label: 'SYS MESSAGE',   icon: '\U0001f4ac', color: 'text-zinc-400',   desc: 'Terminal toast: [SERVER] message prints on screen', auto: { enabled: false, mode: 'interval', intervalMin: 10, idleMin: 5 }, effect: { type: 'terminal-toast',   cfg: { messages: ['[SERVER]: connection unstable', '[SYSTEM]: low memory warning'], duration: 6, position: 'bottom-left' } } },
  { id: 'archive-corrupt', label: 'CORRUPTION',  icon: '\U0001f5c4', color: 'text-orange-400', desc: 'Corruption artifacts: glitch rectangles and scan line burst', auto: { enabled: false, mode: 'interval', intervalMin: 20, idleMin: 5 }, effect: { type: 'corruption-burst', cfg: { intensity: 'medium', duration: 2 } } },
]"""
src = src[:idx] + new_defs_block + src[end_idx:]
print("✓ 3: DEFAULT_EVENT_DEFS updated")

# ── 4: Add EFFECT_CATALOG and makeDefaultEffect after DEFAULT_EVENT_DEFS ──
insert_after = new_defs_block
insert_pos = src.find(insert_after) + len(insert_after)

EFFECT_CATALOG_CODE = """

// ── Effect catalog ──────────────────────────────────────────────────

const EFFECT_CATALOG: { type: EffectType; icon: string; label: string; desc: string }[] = [
  { type: 'notification-box', icon: '\U0001f5bc', label: 'Notification Box', desc: 'Win98 dialog window, auto-dismisses' },
  { type: 'terminal-toast',   icon: '\U0001f4ac', label: 'Terminal Toast',   desc: '[SERVER]: messages type out bottom-left' },
  { type: 'floaties',         icon: '\u2728',     label: 'Floaties',         desc: 'Glowing symbols drift across the screen' },
  { type: 'corruption-burst', icon: '\u26a1',     label: 'Corruption',       desc: 'Glitch rects + scanline sweep' },
  { type: 'network-glitch',   icon: '\U0001f4e1', label: 'Network Glitch',   desc: 'Screen shake + interruption banner' },
  { type: 'vignette-pulse',   icon: '\U0001f534', label: 'Vignette Pulse',   desc: 'Color vignette floods screen' },
  { type: 'screen-shake',     icon: '\U0001f4a5', label: 'Screen Shake',     desc: 'Camera shake only, no overlay' },
  { type: 'typewriter',       icon: '\u2328',     label: 'Typewriter',       desc: 'Text types itself at chosen position' },
  { type: 'static-burst',     icon: '\U0001f4fa', label: 'Static Burst',     desc: 'TV static noise flash' },
]

function makeDefaultEffect(type: EffectType): EffectConfig {
  switch (type) {
    case 'notification-box': return { type, cfg: { title: 'NOTIFICATION', body: '', icon: '\U0001f5a5', autoDismiss: 5 } }
    case 'terminal-toast':   return { type, cfg: { messages: ['[SERVER]: event triggered'], duration: 5, position: 'bottom-left' } }
    case 'floaties':         return { type, cfg: { count: 10, duration: 10, speed: 1.0 } }
    case 'corruption-burst': return { type, cfg: { intensity: 'medium', duration: 2 } }
    case 'network-glitch':   return { type, cfg: { message: '[ NETWORK INTERRUPTION ]', duration: 2 } }
    case 'vignette-pulse':   return { type, cfg: { color: '#ff0000', opacity: 0.6, duration: 3, text: '' } }
    case 'screen-shake':     return { type, cfg: { intensity: 'medium', duration: 0.5 } }
    case 'typewriter':       return { type, cfg: { text: '', position: 'center', color: '#00ff41', fontSize: 32, duration: 4 } }
    case 'static-burst':     return { type, cfg: { opacity: 0.8, duration: 1.5 } }
  }
}
"""
src = src[:insert_pos] + EFFECT_CATALOG_CODE + src[insert_pos:]
print("✓ 4: EFFECT_CATALOG + makeDefaultEffect added")

# ── 5: Replace EventForm with full-featured version ──
# Find the EventForm function
ef_start = src.find("// ── EventForm ──────────────────────────────────────────────────────")
ef_end   = src.find("\n// ── SceneConfig", ef_start)
assert ef_start != -1, "PATCH 5 start"
assert ef_end   != -1, "PATCH 5 end"

NEW_EVENTFORM = r"""// ── EventForm ──────────────────────────────────────────────────────

// -------- per-type config editors --------

function CfgNotificationBox({ cfg, onChange }: { cfg: import('@ieom/shared').NotificationBoxConfig; onChange: (c: import('@ieom/shared').NotificationBoxConfig) => void }) {
  const u = (patch: Partial<import('@ieom/shared').NotificationBoxConfig>) => onChange({ ...cfg, ...patch })
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
        <textarea value={cfg.body} onChange={(e) => u({ body: e.target.value })}
          rows={2} className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 resize-none" />
      </div>
      <Slider label="Auto-dismiss" value={cfg.autoDismiss} min={0} max={30} step={1} unit="s"
        onChange={(v) => u({ autoDismiss: v })} />
      <div className="text-[10px] text-zinc-500">0 s = stays until closed manually</div>
    </div>
  )
}

function CfgTerminalToast({ cfg, onChange }: { cfg: import('@ieom/shared').TerminalToastConfig; onChange: (c: import('@ieom/shared').TerminalToastConfig) => void }) {
  const u = (patch: Partial<import('@ieom/shared').TerminalToastConfig>) => onChange({ ...cfg, ...patch })
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
              <button onClick={() => u({ messages: cfg.messages.filter((_, j) => j !== i) })}
                className="text-zinc-600 hover:text-red-400 text-xs px-1">✕</button>
            </div>
          ))}
        </div>
        <div className="flex gap-1 mt-1">
          <input type="text" value={newMsg} onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addMsg() }}
            placeholder="[SERVER]: …  Enter to add" className="flex-1 text-xs" />
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
  const u = (patch: Partial<import('@ieom/shared').FloatiesConfig>) => onChange({ ...cfg, ...patch })
  return (
    <div className="space-y-2">
      <Slider label="Count"    value={cfg.count}    min={3}   max={40}  step={1}   onChange={(v) => u({ count: v })} />
      <Slider label="Duration" value={cfg.duration} min={3}   max={30}  step={1} unit="s" onChange={(v) => u({ duration: v })} />
      <Slider label="Speed"    value={cfg.speed}    min={0.3} max={3.0} step={0.1} onChange={(v) => u({ speed: v })} />
    </div>
  )
}

function CfgCorruption({ cfg, onChange }: { cfg: import('@ieom/shared').CorruptionBurstConfig; onChange: (c: import('@ieom/shared').CorruptionBurstConfig) => void }) {
  const u = (patch: Partial<import('@ieom/shared').CorruptionBurstConfig>) => onChange({ ...cfg, ...patch })
  return (
    <div className="space-y-2">
      <div>
        <div className="text-[10px] text-zinc-400 mb-1">Intensity</div>
        <div className="flex gap-1">
          {(['low','medium','high'] as const).map((v) => (
            <button key={v} onClick={() => u({ intensity: v })}
              className={'flex-1 px-2 py-1 text-xs rounded border capitalize transition-colors ' + (cfg.intensity === v ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40' : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:text-zinc-100')}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <Slider label="Duration" value={cfg.duration} min={0.5} max={6} step={0.5} unit="s" onChange={(v) => u({ duration: v })} />
    </div>
  )
}

function CfgNetworkGlitch({ cfg, onChange }: { cfg: import('@ieom/shared').NetworkGlitchConfig; onChange: (c: import('@ieom/shared').NetworkGlitchConfig) => void }) {
  const u = (patch: Partial<import('@ieom/shared').NetworkGlitchConfig>) => onChange({ ...cfg, ...patch })
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
  const u = (patch: Partial<import('@ieom/shared').VignettePulseConfig>) => onChange({ ...cfg, ...patch })
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="text-[10px] text-zinc-400 w-12 shrink-0">Color</div>
        <input type="color" value={cfg.color} onChange={(e) => u({ color: e.target.value })}
          className="h-7 w-12 rounded border border-zinc-700 bg-zinc-800 cursor-pointer" />
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
  const u = (patch: Partial<import('@ieom/shared').ScreenShakeConfig>) => onChange({ ...cfg, ...patch })
  return (
    <div className="space-y-2">
      <div>
        <div className="text-[10px] text-zinc-400 mb-1">Intensity</div>
        <div className="flex gap-1">
          {(['light','medium','heavy'] as const).map((v) => (
            <button key={v} onClick={() => u({ intensity: v })}
              className={'flex-1 px-2 py-1 text-xs rounded border capitalize transition-colors ' + (cfg.intensity === v ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40' : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:text-zinc-100')}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <Slider label="Duration" value={cfg.duration} min={0.1} max={2.0} step={0.1} unit="s" onChange={(v) => u({ duration: v })} />
    </div>
  )
}

function CfgTypewriter({ cfg, onChange }: { cfg: import('@ieom/shared').TypewriterConfig; onChange: (c: import('@ieom/shared').TypewriterConfig) => void }) {
  const u = (patch: Partial<import('@ieom/shared').TypewriterConfig>) => onChange({ ...cfg, ...patch })
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
              className={'flex-1 px-2 py-1 text-xs rounded border capitalize transition-colors ' + (cfg.position === v ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40' : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:text-zinc-100')}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-[10px] text-zinc-400 w-12 shrink-0">Color</div>
        <input type="color" value={cfg.color} onChange={(e) => u({ color: e.target.value })}
          className="h-7 w-12 rounded border border-zinc-700 bg-zinc-800 cursor-pointer" />
      </div>
      <Slider label="Font size" value={cfg.fontSize} min={16} max={80} step={2} unit="px" onChange={(v) => u({ fontSize: v })} />
      <Slider label="Duration"  value={cfg.duration} min={1}  max={15} step={0.5} unit="s" onChange={(v) => u({ duration: v })} />
    </div>
  )
}

function CfgStaticBurst({ cfg, onChange }: { cfg: import('@ieom/shared').StaticBurstConfig; onChange: (c: import('@ieom/shared').StaticBurstConfig) => void }) {
  const u = (patch: Partial<import('@ieom/shared').StaticBurstConfig>) => onChange({ ...cfg, ...patch })
  return (
    <div className="space-y-2">
      <Slider label="Opacity"  value={cfg.opacity}  min={0.1} max={1.0} step={0.05} onChange={(v) => u({ opacity: v })} />
      <Slider label="Duration" value={cfg.duration} min={0.3} max={5}   step={0.1} unit="s" onChange={(v) => u({ duration: v })} />
    </div>
  )
}

function EffectConfigEditor({ effect, onChange }: { effect: EffectConfig; onChange: (e: EffectConfig) => void }) {
  switch (effect.type) {
    case 'notification-box': return <CfgNotificationBox cfg={effect.cfg} onChange={(c) => onChange({ type: effect.type, cfg: c })} />
    case 'terminal-toast':   return <CfgTerminalToast   cfg={effect.cfg} onChange={(c) => onChange({ type: effect.type, cfg: c })} />
    case 'floaties':         return <CfgFloaties         cfg={effect.cfg} onChange={(c) => onChange({ type: effect.type, cfg: c })} />
    case 'corruption-burst': return <CfgCorruption       cfg={effect.cfg} onChange={(c) => onChange({ type: effect.type, cfg: c })} />
    case 'network-glitch':   return <CfgNetworkGlitch    cfg={effect.cfg} onChange={(c) => onChange({ type: effect.type, cfg: c })} />
    case 'vignette-pulse':   return <CfgVignette         cfg={effect.cfg} onChange={(c) => onChange({ type: effect.type, cfg: c })} />
    case 'screen-shake':     return <CfgScreenShake      cfg={effect.cfg} onChange={(c) => onChange({ type: effect.type, cfg: c })} />
    case 'typewriter':       return <CfgTypewriter        cfg={effect.cfg} onChange={(c) => onChange({ type: effect.type, cfg: c })} />
    case 'static-burst':     return <CfgStaticBurst      cfg={effect.cfg} onChange={(c) => onChange({ type: effect.type, cfg: c })} />
  }
}

function EffectCatalogPicker({ onPick }: { onPick: (type: EffectType) => void }) {
  return (
    <Panel title="Choose Effect Type">
      <div className="text-[10px] text-zinc-500 mb-2">Select what visual this event plays:</div>
      <div className="space-y-0.5">
        {EFFECT_CATALOG.map(({ type, icon, label, desc }) => (
          <button key={type} onClick={() => onPick(type)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded hover:bg-zinc-700/60 border border-transparent hover:border-zinc-600/60 transition-colors text-left">
            <span className="text-base w-5 text-center shrink-0">{icon}</span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-200">{label}</div>
              <div className="text-[10px] text-zinc-500 leading-snug">{desc}</div>
            </div>
          </button>
        ))}
      </div>
    </Panel>
  )
}

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
      {/* Identity card */}
      <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/60">
        <span className="text-3xl">{def.icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-zinc-100">{def.label}</div>
          <div className="text-[11px] text-zinc-500 font-mono">{def.id}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">{def.desc}</div>
        </div>
      </div>

      {/* Edit identity — custom events only */}
      {!def.builtIn && (
        <Panel title="Identity">
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <div className="text-[10px] text-zinc-400 w-12 shrink-0">Icon</div>
              <input type="text" value={def.icon} onChange={(e) => update((d) => { d.icon = e.target.value })} className="w-16 text-center text-lg" placeholder="\u26A1" />
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
      )}

      {/* Effect section */}
      {def.builtIn ? (
        <Panel title="Effect">
          <div className="text-[10px] text-zinc-500 italic">Built-in animation — not configurable.</div>
        </Panel>
      ) : def.effect === null ? (
        <EffectCatalogPicker onPick={(type) => update((d) => { d.effect = makeDefaultEffect(type) })} />
      ) : (
        <Panel title={'Effect \u2014 ' + EFFECT_CATALOG.find((c) => c.type === def.effect?.type)?.label}>
          <EffectConfigEditor
            effect={def.effect}
            onChange={(e) => update((d) => { d.effect = e })}
          />
          <button className="mt-3 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
            onClick={() => update((d) => { d.effect = null })}>
            \u21BA Change effect type
          </button>
        </Panel>
      )}

      {/* Auto-trigger section */}
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

      {/* Delete — custom events only */}
      {!def.builtIn && onDelete && (
        <div className="pt-1">
          <Btn variant="danger" onClick={onDelete} className="w-full text-xs">Delete Event</Btn>
        </div>
      )}
    </div>
  )
}"""

src = src[:ef_start] + NEW_EVENTFORM + src[ef_end:]
print("✓ 5: EventForm replaced with full-featured version")

# ── 6: Update handleAddEvent to include effect: null ──
old_add = "    const def: EventDef = { id, label: 'New Event', icon: '\u26A1', color: 'text-cyan-400', desc: '', auto: { enabled: false, mode: 'interval', intervalMin: 15, idleMin: 5 } }"
new_add  = "    const def: EventDef = { id, label: 'New Event', icon: '\u26A1', color: 'text-cyan-400', desc: '', auto: { enabled: false, mode: 'interval', intervalMin: 15, idleMin: 5 }, effect: null }"
assert src.count(old_add) == 1, "PATCH 6 - handleAddEvent"
src = src.replace(old_add, new_add, 1)
print("✓ 6: handleAddEvent sets effect: null")

# ── 7: Update Fire Now actionFn to emit full OverlayTriggerPayload ──
old_fire = "    actionFn    = () => socket.emit('overlay:trigger', selected.id)"
new_fire  = "    actionFn    = () => socket.emit('overlay:trigger', { id: selected.id, effect: def?.effect ?? null })"
assert src.count(old_fire) == 1, "PATCH 7 - Fire Now"
src = src.replace(old_fire, new_fire, 1)
print("✓ 7: Fire Now emits full OverlayTriggerPayload")

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(src)

print(f"\n\u2713 Written {src.count(chr(10))+1} lines to {FILE}")
