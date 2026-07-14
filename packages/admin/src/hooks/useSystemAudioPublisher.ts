import { AUDIO_REACTIVITY_WIDGET_ID } from '@ieomlabs/shared'
import { useScreenSharePublisher, type ScreenSharePublisherState } from './useScreenSharePublisher'

/**
 * Publishes system/tab audio (via getDisplayMedia, audio-only in intent —
 * the browser still captures a video track, which the overlay side simply
 * discards) for audio-reactivity purposes: beat/energy/silence detection.
 *
 * Reuses the exact same admin→server→overlay screen-share relay that
 * screen-share widgets use (screenSharePublisherRegistry, screen-share:*
 * socket events) under a reserved widgetId, so this is literally the same
 * capture/relay mechanism — just always-on and tied to the Audio Reactivity
 * toggle instead of a specific widget's lifecycle.
 *
 * getDisplayMedia() requires a real user gesture, which only exists in the
 * admin app — the overlay is a passive OBS render target with no one to
 * click anything, so it can never capture this itself.
 */
export function useSystemAudioPublisher(): ScreenSharePublisherState {
  return useScreenSharePublisher(AUDIO_REACTIVITY_WIDGET_ID, true)
}
