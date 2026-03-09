export function SolidColorRenderer({ config }: { config: Record<string, unknown> }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: String(config.color ?? '#000000') }} />
  )
}
