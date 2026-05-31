import { OAuth2Client } from 'google-auth-library'

export interface GoogleProfile {
  googleId: string
  email: string
  name: string
  picture: string | null
}

const SCOPES = ['openid', 'email', 'profile']

function getClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Google OAuth environment variables')
  }
  return new OAuth2Client(clientId, clientSecret, redirectUri)
}

export function getAuthorizationUrl(): string {
  return getClient().generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' })
}

export function getAuthorizationUrlWithState(state: string): string {
  return getClient().generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent', state })
}

export async function exchangeCodeForTokens(code: string): Promise<{ idToken: string; accessToken: string }> {
  const { tokens } = await getClient().getToken(code)
  if (!tokens.id_token) throw new Error('No ID token returned from Google')
  return { idToken: tokens.id_token, accessToken: tokens.access_token ?? '' }
}

export async function extractProfile(idToken: string): Promise<GoogleProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID!
  const client = new OAuth2Client(clientId)
  const ticket = await client.verifyIdToken({ idToken, audience: clientId })
  const payload = ticket.getPayload()
  if (!payload?.sub || !payload?.email) throw new Error('ID token missing required fields')
  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    picture: payload.picture ?? null,
  }
}
