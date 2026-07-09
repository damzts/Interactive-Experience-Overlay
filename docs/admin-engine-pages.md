# Admin — Right Pane Panels & Table Ownership

Each right-pane panel in the admin is responsible for exactly one DB table. A panel that saves to multiple tables indicates a schema design problem or mixed abstraction — fix the schema or split the panel.

---

## Panel → Table Map

| Panel | `SelectedItem.kind` | Component | DB Table | `AppConfig` key |
|---|---|---|---|---|
| Scene editor (Lobby / Desktop / user) | `env`, `scene` | `ScenePanel` | `scenes` | `scenes` |
| Widget / app editor | `app` | `AppForm` | `applications` | `applications` |
| Desktop Theme & Icons | `desktop-theme` | `DesktopThemeEditor` | `desktop_config` | `desktopConfig` |
| Widget Layouts | `widget-layout` | `WidgetLayoutPanel` | `widget_layouts` + `widget_layout_items` | `widgetLayouts` |
| Ambiance | `ambiance` | `AmbiancePanel` | `desktop_ambiance` | `desktopAmbiance` |
| Audio Engine | `audio` | `AudioPanel` | `audio_config` | `audio` |
| OBS | `obs` | `ObsPanel` | `obs_config` | `obs` |
| Input Engine (Keybinds) | `keybinds` | `KeybindEditor` | `keybinds` | `keybinds` |
| Settings | `settings` | `SettingsPage` | — (display only, no saves) | — |
| Asset Library: Catalog | `asset-catalog` | `AssetLibraryPanel` | `source_media` | `sourceMedia` |
| Asset Library: Events | `asset-events` | `AssetLibraryPanel` | `source_events` | `sourceEvents` |
| Asset Library: Sources | `asset-sources` | `AssetLibraryPanel` | `source_presets` | `sourcePresets` |
| Asset Library: Transitions | `asset-transitions` | `AssetLibraryPanel` | `source_transitions` | `sourceTransitions` |
| Scheduler | `scheduler` | `SchedulerPanel` | `source_events` (auto fields only) | `sourceEvents` |
| Ambience: Persona | (Ambience tab) | `PersonaPanel` | `desktop_persona` (JSON blob) | `persona` — trigger/cooldown, switchable `profiles` (voice + avatar art), `avatar`, `brain` (LLM), event lines; the Console section talks to the live kernel (`persona:console` / `persona:summarize`), not to config |

---

## Schema Table Inventory

All tables currently in the DB:

| Table | Owned by | Notes |
|---|---|---|
| `scenes` | `ScenePanel` | Includes `on_entry_json`, `on_exit_json` (named transition refs), `music_track`, `style_json` |
| `applications` | `AppForm` | Widget geometry (`window_x/y`, `window_width/height`, `z_index_default/current`) lives here |
| `desktop_config` | `DesktopThemeEditor` | OS presentation only: theme, icon config, screensaver, system sounds. No geometry. |
| `widget_layouts` + `widget_layout_items` | `WidgetLayoutPanel` | Named layout presets. Independent of `desktop_config`. |
| `automation_rules` | — (Automation panel → `/api/automation/rules`) | Unified any-signal → any-action rules. Each row: trigger (kernel event or widget signal) → action. |
| `desktop_ambiance` | `AmbiancePanel` | Widget simulation config |
| `desktop_persona` | `PersonaPanel` | Persona config JSON blob (single row id=1): trigger, profiles, avatar, brain. The Anthropic API key is NOT here — it's the `ANTHROPIC_API_KEY` env var. |
| `audio_config` | `AudioPanel` | Master/SFX/music volumes |
| `obs_config` | `ObsPanel` | WebSocket URL and password |
| `keybinds` | `KeybindEditor` | OBS and admin key→action mappings |
| `source_media` | Asset Library: Catalog | Named media assets (images, videos) |
| `source_events` | Asset Library: Events + Scheduler | Event definitions with effects, actions, auto-trigger config |
| `source_presets` | Asset Library: Sources | Reusable scene source plugin configs |
| `source_transitions` | Asset Library: Transitions | Named transition definitions (type + params) |
| `users` | Auth | Google OAuth accounts |
| `license_cache` | Desktop shell | License tier, validation timestamp |
| `window_state` | Desktop shell | Electron window position/size |
| `app_settings` | Desktop shell | Startup behavior |
| `schema_migrations` | DB infra | Migration version tracking |

---

## Why Scenes Reference Transitions by Name

Transition steps used to be inline JSON blobs on `scenes` and `applications`. They are now named assets in `source_transitions`, and scenes reference them as string arrays (`onEntry`, `onExit`).

**Benefits:**
- `ScenePanel` saves only to `scenes` — no cross-table write
- Transitions are reusable across scenes
- The Asset Library Transitions tab is the single place to create/edit/delete transitions
- Stale references (deleted transition name) silently fall back to default — no crash

---

## Why Widget Geometry Moved to `applications`

Position, size, and z-index used to live in `desktop_config` as nested JSON maps. They now live as columns directly on the `applications` row.

**Benefits:**
- `AppForm` saves only to `applications` — no cross-table write
- Widget geometry is colocated with the widget definition
- `DesktopThemePanel` saves only presentation config, never widget positions
- The DB record for a widget is self-contained

---

## `SettingsPage` — No Saves

`SettingsPage` is intentionally display-only:
- **Account** section — shows logged-in user, logout (auth only, no config save)
- **Server Info** — read-only URL display

OBS credentials are edited exclusively in `ObsPanel` (System → OBS).

---

## Data Flow

All panels follow the same pattern:

1. Read from `useAdminStore(s => s.config.<key>)`
2. Local form state tracks unsaved changes (dirty flag)
3. Save bar calls `saveConfig({ <key>: value })` with exactly one top-level key
4. `saveConfig` → `PATCH /api/config` → `DesktopConfigService.persistForUser` → writes one table → emits `config:patch` with just the changed section (full `config:update` is reserved for full non-patch saves)

**Single-key constraint:** `configApi.patchConfig` sends `{ <key>: value }`. The server's `writeSections` switches on the key and writes exactly the table it maps to. Multi-key payloads are only allowed for the atomic `POST /api/config/scenes` endpoint (creates both a `scenes` row and an `applications` row in one server-side transaction).

---

## Routing

All panels follow the same four-point checklist:

1. Add a `kind` to the `SelectedItem` union in `types.ts`
2. Add a `SidebarBtn` in the appropriate nav section
3. Add a case to `RightPaneContent` in `RightPane.tsx`
4. Add a header block to `RightPane`'s header switch
