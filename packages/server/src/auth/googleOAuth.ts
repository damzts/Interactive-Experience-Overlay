import { OAuth2Client } from 'google-auth-library'

const SCOPES = ['openid', 'email', 'profile']

function getClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Google OAuth environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI')
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri)
}

/**
 * Builds the Google OAuth 2.0 authorization URL with configured
 * client_id, redirect_uri, and scopes (openid, email, profile).
 */
export function getAuthorizationUrl(): string {
  const client = getClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })
}

export function getAuthorizationUrlWithState(state: string): string {
  const client = getClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  })
}

/**
 * Exchanges an authorization code for access and ID tokens
 * via Google's token endpoint.
 */
export async function exchangeCodeForTokens(code: string): Promise<{ idToken: string; accessToken: string }> {
  const client = getClient()
  const { tokens } = await client.getToken(code)

  if (!tokens.id_token) {
    throw new Error('No ID token returned from Google token exchange')
  }

  return {
    idToken: tokens.id_token,
    accessToken: tokens.access_token ?? '',
  }
}

export interface GoogleProfile {
  googleId: string
  email: string
  name: string
  picture: string | null
}

/**
 * Extracts user profile (google_id, email, name, picture) from the ID token
 * by verifying it against Google's public keys.
 */
export async function extractProfile(idToken: string): Promise<GoogleProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    throw new Error('Missing GOOGLE_CLIENT_ID environment variable')
  }

  const client = new OAuth2Client(clientId)
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  })

  const payload = ticket.getPayload()
  if (!payload) {
    throw new Error('Unable to extract payload from ID token')
  }
  if (!payload.sub || !payload.email) {
    throw new Error('ID token payload missing required fields (sub, email)')
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    picture: payload.picture ?? null,
  }
}
