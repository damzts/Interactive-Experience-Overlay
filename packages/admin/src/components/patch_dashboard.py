#!/usr/bin/env python3
"""Patch Dashboard.tsx — events redesign."""
import re, sys

FILE = '/mnt/c/projects/stream/ieom/packages/admin/src/components/Dashboard.tsx'

with open(FILE, 'r', encoding='utf-8') as f:
    src = f.read()

original = src

# ── 1: Add AutoTrigger + EventDef types; rename EVENT_DEFS → DEFAULT_EVENT_DEFS ──

old_event_defs = """\
// ── Events def ─────────────────────────────────────────────────────

const EVENT_DEFS: { label: string; event: OVERLAY_EVENT; icon: string; color: string; desc: string }[] = [
  { label: 'DEATH',   event: OVERLAY_EVENT.DEATH,          icon: '💀', color: 'text-red-400',     desc: 'Red vignette + YOU DIED overlay' },
  { label: 'VICTORY', event: OVERLAY_EVENT.VICTORY,        icon: '🏆', color: 'text-yellow-400',  desc: 'Win98 dialog: MISSION.LOG saved' },
  { label: 'REVIVE',  event: OVERLAY_EVENT.REVIVE,         icon: '❤',  color: 'text-emerald-400', desc: 'Terminal: Restarting process...' },
  { label: 'GLITCH',  event: OVERLAY_EVENT.NETWORK_GLITCH, icon: '📡', color: 'text-purple-400',  desc: 'Full-screen artifact burst' },
]"""

new_event_defs = """\
// ── Events def ─────────────────────────────────────────────────────

type AutoTrigger = { enabled: boolean; mode: 'interval' | 'idle'; intervalMin: number; idleMin: number }
type EventDef    = { id: string; label: string; icon: string; color: string; desc: string; builtIn?: boolean; auto: AutoTrigger }

const DEFAULT_EVENT_DEFS: EventDef[] = [
  { id: OVERLAY_EVENT.DEATH,          label: 'DEATH',   icon: '💀', color: 'text-red-400',     desc: 'Red vignette + YOU DIED overlay', builtIn: true, auto: { enabled: false, mode: 'interval', intervalMin: 20, idleMin: 5 } },
  { id: OVERLAY_EVENT.VICTORY,        label: 'VICTORY', icon: '🏆', color: 'text-yellow-400',  desc: 'Win98 dialog: MISSION.LOG saved', builtIn: true, auto: { enabled: false, mode: 'interval', intervalMin: 30, idleMin: 5 } },
  { id: OVERLAY_EVENT.REVIVE,         label: 'REVIVE',  icon: '❤',  color: 'text-emerald-400', desc: 'Terminal: Restarting process...',  builtIn: true, auto: { enabled: false, mode: 'interval', intervalMin: 25, idleMin: 5 } },
  { id: OVERLAY_EVENT.NETWORK_GLITCH, label: 'GLITCH',  icon: '📡', color: 'text-purple-400',  desc: 'Full-screen artifact burst',       builtIn: true, auto: { enabled: false, mode: 'interval', intervalMin: 15, idleMin: 5 } },
]"""

assert old_event_defs in src, "PATCH 1 - EVENT_DEFS: anchor not found"
src = src.replace(old_event_defs, new_event_defs, 1)
print("✓ 1: EVENT_DEFS → DEFAULT_EVENT_DEFS + types")

# ── 2: SelectedItem — change event: OVERLAY_EVENT → id: string; remove auto-events ──

old_selected = """\
type SelectedItem =
  | { kind: 'env';   envState: STATE }
  | { kind: 'scene'; sceneState: STATE }
  | { kind: 'app';   appId: string }
  | { kind: 'event'; event: OVERLAY_EVENT }
  | { kind: 'audio' }
  | { kind: 'auto-events' }
  | { kind: 'keybinds' }
  | { kind: 'archive' }
  | { kind: 'settings' }"""

new_selected = """\
type SelectedItem =
  | { kind: 'env';   envState: STATE }
  | { kind: 'scene'; sceneState: STATE }
  | { kind: 'app';   appId: string }
  | { kind: 'event'; id: string }
  | { kind: 'audio' }
  | { kind: 'keybinds' }
  | { kind: 'archive' }
  | { kind: 'settings' }"""

