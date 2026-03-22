import { useEffect, useRef, useState } from 'react'
import { DEFAULT_STICKY_NOTES_SETTINGS } from '@ieom/shared'
import { useAppStore } from '../store/useAppStore'
import { DesktopWindow } from './DesktopWindow'
import { patchApplicationConfig } from './configPersistence'

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
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: 10, background: color }}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {NOTE_COLORS.map((swatch) => (
          <button
            key={swatch}
            data-sim-action={`sticky-color-${swatch.replace('#', '')}`}
            onClick={() => {
              setColor(swatch)
              scheduleSave(text, swatch)
            }}
            title={swatch}
            style={{
              width: 18,
              height: 18,
              borderRadius: 2,
              border: swatch === color ? '2px solid #000080' : '1px solid #666',
              background: swatch,
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          const nextText = e.target.value
          setText(nextText)
          scheduleSave(nextText, color)
        }}
        placeholder="Write something..."
        style={{
          width: '100%',
          minHeight: 170,
          resize: 'none',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontFamily: 'Comic Sans MS, Chalkboard SE, cursive',
          fontSize: 17,
          lineHeight: 1.35,
          color: '#2a2208',
        }}
      />
    </DesktopWindow>
  )
}