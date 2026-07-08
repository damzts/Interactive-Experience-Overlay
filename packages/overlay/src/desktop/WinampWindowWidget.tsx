import { useCallback, useEffect, useMemo, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'
import { useAppStore } from '../store/useAppStore'
import { addWidgetSimulationIntentListener, dispatchWidgetSignal, addWidgetChainActionListener } from './widgetSimulationEvents'

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
  folder?: string
}

type AssetCatalogResponse = {
  assets?: AssetCatalogEntry[]
}

const WINAMP_FOLDER = 'images/winamp'
const DEFAULT_BOX = { width: 275, height: 116 }
const MAX_BOX_WIDTH = 400

function randomIndex(length: number, exclude: number | null) {
  if (length <= 1) return 0
  let idx = Math.floor(Math.random() * length)
  if (exclude !== null && idx === exclude) {
    idx = (idx + 1 + Math.floor(Math.random() * (length - 1))) % length
  }
  return idx
}

export function WinampWindowWidget({ appId, onClose, onMinimize, onFocus, windowState = 'open', zIndex }: DesktopWidgetProps) {
  const applications = useAppStore((s) => s.config.applications)
  const [assets, setAssets] = useState<AssetCatalogEntry[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [box, setBox] = useState(DEFAULT_BOX)

  const winampWindowSettings = useMemo(() => {
    const app = applications.find((entry) => entry.id === appId)
    return {
      randomOrder: app?.winampWindowSettings?.randomOrder ?? true,
      autoPlay: app?.winampWindowSettings?.autoPlay ?? false,
      intervalSec: Math.max(2, app?.winampWindowSettings?.intervalSec ?? 8),
    }
  }, [applications, appId])

  useEffect(() => {
    const controller = new AbortController()

    async function loadCatalog() {
      setLoading(true)
      try {
        const response = await fetch('/api/assets/catalog', { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Catalog request failed: ${response.status}`)
        }
        const json = await response.json() as AssetCatalogResponse
        const images = (json.assets ?? []).filter((asset) => asset.kind === 'image' && asset.folder === WINAMP_FOLDER)
        setAssets(images)
        setCurrentIndex(randomIndex(images.length, null))
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return
      } finally {
        setLoading(false)
      }
    }

    void loadCatalog()
    return () => controller.abort()
  }, [])

  const current = useMemo(() => assets[currentIndex] ?? null, [assets, currentIndex])

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget
    if (!naturalWidth || !naturalHeight) return
    const width = Math.min(MAX_BOX_WIDTH, naturalWidth)
    const height = Math.round(width * (naturalHeight / naturalWidth))
    setBox({ width, height })
  }, [])

  const showNext = useCallback(() => {
    setCurrentIndex((prev) => {
      if (assets.length <= 1) return prev
      if (winampWindowSettings.randomOrder) return randomIndex(assets.length, prev)
      return (prev + 1) % assets.length
    })
  }, [assets.length, winampWindowSettings.randomOrder])

  const showPrevious = useCallback(() => {
    setCurrentIndex((prev) => {
      if (assets.length <= 1) return prev
      return (prev - 1 + assets.length) % assets.length
    })
  }, [assets.length])

  useEffect(() => {
    if (!winampWindowSettings.autoPlay || assets.length <= 1) return
    const ms = winampWindowSettings.intervalSec * 1000
    const timer = window.setInterval(() => {
      showNext()
    }, ms)
    return () => window.clearInterval(timer)
  }, [assets.length, winampWindowSettings.autoPlay, winampWindowSettings.intervalSec, showNext])

  useEffect(() => {
    return addWidgetSimulationIntentListener((payload) => {
      if (payload.widgetId !== appId) return
      if (payload.kind === 'winamp-window:next') { showNext(); return }
      if (payload.kind === 'winamp-window:previous') showPrevious()
    })
  }, [appId, showNext, showPrevious])

  useEffect(() => {
    return addWidgetChainActionListener(({ targetWidgetId, action }) => {
      if (targetWidgetId !== appId) return
      if (action === 'winamp-window:next') showNext()
      else if (action === 'winamp-window:previous') showPrevious()
    })
  }, [appId, showNext, showPrevious])

  useEffect(() => {
    if (!current) return
    dispatchWidgetSignal({ source: appId!, event: 'winamp-window:slide-changed', payload: { assetId: current.id } })
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DesktopWindow
      id={appId ?? 'winamp-window'}
      title=""
      width={box.width}
      height={box.height}
      frameless
      autoSize
      defaultPosition={{ x: 220, y: 90 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--winamp-window"
      bodyClassName="desktop-window-body--winamp-window"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: 0 }}
    >
      {!loading && current && (
        <img
          src={current.url}
          alt={current.name}
          onLoad={handleImageLoad}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          draggable={false}
        />
      )}
    </DesktopWindow>
  )
}
