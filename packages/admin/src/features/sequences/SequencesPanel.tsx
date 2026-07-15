import { useEffect, useState, useCallback, useMemo } from 'react'
import type { Sequence } from '@ieomlabs/shared'
import { fetchSequences, createSequence } from '../../api/sequencesApi'
import { SequenceEditor } from './SequenceEditor'
import { AutomationPanel } from '../automation/AutomationPanel'
import { MediaSearchInput } from '../media-library/MediaLibraryPanel'
import { LibraryItemBtn } from '../media-library/mediaLibraryUi'
import { ConfigNotice } from '../../shared/ui'

// ── Tab definition ─────────────────────────────────────────────────

export type SequencesTab = 'sequences' | 'automation'

const SEQUENCES_PANEL_TABS: Array<{ tab: SequencesTab; icon: string; label: string }> = [
  { tab: 'sequences',  icon: '🎞', label: 'Sequences' },
  { tab: 'automation', icon: '🤖', label: 'Automation' },
]

// ── Left sidebar buttons ───────────────────────────────────────────

export function SidebarBtn({ icon, label, active, onClick }: {
  icon: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'mb-1.5 flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs transition-all duration-150 ' +
        (active
          ? 'border-cyan-400/30 bg-cyan-500/12 text-zinc-50 shadow-[0_0_0_1px_rgba(34,211,238,0.06)]'
          : 'border-white/5 bg-white/[0.02] text-zinc-400 hover:border-cyan-400/20 hover:bg-white/[0.04] hover:text-zinc-100')
      }
    >
      <span className="h-4 w-4 shrink-0 overflow-hidden text-center text-sm leading-none flex items-center justify-center">{icon}</span>
      <span className="flex-1 truncate font-medium">{label}</span>
    </button>
  )
}

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-1 flex w-full items-center gap-1.5 rounded-xl border border-dashed border-white/10 px-3 py-2 text-[11px] text-zinc-500 transition-colors hover:border-cyan-500/35 hover:bg-cyan-500/8 hover:text-cyan-200"
    >
      <span className="w-4 shrink-0 text-center text-sm">+</span>
      <span>{label}</span>
    </button>
  )
}

// ── SequencesPanel ─────────────────────────────────────────────────

export function SequencesPanel({
  tab = 'sequences',
  onTabChange,
}: {
  tab?: SequencesTab
  onTabChange?: (tab: SequencesTab) => void
}) {
  const [activeTab, setActiveTab] = useState<SequencesTab>(tab)
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Sync tab prop → local state (e.g. when navigating via TopBar subItem)
  useEffect(() => { setActiveTab(tab) }, [tab])

  const loadSequences = useCallback(async () => {
    const all = await fetchSequences()
    setSequences(all)
    // Auto-select first if nothing is selected or current selection is gone
    setSelectedId((prev) => {
      if (prev && all.some((s) => s.id === prev)) return prev
      return all[0]?.id ?? null
    })
  }, [])

  useEffect(() => {
    void loadSequences()
  }, [loadSequences])

  const handleTabClick = (t: SequencesTab) => {
    setActiveTab(t)
    onTabChange?.(t)
  }

  const handleAdd = async () => {
    const seq = await createSequence(`Sequence ${sequences.length + 1}`, [])
    setSequences((prev) => [seq, ...prev])
    setSelectedId(seq.id)
  }

  const handleDeleted = useCallback(() => {
    void loadSequences()
  }, [loadSequences])

  const filteredSequences = useMemo(() => {
    if (!search.trim()) return sequences
    const q = search.toLowerCase()
    return sequences.filter((s) => s.label.toLowerCase().includes(q))
  }, [sequences, search])

  const selectedSeq = sequences.find((s) => s.id === selectedId) ?? null

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Tab bar ── */}
      <div className="flex shrink-0 items-center border-b border-[var(--color-border-default)]">
        {SEQUENCES_PANEL_TABS.map(({ tab: t, icon, label }) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTabClick(t)}
            className={
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-2 text-xs font-medium transition-colors ' +
              (activeTab === t
                ? 'border-cyan-400 text-zinc-50'
                : 'border-transparent text-zinc-500 hover:text-zinc-200')
            }
          >
            <span className="text-sm leading-none">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {activeTab === 'automation' ? (
        // Automation tab: AutomationPanel already has its own left listbox layout
        <div className="flex-1 min-h-0 overflow-hidden">
          <AutomationPanel />
        </div>
      ) : (
        // Sequences tab: left searchbar + list sidebar + right editor
        <div className="grid flex-1 min-h-0 gap-5 grid-cols-[220px_minmax(0,1fr)] border-t border-[var(--color-border-default)] pt-4 overflow-hidden">
          {/* Left sidebar: search + list */}
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            <MediaSearchInput value={search} onChange={setSearch} placeholder="Search sequences…" />
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
              {filteredSequences.length === 0 && sequences.length > 0 && (
                <ConfigNotice tone="info">No sequences match this filter.</ConfigNotice>
              )}
              {filteredSequences.length === 0 && sequences.length === 0 && (
                <div className="px-1 py-2 text-[10px] text-zinc-600 italic">No sequences yet.</div>
              )}
              {filteredSequences.map((seq) => (
                <LibraryItemBtn
                  key={seq.id}
                  active={selectedId === seq.id}
                  onClick={() => setSelectedId(seq.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm leading-none">🎞</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{seq.label}</span>
                    <span className="shrink-0 rounded-full bg-zinc-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                      {seq.steps.length} {seq.steps.length === 1 ? 'step' : 'steps'}
                    </span>
                  </div>
                </LibraryItemBtn>
              ))}
            </div>
            <AddBtn label="New Blank Sequence" onClick={() => { void handleAdd() }} />
          </div>

          {/* Right content */}
          <div className="min-w-0 min-h-0 overflow-y-auto pr-1">
            {selectedSeq ? (
              <SequenceEditor
                key={selectedSeq.id}
                sequence={selectedSeq}
                onSaved={(next) => {
                  setSequences((prev) => prev.map((s) => s.id === next.id ? next : s))
                }}
                onDeleted={handleDeleted}
              />
            ) : (
              <ConfigNotice tone="info" className="py-8 text-center">
                {sequences.length === 0
                  ? 'Create your first sequence with the button on the left.'
                  : 'Select a sequence to edit it.'}
              </ConfigNotice>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
