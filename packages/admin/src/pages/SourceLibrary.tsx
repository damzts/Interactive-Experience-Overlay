import { AssetCatalogPanel } from '../components/AssetLibrary'

export function SourceLibrary() {
  return (
    <div className="flex flex-col h-full overflow-hidden rounded-lg bg-zinc-800/60 border border-zinc-700/60">
      <div className="px-3 py-2 bg-zinc-800 border-b border-zinc-700/60 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        Source Library — Unified Image Catalog
      </div>
      <div className="flex-1 overflow-auto p-3">
        <AssetCatalogPanel kinds={['image']} />
      </div>
    </div>
  )
}
