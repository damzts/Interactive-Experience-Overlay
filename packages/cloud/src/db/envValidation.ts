export interface EnvValidationResult {
  valid: boolean
  missing: string[]
}

const PG_VARIABLES = ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'] as const
const AUTH_VARIABLES = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'JWT_SECRET'] as const

export function validateEnv(env: Record<string, string | undefined> = process.env): EnvValidationResult {
  const missing: string[] = []
  const hasDatabaseUrl = Boolean(env.DATABASE_URL)

  if (!hasDatabaseUrl) {
    for (const varName of PG_VARIABLES) {
      if (!env[varName]) missing.push(varName)
    }
  }

  for (const varName of AUTH_VARIABLES) {
    if (!env[varName]) missing.push(varName)
  }

  return { valid: missing.length === 0, missing }
}

export function validateEnvOrExit(env: Record<string, string | undefined> = process.env): void {
  const { valid, missing } = validateEnv(env)
  if (!valid) {
    console.error(
      `[env] Missing required environment variables: ${missing.join(', ')}. ` +
      `Provide DATABASE_URL or individual PG* variables, plus GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and JWT_SECRET.`
    )
    process.exit(1)
  }
}
