import type { ReactNode } from 'react'

import { ConfigCard, FloatingWindowHeader, FloatingWindowShell } from '../../shared/ui'

type AssetLibraryTab = {
  id: string
  label: string
  icon: string
  meta: string
}

export function AssetLibraryModal({
  isOpen,
  onClose,
  tabs,
  activeTab,
  onTabChange,
  sidebarChildren,
  contentChildren,
  inline = false,
}: {
  isOpen: boolean
  onClose: () => void
  tabs: readonly AssetLibraryTab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  sidebarChildren: ReactNode
  contentChildren: ReactNode
  inline?: boolean
}) {
  const content = (
    <div className="flex-1 min-h-0 overflow-hidden p-5 sm:p-6">
      <div className="grid h-full min-h-0 gap-5 grid-cols-[320px_minmax(0,1fr)]">
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
  )

  if (inline) return content

  return (
    <FloatingWindowShell
      frameClassName="h-[98vh] max-h-[1040px] max-w-none w-[min(1760px,calc(100vw-8px))]"
      layerClassName={`z-[60]${isOpen ? '' : ' hidden'}`}
    >
      <FloatingWindowHeader icon="🗂" title="Asset Library" onClose={onClose} />
      {content}
    </FloatingWindowShell>
  )
}