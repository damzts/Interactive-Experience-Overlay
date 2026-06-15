import { SettingsPage } from '../settings/SettingsPage'

export function SettingsPanel() {
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <SettingsPage />
      </div>
    </div>
  )
}
