/**
 * Migration 001: Create the users table.
 * This is the tenant identity table — all other tenant-scoped tables reference it.
 */

import type { PoolClient } from 'pg'
import type { Migration } from '../migrationRunner.js'

export const migration001: Migration = {
  version: 1,
  name: 'create_users_table',
  up: async (client: PoolClient) => {
    await client.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        google_id TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        slug TEXT UNIQUE NOT NULL,
        refresh_token_hash TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE UNIQUE INDEX idx_users_google_id ON users(google_id)
    `)

    await client.query(`
      CREATE UNIQUE INDEX idx_users_slug ON users(slug)
    `)
  },
}
