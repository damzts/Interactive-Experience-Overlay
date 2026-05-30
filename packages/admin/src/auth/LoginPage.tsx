import { useMemo } from 'react'
import { useAuth } from './AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const errorMessage = useMemo(() => {
    if (typeof window === 'undefined') return null
    const error = new URLSearchParams(window.location.search).get('error')
    if (!error) return null
    if (error === 'oauth_failed') return 'Google sign-in failed. Please try again.'
    return 'Sign-in failed. Please try again.'
  }, [])

  return (
    <div className="flex items-center justify-center h-full bg-gray-900">
      <div className="text-center p-8 bg-gray-800 rounded-lg shadow-lg max-w-sm w-full">
        <h1 className="text-2xl font-bold text-white mb-2">IEOM Admin</h1>
        <p className="text-gray-400 mb-6">Sign in to manage your overlay</p>
        {errorMessage ? (
          <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}
        <button
          onClick={login}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-gray-800 font-medium rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
