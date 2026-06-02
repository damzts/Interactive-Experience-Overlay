import { useEffect, useRef, useState } from 'react'
import { socket } from '../../socket/client'
import { Btn, ConfigCard, ConfigNotice, ConfigToolbar } from '../../shared/ui'

// ── Module-level log state (intentionally outside React) ──────────────

const MAX_LOG_ENTRIES = 300

export type LogEntry = { id: number; time: string; dir: '←' | '→'; event: string; details: string }

const logListeners: ((e: LogEntry) => void)[] = []
let logSeq = 0
let logHistory: LogEntry[] = []

function stringifyLogValue(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  if (value instanceof Error) {
    return [value.name ? `${value.name}: ${value.message}` : value.message, value.stack]
      .filter(Boolean)
      .join('\n')
  }

  try {
    const seen = new WeakSet<object>()
    const serialized = JSON.stringify(value, (_key, currentValue) => {
      if (typeof currentValue === 'bigint') return `${currentValue.toString()}n`
      if (currentValue instanceof Error) {
        return { name: currentValue.name, message: currentValue.message, stack: currentValue.stack }
      }
      if (typeof currentValue === 'object' && currentValue !== null) {
        if (seen.has(currentValue)) return '[Circular]'
        seen.add(currentValue)
      }
      return currentValue
    }, 2)
    return serialized ?? String(value)
  } catch {
    return String(value)
  }
}

function formatLogData(args: unknown[]): string {
  if (args.length === 0) return ''
  return args
    .map((arg, index) => {
      const rendered = stringifyLogValue(arg)
      return args.length > 1 ? `[${index}] ${rendered}` : rendered
    })
    .join('\n')
}

function summarizeLogDetails(details: string) {
  const firstLine = details.split('\n').find((line) => line.trim().length > 0) ?? ''
  if (!firstLine) return ''
  return firstLine.length > 120 ? `${firstLine.slice(0, 120)}...` : firstLine
}

function pushLog(dir: '←' | '→', event: string, args: unknown[]) {
  const now = new Date()
  const time = now.toTimeString().slice(0, 8)
  const entry: LogEntry = { id: ++logSeq, time, dir, event, details: formatLogData(args) }
  logHistory = [...logHistory.slice(-(MAX_LOG_ENTRIES - 1)), entry]
  logListeners.forEach((fn) => fn(entry))
}

// Wire up socket event capture at module level
const LOG_SKIP = new Set(['obs:status'])
socket.onAny((event, ...args) => { if (!LOG_SKIP.has(event)) pushLog('←', event, args as unknown[]) })
socket.onAnyOutgoing((event, ...args) => pushLog('→', event, args as unknown[]))

// ── SocketLogConsole component ────────────────────────────────────────

