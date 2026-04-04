# IEOM Architecture Recommendations

This file holds backlog and polish notes that were previously embedded in `architecture.md`.

## Things To Cut

The **EffectsLayer** file still exists as a reserved `null` render in `packages/overlay/src/layers/EffectsLayer.tsx`, but the runtime mounts `CSSEffectsLayer` instead. If there is no concrete plan to revive a separate post-processing layer, delete the unused file and any references to it so the architecture does not drift away from the real runtime.

## Things To Add

The **gallery-scroll screensaver** currently fades between full images every 4 seconds. A more interesting version would scroll inside each game's folder (multiple screenshots per game), display the game name more prominently, and support keyboard navigation to skip to the next game.

The **desktop icon layout system** now supports manual dragging with persistence, but there is still no first-class layout management UX around it. Add `Snap to grid`, `Reset icon positions`, and `Auto-arrange once` actions so operators can recover from messy layouts without manually editing every `Application.iconPosition` field.

The **boot sequence transition** (`boot-sequence`) is a standard named GSAP transition that any scene can include in its `introTransitions` pipeline. No built-in default scene has it configured out of the box. To play the boot sequence on startup, add `{ id: 'boot-sequence' }` as the first step in `DESKTOP.introTransitions` (or whichever scene loads first). This should be surfaced in the admin transition-picker help text so it is discoverable without reading source.

The **media file upload** currently supports video and image files via `POST /api/upload/asset`, which saves to `assets/video/` or `assets/images/`. There is no delete endpoint. Once a file is uploaded it can only be removed by manual filesystem access. Adding `DELETE /api/asset?path=...` (with path validation to prevent directory traversal) would let the admin's media library clean up unused files without touching the server manually.

The **lobby sky system** now uses a nearer 3D sky hall with editable top and horizon colors, including 8-digit hex authoring. If image, video, or pattern backgrounds are expected to appear directly in the lobby itself rather than only in the CSS background layer behind the canvas, the overlay needs a dedicated 3D hall material path for those media types instead of the current color/gradient tint bridge.

## Things To Polish

The **launchPipeline UI** allows adding effects by type and setting delay, but does not expose per-effect config fields (e.g. the message for `terminal-toast`, the color for `vignette-pulse`). Currently those require JSON editing. Expanding the effect editor with per-type config forms is the next step.

The **TransitionList pipeline preview** still only previews individual steps; clicking the preview button inside a `TransitionPicker` row sends `[{ id }]` as a one-step pipe. There is no button to fire the entire exit or intro pipeline as configured. A panel-level `Preview pipeline` button that calls `socket.emit('transition:preview', steps)` with the full array would let the streamer verify a multi-step chain before going live.

The new shared **hex color editor** now supports live picker updates and `#RRGGBBAA`, but the admin UI still does not explain the desktop-specific alpha semantics. Desktop chrome can use the authored text color directly, while desktop icon labels and text-style glyph icons intentionally use the opaque RGB portion so non-image icons do not disappear when alpha is `00`. That rule should be documented inline in the desktop Theme editor, and ideally split into separate controls if operators need independent icon-label color behavior.

The **desktop icon drag UX** works, but the desktop context menu still shows disabled placeholder actions and does not expose the new layout capabilities. `Arrange Icons`, `Snap to Grid`, and `Reset to Saved Defaults` should be real commands instead of dead menu items so the runtime feels like a complete OS surface rather than a partially interactive mock.

The **desktop icon text readability** path has become a stack of CSS overrides after several iterations around transparency, alpha-aware text colors, and selection styling. That logic should be centralized into a small set of desktop label tokens or helper classes so future theme/text-color changes do not keep regressing icon readability.

The **widget system** works but `WIDGET_COMPONENTS` in `Desktop.tsx` is a hardcoded map. Adding a new widget requires editing source code. A cleaner model would be a plugin-style registry like the effect system: each widget self-registers with an ID, a display name, and a component. New widgets could then be dropped in without touching `Desktop.tsx`.

The **GenericWidget fallback** shows a placeholder window for any unregistered widget ID. This is a useful safety net but is not a real feature. Any widget ID that reaches `GenericWidget` in production is a bug (missing registration). The fallback should log a warning so it is not silently swallowed.

The **ChatWidget** currently only displays seeded demo messages; it has no live data source. It should connect to a Twitch EventSub or IRC feed via the server, which would broadcast incoming chat messages as a socket event. The widget renders the message list; the server owns the connection.

The **MusicWidget** (used by both `music` and `spotify` IDs) shows a simulated elapsed timer and static track name. It does not track real playback. To make it useful it needs a data source: either the server polling the Spotify Web API and broadcasting current track info, or the overlay reading from a local file written by a Spotify integration tool.


## Further Reading
Current implementation notes:

- Desktop runtime sync is leader-aware and event-driven: ambiance cadence uses `actionId` plus completion ack, widget simulation uses deterministic `widget:simulate:action`, and reconnect snapshots include `startMenuState`.

- The admin styling system is centralized in `packages/admin/src/components/ui.tsx` and `admin.css`.

- OBS still does not passively expose arbitrary hotkey presses back to IEOM, so OBS-scoped bindings remain server-executed rather than passively observed.
- Lobby background rendering is still split by renderer: color/gradient backgrounds can tint the 3D hall, while image/video/pattern backgrounds remain CSS-backed behind the lobby canvas.