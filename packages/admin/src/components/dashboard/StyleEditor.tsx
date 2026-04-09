import { useCallback, useEffect, useRef, useState } from 'react'
import { STATE, withOverlayStyleDefaults } from '@ieom/shared'
import type { BackgroundType, OverlayStyle, ParticlePreset } from '@ieom/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { AssetSelectionInput } from '../AssetLibrary'
import { ConfigApplyBar, ConfigSectionPanel, isSameDraft, Slider, Toggle } from '../ui'
import { BG_TYPES, GRADIENT_PRESETS, PARTICLE_PRESETS, PATTERN_CSS } from './constants'

export function StyleEditor({ sceneId }: { sceneId: string }) {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const sourceStyle = structuredClone(withOverlayStyleDefaults((config.scenes[sceneId] as { style?: OverlayStyle } | undefined)?.style, config.overlayStyle))
  const [style, setStyle] = useState<OverlayStyle>(() => sourceStyle)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = !isSameDraft(style, sourceStyle)

  useEffect(() => {
    setStyle(sourceStyle)
    setSaved(false)
  }, [config.scenes, config.overlayStyle, sceneId])

  const update = useCallback((updater: (d: OverlayStyle) => void) => {
    setStyle((prev) => {
      const next = structuredClone(prev)
      updater(next)
      return next
    })
    setSaved(false)
  }, [])

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    const scene = config.scenes[sceneId]
    await saveConfig({ scenes: { [sceneId]: { ...scene, style } } })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [dirty, saveConfig, config.scenes, sceneId, style])

  const reset = useCallback(() => {
    setStyle(sourceStyle)
    setSaved(false)
  }, [sourceStyle])

  const bg = style.background
  const fx = style.effects
  const pt = style.particles

  return (
    <div className="space-y-3">
      <ConfigApplyBar label="Scene Style" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} />

      <div className="space-y-0 pt-3">
        <ConfigSectionPanel label="Background" first>
          <div className="space-y-3">
            <select value={bg.type} onChange={(e) => update((d) => { d.background.type = e.target.value as BackgroundType })} className="w-full text-xs">
              {BG_TYPES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>

            {sceneId === STATE.DESKTOP && (
              <div className="text-[10px] text-zinc-500 leading-relaxed">
                Desktop themes only style windows, menus, taskbars, and widgets. Leave Background on None to keep the overlay transparent; choose a background here only when you intentionally want wallpaper behind the desktop.
              </div>
            )}

            {sceneId === STATE.LOBBY && (
              <div className="text-[10px] text-zinc-500 leading-relaxed">
                In the lobby, gradient backgrounds tint the sky dome. Image, video, and pattern backgrounds stay behind the 3D scene and will not replace the sky.
              </div>
            )}

            {bg.type === 'gradient' && (
              <div>
                <div className="grid grid-cols-3 gap-1 mb-2">
                  {GRADIENT_PRESETS.map((g) => (
                    <button key={g.name} type="button"
                      onClick={() => update((d) => { d.background.gradient = g.value })}
                      className={'h-12 rounded border transition-colors ' + (bg.gradient === g.value ? 'border-cyan-400/60' : 'border-zinc-700/40 hover:border-zinc-500/60')}
                      style={{ background: g.value }}>
                      <div className="flex h-full items-end p-2">
                        <span className="rounded bg-black/35 px-1.5 py-0.5 text-[10px] text-white drop-shadow">{g.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
                <input type="text" value={bg.gradient}
                  onChange={(e) => update((d) => { d.background.gradient = e.target.value })}
                  placeholder="linear-gradient(…)" className="w-full text-xs" />
              </div>
            )}

            {bg.type === 'image-url' && (
              <AssetSelectionInput value={bg.imageUrl} onChange={(v) => update((d) => { d.background.imageUrl = v })}
                kinds={['image']} modalTitle="Background Image" placeholder="/assets/backgrounds/name.jpg or https://..."
                buttonLabel="Choose Image" hint="Pick from the unified asset library, game-image catalog, or paste any direct image URL." previewKind="image" />
            )}

            {bg.type === 'video-url' && (
              <AssetSelectionInput value={bg.videoUrl} onChange={(v) => update((d) => { d.background.videoUrl = v })}
                kinds={['video']} modalTitle="Background Video" placeholder="/assets/video/name.mp4 or https://..."
                buttonLabel="Choose Video" hint="Use the asset library for local loops or paste any direct MP4/WebM URL." previewKind="video" />
            )}

            {bg.type === 'pattern' && (
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(PATTERN_CSS) as ParticlePreset[]).map((pat) => (
                  <button key={pat} type="button"
                    onClick={() => update((d) => { d.background.pattern = pat as any })}
                    className={'h-14 capitalize rounded border transition-colors ' + (bg.pattern === pat ? 'border-cyan-400/60' : 'border-zinc-700/40 hover:border-zinc-500/60')}
                    style={pat === 'none' ? { backgroundColor: '#111' } : PATTERN_CSS[pat as any]}>
                    <div className="flex h-full items-end justify-center p-2">
                      <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white drop-shadow">{pat}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {bg.type !== 'none' && (
              <div className="space-y-1 pt-2 border-t border-zinc-700">
                <Slider label="Opacity" value={bg.opacity} onChange={(v) => update((d) => { d.background.opacity = v })} />
                <Slider label="Blur" value={bg.blur} min={0} max={20} step={0.5} unit="px" onChange={(v) => update((d) => { d.background.blur = v })} />
              </div>
            )}
          </div>
        </ConfigSectionPanel>

        <ConfigSectionPanel label="Effects">
          <div className="space-y-2">
            <div>
              <Toggle checked={fx.crt} onChange={(v) => update((d) => { d.effects.crt = v })} label="CRT Scanlines" />
              {fx.crt && <div className="mt-1 pl-11"><Slider label="Intensity" value={fx.scanlineOpacity} onChange={(v) => update((d) => { d.effects.scanlineOpacity = v })} /></div>}
            </div>
            <div>
              <Toggle checked={fx.noise} onChange={(v) => update((d) => { d.effects.noise = v })} label="Film Grain" />
              {fx.noise && <div className="mt-1 pl-11"><Slider label="Grain" value={fx.noiseOpacity} onChange={(v) => update((d) => { d.effects.noiseOpacity = v })} /></div>}
            </div>
            <div>
              <Toggle checked={fx.vignette} onChange={(v) => update((d) => { d.effects.vignette = v })} label="Vignette" />
              {fx.vignette && <div className="mt-1 pl-11"><Slider label="Strength" value={fx.vignetteStrength} onChange={(v) => update((d) => { d.effects.vignetteStrength = v })} /></div>}
            </div>
            <Toggle checked={fx.flicker} onChange={(v) => update((d) => { d.effects.flicker = v })} label="Screen Flicker" />
            <Toggle checked={fx.chromatic} onChange={(v) => update((d) => { d.effects.chromatic = v })} label="Chromatic Aberration" />
          </div>
        </ConfigSectionPanel>

        <ConfigSectionPanel label="Particles">
          <div className="space-y-3">
            <select value={pt.preset}
              onChange={(e) => update((d) => { d.particles.preset = e.target.value as ParticlePreset; d.particles.enabled = e.target.value !== 'none' })}
              className="w-full text-xs">
              {PARTICLE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
            </select>
            {pt.enabled && pt.preset !== 'none' && (
              <div className="space-y-1">
                <Slider label="Density" value={pt.density} onChange={(v) => update((d) => { d.particles.density = v })} />
                <Slider label="Speed"   value={pt.speed}   onChange={(v) => update((d) => { d.particles.speed   = v })} />
              </div>
            )}
          </div>
        </ConfigSectionPanel>
      </div>
    </div>
  )
}
