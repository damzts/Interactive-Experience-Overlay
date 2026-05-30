# Implementation Plan: Electron Desktop App

## Overview

Convert IEOM from a SaaS multi-tenant web application into a self-contained Electron desktop application. The implementation creates a new `@ieom/desktop` package providing the Electron shell, modifies `@ieom/server` to support a desktop entry mode (no auth, SQLite, localhost-only), and updates `@ieom/admin` for desktop-aware IPC communication. Tasks are ordered to establish the foundation first (package structure, server dual-mode), then layer in desktop-specific features (tray, deep link, license, rooms, auto-update), and finally wire everything together with packaging.

## Tasks

- [x] 1. Set up @ieom/desktop package structure and Electron entry point
  - [x] 1.1 Create the `packages/desktop/` directory structure with `src/main/`, `src/preload/`, `package.json`, `tsconfig.json`, and `electron-builder.yml`
    - Initialize package.json with name `@ieom/desktop`, Electron and electron-builder dependencies
    - Configure tsconfig.json targeting ES2022 with Node module resolution
    - Create electron-builder.yml with Windows (nsis), macOS (dmg), and Linux (AppImage) targets
    - _Requirements: 11.1_

  - [x] 1.2 Implement the Electron main process entry point (`src/main/index.ts`)
    - Initialize Electron app with single-instance lock (second instance focuses existing window)
    - Register `ieom://` protocol handler via `app.setAsDefaultProtocolClient`
    - Orchestrate startup sequence: server → admin window → license validation
    - Handle `app.on('ready')`, `app.on('window-all-closed')`, `app.on('activate')`
    - Prevent app quit on window close (minimize to tray instead)
    - _Requirements: 1.1, 1.4, 14.5, 5.1, 11.4, 11.5, 11.6_

  - [x] 1.3 Implement the preload script (`src/preload/index.ts`) with context bridge
    - Expose IPC channels: `license:get-tier`, `license:tier-changed`, `auth:login`, `auth:logout`, `auth:status`, `server:status`, `app:get-version`, `update:available`, `update:install`
    - Use `contextBridge.exposeInMainWorld` to create a typed `window.ieom` API
    - _Requirements: 8.1_

- [x] 2. Implement desktop server entry in @ieom/server
  - [x] 2.1 Create `packages/server/src/desktop-entry.ts` with `createDesktopServer()` factory
    - Accept `DesktopServerOptions` (dbPath, port, assetsDir, overlayDir, adminDir)
    - Create Fastify instance bound to `127.0.0.1` only
    - Register static file serving: overlay at `/`, admin at `/admin`
    - Register all existing routes WITHOUT auth middleware
    - Configure Socket.IO WITHOUT auth handshake
    - Return `{ app, io, start(), stop(), getPort() }` interface
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 4.1, 4.2, 4.3, 4.5, 4.6_

  - [x] 2.2 Implement SQLite database initialization in desktop mode
    - Use better-sqlite3 with WAL mode enabled
    - Store database file in the Electron `app.getPath('userData')` directory
    - Run migrations on startup; roll back and throw on failure
    - Seed default configuration for newly created databases
    - Remove all user_id scoping from queries in desktop mode
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 2.3 Remove multi-tenant auth dependencies from desktop server path
    - Ensure no PostgreSQL connection pool is created in desktop mode
    - Ensure no tenant-scoped repositories are instantiated
    - Ensure no CSRF middleware is registered
    - Verify all routes respond without authorization headers
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x]* 2.4 Write property test: No Authentication in Desktop Mode (Property 2)
    - **Property 2: No Authentication in Desktop Mode**
    - For any HTTP route and any Socket.IO namespace, requests without auth SHALL be accepted
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [x]* 2.5 Write property test: Localhost-Only Binding (Property 1)
    - **Property 1: Localhost-Only Binding**
    - For any connection from a non-localhost IP, the server SHALL reject the connection
    - **Validates: Requirements 2.5**

- [x] 3. Implement server lifecycle management in Electron main process
  - [x] 3.1 Create `src/main/server.ts` — embedded server lifecycle manager
    - Import `createDesktopServer` from `@ieom/server/desktop-entry`
    - Implement `startServer()` with 15-second timeout; show native error dialog on failure
    - Implement `stopServer()` with 10-second timeout; force-terminate if exceeded
    - Implement `restartServer()` that stops then starts, showing notification on success
    - Handle port-in-use errors with specific dialog messaging
    - Handle fatal errors (unhandled exceptions, DB corruption) with native dialog
    - _Requirements: 1.1, 1.2, 1.5, 1.7, 2.1, 2.4, 2.6, 3.6, 3.7_

