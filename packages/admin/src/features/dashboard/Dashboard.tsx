import { useEffect, useRef, useState } from 'react'
import { withDesktopConfigDefaults } from '@ieom/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { AssetLibraryPanel as ExtractedAssetLibraryPanel } from '../asset-library/AssetLibraryPanel'
import { TopBar } from './TopBar'
import { LeftSidebar } from './LeftSidebar'
import { RightPane, SettingsModal } from './RightPane'
import type { SelectedItem } from './types'
import { itemKey } from './types'


export function Dashboard() {
  const [selected,       setSelected]       = useState<SelectedItem | null>(null)
  const [libraryOpen,    setLibraryOpen]    = useState(false)
  const [libraryMounted, setLibraryMounted] = useState(false)
  const [settingsOpen,   setSettingsOpen]   = useState(false)
  const [settingsTab,    setSettingsTab]    = useState<'general' | 'audio' | 'keybinds' | 'about'>('general')
  const libraryRestoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const applications  = useAdminStore((s) => s.config.applications)
  const desktopConfig = withDesktopConfigDefaults(useAdminStore((s) => s.config.desktopConfig))

  const clearLibraryRestoreTimeout = () => {
    if (libraryRestoreTimeoutRef.current) {
      clearTimeout(libraryRestoreTimeoutRef.current)
      libraryRestoreTimeoutRef.current = null
    }
  }

  const handleSettingsToggle = () => {
    if (settingsOpen) {
      setSettingsOpen(false)
      setSettingsTab('general')
      return
    }
    setSettingsTab('general')
    setSettingsOpen(true)
  }

  const handleSettingsClose = () => {
    setSettingsOpen(false)
    setSettingsTab('general')
  }

  const handleLibraryToggle = () => {
    clearLibraryRestoreTimeout()
    if (libraryOpen) {
      setLibraryOpen(false)
      setLibraryMounted(false)
      return
    }
    setLibraryMounted(true)
    setLibraryOpen(true)
  }

  const handleLibraryHide = () => {
    clearLibraryRestoreTimeout()
    setLibraryOpen(false)
    libraryRestoreTimeoutRef.current = setTimeout(() => {
      setLibraryMounted(true)
      setLibraryOpen(true)
      libraryRestoreTimeoutRef.current = null
    }, 3000)
  }

  const handleLibraryClose = () => {
    clearLibraryRestoreTimeout()
    setLibraryOpen(false)
    setLibraryMounted(false)
  }

  useEffect(() => () => {
    clearLibraryRestoreTimeout()
  }, [])

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
    <div className="relative flex flex-col h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar
          selected={selected}
          onSelect={handleSelect}
          onActivate={handleActivate}
          libraryOpen={libraryOpen}
          onLibrary={handleLibraryToggle}
          settingsOpen={settingsOpen}
          onSettings={handleSettingsToggle}
        />
        <RightPane selected={selected} onClose={() => setSelected(null)} onSelectItem={setSelected} />
      </div>
      {libraryMounted && <ExtractedAssetLibraryPanel isOpen={libraryOpen} onHide={handleLibraryHide} onClose={handleLibraryClose} />}
      {settingsOpen && (
        <SettingsModal
          tab={settingsTab}
          onTabChange={setSettingsTab}
          onClose={handleSettingsClose}
        />
      )}
    </div>
  )
}
