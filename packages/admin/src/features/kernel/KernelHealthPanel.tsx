import { useAdminStore } from '../../store/useAdminStore'
import { ConfigPageIntro, ConfigSectionPanel } from '../../shared/ui'
import type { ManagerStatus } from '@ieomlabs/shared'

const STATUS_STYLE: Record<ManagerStatus, string> = {
  running: 'bg-emerald-400',
  idle:    'bg-zinc-500',
  stopped: 'bg-amber-400',
  error:   'bg-red-500 animate-pulse',
}

const STATUS_LABEL: Record<ManagerStatus, string> = {
  running: 'running',
  idle:    'idle',
  stopped: 'stopped',
  error:   'error / quarantined',
}

export function KernelHealthPanel() {
  const managers = useAdminStore((s) => s.runtimeDiagnostics.managers)

  const entries = managers ? Object.entries(managers) : []
  const quarantined = entries.filter(([, s]) => s === 'error')

  return (
    <div className="space-y-5">
      <ConfigPageIntro
        icon="⚙"
        title="Kernel Health"
        description="Lifecycle status of every registered kernel manager. Updates with each diagnostics heartbeat. Managers in 'error' state have been quarantined after repeated failures and are no longer executing."
      />

      {quarantined.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300">
          ⚠ {quarantined.length} manager{quarantined.length > 1 ? 's' : ''} quarantined:{' '}
          <span className="font-medium">{quarantined.map(([n]) => n).join(', ')}</span>.
          Restart the server to recover.
        </div>
      )}

      <ConfigSectionPanel label="Managers">
        {entries.length === 0 ? (
          <div className="text-xs text-zinc-600 italic px-1">No manager data yet — waiting for diagnostics heartbeat.</div>
        ) : (
          <div className="space-y-1.5">
            {entries.map(([name, status]) => (
              <div
                key={name}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-5 py-4"
              >
                <div className={`h-2 w-2 rounded-full shrink-0 ${STATUS_STYLE[status] ?? 'bg-zinc-600'}`} />
                <span className="flex-1 text-xs text-zinc-200 font-medium">{name}</span>
                <span className="text-[10px] text-zinc-500 tabular-nums">{STATUS_LABEL[status] ?? status}</span>
              </div>
            ))}
          </div>
        )}
      </ConfigSectionPanel>
    </div>
  )
}
