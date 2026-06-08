import type { OverlayEffects } from '@ieomlabs/shared'

/**
 * Pure CSS effects layer — CRT scanlines, vignette, film grain, flicker, chromatic.
 * Rendered over all content at z-index 30.
 */

interface Props {
  effects: OverlayEffects
}

export function CSSEffectsLayer({ effects }: Props) {
  const { crt, noise, vignette, flicker, chromatic, scanlineOpacity, noiseOpacity, vignetteStrength } = effects

  return (
    <>
      {/* CRT scanlines */}
      {crt && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 1px,
              rgba(0,0,0,${scanlineOpacity}) 1px,
              rgba(0,0,0,${scanlineOpacity}) 2px
            )`,
            pointerEvents: 'none',
            zIndex: 30,
          }}
        />
      )}

      {/* Vignette */}
      {vignette && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${vignetteStrength}) 100%)`,
            pointerEvents: 'none',
            zIndex: 31,
          }}
        />
      )}

      {/* Film grain */}
      {noise && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: noiseOpacity,
            animation: 'grain 0.5s steps(1) infinite',
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px',
            pointerEvents: 'none',
            zIndex: 32,
          }}
        />
      )}

      {/* Screen flicker */}
      {flicker && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            animation: 'flicker 8s infinite',
            pointerEvents: 'none',
            zIndex: 33,
          }}
        />
      )}

      {/* Chromatic aberration — slight RGB edge separation */}
      {chromatic && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              mixBlendMode: 'screen',
              background: 'radial-gradient(ellipse at center, transparent 70%, rgba(255,0,0,0.04) 100%)',
              transform: 'translateX(-2px)',
              pointerEvents: 'none',
              zIndex: 34,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              mixBlendMode: 'screen',
              background: 'radial-gradient(ellipse at center, transparent 70%, rgba(0,0,255,0.04) 100%)',
              transform: 'translateX(2px)',
              pointerEvents: 'none',
              zIndex: 34,
            }}
          />
        </>
      )}
    </>
  )
}
