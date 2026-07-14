import { useEffect, useRef, useState } from 'react'
import { AUDIO_REACTIVITY_WIDGET_ID } from '@ieomlabs/shared'
import { useRemoteScreenShare } from './useRemoteScreenShare'

export interface RemoteSystemAudioState {
  /** Audio-only — any video track from the relayed stream is stopped and dropped. */
  stream: MediaStream | null
  connecting: boolean
  error: string | null
}

/**
 * Subscribes to system/tab audio published by the admin app for
 * audio-reactivity (beat/energy/silence detection), relayed through the
 * exact same screen-share signaling as screen-share widgets — see
 * useRemoteScreenShare and packages/server/src/transport/webrtc/screen-share-relay.ts.
 *
 * getDisplayMedia() always includes a video track even when only audio is
 * wanted; this hook strips it immediately so nothing pointlessly decodes or
 * renders a video feed that no one asked for — only the audio track is kept
 * for AudioEngine.setReactiveStream().
 *
 * Pass enabled=false when audio reactivity isn't set to 'system' (or is
 * disabled outright) — skips subscribing/negotiating entirely.
 */
export function useRemoteSystemAudio(enabled = true): RemoteSystemAudioState {
  const { stream: rawStream, connecting, error } = useRemoteScreenShare(AUDIO_REACTIVITY_WIDGET_ID, enabled)
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)
  const lastRawStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (rawStream === lastRawStreamRef.current) return
    lastRawStreamRef.current = rawStream

    if (!rawStream) {
      setAudioStream(null)
      return
    }

    const audioTracks = rawStream.getAudioTracks()
    for (const track of rawStream.getVideoTracks()) {
      try { track.stop() } catch {}
    }
    setAudioStream(audioTracks.length > 0 ? new MediaStream(audioTracks) : null)
  }, [rawStream])

  return { stream: audioStream, connecting, error }
}
