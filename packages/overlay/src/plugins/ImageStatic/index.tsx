export function ImageStaticRenderer({ config }: { config: Record<string, unknown> }) {
  const url       = String(config.url ?? '')
  const objectFit = String(config.objectFit ?? 'cover') as 'cover' | 'contain' | 'fill'
  const opacity   = Number(config.opacity ?? 1)

  if (!url) {
    return <div style={{ position: 'absolute', inset: 0, background: '#111' }} />
  }

  return (
    <img
      src={url}
      alt=""
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit,
        opacity,
      }}
    />
  )
}
