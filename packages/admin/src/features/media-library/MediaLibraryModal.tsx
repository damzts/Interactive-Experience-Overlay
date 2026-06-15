import { useEffect, type ReactNode } from 'react'
import { ConfigCard } from '../../shared/ui'

type ModalTab = {
  id: string
  label: string
  icon: string
  meta: string
}

export function MediaLibraryModal({
  isOpen,
  onClose,
  tabs,
  activeTab,
  onTabChange,
  sidebarChildren,
  contentChildren,
}: {
  isOpen: boolean
  onClose: () => void
  tabs: readonly ModalTab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  sidebarChildren: ReactNode
  contentChildren: ReactNode
}) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative flex flex-1 min-h-0 overflow-hidden p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 rounded-lg border border-red-700/60 bg-red-900/80 px-2 py-1 text-xs text-red-300 hover:text-red-100 transition-colors" aria-label="Close">✕</button>
        <div className="grid w-full h-full min-h-0 gap-5 grid-cols-[320px_minmax(0,1fr)]">
          <ConfigCard className="min-h-0 overflow-hidden p-4 sm:p-5">
            <div className="flex h-full min-h-0 flex-col gap-4">
              <div className="grid gap-1.5">
                {tabs.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onTabChange(entry.id)}
                    className={
                      'rounded-xl border px-3 py-3 text-left transition-colors ' +
                      (activeTab === entry.id
                        ? 'border-cyan-400/35 bg-cyan-500/14 text-cyan-100'
                        : 'border-zinc-800/80 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700/80 hover:text-zinc-200')
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base leading-none">{entry.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">{entry.label}</div>
                        <div className="text-[10px] text-zinc-500">{entry.meta}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {sidebarChildren}
            </div>
          </ConfigCard>

          <div className="min-w-0 min-h-0 overflow-y-auto pr-1">
            {contentChildren}
          </div>
        </div>
      </div>
    </div>
  )
}
