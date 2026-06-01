import { useMemo } from 'react'
import { useAuth } from './AuthContext'

export function LoginPage() {
  const { login } = useAuth()

  const goToAdmin = () => {
    window.location.href = '/admin'
  }

  const errorMessage = useMemo(() => {
    if (typeof window === 'undefined') return null
    const error = new URLSearchParams(window.location.search).get('error')
    if (!error) return null
    if (error === 'oauth_failed') return 'Google sign-in failed. Please try again.'
    return 'Sign-in failed. Please try again.'
  }, [])

  return (
    <div className="login-shell relative flex h-full items-center justify-center overflow-hidden bg-[#070b14] px-4 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.18),_transparent_30%),linear-gradient(180deg,_rgba(9,12,20,1),_rgba(4,7,14,1))]" />
      <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />

      <div className="relative w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="grid md:grid-cols-[1.15fr_0.85fr]">
          <div className="login-panel flex flex-col justify-between gap-10 border-b border-white/10 p-8 md:border-b-0 md:border-r md:p-10 lg:p-12">
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 via-sky-500/10 to-indigo-500/10 shadow-[0_10px_30px_rgba(34,211,238,0.12)]">
                    <svg className="h-7 w-7" viewBox="0 0 32 32" aria-hidden="true">
                      <defs>
                        <linearGradient id="ieom-brand-gradient" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#67e8f9" />
                          <stop offset="55%" stopColor="#38bdf8" />
                          <stop offset="100%" stopColor="#818cf8" />
                        </linearGradient>
                      </defs>
                      <rect x="4" y="4" width="24" height="24" rx="8" fill="url(#ieom-brand-gradient)" opacity="0.16" />
                      <path d="M10 9.5a2.5 2.5 0 0 1 2.5-2.5h7A4.5 4.5 0 0 1 24 11.5v1.2a4.5 4.5 0 0 1-2.6 4.08A4.5 4.5 0 0 1 24 20.86v.64A4.5 4.5 0 0 1 19.5 26h-7A2.5 2.5 0 0 1 10 23.5v-14Z" fill="none" stroke="url(#ieom-brand-gradient)" strokeWidth="2.2" strokeLinejoin="round" />
                      <path d="M13.5 10.5v11" stroke="#e0f2fe" strokeWidth="2.2" strokeLinecap="round" />
                      <path d="M17.1 10.5h2.8M17.1 16h4.2M17.1 21.5h2.8" stroke="#e0f2fe" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">IEOM Admin</p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Desktop control surface</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-medium text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(74,222,128,0.75)]" />
                  Ready
                </div>
              </div>

              <div className="login-chip inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium tracking-[0.12em] text-cyan-200 uppercase">
                Desktop-ready control center
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">IEOM Admin</h1>
                <p className="max-w-xl text-sm leading-6 text-slate-300 md:text-base">
                  Sign in only if you want cloud, rooms, or user-bound features.
                  Google sign-in opens in a separate window, and the rest of the admin stays available without login.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  'Open the dashboard without logging in',
                  'Use rooms and online features when needed',
                  'Keep your workspace available after logout',
                  'Works smoothly as a desktop-first app',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-300">✓</span>
                    <span className="text-sm leading-5 text-slate-200">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Guest access enabled</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Optional login</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Desktop-first UX</span>
            </div>
          </div>

          <div className="login-card flex items-center justify-center p-6 md:p-10 lg:p-12">
            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-red-400/80" />
                    <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="text-[11px] font-medium tracking-[0.14em] text-slate-400 uppercase">IEOM Admin</span>
                </div>
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Login
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-white/10 bg-black/15 px-5 py-2.5 text-[11px] text-slate-400">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                  Local admin shell active
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-slate-500">Guest mode</span>
              </div>

              <div className="p-6 sm:p-7">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Authentication</p>
                    <h2 className="mt-1 text-xl font-medium text-white">Choose how you want to continue</h2>
                  </div>
                  <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 px-3 py-2 text-[11px] text-cyan-200">
                    Optional
                  </div>
                </div>

                {errorMessage ? (
                  <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {errorMessage}
                  </div>
                ) : null}

                <div className="space-y-3">
                  <button
                    onClick={login}
                    className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-cyan-400 to-sky-500 px-4 py-3.5 font-medium text-slate-950 shadow-lg shadow-cyan-500/20 transition-transform hover:-translate-y-0.5 hover:shadow-cyan-500/30 cursor-pointer"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
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

                  <button
                    onClick={goToAdmin}
                    className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 font-medium text-slate-200 transition-colors hover:bg-white/10 cursor-pointer"
                  >
                    Back to admin
                  </button>
                </div>

                <p className="mt-5 text-center text-[11px] leading-5 text-slate-500">
                  You can always return here later. Logout only removes the session; it does not block the rest of the app.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
