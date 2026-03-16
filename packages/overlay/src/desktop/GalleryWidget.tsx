import { useCallback, useEffect, useMemo, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'
import { useAppStore } from '../store/useAppStore'

interface DesktopWidgetProps {
  appId?: string
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

type AssetCatalogEntry = {
  id: string
  kind: 'image' | 'video' | 'audio'
  url: string
  name: string
}

type AssetCatalogResponse = {
  assets?: AssetCatalogEntry[]
}

function randomIndex(length: number, exclude: number | null) {
  if (length <= 1) return 0
  let idx = Math.floor(Math.random() * length)
  if (exclude !== null && idx === exclude) {
    idx = (idx + 1 + Math.floor(Math.random() * (length - 1))) % length
  }
  return idx
}

export function GalleryWidget({ appId, onClose, onMinimize, onFocus, windowState = 'open', zIndex }: DesktopWidgetProps) {
  const applications = useAppStore((s) => s.config.applications)
  const [assets, setAssets] = useState<AssetCatalogEntry[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const gallerySettings = useMemo(() => {
    const app = applications.find((entry) => entry.id === appId)
    return {
      randomOrder: app?.gallerySettings?.randomOrder ?? true,
      autoPlay: app?.gallerySettings?.autoPlay ?? false,
      intervalSec: Math.max(2, app?.gallerySettings?.intervalSec ?? 8),
    }
  }, [applications, appId])

  useEffect(() => {
    const controller = new AbortController()

    async function loadCatalog() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/assets/catalog', { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Catalog request failed: ${response.status}`)
        }
        const json = await response.json() as AssetCatalogResponse
        const images = (json.assets ?? []).filter((asset) => asset.kind === 'image')
        setAssets(images)
        setCurrentIndex(randomIndex(images.length, null))
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return
        setError('No se pudo cargar el catalogo de imagenes.')
      } finally {
        setLoading(false)
      }
    }

    void loadCatalog()
    return () => controller.abort()
  }, [])

  const current = useMemo(() => assets[currentIndex] ?? null, [assets, currentIndex])

  const showNext = useCallback(() => {
    setCurrentIndex((prev) => {
      if (assets.length <= 1) return prev
      if (gallerySettings.randomOrder) return randomIndex(assets.length, prev)
      return (prev + 1) % assets.length
    })
  }, [assets.length, gallerySettings.randomOrder])

  const showPrevious = useCallback(() => {
    setCurrentIndex((prev) => {
      if (assets.length <= 1) return prev
      return (prev - 1 + assets.length) % assets.length
    })
  }, [assets.length])

  useEffect(() => {
    if (!gallerySettings.autoPlay || assets.length <= 1) return
    const ms = gallerySettings.intervalSec * 1000
    const timer = window.setInterval(() => {
      showNext()
    }, ms)
    return () => window.clearInterval(timer)
  }, [assets.length, gallerySettings.autoPlay, gallerySettings.intervalSec, showNext])

  return (
    <DesktopWindow
      id={appId ?? 'gallery'}
      title="Random Gallery"
      width={430}
      defaultPosition={{ x: 220, y: 90 }}
      zIndex={zIndex}
      state={windowState}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: 8, color: '#202020' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            background: '#111',
            border: '1px solid #808080',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {loading && <div style={{ color: '#d4d4d4', fontSize: 11 }}>Cargando imagenes...</div>}
          {!loading && error && <div style={{ color: '#f87171', fontSize: 11, padding: '0 12px', textAlign: 'center' }}>{error}</div>}
          {!loading && !error && !current && <div style={{ color: '#d4d4d4', fontSize: 11 }}>No hay imagenes en el catalogo.</div>}
          {!loading && !error && current && (
            <img
              src={current.url}
              alt={current.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              draggable={false}
            />
          )}
        </div>

        <div style={{ fontSize: 11, color: '#444', minHeight: 16 }}>
          {current ? `${current.name} (${currentIndex + 1}/${assets.length})` : 'Sin seleccion'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button data-sim-action="gallery-prev" type="button" onClick={showPrevious} disabled={assets.length < 2}>◀ Previous</button>
          <button data-sim-action="gallery-play" type="button" onClick={showNext} disabled={assets.length < 2}>▶ Play</button>
          <button data-sim-action="gallery-next" type="button" onClick={showNext} disabled={assets.length < 2}>Next ▶</button>
        </div>
      </div>
    </DesktopWindow>
  )
}
