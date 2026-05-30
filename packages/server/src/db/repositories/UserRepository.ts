/**
 * UserRepository — data access for the users table.
 * Handles user lookup, upsert from Google OAuth profile,
 * slug generation with collision handling, and refresh token management.
 */

import type { Pool } from 'pg'
import type { GoogleProfile } from '../../auth/googleOAuth.js'

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

interface UserRow {
  id: string
  google_id: string
  email: string
  display_name: string
  avatar_url: string | null
  slug: string
  refresh_token_hash: string | null
  created_at: Date
  updated_at: Date
}

function rowToRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    googleId: row.google_id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    slug: row.slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Generates a URL-safe slug from a display name.
 * - Lowercased
 * - Non-alphanumeric characters replaced with hyphens
 * - Consecutive hyphens collapsed
 * - Leading/trailing hyphens removed
 * - Truncated to max 20 characters (trimmed at word boundary if possible)
 * - Must match: ^[a-z0-9][a-z0-9\-]*[a-z0-9]$
 */
export function generateSlug(displayName: string): string {
  let slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')

  // Truncate to max 20 characters
  if (slug.length > 20) {
    slug = slug.slice(0, 20)
    // Remove trailing hyphen after truncation
    slug = slug.replace(/-+$/, '')
  }

  // If slug is empty or single char that doesn't satisfy the regex, provide a fallback
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
  // Ensure total length stays reasonable
  const maxBase = 20 - suffix.length - 1 // -1 for the hyphen
  let trimmed = baseSlug.slice(0, maxBase)
  trimmed = trimmed.replace(/-+$/, '')
  return `${trimmed}-${suffix}`
}

const MAX_SLUG_RETRIES = 5

export class UserRepository {
  constructor(private pool: Pool) {}

  async findByGoogleId(googleId: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRow>(
      'SELECT * FROM users WHERE google_id = $1',
      [googleId]
    )
    return result.rows[0] ? rowToRecord(result.rows[0]) : null
  }

  async findBySlug(slug: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRow>(
      'SELECT * FROM users WHERE slug = $1',
      [slug]
    )
    return result.rows[0] ? rowToRecord(result.rows[0]) : null
  }

  async findById(id: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRow>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    )
    return result.rows[0] ? rowToRecord(result.rows[0]) : null
  }

  /**
   * Creates or updates a user from a Google OAuth profile.
   * - If a user with the same google_id exists, updates display_name and avatar_url.
   * - If no user exists, creates a new record with a generated slug.
   * - Handles slug collisions by appending a random suffix and retrying.
   */
  async upsertFromGoogle(profile: GoogleProfile): Promise<UserRecord> {
    // Check if user already exists
    const existing = await this.findByGoogleId(profile.googleId)

    if (existing) {
      // Update display_name and avatar_url
      const result = await this.pool.query<UserRow>(
        `UPDATE users
         SET display_name = $1, avatar_url = $2, updated_at = NOW()
         WHERE google_id = $3
         RETURNING *`,
        [profile.name, profile.picture, profile.googleId]
      )
      return rowToRecord(result.rows[0])
    }

    // New user — generate slug and insert
    const baseSlug = generateSlug(profile.name)
    let slug = baseSlug
    let retries = 0

    while (retries < MAX_SLUG_RETRIES) {
      try {
        const result = await this.pool.query<UserRow>(
          `INSERT INTO users (google_id, email, display_name, avatar_url, slug)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [profile.googleId, profile.email, profile.name, profile.picture, slug]
        )
        return rowToRecord(result.rows[0])
      } catch (error: unknown) {
        // Check for unique constraint violation on slug
        if (
          error instanceof Error &&
          'code' in error &&
          (error as { code: string }).code === '23505' &&
          'constraint' in error &&
          String((error as { constraint: string }).constraint).includes('slug')
        ) {
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
    await this.pool.query(
      'UPDATE users SET refresh_token_hash = $1, updated_at = NOW() WHERE id = $2',
      [hash, userId]
    )
  }

  async getRefreshTokenHash(userId: string): Promise<string | null> {
    const result = await this.pool.query<{ refresh_token_hash: string | null }>(
      'SELECT refresh_token_hash FROM users WHERE id = $1',
      [userId]
    )
    return result.rows[0]?.refresh_token_hash ?? null
  }

  async invalidateRefreshToken(userId: string): Promise<void> {
    await this.pool.query(
      'UPDATE users SET refresh_token_hash = NULL, updated_at = NOW() WHERE id = $1',
      [userId]
    )
  }
}
