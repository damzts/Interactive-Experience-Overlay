import type { OverlayStyle } from '@ieom/shared'
import type { Pool } from 'pg'

function clone<T>(value: T): T {
  return structuredClone(value)
}

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

interface OverlayStyleRow {
  user_id: string
  background_json: unknown | null
  effects_json: unknown | null
  particles_json: unknown | null
  font_family: string | null
  accent_color: string | null
  text_color: string | null
}

export class OverlayStyleRepository {
  constructor(private pool: Pool) {}

  async find(userId: string): Promise<OverlayStyle> {
    const { rows } = await this.pool.query<OverlayStyleRow>(
      'SELECT background_json, effects_json, particles_json, font_family, accent_color, text_color FROM overlay_style WHERE user_id = $1',
      [userId]
    )

    if (rows.length === 0) return clone(DEFAULT_OVERLAY_STYLE)

    const row = rows[0]
    return {
      background: (row.background_json as OverlayStyle['background']) ?? clone(DEFAULT_OVERLAY_STYLE.background),
      effects: (row.effects_json as OverlayStyle['effects']) ?? clone(DEFAULT_OVERLAY_STYLE.effects),
      particles: (row.particles_json as OverlayStyle['particles']) ?? clone(DEFAULT_OVERLAY_STYLE.particles),
      fontFamily: row.font_family ?? DEFAULT_OVERLAY_STYLE.fontFamily,
      accentColor: row.accent_color ?? DEFAULT_OVERLAY_STYLE.accentColor,
      textColor: row.text_color ?? DEFAULT_OVERLAY_STYLE.textColor,
    }
  }

  async save(userId: string, style: OverlayStyle): Promise<void> {
    await this.pool.query(
      `INSERT INTO overlay_style (user_id, background_json, effects_json, particles_json, font_family, accent_color, text_color)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET
         background_json = EXCLUDED.background_json,
         effects_json = EXCLUDED.effects_json,
         particles_json = EXCLUDED.particles_json,
         font_family = EXCLUDED.font_family,
         accent_color = EXCLUDED.accent_color,
         text_color = EXCLUDED.text_color`,
      [
        userId,
        JSON.stringify(style.background),
        JSON.stringify(style.effects),
        JSON.stringify(style.particles),
        style.fontFamily,
        style.accentColor,
        style.textColor,
      ]
    )
  }
}
