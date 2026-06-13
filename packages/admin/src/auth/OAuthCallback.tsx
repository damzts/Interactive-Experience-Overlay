/**
 * OAuthCallback — Minimal page rendered at /auth/callback inside the OAuth popup.
 *
 * This component does NOT render the full app. It only:
 * 1. Extracts the token from the URL query params
 * 2. Stores it in localStorage (shared across windows of the same origin)
 * 3. Notifies the opener via postMessage as backup
 * 4. Closes the popup
 */

import { useEffect } from 'react'

export function OAuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token') ?? params.get('access_token')
    const error = params.get('error')

    console.log('[OAuthCallback] mounted, URL:', window.location.href)
    console.log('[OAuthCallback] token present:', !!token, 'token length:', token?.length)
    console.log('[OAuthCallback] error:', error)
    console.log('[OAuthCallback] window.opener:', !!window.opener)

    if (token) {
      // Write token to localStorage — the main window polls for this
      localStorage.setItem('ieom_oauth_token', token)
      console.log('[OAuthCallback] wrote token to localStorage')
      console.log('[OAuthCallback] verify localStorage:', !!localStorage.getItem('ieom_oauth_token'))

      // Notify the opener via postMessage as backup (in case polling misses it)
      if (window.opener) {
        try {
          window.opener.postMessage({ type: 'ieom_oauth_token', token }, window.location.origin)
          console.log('[OAuthCallback] postMessage sent to opener')
        } catch (e) {
          console.warn('[OAuthCallback] postMessage failed:', e)
        }
      } else {
        console.warn('[OAuthCallback] NO window.opener — postMessage skipped')
      }

      // Close the popup after a brief delay to ensure localStorage is flushed
      console.log('[OAuthCallback] scheduling window.close() in 300ms')
      setTimeout(() => {
        console.log('[OAuthCallback] calling window.close()')
        window.close()
      }, 300)
    } else if (error) {
      console.error('[OAuthCallback] OAuth error received:', error)
      if (window.opener) {
        try {
          window.opener.postMessage({ type: 'ieom_oauth_error', error }, window.location.origin)
        } catch {
          // ignore cross-origin errors
        }
      }
      setTimeout(() => window.close(), 1000)
    } else {
      console.warn('[OAuthCallback] No token AND no error in URL params!')
      console.log('[OAuthCallback] All params:', Object.fromEntries(params.entries()))
    }
  }, [])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#070b14',
      color: '#94a3b8',
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px',
    }}>
      <p>Completing sign-in…</p>
    </div>
  )
}
