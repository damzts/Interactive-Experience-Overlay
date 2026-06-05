import { useEffect, useState, type ReactNode } from 'react'
import { ConfigPageIntro, ConfigTable, ConfigToolbar } from '../../shared/ui'
import { Button } from '../../components/atoms'
import { Card } from '../../components/molecules'
import { ConfigPanel } from '../../components/organisms'
import {
  getArchiveStats,
  getArchiveLog,
  resetArchiveStats,
  incrementArchiveStat,
} from '../../api/archiveApi.js'
import type { ArchiveStats, ArchiveLogEntry } from '../../api/archiveApi.js'

/** Notice component for informational/warning messages within config panels */
function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: ReactNode }) {
  const toneStyles: Record<string, string> = {
    info: 'border-[var(--color-primary-400)]/25 bg-[var(--color-primary-500)]/10 text-[var(--color-primary-100)]',
    warning: 'border-[var(--color-accent-400)]/30 bg-[var(--color-accent-500)]/12 text-[var(--color-accent-100)]',
    danger: 'border-[var(--color-danger-400)]/30 bg-[var(--color-danger-500)]/12 text-[var(--color-danger-400)]',
    success: 'border-[var(--color-success-400)]/30 bg-[var(--color-success-500)]/12 text-[var(--color-success-400)]',
  }
  return (
    <div className={`rounded-[var(--radius-lg)] border px-3 py-2.5 text-sm shadow-[var(--shadow-sm)] backdrop-blur ${toneStyles[tone]}`}>
      {children}
    </div>
  )
}

export function ArchivePanel() {
  const [stats, setStats] = useState<ArchiveStats | null>(null)
  const [log, setLog] = useState<ArchiveLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  const fetchStats = () => {
    getArchiveStats()
      .then((data) => setStats(data))
      .catch((e) => setError(String(e)))
  }

  const fetchLog = () => {
    getArchiveLog()
      .then((data) => setLog(data))
      .catch(() => {})
  }

  useEffect(() => {
    fetchStats()
    fetchLog()
  }, [])

  const handleReset = async () => {
    await resetArchiveStats()
    setConfirmReset(false)
    setResetDone(true)
    fetchStats()
    fetchLog()
    setTimeout(() => setResetDone(false), 3000)
  }

  const handleIncrement = async (field: keyof ArchiveStats) => {
    await incrementArchiveStat(field)
    fetchStats()
  }

  return (
    <div className="w-full max-w-none space-y-0 pt-1">
      <ConfigPageIntro title="Archive Control">
        Review tracked session metrics, inspect recent archive events, and run maintenance actions from the same configuration surface.
      </ConfigPageIntro>

      {error && <Notice tone="danger">{error}</Notice>}

      <div className="space-y-6 pt-3">
        <ConfigPanel title="System Archive" collapsible>
          {!stats && !error && <Notice tone="info">Loading archive…</Notice>}
          {stats && (
            <ConfigTable compact>
              <table>
                <tbody>
                  {(Object.entries(stats) as [keyof ArchiveStats, number][]).map(([key, val]) => (
                    <tr key={key}>
                      <td className="w-40 capitalize text-sm font-medium text-[var(--color-primary-300)]">{key}</td>
                      <td className="font-mono text-base font-bold text-[var(--color-text-primary)]">{val}</td>
                      <td className="w-24 text-right">
                        <Button variant="secondary" size="sm" onClick={() => handleIncrement(key)}>+1</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ConfigTable>
          )}
        </ConfigPanel>

        <ConfigPanel title="Event Log" collapsible>
          {log.length === 0 ? (
            <Notice tone="info">No events recorded yet.</Notice>
          ) : (
            <div className="max-h-52 overflow-auto">
              <ConfigTable compact>
                <table>
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="w-40">Date</th>
                      <th className="w-28">Event</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.map((e) => (
                      <tr key={e.id}>
                        <td className="font-mono text-[var(--color-text-muted)]">{e.date}</td>
                        <td className="text-[var(--color-primary-300)]">{e.event}</td>
                        <td className="text-[var(--color-text-muted)]">{e.detail ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ConfigTable>
            </div>
          )}
        </ConfigPanel>

        <ConfigPanel title="Actions" collapsible>
          <Notice tone="warning">
            Resetting archive stats clears the operator counters below and refreshes the visible log data.
          </Notice>
          <ConfigToolbar className="mt-3">
            {resetDone && <span className="text-xs text-[var(--color-success-400)]">✔ Stats reset.</span>}
            {!confirmReset ? (
              <Button variant="danger" size="md" onClick={() => setConfirmReset(true)}>Reset All Stats</Button>
            ) : (
              <>
                <span className="text-xs text-[var(--color-danger-400)]">Are you sure?</span>
                <Button variant="danger" size="md" onClick={handleReset}>Yes, Reset</Button>
                <Button variant="secondary" size="md" onClick={() => setConfirmReset(false)}>Cancel</Button>
              </>
            )}
            <div className="flex-1" />
            <span className="text-xs text-[var(--color-text-muted)]">(v1 — stats persist per session; SQLite in v2)</span>
          </ConfigToolbar>
        </ConfigPanel>
      </div>
    </div>
  )
}