assert old_selected in src, "PATCH 2 - SelectedItem: anchor not found"
src = src.replace(old_selected, new_selected, 1)
print("✓ 2: SelectedItem updated")

# ── 3: itemKey — item.event → item.id ──

old_itemkey = "  if (item.kind === 'event') return 'event-' + item.event"
new_itemkey = "  if (item.kind === 'event') return 'event-' + item.id"

assert old_itemkey in src, "PATCH 3 - itemKey: anchor not found"
src = src.replace(old_itemkey, new_itemkey, 1)
print("✓ 3: itemKey updated")

# ── 4: Replace EventForm ──

old_eventform = """\
// ── EventForm ──────────────────────────────────────────────────────

function EventForm({ event }: { event: OVERLAY_EVENT }) {
  const def = EVENT_DEFS.find((e) => e.event === event)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/60">
        <span className="text-3xl">{def?.icon}</span>
        <div>
          <div className="text-sm font-bold text-zinc-100">{def?.label}</div>
          <div className="text-[11px] text-zinc-500 font-mono">{event}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">{def?.desc}</div>
        </div>
      </div>
      <Panel title="Trigger Sources">
        <div className="space-y-1.5 text-[11px] text-zinc-400">
          <div>⌨  Manual — Fire Now button above (in panel header)</div>
          <div>⌨  Hotkey — Studio › Keybinds</div>
          <div>⚡  Auto — Studio › Auto-Events</div>
        </div>
      </Panel>
    </div>
  )
}"""

new_eventform = """\
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
}"""

assert old_eventform in src, "PATCH 4 - EventForm: anchor not found"
src = src.replace(old_eventform, new_eventform, 1)
print("✓ 4: EventForm rewritten")

# ── 5: Remove AutoEventRow + AutoEventsConfig ──
# Replace from the comment through the closing } of AutoEventsConfig, keeping SceneConfig intact
# Anchor: the comment line and everything through the last } before LivePreview

# Find the AutoEventsConfig comment → LivePreview comment boundary
marker_start = '// ── AutoEventsConfig ───────────────────────────────────────────────'
marker_end   = '// ── LivePreview ────────────────────────────────────────────────────'

i_start = src.find(marker_start)
i_end   = src.find(marker_end)
assert i_start != -1, "PATCH 5 - AutoEventsConfig start: marker not found"
assert i_end   != -1, "PATCH 5 - LivePreview marker: not found"
assert i_start < i_end, "PATCH 5 - markers out of order"

# Replace the block (including trailing newline before LivePreview)
old_auto_block = src[i_start:i_end]
src = src[:i_start] + src[i_end:]
print(f"✓ 5: Removed AutoEventRow + AutoEventsConfig ({len(old_auto_block)} chars)")

# ── 6: RightPaneContent — add eventDefs/onUpdateEvent/onDeleteEvent props + fix dispatches ──

old_rightpane_content_sig = """\
function RightPaneContent({ selected, onDeleted }: { selected: SelectedItem; onDeleted: () => void }) {"""

new_rightpane_content_sig = """\
function RightPaneContent({ selected, onDeleted, eventDefs, onUpdateEvent, onDeleteEvent }: {
  selected: SelectedItem; onDeleted: () => void
  eventDefs: EventDef[]; onUpdateEvent: (d: EventDef) => void; onDeleteEvent: (id: string) => void
}) {"""

assert old_rightpane_content_sig in src, "PATCH 6a - RightPaneContent sig: anchor not found"
src = src.replace(old_rightpane_content_sig, new_rightpane_content_sig, 1)
print("✓ 6a: RightPaneContent signature updated")

# Fix the event dispatch line
old_event_dispatch = "  if (selected.kind === 'event') return <EventForm event={selected.event} />"
new_event_dispatch = """\
  if (selected.kind === 'event') {
    const def = eventDefs.find((e) => e.id === selected.id)
    if (!def) return <div className="text-zinc-600 text-xs italic p-4">Event not found.</div>
    return <EventForm def={def} onUpdate={onUpdateEvent} onDelete={() => onDeleteEvent(def.id)} />
  }"""

