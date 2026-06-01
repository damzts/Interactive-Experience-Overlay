// import jwt from 'jsonwebtoken'
import jwt, { SignOptions } from 'jsonwebtoken'

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

export interface JwtPayload {
  sub: string
  email: string
  iat: number
  exp: number
}

/**
 * Signs an access token containing the user's ID and email.
 */
const options: SignOptions = {
  expiresIn: getAccessExpiration() as SignOptions['expiresIn']
}


export function signAccessToken(userId: string, email: string): string {
  const secret = getSecret()
//   return jwt.sign({ sub: userId, email }, secret, { expiresIn: getAccessExpiration() })
return jwt.sign({ sub: userId, email }, secret, options)
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
//   return jwt.sign({ sub: userId }, secret, { expiresIn: getRefreshExpiration() })
return jwt.sign({ sub: userId}, secret, options)
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
