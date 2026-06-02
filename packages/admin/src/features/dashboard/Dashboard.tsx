import { useEffect, useState } from 'react'
import { withDesktopConfigDefaults } from '@ieom/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { TopBar } from './TopBar'
import { LeftSidebar } from './LeftSidebar'
import { RightPane } from './RightPane'
import type { SelectedItem } from './types'
import { itemKey } from './types'
// AssetLibraryPanel (modal) and SettingsModal are preserved in their respective files for future use


export function Dashboard() {
  const [selected,       setSelected]       = useState<SelectedItem | null>(null)
  const applications  = useAdminStore((s) => s.config.applications)
  const desktopConfig = withDesktopConfigDefaults(useAdminStore((s) => s.config.desktopConfig))

  // Clear selection when selected app is removed
  useEffect(() => {
    if (selected?.kind === 'app' && !applications.find((a) => a.id === selected.appId)) {
      setSelected(null)
    }
  }, [applications, selected])

  useEffect(() => {
    if (selected?.kind === 'widget-layout' && !(desktopConfig.widgetLayouts ?? []).some((layout) => layout.id === selected.layoutId)) {
      setSelected(null)
    }
  }, [desktopConfig.widgetLayouts, selected])

  const handleSelect = (item: SelectedItem) => {
    if (selected && itemKey(item) === itemKey(selected)) {
      setSelected(null)
    } else {
      setSelected(item)
    }
  }

  const handleActivate = (item: SelectedItem) => {
    setSelected(item)
    if (item.kind === 'env') {
      socket.emit('scene:change', item.envState)
    } else if (item.kind === 'scene') {
      socket.emit('scene:change', item.sceneState)
    } else if (item.kind === 'app') {
      const app = applications.find((a) => a.id === item.appId)
      if (!app) return
      if (app.appType === 'widget') socket.emit('widget:toggle', app.id)
      else if (app.appType === 'scene') socket.emit('scene:change', app.targetSceneId)
    } else if (item.kind === 'widget-layout') {
      socket.emit('widget:layout:apply', item.layoutId)
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden text-zinc-100">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar
          selected={selected}
          onSelect={handleSelect}
          onActivate={handleActivate}
        />
        <RightPane selected={selected} onClose={() => setSelected(null)} onSelectItem={setSelected} />
      </div>
    </div>
  )
}