assert old_event_dispatch in src, "PATCH 6b - event dispatch: anchor not found"
src = src.replace(old_event_dispatch, new_event_dispatch, 1)
print("✓ 6b: event dispatch updated")

# Remove auto-events case
old_auto_case = "\n  if (selected.kind === 'auto-events') return <AutoEventsConfig />"
assert old_auto_case in src, "PATCH 6c - auto-events case: anchor not found"
src = src.replace(old_auto_case, '', 1)
print("✓ 6c: auto-events dispatch removed")

# ── 7: RightPane — add eventDefs prop + fix event header + pass props to RightPaneContent ──

old_rightpane_sig = """\
function RightPane({ selected, onClose }: { selected: SelectedItem | null; onClose: () => void }) {"""

new_rightpane_sig = """\
function RightPane({ selected, onClose, eventDefs, onUpdateEvent, onDeleteEvent }: {
  selected: SelectedItem | null; onClose: () => void
  eventDefs: EventDef[]; onUpdateEvent: (d: EventDef) => void; onDeleteEvent: (id: string) => void
}) {"""

assert old_rightpane_sig in src, "PATCH 7a - RightPane sig: anchor not found"
src = src.replace(old_rightpane_sig, new_rightpane_sig, 1)
print("✓ 7a: RightPane signature updated")

# Fix event header: was using EVENT_DEFS.find((e) => e.event === selected.event)
old_event_header = """\
  } else if (selected.kind === 'event') {
    const def   = EVENT_DEFS.find((e) => e.event === selected.event)
    headerIcon  = def?.icon  ?? '⚡'
    headerLabel = def?.label ?? 'Event'
    actionLabel = '▶ Fire Now'
    actionFn    = () => socket.emit('overlay:trigger', selected.event)
  } else if (selected.kind === 'audio')       { headerIcon = '🔊'; headerLabel = 'Audio' }
  else if (selected.kind === 'auto-events') { headerIcon = '⚡'; headerLabel = 'Auto-Events' }
  else if (selected.kind === 'keybinds')    { headerIcon = '⌨';  headerLabel = 'Keybinds' }"""

new_event_header = """\
  } else if (selected.kind === 'event') {
    const def   = eventDefs.find((e) => e.id === selected.id)
    headerIcon  = def?.icon  ?? '⚡'
    headerLabel = def?.label ?? 'Event'
    isLive      = def?.auto.enabled ?? false
    actionLabel = '▶ Fire Now'
    actionFn    = () => socket.emit('overlay:trigger', selected.id)
  } else if (selected.kind === 'audio')       { headerIcon = '🔊'; headerLabel = 'Audio' }
  else if (selected.kind === 'keybinds')    { headerIcon = '⌨';  headerLabel = 'Keybinds' }"""

assert old_event_header in src, "PATCH 7b - event header: anchor not found"
src = src.replace(old_event_header, new_event_header, 1)
print("✓ 7b: RightPane event header updated")

# Pass new props to RightPaneContent inside RightPane
old_rpc_usage = "        <RightPaneContent selected={selected} onDeleted={onClose} />"
new_rpc_usage = "        <RightPaneContent selected={selected} onDeleted={onClose} eventDefs={eventDefs} onUpdateEvent={onUpdateEvent} onDeleteEvent={onDeleteEvent} />"

assert old_rpc_usage in src, "PATCH 7c - RightPaneContent usage: anchor not found"
src = src.replace(old_rpc_usage, new_rpc_usage, 1)
print("✓ 7c: RightPaneContent call updated")

# ── 8: LeftSidebar — add eventDefs + onAddEvent props; update Events section; remove Auto-Events ──

old_sidebar_sig = """\
function LeftSidebar({ selected, onSelect }: { selected: SelectedItem | null; onSelect: (item: SelectedItem) => void }) {"""

