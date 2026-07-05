import { AccountSection } from '../../auth/AccountSection'
import { ConfigPanel } from '../../components/organisms'
import { Button } from '../../components/atoms/Button'

function openBusTrace() {
  window.open('/bus-trace.html', 'ieom-bus-trace', 'width=1000,height=640,menubar=no,toolbar=no,location=no')
}

export function SettingsPage() {
  return (
    <div className="w-full max-w-none space-y-4 pt-1">
      <ConfigPanel title="Account">
        <AccountSection />
      </ConfigPanel>
      <ConfigPanel title="Diagnostics">
        <Button variant="secondary" size="md" onClick={openBusTrace}>
          Open Bus Trace
        </Button>
      </ConfigPanel>
    </div>
  )
}