export function SocketLogConsole({ variant = 'sidebar' }: { variant?: 'sidebar' | 'settings' }) {
  const [entries, setEntries] = useState<LogEntry[]>(() => logHistory)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [expandedEntryIds, setExpandedEntryIds] = useState<number[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const isSettingsVariant = variant === 'settings'

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!entries.length) return
    const text = entries
      .map((entry) => [`${entry.time} ${entry.dir} ${entry.event}`, entry.details].filter(Boolean).join('\n'))
      .join('\n\n')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 1500)
    } catch {
      setCopyState('error')
      setTimeout(() => setCopyState('idle'), 1800)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    logHistory = []
    setEntries([])
    setExpandedEntryIds([])
    setCopyState('idle')
  }

  const toggleEntry = (entryId: number) => {
    setExpandedEntryIds((prev) => (
      prev.includes(entryId) ? prev.filter((id) => id !== entryId) : [...prev, entryId]
    ))
  }

  useEffect(() => {
    const handler = (e: LogEntry) => setEntries((prev) => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), e])
    logListeners.push(handler)
    return () => { const i = logListeners.indexOf(handler); if (i >= 0) logListeners.splice(i, 1) }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  return (
    <div className={isSettingsVariant ? 'rounded-xl border border-zinc-800/80 bg-zinc-950/70' : 'shrink-0 border-t border-zinc-800/80 bg-zinc-950/65'}>
      <ConfigToolbar className={isSettingsVariant ? 'rounded-none border-0 border-b border-zinc-800/80 bg-zinc-950/40 px-5 py-4' : 'rounded-none border-0 border-b border-zinc-800/80 bg-zinc-950/35 px-2.5 py-1.5'}>
        <span className={isSettingsVariant ? 'flex-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400' : 'flex-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600'}>
          {isSettingsVariant ? 'Socket Console' : 'Console'}
        </span>
        <span className={isSettingsVariant ? 'rounded-full border border-zinc-800 bg-zinc-950/70 px-2 py-1 text-[10px] font-mono text-zinc-500' : 'text-[10px] font-mono text-zinc-600'}>
          {entries.length} event{entries.length === 1 ? '' : 's'}
        </span>
        <Btn type="button" variant="default" onClick={handleCopy} disabled={!entries.length}
          title="Copy the full socket log to the clipboard"
          className={isSettingsVariant ? 'px-2 py-1 text-[10px] font-medium' : 'px-1.5 py-0.5 text-[10px]'}>
          {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy all'}
        </Btn>
        <Btn type="button" variant="danger" onClick={handleClear} disabled={!entries.length}
          title="Clear the socket log"
          className={isSettingsVariant ? 'px-2 py-1 text-[10px] font-medium' : 'px-1.5 py-0.5 text-[10px]'}>
          Clear
        </Btn>
      </ConfigToolbar>
      <div className={isSettingsVariant ? 'max-h-[26rem] overflow-y-auto bg-zinc-950/60 px-3 py-2 space-y-2' : 'h-[150px] overflow-y-auto bg-zinc-950/60 px-2 py-1 space-y-1'}>
        {entries.length === 0 && (
          <ConfigNotice tone="info" className={isSettingsVariant ? 'pt-3 text-center' : 'py-2 text-center text-[10px]'}>No events yet.</ConfigNotice>
        )}
        {entries.map((e) => (
          <ConfigCard key={e.id} className={isSettingsVariant ? 'font-mono' : 'font-mono px-2 py-1.5'}>
            <div className="flex min-w-0 items-start gap-2">
              <span className={isSettingsVariant ? 'text-[10px] text-zinc-600 shrink-0' : 'text-[9px] text-zinc-700 shrink-0'}>{e.time}</span>
              <span className={(isSettingsVariant ? 'text-[11px] shrink-0 ' : 'text-[10px] shrink-0 ') + (e.dir === '→' ? 'text-cyan-500' : 'text-emerald-500')}>{e.dir}</span>
              <span className={isSettingsVariant ? 'min-w-0 break-all text-[11px] text-zinc-200' : 'min-w-0 break-all text-[10px] text-zinc-300'}>{e.event}</span>
            </div>
            {e.details && (() => {
              const expanded = expandedEntryIds.includes(e.id)
              const summary = summarizeLogDetails(e.details)
              return (
                <div className="mt-2">
                  <Btn type="button" variant="ghost" onClick={() => toggleEntry(e.id)}
                    className={isSettingsVariant
                      ? 'flex w-full items-center justify-start gap-2 px-2 py-1.5 text-left text-[10px] text-zinc-400'
                      : 'flex w-full items-center justify-start gap-1.5 px-1.5 py-1 text-left text-[10px] text-zinc-500'}
                    title={expanded ? 'Collapse' : 'Expand'}>
                    <span className="shrink-0">{expanded ? '▾' : '▸'}</span>
                    <span className="shrink-0 font-medium normal-case tracking-normal">{expanded ? 'Collapse' : 'Expand'}</span>
                    {summary && <span className="min-w-0 flex-1 truncate normal-case tracking-normal">{summary}</span>}
                  </Btn>
                  {expanded && (
                    <pre className={isSettingsVariant ? 'mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded border border-zinc-900 bg-zinc-900/70 px-2 py-1.5 text-[10px] leading-relaxed text-zinc-400' : 'mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded border border-zinc-900/80 bg-zinc-950/60 px-1.5 py-1 text-[10px] leading-relaxed text-zinc-500'}>{e.details}</pre>
                  )}
                </div>
              )
            })()}
          </ConfigCard>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
