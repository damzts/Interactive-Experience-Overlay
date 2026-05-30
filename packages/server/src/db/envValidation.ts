/**
 * Environment variable validation for PostgreSQL multi-tenant auth.
 * Validates that all required environment variables are present on startup.
 * Supports DATABASE_URL as an alternative to individual PG* variables.
 */

export interface EnvValidationResult {
  valid: boolean
  missing: string[]
}

/**
 * Required environment variables when DATABASE_URL is NOT provided.
 * If DATABASE_URL is set, individual PG* variables are not required.
 */
const PG_VARIABLES = ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'] as const

/**
 * Required environment variables regardless of DATABASE_URL presence.
 */
const AUTH_VARIABLES = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'JWT_SECRET'] as const

/**
 * Validates that all required environment variables are present.
 * If DATABASE_URL is provided, individual PG* variables are not required.
 *
 * @param env - The environment variables object (defaults to process.env)
 * @returns An object indicating whether validation passed and which variables are missing
 */
export function validateEnv(env: Record<string, string | undefined> = process.env): EnvValidationResult {
  const missing: string[] = []

  const hasDatabaseUrl = Boolean(env.DATABASE_URL)

  if (!hasDatabaseUrl) {
    for (const varName of PG_VARIABLES) {
      if (!env[varName]) {
        missing.push(varName)
      }
    }
  }

  for (const varName of AUTH_VARIABLES) {
    if (!env[varName]) {
      missing.push(varName)
    }
  }

  return { valid: missing.length === 0, missing }
}

/**
 * Validates environment variables and exits the process if any are missing.
 * Logs which variables are absent before exiting.
 *
 * @param env - The environment variables object (defaults to process.env)
 */
export function validateEnvOrExit(env: Record<string, string | undefined> = process.env): void {
  const { valid, missing } = validateEnv(env)

  if (!valid) {
    console.error(
      `[env] Missing required environment variables: ${missing.join(', ')}. ` +
      `Provide DATABASE_URL or individual PG* variables (PGHOST, PGDATABASE, PGUSER, PGPASSWORD), ` +
      `plus GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and JWT_SECRET.`
    )
    process.exit(1)
  }
}
