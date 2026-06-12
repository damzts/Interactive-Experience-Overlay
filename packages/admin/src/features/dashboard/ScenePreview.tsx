/**
 * ScenePreview — OverlayCanvas drag handles over the live overlay iframe.
 *
 * - Iframe shows the real overlay (runtime URL)
 * - OverlayCanvas renders source position handles on top at same 16:9 scale
 * - Drag/resize a handle → updates source.position in the draft
 */
import { useRef } from 'react'
import type { SourceInstance } from '@ieomlabs/shared'
import { OverlayCanvas, OverlayPreviewItem } from '../../shared/ui'
import { PLUGIN_CATALOG as SOURCE_CATALOG } from '@ieomlabs/shared'
import { getOverlayRuntimeOrigin } from '../../shared/runtimeUrls'

interface Props {
  sources: SourceInstance[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChangePosition: (id: string, pos: { x: number; y: number; width: number; height: number }) => void
}

export function ScenePreview({ sources, selectedId, onSelect, onChangePosition }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const overlayUrl = getOverlayRuntimeOrigin()

  // Only show handles for content-tier sources (not full-screen builtins)
  const handleItems = sources
    .filter((s) => s.visible)
    .map((s) => ({
      id: s.id,
      x: s.position.x,
      y: s.position.y,
      width: s.position.width,
      height: s.position.height,
      _pluginType: (s as any).pluginType ?? s.pluginType ?? '',
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
            const src = sources.find((s) => s.id === id)
            if (!src) return
            onChangePosition(id, { ...src.position, ...patch })
          }}
          renderItem={(item, selected) => {
            const meta = SOURCE_CATALOG.find((c) => c.id === item._pluginType)
            return (
              <div className={`absolute inset-0 flex items-start p-1 ${selected ? 'bg-cyan-500/10' : ''}`}>
                <span className="text-[9px] rounded bg-black/60 px-1 text-white leading-tight">
                  {meta?.icon} {meta?.label ?? item._pluginType}
                </span>
              </div>
            )
          }}
          emptyMessage="No visible sources"
        />
      </div>
    </div>
  )
}
