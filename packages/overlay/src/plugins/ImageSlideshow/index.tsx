import { useState, useEffect, useRef } from 'react'

interface SlideState {
  aIdx: number
  bIdx: number
  showB: boolean
}

export function ImageSlideshowRenderer({ config }: import('../registry').PluginProps) {
  const intervalMs = (Number(config.interval) || 8) * 1000
  const doShuffle = config.shuffle !== false

  const imagesRef = useRef<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [slide, setSlide] = useState<SlideState>({ aIdx: 0, bIdx: 1, showB: false })
  const slideRef = useRef(slide)
  slideRef.current = slide

  useEffect(() => {
    fetch('/api/media/list')
      .then((r) => r.json())
      .then((data: { games: Record<string, string[]> }) => {
        let all: string[] = Object.values(data.games).flat()
        if (doShuffle) all = [...all].sort(() => Math.random() - 0.5)
        imagesRef.current = all
        setLoaded(true)
      })
      .catch(() => {
        console.warn('[ImageSlideshow] Could not fetch /api/media/list')
      })
  }, [doShuffle])

  useEffect(() => {
    const imgs = imagesRef.current
    if (!loaded || imgs.length < 2) return

    let cursor = 2

    const id = setInterval(() => {
      const total = imagesRef.current.length
      const curr = slideRef.current
      const nextIdx = cursor++ % total

      if (!curr.showB) {
        // A is front → show B with new image
        setSlide({ aIdx: curr.aIdx, bIdx: nextIdx, showB: true })
        // After transition, update A as preload
        setTimeout(() => {
          setSlide((s) => ({ ...s, aIdx: cursor++ % total }))
        }, 2000)
      } else {
        // B is front → show A with new image
        setSlide({ aIdx: nextIdx, bIdx: curr.bIdx, showB: false })
        setTimeout(() => {
          setSlide((s) => ({ ...s, bIdx: cursor++ % total }))
        }, 2000)
      }
    }, intervalMs)

    return () => clearInterval(id)
  }, [loaded, intervalMs])

  const imgs = imagesRef.current
  if (!imgs.length) {
    return <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a' }} />
  }

  const safeIdx = (i: number) => imgs[i % imgs.length]

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <img
        src={safeIdx(slide.aIdx)}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: slide.showB ? 0 : 1,
          transition: 'opacity 1.5s ease-in-out',
        }}
      />
      <img
        src={safeIdx(slide.bIdx)}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: slide.showB ? 1 : 0,
          transition: 'opacity 1.5s ease-in-out',
        }}
      />
    </div>
  )
}
