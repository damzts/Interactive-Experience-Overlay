import { useAdminStore } from '../../store/useAdminStore'
import { AuthBadge } from '../../auth/AuthBadge'
import { getOverlayRuntimeOrigin } from '../../shared/runtimeUrls'

export function TopBar() {
  const obsConnected = useAdminStore((s) => s.obsConnected)
  const lastError    = useAdminStore((s) => s.lastError)
  const cameraOwnerSocketId = useAdminStore((s) => s.cameraOwnerSocketId)
  const overlayConnected = !!cameraOwnerSocketId

  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-b border-zinc-800/80 bg-zinc-950/85 px-3 backdrop-blur-sm">
      <span className="text-cyan-400 font-bold font-mono text-sm tracking-widest">IEOM</span>
      <div className="w-px h-4 bg-zinc-700" />
      <span className={'text-xs font-mono ' + (obsConnected ? 'text-emerald-400' : 'text-zinc-600')}>
        {obsConnected ? '● OBS' : '○ OBS'}
      </span>
      <span className={'rounded-full border px-2.5 py-0.5 text-[10px] font-mono ' + (overlayConnected
        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
        : 'border-zinc-700/80 bg-zinc-900/80 text-zinc-500')}>
        {overlayConnected ? '● Overlay' : '○ No overlay'}
      </span>
      {lastError && (
        <span className="max-w-[220px] truncate rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-mono text-red-300" title={lastError}>{lastError}</span>
      )}
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => window.open(getOverlayRuntimeOrigin(), 'ieom-overlay', 'width=1920,height=1080')}
        className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-cyan-500/50 hover:bg-zinc-800"
      >
        <span>🖥️</span>
        <span>Open Overlay</span>
      </button>
      <AuthBadge />
    </div>
  )
}
