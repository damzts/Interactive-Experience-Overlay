import { useEffect, useRef, useState } from 'react'
import { DEFAULT_STICKY_NOTES_SETTINGS } from '@ieom/shared'
import { useAppStore } from '../store/useAppStore'
import { DesktopWindow } from './DesktopWindow'
import { patchApplicationConfig } from './configPersistence'
import { addWidgetSimulationIntentListener } from './widgetSimulationEvents'

const NOTE_COLORS = ['#fff2a8', '#ffd3e0', '#d8f8d0', '#cde8ff']

function saveStickyNote(appId: string, text: string, color: string) {
  patchApplicationConfig(appId, {
    stickyNotesSettings: {
      text,
      color,
    },
  }).catch(() => {})
}

interface StickyNotesWidgetProps {
  appId?: string
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

export function StickyNotesWidget({
  appId = 'sticky-notes',
  onClose,
  onMinimize,
  onFocus,
  windowState = 'open',
  zIndex,
}: StickyNotesWidgetProps) {
  const noteConfig = useAppStore((store) => (
    store.config.applications.find((app) => app.id === appId)?.stickyNotesSettings
  ))
  const [text, setText] = useState(() => noteConfig?.text ?? DEFAULT_STICKY_NOTES_SETTINGS.text)
  const [color, setColor] = useState(() => noteConfig?.color ?? DEFAULT_STICKY_NOTES_SETTINGS.color)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!noteConfig) return
    setText(noteConfig.text)
    setColor(noteConfig.color)
  }, [noteConfig])

  useEffect(() => {
    return addWidgetSimulationIntentListener((payload) => {
      if (payload.widgetId !== appId || payload.kind !== 'sticky:set-color') return
      setColor(payload.color)
    })
  }, [appId])

  const scheduleSave = (nextText: string, nextColor: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveStickyNote(appId, nextText, nextColor)
    }, 300)
  }

  return (
    <DesktopWindow
      id="sticky-notes"
      title="📝 Sticky Notes"
      width={260}
      defaultPosition={{ x: 280, y: 110 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--sticky-notes"
      bodyClassName="desktop-window-body--sticky-notes"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: 12 }}
    >
      <div className="widget-stack">
        <div className="widget-note-swatches">
          {NOTE_COLORS.map((swatch) => (
            <button
              key={swatch}
              data-sim-action={`sticky-color-${swatch.replace('#', '')}`}
              onClick={() => {
                setColor(swatch)
                scheduleSave(text, swatch)
              }}
              title={swatch}
              className={`widget-note-swatch ${swatch === color ? 'widget-note-swatch--active' : ''}`}
              style={{ background: swatch }}
            />
          ))}
        </div>

        <div className="widget-note-sheet" style={{ background: color }}>
          <textarea
            value={text}
            onChange={(e) => {
              const nextText = e.target.value
              setText(nextText)
              scheduleSave(nextText, color)
            }}
            placeholder="Write something..."
            className="widget-note-editor"
          />
        </div>
      </div>
    </DesktopWindow>
  )
}