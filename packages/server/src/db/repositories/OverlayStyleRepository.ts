import type { OverlayStyle } from '@ieom/shared'
import type { Database as DatabaseType } from 'better-sqlite3'
import { clone, parseJson } from '../utils.js'

const DEFAULT_OVERLAY_STYLE: OverlayStyle = {
  background: {
    type: 'none',
    color: '#000000',
    gradient: 'linear-gradient(135deg, #0c0c1e 0%, #1a0533 50%, #0c0c1e 100%)',
    imageUrl: '',
    videoUrl: '',
    pattern: 'none',
    opacity: 0,
    blur: 0,
  },
  effects: {
    crt: true,
    noise: false,
    vignette: true,
    flicker: false,
    chromatic: false,
    scanlineOpacity: 0.18,
    noiseOpacity: 0.06,
    vignetteStrength: 0.65,
  },
  particles: {
    enabled: false,
    preset: 'none',
    density: 0.5,
    speed: 0.4,
  },
  fontFamily: 'default',
  accentColor: '#00ff41',
  textColor: '#ffffff',
}

export class OverlayStyleRepository {
  constructor(private db: DatabaseType) {}

  find(): OverlayStyle {
    const row = this.db.prepare('SELECT * FROM overlay_style WHERE id = 1').get() as {
      background_json: string | null
      effects_json: string | null
      particles_json: string | null
      font_family: string | null
      accent_color: string | null
      text_color: string | null
    } | undefined

    if (!row) return clone(DEFAULT_OVERLAY_STYLE)

    return {
      background: parseJson<OverlayStyle['background']>(row.background_json) ?? clone(DEFAULT_OVERLAY_STYLE.background),
      effects: parseJson<OverlayStyle['effects']>(row.effects_json) ?? clone(DEFAULT_OVERLAY_STYLE.effects),
      particles: parseJson<OverlayStyle['particles']>(row.particles_json) ?? clone(DEFAULT_OVERLAY_STYLE.particles),
      fontFamily: row.font_family ?? DEFAULT_OVERLAY_STYLE.fontFamily,
      accentColor: row.accent_color ?? DEFAULT_OVERLAY_STYLE.accentColor,
      textColor: row.text_color ?? DEFAULT_OVERLAY_STYLE.textColor,
    }
  }

  save(style: OverlayStyle): void {
    this.db.prepare(`
      INSERT INTO overlay_style (
        id, background_json, effects_json, particles_json, font_family, accent_color, text_color
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        background_json = excluded.background_json,
        effects_json = excluded.effects_json,
        particles_json = excluded.particles_json,
        font_family = excluded.font_family,
        accent_color = excluded.accent_color,
        text_color = excluded.text_color
    `).run(
      1,
      JSON.stringify(style.background),
      JSON.stringify(style.effects),
      JSON.stringify(style.particles),
      style.fontFamily,
      style.accentColor,
      style.textColor,
    )
  }
}
