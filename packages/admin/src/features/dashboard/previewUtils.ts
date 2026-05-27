import type { AppConfig } from '@ieom/shared'

export const CONFIG_PREVIEW_MESSAGE_TYPE = 'ieom:config-preview'

export function postPreviewConfigPatch(patch: Partial<AppConfig> | null) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const previewFrame = document.querySelector('iframe[title="Overlay Preview"]') as HTMLIFrameElement | null
  if (!previewFrame?.contentWindow) return

  previewFrame.contentWindow.postMessage(
    patch
      ? { type: CONFIG_PREVIEW_MESSAGE_TYPE, patch }
      : { type: CONFIG_PREVIEW_MESSAGE_TYPE, clear: true },
    '*',
  )
}
