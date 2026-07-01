import { useEffect, useRef, useState } from 'react'
import type { RendererProps } from '../registry'

const DEFAULT_QUOTES = [
  { text: 'The next generation will always surpass the previous one.', author: 'Hiruzen Sarutobi' },
  { text: 'If you do not like the world you are in, take another look around you.', author: 'Armin Arlert' },
  { text: "People's lives don't end when they die. It ends when they lose faith.", author: 'Itachi Uchiha' },
  { text: 'Hard work is worthless for those that do not believe in themselves.', author: 'Naruto Uzumaki' },
  { text: 'The world is not beautiful, therefore it is.', author: 'Kino' },
  { text: 'Fear is not evil. It tells you what your weakness is.', author: 'Gildarts Clive' },
  { text: 'Knowing you are different is only the beginning. If you accept these differences...', author: 'Tohru Honda' },
  { text: 'If you keep your head down, you won\'t have to worry about tripping.', author: 'Saitama' },
]

export function AnimeQuoteRenderer({ config }: RendererProps) {
  const quotes     = (config.quotes    as { text: string; author?: string }[] | undefined) ?? DEFAULT_QUOTES
  const intervalMs = (config.intervalMs as number | undefined) ?? 8000
  const color      = (config.color     as string | undefined) ?? '#ffffff'
  const fontSize   = (config.fontSize  as number | undefined) ?? 20

  const [idx, setIdx]      = useState(0)
  const [visible, setVis]  = useState(true)
  const timerRef           = useRef<ReturnType<typeof setTimeout>>(null!)

  useEffect(() => {
    const cycle = () => {
      setVis(false)
      timerRef.current = setTimeout(() => {
        setIdx(i => (i + 1) % quotes.length)
        setVis(true)
        timerRef.current = setTimeout(cycle, intervalMs - 600)
      }, 600)
    }
    timerRef.current = setTimeout(cycle, intervalMs - 600)
    return () => clearTimeout(timerRef.current)
  }, [quotes, intervalMs])

  const q = quotes[idx % quotes.length]

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px 24px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s ease',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize,
          color,
          fontFamily: 'Georgia,serif',
          fontStyle: 'italic',
          lineHeight: 1.5,
          textShadow: '0 2px 12px rgba(0,0,0,0.8)',
          marginBottom: 10,
        }}
      >
        "{q.text}"
      </div>
      {q.author && (
        <div
          style={{
            fontSize: fontSize * 0.65,
            color: color + 'aa',
            fontFamily: 'Inter,Arial,sans-serif',
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          — {q.author}
        </div>
      )}
    </div>
  )
}
