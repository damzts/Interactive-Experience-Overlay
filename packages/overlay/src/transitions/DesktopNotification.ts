import { DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS, type DesktopNotificationEffectConfig } from '@ieom/shared'
import { useAppStore } from '../store/useAppStore'

export function runDesktopNotification(cfg: DesktopNotificationEffectConfig) {
  const title = cfg.title?.trim() || 'Desktop notification'
  const body = cfg.body?.trim() || ''
  const icon = cfg.icon?.trim()

  useAppStore.getState().enqueueDesktopNotification({
    title,
    body,
    ...(icon ? { icon } : {}),
    durationMs: cfg.durationMs ?? DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS,
  })
}