export function ColorOverlayRenderer({ config }: import('../registry').RendererProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: String(config.color ?? '#000000'),
        opacity: Number(config.opacity ?? 0.5),
        pointerEvents: 'none',
      }}
    />
  )
}