- [x] 4. Checkpoint - Core server integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Admin Window management
  - [x] 5.1 Create `src/main/window.ts` — Admin BrowserWindow manager
    - Create BrowserWindow with minimum size 1024x768
    - Load admin UI from `http://localhost:3000/admin`
    - Hide default Electron menu bar
    - Inject server base URL via preload
    - Persist window bounds (x, y, width, height, isMaximized) to SQLite `window_state` table
    - Restore window bounds on launch; reset to center of primary display if out-of-bounds
    - Handle close event: hide window instead of destroying (minimize to tray)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 1.4_

  - [x]* 5.2 Write property test: Window Bounds Persistence Round-Trip (Property 9)
    - **Property 9: Window Bounds Persistence Round-Trip**
    - For any valid bounds (width ≥ 1024, height ≥ 768), persist and load SHALL return identical values
    - **Validates: Requirements 13.3**

  - [x]* 5.3 Write property test: Out-of-Bounds Window Position Reset (Property 10)
    - **Property 10: Out-of-Bounds Window Position Reset**
    - For any stored position outside all display bounds, window SHALL reset to center of primary display
    - **Validates: Requirements 13.4**

- [x] 6. Implement System Tray integration
  - [x] 6.1 Create `src/main/tray.ts` — Tray icon and context menu
    - Create tray icon indicating server running/stopped state
    - Build context menu with "Show Window", "Restart Server", and "Quit" options
    - Handle tray click: show/focus Admin Window
    - Handle "Restart Server": call server lifecycle restart
    - Handle "Quit": shut down server, then `app.quit()`
    - Update tray icon/tooltip when server status changes
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 7. Implement Deep Link authentication
  - [x] 7.1 Create `src/main/deeplink.ts` — Protocol handler for `ieom://` URLs
    - Parse incoming deep link URLs matching `ieom://auth?token=<value>`
    - Validate token: non-empty, three dot-separated base64url parts (header.payload.signature)
    - On valid token: store via token-storage, replace existing token if present
    - On invalid token: display native error notification "Authentication failed"
    - Handle `open-url` event (macOS) and `second-instance` event (Windows/Linux) for deep links
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8_

  - [x]* 7.2 Write property test: Deep Link Token Extraction and JWT Validation (Property 3)
    - **Property 3: Deep Link Token Extraction and JWT Validation**
    - For any deep link with valid three-part JWT, token SHALL be accepted; for invalid/missing tokens, SHALL be rejected
    - **Validates: Requirements 5.4, 5.5, 5.6**

- [x] 8. Implement Secure Token Storage
  - [x] 8.1 Create `src/main/token-storage.ts` — Encrypted token persistence
    - Encrypt token using `safeStorage.encryptString()` before writing to disk
    - Store encrypted token at `{userData}/auth-token.enc` with creation timestamp
    - Implement `loadToken()`: read and decrypt on startup; delete file and notify on failure
    - Implement `saveToken(jwt)`: encrypt and write
    - Implement `clearToken()`: delete token file
    - Fallback chain: safeStorage → OS keychain → plaintext with warning
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 5.7_

  - [x]* 8.2 Write property test: Token Storage Round-Trip (Property 4)
    - **Property 4: Token Storage Round-Trip**
    - For any valid JWT string, encrypt then decrypt SHALL produce the original string unchanged
    - **Validates: Requirements 6.1, 6.3**

- [x] 9. Implement License Validation service
  - [x] 9.1 Create `src/main/license.ts` — License validation and caching
    - On startup (if token exists): call `GET /api/license/me` on Remote Web App with 10s timeout
    - On 200 response: cache tier + timestamp to SQLite `license_cache` table
    - On 401 response: clear stored token, notify user to re-authenticate
    - On non-401 error or timeout: apply grace period rules (7-day window from last validation)
    - If grace period expired: downgrade to free tier
    - Re-validate every 24 hours while app is running
    - Expose `getLicenseTier()` and emit `license:tier-changed` IPC event on changes
    - Detect connectivity restoration and re-validate within 30 seconds
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 12.4, 12.5_

  - [x]* 9.2 Write property test: Grace Period Tier Resolution (Property 5)
    - **Property 5: Grace Period Tier Resolution**
    - For any last-validated timestamp: ≤7 days elapsed → cached tier; >7 days → free
    - **Validates: Requirements 7.4, 7.6, 7.7**

- [x] 10. Implement Feature Gating
  - [x] 10.1 Create `src/main/ipc-handlers.ts` — IPC channel handlers for feature gating
    - Handle `license:get-tier` request from renderer
    - Broadcast `license:tier-changed` to all renderer windows on tier change
    - Implement feature gate map: `stream-rooms` → pro+rooms, `advanced-ambiance-presets` → pro, `priority-support` → pro
    - Handle `auth:login` (open system browser to OAuth page) and `auth:logout` (clear token + cached tier)
    - Handle `server:status` broadcasts and `app:get-version` requests
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 5.2, 5.7_

  - [x]* 10.2 Write property test: Feature Gating by License Tier (Property 6)
    - **Property 6: Feature Gating by License Tier**
    - For any feature and tier, feature enabled iff tier ≥ required tier (free < pro < pro+rooms)
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.6**

