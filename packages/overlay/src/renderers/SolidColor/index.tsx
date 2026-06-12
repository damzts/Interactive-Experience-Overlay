export function SolidColorRenderer({ config }: import('../registry').RendererProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: String(config.color ?? '#000000') }} />
  )
}
