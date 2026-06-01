import { useEffect, useState } from 'react'
import { AuthBadge } from '../../auth/AuthBadge'
import { getOverlayRuntimeOrigin } from '../../shared/runtimeUrls'
import { getApiOrigin } from '../../shared/runtimeUrls'

function Indicator({ connected, label }: { connected: boolean; label: string }) {
  return (
    <span className={'rounded-full border px-2.5 py-0.5 text-[10px] font-mono ' + (connected
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
      : 'border-zinc-700/80 bg-zinc-900/80 text-zinc-500')}>
      {connected ? '●' : '○'} {label}
    </span>
  )
}

export function TopBar() {
  const [overlayConnected, setOverlayConnected] = useState(false)

  useEffect(() => {
    let active = true
    async function check() {
      try {
        const res = await fetch(`${getApiOrigin()}/api/overlay/status`)
        if (res.ok && active) {
          const data = await res.json()
          setOverlayConnected(!!data.slotTaken)
        }
      } catch {}
    }
    check()
    const interval = setInterval(check, 5000)
    return () => { active = false; clearInterval(interval) }
  }, [])

  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-b border-zinc-800/80 bg-zinc-950/85 px-3 backdrop-blur-sm">
      <span className="text-cyan-400 font-bold font-mono text-sm tracking-widest">IEOM</span>
      <div className="w-px h-4 bg-zinc-700" />
      <Indicator connected={overlayConnected} label="Overlay" />
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