new_sidebar_sig = """\
function LeftSidebar({ selected, onSelect, eventDefs, onAddEvent }: {
  selected: SelectedItem | null; onSelect: (item: SelectedItem) => void
  eventDefs: EventDef[]; onAddEvent: () => void
}) {"""

assert old_sidebar_sig in src, "PATCH 8a - LeftSidebar sig: anchor not found"
src = src.replace(old_sidebar_sig, new_sidebar_sig, 1)
print("✓ 8a: LeftSidebar signature updated")

# Update Events section - replace static EVENT_DEFS map with eventDefs map + AddBtn
old_events_section = """\
      <SectionLabel>Events</SectionLabel>
      {EVENT_DEFS.map(({ label, event, icon, color }) => (
        <SidebarBtn key={event} icon={icon} label={label}
          active={isActive({ kind: 'event', event })}
          onClick={() => onSelect({ kind: 'event', event })} />
      ))}"""

new_events_section = """\
      <SectionLabel>Events</SectionLabel>
      {eventDefs.map((def) => (
        <SidebarBtn key={def.id} icon={def.icon} label={def.label}
          live={def.auto.enabled}
          active={isActive({ kind: 'event', id: def.id })}
          onClick={() => onSelect({ kind: 'event', id: def.id })} />
      ))}
      <AddBtn label="New Event" onClick={onAddEvent} />"""

assert old_events_section in src, "PATCH 8b - Events section: anchor not found"
src = src.replace(old_events_section, new_events_section, 1)
print("✓ 8b: LeftSidebar Events section updated")

# Remove Auto-Events from Studio section
old_auto_events_btn = """\
      <SidebarBtn icon="⚡" label="Auto-Events" active={isActive({ kind: 'auto-events' })} onClick={() => onSelect({ kind: 'auto-events' })} />
"""
assert old_auto_events_btn in src, "PATCH 8c - Auto-Events button: anchor not found"
src = src.replace(old_auto_events_btn, '', 1)
print("✓ 8c: Auto-Events Studio button removed")

# ── 9: Dashboard — add eventDefs state + handlers; pass to LeftSidebar and RightPane ──

old_dashboard = """\
export function Dashboard() {
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const applications = useAdminStore((s) => s.config.applications)

  // Clear selection when selected app is removed
  useEffect(() => {
    if (selected?.kind === 'app' && !applications.find((a) => a.id === selected.appId)) {
      setSelected(null)
    }
  }, [applications, selected])

  const handleSelect = (item: SelectedItem) => {
    // Toggle off if clicking the already-selected item
    if (selected && itemKey(item) === itemKey(selected)) {
      setSelected(null)
    } else {
      setSelected(item)
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <TopBar onSettings={() => handleSelect({ kind: 'settings' })} />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar selected={selected} onSelect={handleSelect} />
        <LivePreview />
        <RightPane selected={selected} onClose={() => setSelected(null)} />
      </div>
    </div>
  )
}"""

new_dashboard = """\
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
        <LeftSidebar selected={selected} onSelect={handleSelect} eventDefs={eventDefs} onAddEvent={handleAddEvent} />
        <LivePreview />
        <RightPane selected={selected} onClose={() => setSelected(null)} eventDefs={eventDefs} onUpdateEvent={handleUpdateEvent} onDeleteEvent={handleDeleteEvent} />
      </div>
    </div>
  )
}"""

assert old_dashboard in src, "PATCH 9 - Dashboard: anchor not found"
src = src.replace(old_dashboard, new_dashboard, 1)
print("✓ 9: Dashboard updated with eventDefs state")

# ── Verify no leftover references to old identifiers ──
problems = []
for bad in ['OVERLAY_EVENT }', 'EVENT_DEFS', 'auto-events', 'kind: .auto-events', "selected.event)", '.event === ']:
    if bad in src:
        # Find all occurrences
        lines = [i+1 for i, line in enumerate(src.splitlines()) if bad in line]
        problems.append(f"  Still has '{bad}' at lines {lines}")

if problems:
    print("\n⚠  Residual references:")
    for p in problems: print(p)
else:
    print("\n✓ No residual old references found")

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(src)

print(f"\n✓ Written {len(src.splitlines())} lines to {FILE}")
