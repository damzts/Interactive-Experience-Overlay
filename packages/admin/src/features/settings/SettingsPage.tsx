import { AccountSection } from '../../auth/AccountSection'
import { ConfigPanel } from '../../components/organisms'

export function SettingsPage() {
  return (
    <div className="w-full max-w-none space-y-4 pt-1">
      <ConfigPanel title="Account">
        <AccountSection />
      </ConfigPanel>
    </div>
  )
}
