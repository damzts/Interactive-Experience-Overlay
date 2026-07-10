/**
 * ScenePreview — OverlayCanvas drag handles over the live overlay iframe.
 *
 * - Iframe shows the real overlay (runtime URL)
 * - OverlayCanvas renders window position handles on top at same 16:9 scale
 * - Drag/resize a handle → updates window.position in the draft
 */
import { useRef } from 'react'
import type { WindowInstance } from '@ieomlabs/shared'
import { OverlayCanvas, OverlayPreviewItem } from '../../shared/ui'
import { RENDERER_CATALOG } from '@ieomlabs/shared'
import { getOverlayRuntimeOrigin, getOverlayDevOrigin } from '../../shared/runtimeUrls'

interface Props {
  windows: WindowInstance[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChangePosition: (id: string, pos: { x: number; y: number; width: number; height: number }) => void
}

export function ScenePreview({ windows, selectedId, onSelect, onChangePosition }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const overlayUrl = import.meta.env.DEV ? getOverlayDevOrigin() : getOverlayRuntimeOrigin()

  const lockedVisibleCount = windows.filter((w) => w.visible && w.locked).length

  const handleItems = windows
    .filter((w) => w.visible && !w.locked)
    .map((w) => ({
      id: w.id,
      x: w.position.x,
      y: w.position.y,
      width: w.position.width,
      height: w.position.height,
      _rendererType: w.rendererType ?? '',
    }))

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-zinc-800">
      {/* Live overlay iframe */}
      <iframe
        ref={iframeRef}
        src={overlayUrl}
        title="Overlay preview"
        className="absolute inset-0 w-full h-full border-0 pointer-events-none"
        sandbox="allow-scripts allow-same-origin"
      />

      {/* Drag handles layer */}
      <div className="absolute inset-0">
        <OverlayCanvas
          items={handleItems}
          selectedId={selectedId}
          onSelect={onSelect}
          onChange={(id, patch) => {
            const win = windows.find((w) => w.id === id)
            if (!win) return
            onChangePosition(id, { ...win.position, ...patch })
          }}
          renderItem={(item, selected) => {
            const meta = RENDERER_CATALOG.find((c) => c.id === item._rendererType)
            return (
              <div className={`absolute inset-0 flex items-start p-1 ${selected ? 'bg-cyan-500/10' : ''}`}>
                <span className="text-[9px] rounded bg-black/60 px-1 text-white leading-tight">
                  {meta?.icon} {meta?.label ?? item._rendererType}
                </span>
              </div>
            )
          }}
          emptyMessage="No visible windows"
        />
      </div>

      {lockedVisibleCount > 0 && (
        <div className="absolute bottom-1 left-1 rounded bg-black/70 px-2 py-0.5 text-[10px] text-[var(--color-warning-400)]">
          {lockedVisibleCount} locked window{lockedVisibleCount === 1 ? '' : 's'} hidden from canvas — unlock in the list to reposition
        </div>
      )}
    </div>
  )
}
