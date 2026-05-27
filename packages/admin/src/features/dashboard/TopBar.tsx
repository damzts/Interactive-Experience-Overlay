import { useMemo } from 'react'
import { useAdminStore } from '../../store/useAdminStore'

export function TopBar() {
  const obsConnected = useAdminStore((s) => s.obsConnected)
  const clientCount  = useAdminStore((s) => s.clientCount)
  const lastError    = useAdminStore((s) => s.lastError)
  const ambiance     = useAdminStore((s) => s.runtimeDiagnostics.ambiance)

  const overlayClientBadges = useMemo(() => {
    return ambiance.overlayClients.map((client) => ({
      key: client.socketId,
      shortId: client.socketId.slice(0, 8),
      text: `${client.port ?? '???'} ${client.kind === 'embedded-preview' ? 'preview' : client.kind === 'runtime' ? 'obs' : client.kind}`,
      title: `${client.label} · ${client.socketId}`,
    }))
  }, [ambiance.overlayClients])

  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-b border-zinc-800/80 bg-zinc-950/85 px-3 backdrop-blur-sm">
      <span className="text-cyan-400 font-bold font-mono text-sm tracking-widest">IEOM</span>
      <div className="w-px h-4 bg-zinc-700" />
      <span className={'text-xs font-mono ' + (obsConnected ? 'text-emerald-400' : 'text-zinc-600')}>
        {obsConnected ? '● OBS' : '○ OBS'}
      </span>
      {clientCount > 0 && (
        <span className="text-[10px] text-zinc-600 font-mono">{clientCount}c</span>
      )}
      {overlayClientBadges.length === 0 ? (
        <span className="rounded-full border border-zinc-700/80 bg-zinc-900/80 px-2.5 py-0.5 text-[10px] font-mono text-zinc-500">
          No overlay clients
        </span>
      ) : overlayClientBadges.map((client) => (
        <span key={client.key} className="rounded-full border border-zinc-700/80 bg-zinc-900/80 px-2.5 py-0.5 text-[10px] font-mono text-zinc-300" title={client.title}>
          {client.text} {client.shortId}
        </span>
      ))}
      {lastError && (
        <span className="max-w-[220px] truncate rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-mono text-red-300" title={lastError}>{lastError}</span>
      )}
      <div className="flex-1" />
    </div>
  )
}
