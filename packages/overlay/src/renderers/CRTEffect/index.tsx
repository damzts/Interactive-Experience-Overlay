export function CRTEffectRenderer({ config }: import('../registry').RendererProps) {
  const scanlineIntensity = Math.min(1, Math.max(0, Number(config.scanlineIntensity) || 0.25))
  const vignetteStrength = Math.min(1, Math.max(0, Number(config.vignetteStrength) || 0.5))

  return (
    <div
      className="crt-effect crt-flicker"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage: [
          `repeating-linear-gradient(0deg, rgba(0,0,0,${scanlineIntensity}) 0px, rgba(0,0,0,${scanlineIntensity}) 1px, transparent 1px, transparent 3px)`,
          `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${vignetteStrength}) 100%)`,
        ].join(', '),
      }}
    />
  )
}
