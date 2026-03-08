import { useEffect, useState } from 'react'
import { Panel, Btn } from '../components/ui'

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
    <div className="flex flex-col gap-4 max-w-2xl">

      {error && (
        <div className="text-red-400 bg-red-950/40 border border-red-800/40 rounded px-3 py-2 text-xs">⚠ {error}</div>
      )}

      <Panel title="SYSTEM ARCHIVE — Persistent Stats">
        {!stats && !error && <div className="text-sm text-zinc-500">Loading archive…</div>}
        {stats && (
          <table className="w-full text-sm border-collapse">
            <tbody>
              {(Object.entries(stats) as [keyof Stats, number][]).map(([key, val]) => (
                <tr key={key} className="border-b border-zinc-700/60">
                  <td className="py-2 text-cyan-400 font-medium w-36 capitalize">{key}</td>
                  <td className="py-2 font-mono font-bold text-base text-zinc-100">{val}</td>
                  <td className="py-2">
                    <Btn onClick={() => handleIncrement(key)} className="text-xs py-0.5 px-2">+1</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Event Log">
        {log.length === 0 ? (
          <div className="text-sm text-zinc-500">No events recorded yet.</div>
        ) : (
          <div className="overflow-auto max-h-52">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0">
                <tr className="border-b border-zinc-700 bg-zinc-800">
                  <th className="py-1.5 text-left text-zinc-400 font-medium pr-4 w-40">Date</th>
                  <th className="py-1.5 text-left text-zinc-400 font-medium pr-4 w-28">Event</th>
                  <th className="py-1.5 text-left text-zinc-400 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {log.map((e) => (
                  <tr key={e.id} className="border-b border-zinc-800/60">
                    <td className="py-1 font-mono text-zinc-400">{e.date}</td>
                    <td className="py-1 text-cyan-400">{e.event}</td>
                    <td className="py-1 text-zinc-400">{e.detail ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Actions">
        <div className="flex gap-3 items-center flex-wrap">
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
          <span className="text-xs text-zinc-500">(v1 — stats persist per session; SQLite in v2)</span>
        </div>
      </Panel>
    </div>
  )
}
