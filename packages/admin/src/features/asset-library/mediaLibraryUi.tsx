import type { ReactNode } from 'react'

/** Rich list-item button shared by Events and Sources sidebars. */
export function LibraryItemBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'w-full rounded-xl border px-3.5 py-3 text-left transition-all duration-150 ' +
        (active
          ? 'border-cyan-400/30 bg-cyan-500/12 text-zinc-50 shadow-[0_0_0_1px_rgba(34,211,238,0.06)]'
          : 'border-white/5 bg-white/[0.02] text-zinc-400 hover:border-cyan-400/20 hover:bg-white/[0.04] hover:text-zinc-100')
      }
    >
      {children}
    </button>
  )
}
