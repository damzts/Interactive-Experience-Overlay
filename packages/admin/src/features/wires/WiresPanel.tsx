import { useEffect, useState, useCallback } from 'react'
import type { WidgetWire, WidgetIntentManifest } from '@ieomlabs/shared'
import { STATE, NAVIGABLE_STATES } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { fetchWires, fetchWireManifests, createWire, patchWire, deleteWire } from '../../api/wiresApi'
import { ConfigPageIntro, ConfigSectionPanel } from '../../shared/ui'
import { Button } from '../../components/atoms'
import { Toggle } from '../../components/atoms'

// ── Helpers ──────────────────────────────────────────────────────

function widgetLabel(appId: string, apps: { id: string; label: string }[]): string {
  return apps.find((a) => a.id === appId)?.label ?? appId
}

// ── WiresPanel ───────────────────────────────────────────────────

export function WiresPanel() {
  const applications = useAdminStore((s) => s.config.applications)

  const [wires, setWires] = useState<WidgetWire[]>([])
  const [manifests, setManifests] = useState<WidgetIntentManifest[]>([])
  const [loading, setLoading] = useState(true)

  // Pending new wire state
  const [srcWidgetId,  setSrcWidgetId]  = useState<string | null>(null)
  const [srcEvent,     setSrcEvent]     = useState<string | null>(null)
  const [dstWidgetId,  setDstWidgetId]  = useState<string | null>(null)
  const [dstAction,    setDstAction]    = useState<string | null>(null)
  const [sceneFilter,  setSceneFilter]  = useState<STATE[]>([])
  const [adding, setAdding] = useState(false)

  // Map componentType → manifest for quick lookup
  const manifestByType = new Map(manifests.map((m) => [m.componentType, m]))

  // Apps that have at least one emitter
  const emitterApps = applications.filter((app) =>
    app.widgetComponent && (manifestByType.get(app.widgetComponent)?.emits.length ?? 0) > 0
  )

  // Apps that have at least one receiver
  const receiverApps = applications.filter((app) =>
    app.widgetComponent && (manifestByType.get(app.widgetComponent)?.accepts.length ?? 0) > 0
  )

  const srcManifest = applications.find((a) => a.id === srcWidgetId)?.widgetComponent
    ? manifestByType.get(applications.find((a) => a.id === srcWidgetId)!.widgetComponent!)
    : null

  const dstManifest = applications.find((a) => a.id === dstWidgetId)?.widgetComponent
    ? manifestByType.get(applications.find((a) => a.id === dstWidgetId)!.widgetComponent!)
    : null

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [w, m] = await Promise.all([fetchWires(), fetchWireManifests()])
      setWires(w)
      setManifests(m)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const canAdd = !!(srcWidgetId && srcEvent && dstWidgetId && dstAction)

  async function handleAdd() {
    if (!canAdd) return
    setAdding(true)
    try {
      const wire = await createWire({
        triggerWidgetId: srcWidgetId!,
        triggerEvent:    srcEvent!,
        targetWidgetId:  dstWidgetId!,
        targetAction:    dstAction!,
        enabled: true,
        condition: sceneFilter.length > 0 ? { sceneIs: sceneFilter } : undefined,
      })
      setWires((prev) => [...prev, wire])
      setSrcWidgetId(null); setSrcEvent(null)
      setDstWidgetId(null); setDstAction(null)
      setSceneFilter([])
    } finally { setAdding(false) }
  }

  async function handleToggle(wire: WidgetWire) {
    const updated = await patchWire(wire.id, { enabled: !wire.enabled })
    setWires((prev) => prev.map((w) => w.id === updated.id ? updated : w))
  }

  async function handleDelete(id: string) {
    await deleteWire(id)
    setWires((prev) => prev.filter((w) => w.id !== id))
  }

  return (
    <div className="space-y-5">
      <ConfigPageIntro
        icon="⚡"
        title="Wires"
        description="Connect widget signals to widget actions. When a source widget emits a signal, the wired target widget receives an action automatically — no manual scripting required."
      />

      {/* ── Wire builder ── */}
      <ConfigSectionPanel label="New Wire">
        <div className="grid grid-cols-2 gap-4">
          {/* Source column */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Source widget</div>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {emitterApps.length === 0 && (
                <div className="text-[10px] text-zinc-600 italic">No widgets with signals</div>
              )}
              {emitterApps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => { setSrcWidgetId(app.id); setSrcEvent(null) }}
                  className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${
                    srcWidgetId === app.id
                      ? 'bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/40'
                      : 'text-zinc-300 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {app.label}
                </button>
              ))}
            </div>

            {srcWidgetId && srcManifest && (
              <>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 pt-1">Signal</div>
                <div className="space-y-1">
                  {srcManifest.emits.map((sig) => (
                    <button
                      key={sig.event}
                      type="button"
                      onClick={() => setSrcEvent(sig.event)}
                      className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${
                        srcEvent === sig.event
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'text-zinc-400 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <span className="font-medium">{sig.label}</span>
                      <span className="ml-2 font-mono text-[9px] text-zinc-600">{sig.event}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Target column */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Target widget</div>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {receiverApps.length === 0 && (
                <div className="text-[10px] text-zinc-600 italic">No widgets with actions</div>
              )}
              {receiverApps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => { setDstWidgetId(app.id); setDstAction(null) }}
                  className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${
                    dstWidgetId === app.id
                      ? 'bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/40'
                      : 'text-zinc-300 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {app.label}
                </button>
              ))}
            </div>

            {dstWidgetId && dstManifest && (
              <>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 pt-1">Action</div>
                <div className="space-y-1">
                  {dstManifest.accepts.map((act) => (
                    <button
                      key={act.action}
                      type="button"
                      onClick={() => setDstAction(act.action)}
                      className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${
                        dstAction === act.action
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                          : 'text-zinc-400 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <span className="font-medium">{act.label}</span>
                      <span className="ml-2 font-mono text-[9px] text-zinc-600">{act.action}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Scene condition */}
        <div className="mt-4 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Scene condition <span className="normal-case font-normal text-zinc-600">(optional — leave blank to fire in any scene)</span>
          </div>
          <div className="flex items-center gap-2">
            {NAVIGABLE_STATES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSceneFilter((prev) =>
                  prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                )}
                className={`rounded-lg px-3 py-1.5 text-xs transition-colors border ${
                  sceneFilter.includes(s)
                    ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300'
                    : 'border-white/8 bg-white/[0.02] text-zinc-500 hover:border-white/15 hover:text-zinc-300'
                }`}
              >
                {s}
              </button>
            ))}
            {sceneFilter.length > 0 && (
              <button type="button" onClick={() => setSceneFilter([])} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
                clear
              </button>
            )}
          </div>
        </div>

        {/* Add button */}
        <div className="mt-4 flex items-center gap-3">
          {canAdd && (
            <div className="flex-1 text-[10px] text-zinc-400">
              <span className="text-emerald-400">{widgetLabel(srcWidgetId!, applications)} › {srcEvent}</span>
              {' → '}
              <span className="text-violet-400">{widgetLabel(dstWidgetId!, applications)} › {dstAction}</span>
              {sceneFilter.length > 0 && (
                <span className="text-cyan-400"> (in {sceneFilter.join(', ')})</span>
              )}
            </div>
          )}
          <Button
            variant="primary"
            size="sm"
            disabled={!canAdd || adding}
            loading={adding}
            onClick={handleAdd}
          >
            Add Wire
          </Button>
        </div>
      </ConfigSectionPanel>

      {/* ── Wire list ── */}
      <ConfigSectionPanel label={`Active Wires${wires.length ? ` (${wires.length})` : ''}`}>
        {loading ? (
          <div className="text-[10px] text-zinc-600 italic">Loading…</div>
        ) : wires.length === 0 ? (
          <div className="text-[10px] text-zinc-600 italic">No wires configured yet.</div>
        ) : (
          <div className="space-y-2">
            {wires.map((wire) => (
              <div
                key={wire.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-opacity ${
                  wire.enabled ? 'border-white/8 bg-white/[0.02]' : 'border-white/4 bg-transparent opacity-50'
                }`}
              >
                {/* Source */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-emerald-400 font-medium truncate">{widgetLabel(wire.triggerWidgetId, applications)}</span>
                    <span className="text-zinc-600">›</span>
                    <span className="font-mono text-[10px] text-zinc-400 truncate">{wire.triggerEvent}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
                    <span>→</span>
                    <span className="text-violet-400 font-medium truncate">{widgetLabel(wire.targetWidgetId, applications)}</span>
                    <span className="text-zinc-600">›</span>
                    <span className="font-mono text-zinc-400 truncate">{wire.targetAction}</span>
                    {wire.condition?.sceneIs?.length && (
                      <span className="ml-1 font-mono text-[9px] text-cyan-500/80 shrink-0">
                        [{wire.condition.sceneIs.join(', ')}]
                      </span>
                    )}
                  </div>
                </div>

                {/* Toggle enabled */}
                <Toggle
                  checked={wire.enabled}
                  onChange={() => handleToggle(wire)}
                  size="sm"
                  label={wire.enabled ? 'Enabled' : 'Disabled'}
                />

                {/* Delete */}
                <button
                  type="button"
                  aria-label="Delete wire"
                  onClick={() => handleDelete(wire.id)}
                  className="text-zinc-600 hover:text-red-400 transition-colors text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </ConfigSectionPanel>
    </div>
  )
}
