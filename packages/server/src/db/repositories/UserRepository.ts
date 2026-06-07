import type { GoogleProfile } from '../../auth/googleOAuth.js'

type QueryRow = Record<string, unknown>

interface QueryableDb {
  query(sql: string, params?: unknown[]): Promise<{ rows: QueryRow[] }>
}

export interface UserRecord {
  id: string
  googleId: string
  email: string
  displayName: string
  avatarUrl: string | null
  slug: string
  createdAt: Date
  updatedAt: Date
}

function rowToRecord(row: any): UserRecord {
  return {
    id: row.id,
    googleId: row.google_id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    slug: row.slug,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at)),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(String(row.updated_at)),
  }
}

/**
 * Generates a URL-safe slug from a display name.
 */
export function generateSlug(displayName: string): string {
  let slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')

  if (slug.length > 20) {
    slug = slug.slice(0, 20)
    slug = slug.replace(/-+$/, '')
  }

  if (slug.length === 0) {
    slug = 'user'
  }

  return slug
}

/**
 * Appends a random alphanumeric suffix to a base slug for collision resolution.
 */
export function appendSlugSuffix(baseSlug: string): string {
  const suffix = Math.random().toString(36).slice(2, 6)
  const maxBase = 20 - suffix.length - 1
  let trimmed = baseSlug.slice(0, maxBase)
  trimmed = trimmed.replace(/-+$/, '')
  return `${trimmed}-${suffix}`
}

const MAX_SLUG_RETRIES = 5

/**
 * Type guard para errores de constraint UNIQUE de PostgreSQL.
 * Verifica el código de error 23505 sin depender de la estructura interna de pg.
 */
function isUniqueConstraintError(
  err: unknown,
  column?: string
): err is Error & Record<string, unknown> {
  if (!(err instanceof Error)) return false
  const pgErr = err as unknown as Record<string, unknown>
  if (pgErr.code !== '23505') return false
  if (column && typeof pgErr.constraint === 'string' && !pgErr.constraint.includes(column)) return false
  return true
}

export class UserRepository {
  constructor(private pool: QueryableDb) {}

  async findByGoogleId(googleId: string): Promise<UserRecord | null> {
    const result = await this.pool.query('SELECT * FROM users WHERE google_id = $1', [googleId])
    return result.rows[0] ? rowToRecord(result.rows[0]) : null
  }

  async findBySlug(slug: string): Promise<UserRecord | null> {
    const result = await this.pool.query('SELECT * FROM users WHERE slug = $1', [slug])
    return result.rows[0] ? rowToRecord(result.rows[0]) : null
  }

  async findById(id: string): Promise<UserRecord | null> {
    const result = await this.pool.query('SELECT * FROM users WHERE id = $1', [id])
    return result.rows[0] ? rowToRecord(result.rows[0]) : null
  }

  async upsertFromGoogle(profile: GoogleProfile): Promise<UserRecord> {
    const existing = await this.findByGoogleId(profile.googleId)
    if (existing) {
      const result = await this.pool.query(`UPDATE users
         SET display_name = $1, avatar_url = $2, updated_at = NOW()
         WHERE google_id = $3
         RETURNING *`, [profile.name, profile.picture, profile.googleId])
      return rowToRecord(result.rows[0])
    }

    const baseSlug = generateSlug(profile.name)
    let slug = baseSlug
    let retries = 0
    while (retries < MAX_SLUG_RETRIES) {
      try {
        const result = await this.pool.query(`INSERT INTO users (google_id, email, display_name, avatar_url, slug)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`, [profile.googleId, profile.email, profile.name, profile.picture, slug])
        return rowToRecord(result.rows[0])
      } catch (error) {
        if (isUniqueConstraintError(error, 'slug')) {
          slug = appendSlugSuffix(baseSlug)
          retries++
        } else {
          throw error
        }
      }
    }

    throw new Error(`Failed to generate unique slug after ${MAX_SLUG_RETRIES} retries`)
  }

  async storeRefreshTokenHash(userId: string, hash: string): Promise<void> {
    await this.pool.query('UPDATE users SET refresh_token_hash = $1, updated_at = NOW() WHERE id = $2', [hash, userId])
  }

  async getRefreshTokenHash(userId: string): Promise<string | null> {
    const result = await this.pool.query('SELECT refresh_token_hash FROM users WHERE id = $1', [userId])
    const row = result.rows[0] as { refresh_token_hash?: string | null } | undefined
    return row?.refresh_token_hash ?? null
  }

  async invalidateRefreshToken(userId: string): Promise<void> {
    await this.pool.query('UPDATE users SET refresh_token_hash = NULL, updated_at = NOW() WHERE id = $1', [userId])
  }
}
