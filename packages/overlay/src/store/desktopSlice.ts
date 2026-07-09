import { DEFAULT_DESKTOP_NOTIFICATION_MAX_VISIBLE } from '@ieomlabs/shared'
import type { DesktopNotificationPayload, DesktopRuntimeStatePayload } from '@ieomlabs/shared'
import { readRecycleBinState } from '../desktop/presentationState'

const WINDOW_CLOSE_MS = 180
const widgetCloseTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearWidgetCloseTimer(id: string) {
  const t = widgetCloseTimers.get(id)
  if (t) { clearTimeout(t); widgetCloseTimers.delete(id) }
}

function clearAllWidgetCloseTimers() {
  for (const t of widgetCloseTimers.values()) clearTimeout(t)
  widgetCloseTimers.clear()
}

export interface DesktopNotificationItem extends DesktopNotificationPayload {
  id: string
  createdAt: number
}

export interface DesktopSlice {
  openWidgets: Set<string>
  minimizedWidgets: Set<string>
  closingWidgets: Set<string>
  desktopNotifications: DesktopNotificationItem[]
  recycleBinFull: boolean

  openWidget: (id: string) => void
  closeWidget: (id: string) => void
  toggleWidget: (id: string) => void
  minimizeWidget: (id: string) => void
  restoreWidget: (id: string) => void
  toggleWidgetMinimized: (id: string) => void
  enqueueDesktopNotification: (payload: DesktopNotificationPayload, maxVisible?: number) => void
  dismissDesktopNotification: (id: string) => void
  setRecycleBinFull: (full: boolean) => void
  syncDesktopRuntimeState: (payload: DesktopRuntimeStatePayload) => void
}

export const createDesktopSlice = (set: (fn: (state: any) => Partial<any>) => void, get: () => any): DesktopSlice => ({
  openWidgets: new Set(),
  minimizedWidgets: new Set(),
  closingWidgets: new Set(),
  desktopNotifications: [],
  recycleBinFull: false,

  openWidget: (id) => {
    clearWidgetCloseTimer(id)
    set((s) => {
      const openWidgets = new Set(s.openWidgets)
      const minimizedWidgets = new Set(s.minimizedWidgets)
      const closingWidgets = new Set(s.closingWidgets)
      openWidgets.add(id); minimizedWidgets.delete(id); closingWidgets.delete(id)
      return { openWidgets, minimizedWidgets, closingWidgets }
    })
  },

  closeWidget: (id) => {
    const s = get()
    if (s.openWidgets.has(id) && !s.closingWidgets.has(id)) { s.toggleWidget(id); return }
    clearWidgetCloseTimer(id)
    set((s) => {
      const openWidgets = new Set(s.openWidgets)
      const minimizedWidgets = new Set(s.minimizedWidgets)
      const closingWidgets = new Set(s.closingWidgets)
      openWidgets.delete(id); minimizedWidgets.delete(id); closingWidgets.delete(id)
      return { openWidgets, minimizedWidgets, closingWidgets }
    })
  },

  toggleWidget: (id) => {
    const s = get()
    if (s.openWidgets.has(id) && !s.closingWidgets.has(id)) {
      clearWidgetCloseTimer(id)
      set((s) => {
        const closingWidgets = new Set(s.closingWidgets)
        const minimizedWidgets = new Set(s.minimizedWidgets)
        closingWidgets.add(id); minimizedWidgets.delete(id)
        return { closingWidgets, minimizedWidgets }
      })
      const timer = setTimeout(() => {
        set((s) => {
          const openWidgets = new Set(s.openWidgets)
          const minimizedWidgets = new Set(s.minimizedWidgets)
          const closingWidgets = new Set(s.closingWidgets)
          openWidgets.delete(id); minimizedWidgets.delete(id); closingWidgets.delete(id)
          return { openWidgets, minimizedWidgets, closingWidgets }
        })
        widgetCloseTimers.delete(id)
      }, WINDOW_CLOSE_MS)
      widgetCloseTimers.set(id, timer)
      return
    }
    get().openWidget(id)
  },

  minimizeWidget: (id) => set((s) => {
    const minimizedWidgets = new Set(s.minimizedWidgets)
    minimizedWidgets.add(id)
    return { minimizedWidgets }
  }),

  restoreWidget: (id) => set((s) => {
    const minimizedWidgets = new Set(s.minimizedWidgets)
    minimizedWidgets.delete(id)
    return { minimizedWidgets }
  }),

  toggleWidgetMinimized: (id) => {
    const s = get()
    if (!s.openWidgets.has(id)) { s.openWidget(id); return }
    if (s.minimizedWidgets.has(id)) s.restoreWidget(id)
    else s.minimizeWidget(id)
  },

  enqueueDesktopNotification: (payload, maxVisible = DEFAULT_DESKTOP_NOTIFICATION_MAX_VISIBLE) => set((s) => {
    const item: DesktopNotificationItem = {
      ...payload,
      id: `desktop-note-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      createdAt: Date.now(),
    }
    return { desktopNotifications: [item, ...s.desktopNotifications].slice(0, maxVisible) }
  }),

  dismissDesktopNotification: (id) => set((s) => ({
    desktopNotifications: s.desktopNotifications.filter((n: DesktopNotificationItem) => n.id !== id),
  })),

  setRecycleBinFull: (full) => set(() => ({ recycleBinFull: full })),

  syncDesktopRuntimeState: (payload) => {
    clearAllWidgetCloseTimers()
    const bin = readRecycleBinState(payload.presentation)
    set((s) => ({
      openWidgets: new Set(payload.openWidgetIds),
      minimizedWidgets: new Set<string>(),
      closingWidgets: new Set<string>(),
      // Kernel has no recycle-bin fact yet (fresh boot) → keep the local value.
      recycleBinFull: bin ? bin.full : s.recycleBinFull,
    }))
  },
})
