import jwt from 'jsonwebtoken'

export interface JwtPayload {
  sub: string    // user_id (UUID)
  email: string
  iat: number
  exp: number
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return secret
}

function getAccessExpiration(): string {
  return process.env.JWT_EXPIRATION || '24h'
}

function getRefreshExpiration(): string {
  return process.env.REFRESH_TOKEN_EXPIRATION || '30d'
}

/**
 * Signs an access token containing the user's ID and email.
 */
export function signAccessToken(userId: string, email: string): string {
  const secret = getSecret()
  return jwt.sign(
    { sub: userId, email },
    secret,
    { expiresIn: getAccessExpiration() }
  )
}

/**
 * Verifies an access token and returns the decoded payload.
 * Throws if the token is invalid, expired, or malformed.
 */
export function verifyAccessToken(token: string): JwtPayload {
  const secret = getSecret()
  const decoded = jwt.verify(token, secret) as jwt.JwtPayload
  return {
    sub: decoded.sub as string,
    email: decoded.email as string,
    iat: decoded.iat as number,
    exp: decoded.exp as number,
  }
}

/**
 * Signs a refresh token containing only the user's ID.
 */
export function signRefreshToken(userId: string): string {
  const secret = getSecret()
  return jwt.sign(
    { sub: userId },
    secret,
    { expiresIn: getRefreshExpiration() }
  )
}

/**
 * Verifies a refresh token and returns the decoded payload.
 * Throws if the token is invalid, expired, or malformed.
 */
export function verifyRefreshToken(token: string): { sub: string } {
  const secret = getSecret()
  const decoded = jwt.verify(token, secret) as jwt.JwtPayload
  return { sub: decoded.sub as string }
}
