import { useEffect, useState } from 'react'
import { Btn, ConfigNotice, ConfigPageIntro, ConfigSectionPanel, ConfigTable, ConfigToolbar } from '../../shared/ui'

interface Stats {
  wins: number
  losses: number
  deaths: number
  revives: number
  sessions: number
}

interface LogEntry {
  id: number
  date: string
  event: string
  detail: string | null
}

export function ArchivePanel() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  const fetchStats = () => {
    fetch('/api/archive/stats')
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch((e) => setError(String(e)))
  }

  const fetchLog = () => {
    fetch('/api/archive/log')
      .then((r) => r.json())
      .then((data: LogEntry[]) => setLog(data))
      .catch(() => {})
  }

  useEffect(() => {
    fetchStats()
    fetchLog()
  }, [])

  const handleReset = async () => {
    await fetch('/api/archive/reset', { method: 'POST' })
    setConfirmReset(false)
    setResetDone(true)
    fetchStats()
    fetchLog()
    setTimeout(() => setResetDone(false), 3000)
  }

  const handleIncrement = async (field: keyof Stats) => {
    await fetch(`/api/archive/increment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field }),
    })
    fetchStats()
  }

  return (
    <div className="w-full max-w-none space-y-0 pt-1">
      <ConfigPageIntro title="Archive Control">
        Review tracked session metrics, inspect recent archive events, and run maintenance actions from the same configuration surface.
      </ConfigPageIntro>

      {error && <ConfigNotice tone="danger" className="mb-4">{error}</ConfigNotice>}

      <ConfigSectionPanel label="System Archive" first>
        {!stats && !error && <ConfigNotice tone="info">Loading archive…</ConfigNotice>}
        {stats && (
          <ConfigTable compact>
            <table>
              <tbody>
                {(Object.entries(stats) as [keyof Stats, number][]).map(([key, val]) => (
                  <tr key={key}>
                    <td className="w-40 capitalize text-sm font-medium text-cyan-300">{key}</td>
                    <td className="font-mono text-base font-bold text-zinc-100">{val}</td>
                    <td className="w-24 text-right">
                      <Btn onClick={() => handleIncrement(key)} className="px-2 py-1 text-xs">+1</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ConfigTable>
        )}
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Event Log">
        {log.length === 0 ? (
          <ConfigNotice tone="info">No events recorded yet.</ConfigNotice>
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
                      <td className="font-mono text-zinc-400">{e.date}</td>
                      <td className="text-cyan-300">{e.event}</td>
                      <td className="text-zinc-400">{e.detail ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ConfigTable>
          </div>
        )}
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Actions">
        <ConfigNotice tone="warning">
          Resetting archive stats clears the operator counters below and refreshes the visible log data.
        </ConfigNotice>
        <ConfigToolbar className="mt-3">
          {resetDone && <span className="text-xs text-emerald-400">✔ Stats reset.</span>}
          {!confirmReset ? (
            <Btn variant="danger" onClick={() => setConfirmReset(true)}>Reset All Stats</Btn>
          ) : (
            <>
              <span className="text-xs text-red-400">Are you sure?</span>
              <Btn variant="danger" onClick={handleReset}>Yes, Reset</Btn>
              <Btn onClick={() => setConfirmReset(false)}>Cancel</Btn>
            </>
          )}
          <div className="flex-1" />
          <span className="text-xs text-zinc-500">(v1 — stats persist per session; SQLite in v2)</span>
        </ConfigToolbar>
      </ConfigSectionPanel>
    </div>
  )
}
