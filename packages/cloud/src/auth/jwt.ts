import jwt from 'jsonwebtoken'

export interface JwtPayload {
  sub: string
  email: string
  iat: number
  exp: number
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return secret
}

export function signAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, getSecret(), { expiresIn: process.env.JWT_EXPIRATION || '24h' })
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, getSecret()) as jwt.JwtPayload
  return { sub: decoded.sub as string, email: decoded.email as string, iat: decoded.iat as number, exp: decoded.exp as number }
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, getSecret(), { expiresIn: process.env.REFRESH_TOKEN_EXPIRATION || '30d' })
}

export function verifyRefreshToken(token: string): { sub: string } {
  const decoded = jwt.verify(token, getSecret()) as jwt.JwtPayload
  return { sub: decoded.sub as string }
}
