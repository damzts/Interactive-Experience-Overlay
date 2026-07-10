import { ConfigPageIntro, ConfigSectionPanel } from '../../shared/ui'
import { Button } from '../../components/atoms/Button'

function openBusTrace() {
  window.open('/bus-trace.html', 'ieom-bus-trace', 'width=1000,height=640,menubar=no,toolbar=no,location=no')
}

export function DeveloperPanel() {
  return (
    <div className="space-y-5">
      <ConfigPageIntro
        icon="🛠"
        title="Developer"
        description="Diagnostics and low-level tooling for inspecting live system activity."
      />

      <ConfigSectionPanel label="Diagnostics" first>
        <Button variant="secondary" size="md" onClick={openBusTrace}>
          Open Bus Trace
        </Button>
      </ConfigSectionPanel>
    </div>
  )
}
