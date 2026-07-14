/**
 * Grants the admin renderer's existing getDisplayMedia() calls full-desktop
 * video + system-audio loopback automatically, with no native module and no
 * change to the renderer/admin package at all.
 *
 * WHY THIS EXISTS
 * Chrome's screen-share audio picker is unusable for "reactivity should
 * follow my PC's system audio": Chrome can only capture audio when the
 * operator picks a specific browser Tab (not a Window, and "Entire Screen"
 * only works for audio on Windows/ChromeOS, never on macOS). Electron lets
 * the main process intercept getDisplayMedia() and answer it directly,
 * bypassing the picker and Chrome's per-source audio restrictions entirely —
 * see https://www.electronjs.org/docs/latest/api/desktop-capturer.
 *
 * The admin renderer (ScreenConfigSection / screenSharePublisherRegistry)
 * is untouched: it still calls navigator.mediaDevices.getDisplayMedia({video,
 * audio}) exactly as before. Inside the Electron shell, this handler answers
 * that call with the primary screen (no OS picker shown) and honors the
 * renderer's audio request — request.audioRequested reflects the "Capture
 * audio" checkbox's audio: boolean constraint, so audio is only captured
 * when the operator actually asked for it. Outside Electron (plain browser
 * dev/testing), the normal Chrome picker still applies since this handler
 * never runs.
 *
 * PLATFORM CAVEATS (do not remove — these are real, load-bearing constraints)
 * - macOS 12 and earlier: audio loopback capture is impossible. Apple only
 *   exposes a kernel-extension-free desktop audio API from macOS 13 onward.
 *   Video-only capture still works; audio will silently be absent.
 * - macOS 14.2+ (Sonoma and later): requires the NSAudioCaptureUsageDescription
 *   Info.plist key (added via electron-builder.yml's mac.extendInfo) or the
 *   audio track is created but stays silent, with NO error surfaced by
 *   Chromium — see the desktopCapturer docs' warning about "dead" streams.
 * - Windows / Linux (PipeWire): works without extra entitlements.
 */

import { session, desktopCapturer } from 'electron';

let registered = false;

/**
 * Register the desktop-capture handler on the default session. Safe to call
 * once at startup, before any BrowserWindow that will call getDisplayMedia()
 * is created (must run before window creation per Electron's docs).
 */
export function registerDesktopAudioCapture(): void {
  if (registered) return;
  registered = true;

  session.defaultSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen'] })
        .then((sources) => {
          const primary = sources[0];
          if (!primary) {
            // No screen source available — deny the request rather than hang.
            callback({});
            return;
          }
          // Respect the renderer's actual constraints (ScreenConfigSection's
          // "Capture audio" checkbox controls audioRequested via the audio:
          // boolean passed to getDisplayMedia) rather than forcing audio on
          // for every capture.
          callback({
            video: primary,
            audio: request.audioRequested ? 'loopback' : undefined,
          });
        })
        .catch(() => callback({}));
    },
    // Prefer the OS-native picker where Electron/Chromium support one
    // (currently experimental per Electron's docs); falls back to the
    // handler above transparently when unsupported.
    { useSystemPicker: false },
  );
}
