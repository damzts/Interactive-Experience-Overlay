import { useAuth } from './AuthContext'

export function AuthBadge() {
  const { isAuthenticated, user, openLoginModal, logout } = useAuth()

  if (!isAuthenticated) {
    return (
      <button
        onClick={openLoginModal}
        className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
      >
        Sign in
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-zinc-400 font-mono truncate max-w-[120px]">
        {user?.name || user?.email || 'Signed in'}
      </span>
      <button
        onClick={logout}
        className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
      >
        Logout
      </button>
    </div>
  )
}