- [x] 11. Checkpoint - Auth, license, and feature gating
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement Stream Rooms integration
  - [x] 12.1 Create `src/main/room-service.ts` — WebRTC room client
    - Connect to Remote Web App signaling WebSocket with stored auth token
    - Negotiate WebRTC peer connections with room participants (max 8 concurrent)
    - Relay incoming video/audio streams to Overlay Server for rendering
    - Implement exponential backoff reconnection on signaling disconnect (1s start, 30s cap)
    - Handle peer connection timeout (15s): abandon peer, notify admin, continue with others
    - Handle 401 on join: abort and notify user to re-authenticate
    - Handle leave: close all peer connections and disconnect signaling
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x]* 12.2 Write property test: Maximum Peer Connection Limit (Property 7)
    - **Property 7: Maximum Peer Connection Limit**
    - For any number of participants, Room Service SHALL never exceed 8 concurrent peer connections
    - **Validates: Requirements 9.2**

  - [x]* 12.3 Write property test: Exponential Backoff with Cap (Property 8)
    - **Property 8: Exponential Backoff with Cap**
    - For N consecutive failures, delay = min(2^(N-1) × 1000, 30000) ms
    - **Validates: Requirements 9.4**

- [x] 13. Implement Auto-Update system
  - [x] 13.1 Create `src/main/auto-updater.ts` — electron-updater integration
    - Check for updates on app start
    - Download updates in background without interrupting user
    - Notify user via native OS notification when update is ready
    - On user acceptance: install update and restart app
    - Retry failed downloads up to 3 times at 5-minute intervals
    - Verify code signatures before installation; discard and notify on failure
    - If user dismisses notification: re-check on next app start
    - Emit `update:available` IPC event to renderer
    - Handle `update:install` IPC from renderer
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

- [x] 14. Implement Startup Behavior configuration
  - [x] 14.1 Implement launch-at-startup and startup mode logic
    - Use Electron `app.setLoginItemSettings()` to register/unregister auto-start
    - Store preference in SQLite `app_settings` table
    - When started via auto-launch: start minimized to tray (no Admin Window shown)
    - When started via user action: show Admin Window immediately
    - Detect launch mode via `app.getLoginItemSettings().wasOpenedAtLogin` or launch args
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [x] 15. Update @ieom/admin for desktop context
  - [x] 15.1 Create `useDesktopBridge()` hook and desktop-aware AuthContext
    - Create hook wrapping `window.ieom` IPC API with typed methods
    - Replace cookie-based AuthContext with IPC-based variant for desktop mode
    - Detect desktop mode via presence of `window.ieom`
    - _Requirements: 4.5, 8.1, 5.2_

  - [x] 15.2 Implement feature gating UI components in admin
    - Read license tier from `useDesktopBridge()` hook
    - Disable premium features visually when tier is insufficient
    - Show upgrade-required messaging with tier indication
    - Show `<ConnectionStatus>` indicator in header for offline state
    - _Requirements: 8.2, 8.3, 8.4, 8.6, 12.3_

  - [x] 15.3 Add desktop settings panel (launch-at-startup toggle, auto-update toggle)
    - Add settings UI for launch-at-startup preference
    - Add settings UI for auto-update preference
    - Wire settings to IPC calls that update `app_settings` table
    - _Requirements: 14.1, 14.2_

- [x] 16. Checkpoint - Full feature integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Implement packaging and distribution configuration
  - [x] 17.1 Configure electron-builder for multi-platform builds
    - Configure Windows target: NSIS installer (.exe), code signing, protocol registration via registry
    - Configure macOS target: DMG, code signing, protocol registration via Info.plist CFBundleURLTypes
    - Configure Linux target: AppImage, protocol registration via .desktop file MimeType
    - Include pre-built native dependencies (better-sqlite3) for each platform
    - Configure auto-update publish settings pointing to Remote Web App update server
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 18. Wire offline operation and connectivity detection
  - [x] 18.1 Implement connectivity monitoring and offline behavior
    - Monitor network status changes via Electron `net` module or `navigator.onLine`
    - Ensure all local features (scenes, events, OBS bridge, ambiance) work without internet
    - Show persistent offline status indicator in Admin Window header
    - On connectivity restored: trigger license re-validation within 30 seconds
    - Retry re-validation up to 3 times at 60-second intervals on failure
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 19. Final checkpoint - Complete integration and packaging
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout; all implementation tasks use TypeScript
- Properties 1 and 2 are integration-test-oriented but included as property tests for completeness
- The `@ieom/server` package retains its existing web mode; desktop-entry.ts is an additive change

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5", "3.1"] },
    { "id": 4, "tasks": ["5.1", "6.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "7.1", "8.1"] },
    { "id": 6, "tasks": ["7.2", "8.2", "9.1"] },
    { "id": 7, "tasks": ["9.2", "10.1"] },
    { "id": 8, "tasks": ["10.2", "12.1", "13.1", "14.1"] },
    { "id": 9, "tasks": ["12.2", "12.3", "15.1"] },
    { "id": 10, "tasks": ["15.2", "15.3", "17.1", "18.1"] }
  ]
}
```
