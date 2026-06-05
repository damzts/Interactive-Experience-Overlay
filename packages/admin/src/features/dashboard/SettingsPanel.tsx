import { useState } from 'react'
import { SettingsPage } from '../settings/SettingsPage'

type SettingsTab = 'general' | 'about'

export function SettingsPanel() {
  const [tab, setTab] = useState<SettingsTab>('general')
  return (
    <div className="flex flex-1 min-h-0 flex-col space-y-3">
      <div className="flex gap-1.5 rounded-xl border border-zinc-800/80 bg-zinc-950/55 p-1.5">
        {(['general', 'about'] as const).map((id) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={'flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ' + (
              tab === id
                ? 'border-cyan-400/35 bg-cyan-500/14 text-cyan-100'
                : 'border-transparent text-zinc-500 hover:border-zinc-700/70 hover:bg-zinc-900/75 hover:text-zinc-200'
            )}>{id}</button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'about'    && <SettingsPage mode="about" />}
        {tab === 'general'  && <SettingsPage />}
      </div>
    </div>
  )
}
