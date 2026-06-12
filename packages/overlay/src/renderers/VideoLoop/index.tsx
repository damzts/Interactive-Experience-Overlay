export function VideoLoopRenderer({ config }: import('../registry').RendererProps) {
  const url     = String(config.url ?? '')
  const opacity = Number(config.opacity ?? 1)

  if (!url) {
    return <div style={{ position: 'absolute', inset: 0, background: '#111' }} />
  }

  return (
    <video
      src={url}
      autoPlay
      loop
      muted
      playsInline
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity,
      }}
    />
  )
}
