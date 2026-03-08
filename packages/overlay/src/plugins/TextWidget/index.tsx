import { useState, useEffect, useRef } from 'react'

const FONT_MAP: Record<string, string> = {
  vt323: "'VT323', monospace",
  'press-start': "'Press Start 2P', monospace",
  monospace: 'monospace',
  serif: 'serif',
}

export function TextWidgetRenderer({ config }: { config: Record<string, unknown> }) {
  const content = String(config.content ?? '')
  const fontKey = String(config.font ?? 'monospace')
  const fontSize = Number(config.fontSize) || 16
  const color = String(config.color ?? '#ffffff')
  const typewriterMode = config.typewriterMode === true

  const [displayed, setDisplayed] = useState(typewriterMode ? '' : content)
  const indexRef = useRef(0)

  useEffect(() => {
    if (!typewriterMode) {
      setDisplayed(content)
      return
    }
    indexRef.current = 0
    setDisplayed('')
    const id = setInterval(() => {
      indexRef.current++
      setDisplayed(content.slice(0, indexRef.current))
      if (indexRef.current >= content.length) clearInterval(id)
    }, 50)
    return () => clearInterval(id)
  }, [content, typewriterMode])

  return (
    <div
      className="text-widget"
      style={{
        position: 'absolute',
        inset: 0,
        fontFamily: FONT_MAP[fontKey] ?? 'monospace',
        fontSize,
        color,
        whiteSpace: 'pre-wrap',
        overflow: 'hidden',
      }}
    >
      {displayed}
    </div>
  )
}
