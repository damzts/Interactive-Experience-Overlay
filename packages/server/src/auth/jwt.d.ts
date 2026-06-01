declare module './jwt.js' {
  export interface JwtPayload {
    sub: string
    email: string
    iat: number
    exp: number
  }

  export function signAccessToken(userId: string, email: string): string
  export function verifyAccessToken(token: string): JwtPayload
  export function signRefreshToken(userId: string): string
  export function verifyRefreshToken(token: string): { sub: string }
}
