export function ColorOverlayRenderer({ config }: { config: Record<string, unknown> }) {
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
