import { useEffect, useState } from 'react'

interface MediaData {
  games: Record<string, string[]>
  gameNames: string[]
  total: number
}

export function SourceLibrary() {
  const [media, setMedia] = useState<MediaData | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [expandedGame, setExpandedGame] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/media/list')
      .then((r) => r.json())
      .then((data: MediaData) => setMedia(data))
      .catch((e) => setError(String(e)))
  }, [])

  const filteredGames = media
    ? media.gameNames.filter((g) => g.toLowerCase().includes(search.toLowerCase()))
    : []

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-lg bg-zinc-800/60 border border-zinc-700/60">
      <div className="px-3 py-2 bg-zinc-800 border-b border-zinc-700/60 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        Source Library — Game Images
      </div>
      <div className="flex-1 overflow-auto p-3">
        {error && (
          <div className="text-red-400 text-xs mb-3 bg-red-950/40 rounded px-2 py-1">⚠ {error}</div>
        )}

        <div className="flex items-center gap-3 mb-3">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by game name…" className="flex-1" />
          {media && (
            <span className="text-xs text-zinc-400 whitespace-nowrap">
              {filteredGames.length} games · {media.total} images
            </span>
          )}
        </div>

        {!media && !error && (
          <div className="text-sm text-zinc-500">Loading media library…</div>
        )}

        <div className="flex flex-col gap-1.5">
          {filteredGames.map((game) => {
            const imgs = media!.games[game] ?? []
            const isExpanded = expandedGame === game
            return (
              <div key={game} className="rounded-lg overflow-hidden border border-zinc-700/60">
                <div
                  onClick={() => setExpandedGame(isExpanded ? null : game)}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                    isExpanded ? 'bg-cyan-600/20 text-cyan-300' : 'bg-zinc-800/60 text-zinc-200 hover:bg-zinc-700/60'
                  }`}
                >
                  <span className="text-[10px]">{isExpanded ? '▼' : '▶'}</span>
                  <span className="flex-1 text-sm font-medium">{game}</span>
                  <span className="text-xs text-zinc-400">{imgs.length} images</span>
                </div>
                {isExpanded && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-zinc-900/60">
                    {imgs.slice(0, 30).map((url) => (
                      <img key={url} src={url} alt="" loading="lazy"
                        className="w-28 h-16 object-cover rounded border border-zinc-700 cursor-pointer hover:border-cyan-500 transition-colors"
                        title={url}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ))}
                    {imgs.length > 30 && (
                      <div className="w-28 h-16 flex items-center justify-center bg-zinc-800 rounded border border-zinc-700 text-xs text-zinc-400">
                        +{imgs.length - 30} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
