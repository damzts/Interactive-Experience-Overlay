import { useEffect, useRef } from 'react'
import { STATE } from '@ieom/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { Btn, ConfigNotice } from '../../shared/ui'
import { getOverlayDevOrigin, getOverlayRuntimeOrigin } from '../../shared/runtimeUrls'

export function LivePreview() {
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef     = useRef<HTMLIFrameElement>(null)
  const previewTarget = useAdminStore((s) => s.previewTarget)
  const previewUrl = previewTarget === 'runtime' ? getOverlayRuntimeOrigin() : getOverlayDevOrigin()
  const previewLabel = previewTarget === 'runtime' ? 'Runtime' : 'Direct Dev'
  const previewBackdropStyle: React.CSSProperties = {
    backgroundColor: '#111827',
    backgroundImage: [
      'linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.05) 75%, rgba(255,255,255,0.05))',
      'linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.05) 75%, rgba(255,255,255,0.05))',
    ].join(', '),
    backgroundPosition: '0 0, 16px 16px',
    backgroundSize: '32px 32px',
  }

  useEffect(() => {
    const scale = () => {
      const c = containerRef.current
      const f = frameRef.current
      if (!c || !f) return
      const s = Math.min(c.clientWidth / 1920, c.clientHeight / 1080)
      f.style.transform       = 'scale(' + s + ')'
      f.style.transformOrigin = 'top left'
      f.style.marginLeft      = ((c.clientWidth  - 1920 * s) / 2) + 'px'
      f.style.marginTop       = ((c.clientHeight - 1080 * s) / 2) + 'px'
    }
    scale()
    const ro = new ResizeObserver(scale)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden min-w-0" style={previewBackdropStyle}>
      <div className="absolute left-3 top-3 z-10 pointer-events-none">
        <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] shadow-lg shadow-black/20 backdrop-blur ${previewTarget === 'runtime'
          ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-100'
          : 'border-amber-400/35 bg-amber-500/12 text-amber-100'}`}>
          <span className={`h-2 w-2 rounded-full ${previewTarget === 'runtime' ? 'bg-emerald-300' : 'bg-amber-300'}`} />
          <span>{previewLabel}</span>
        </div>
      </div>
      <div className="absolute right-3 bottom-3 z-10 pointer-events-none rounded-xl border border-zinc-800/80 bg-zinc-950/75 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-400 shadow-lg shadow-black/20 backdrop-blur">
        Transparent background preview
      </div>
      <iframe
        ref={frameRef}
        src={previewUrl}
        width={1920}
        height={1080}
        allow="camera; microphone"
        className="absolute block border-0"
        title="Overlay Preview"
      />
    </div>
  )
}
