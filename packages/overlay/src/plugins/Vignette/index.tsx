export function VignetteRenderer({ config }: import('../registry').PluginProps) {
  const color    = String(config.color ?? '#000000')
  const strength = Number(config.strength ?? 0.6)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at center, transparent 40%, ${color} 100%)`,
        opacity: strength,
        pointerEvents: 'none',
      }}
    />
  )
}
