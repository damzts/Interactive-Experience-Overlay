import { useAuth } from './AuthContext'

export function AccountSection() {
  const { isAuthenticated, user, login, logout } = useAuth()

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-5 py-4">
        <div>
          <div className="text-xs font-medium text-zinc-300">Account</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Sign in to unlock online features</div>
        </div>
        <button
          onClick={login}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          Sign in
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-5 py-4">
      <div>
        <div className="text-xs font-medium text-zinc-200">{user?.name || 'Signed in'}</div>
        <div className="text-[11px] text-zinc-500 mt-0.5">{user?.email || user?.id}</div>
      </div>
      <button
        onClick={logout}
        className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
      >
        Logout
      </button>
    </div>
  )
}
