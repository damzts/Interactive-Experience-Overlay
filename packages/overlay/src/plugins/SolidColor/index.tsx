export function SolidColorRenderer({ config }: import('../registry').PluginProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: String(config.color ?? '#000000') }} />
  )
}
