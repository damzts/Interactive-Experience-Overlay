# Implementation Plan: Multi-Camera POV Switching

## Overview

This plan implements the multi-camera POV switching system that enables 3-10 player OBS instances to connect to the IEOM server, with automatic switching based on audio activity levels and manual override support. The implementation follows the existing project patterns (Fastify routes, Socket.IO events, better-sqlite3 persistence, obs-websocket-js connections) and builds incrementally from shared types through server modules to the admin panel UI.

## Tasks

- [x] 1. Set up shared types and database schema
  - [x] 1.1 Define POV domain types and interfaces in shared package
    - Create `packages/shared/src/domain/pov.ts` with `CameraFeed`, `POVSwitchingConfig`, `POVRuntimeState`, `SwitchMode`, `TransitionConfig`, and `QueuedSwitch` interfaces
    - Create `packages/shared/src/contracts/pov-socket.ts` with typed Socket.IO event payloads: `POVStatusPayload`, `POVSwitchPayload`, `POVScoresPayload`, `POVFeedStatusPayload`, `POVErrorPayload`
    - Add server-to-client events (`pov:status`, `pov:switch`, `pov:scores`, `pov:feed:status`, `pov:error`) and client-to-server events (`pov:mode:set`, `pov:select`, `pov:config:update`) to the existing socket contract in `packages/shared/src/contracts/socket.ts`
    - Export all new types from `packages/shared/src/index.ts`
    - _Requirements: 1.1, 2.4, 3.6, 4.5, 5.4, 6.1, 7.1_

  - [x] 1.2 Create database migration for POV tables
    - Add `pov_config` single-row table (id, poll_interval_ms, rolling_window_ms, cooldown_ms, activity_threshold, silence_threshold, health_check_interval_ms, max_connections, transition_type, transition_duration_ms, score_emit_interval_ms, db_floor, db_ceiling) to `packages/server/src/db/migrations.ts`
    - Add `pov_feeds` table (id TEXT PK, label TEXT, obs_address TEXT, obs_password TEXT, scene_name TEXT, registered_at INTEGER)
    - Follow existing migration pattern in the project
    - _Requirements: 7.1, 7.2_

  - [x] 1.3 Create POV config repository
    - Create `packages/server/src/db/repositories/povConfigRepo.ts` with `getPovConfig()`, `upsertPovConfig(config)` functions
    - Implement `withPovConfigDefaults()` function that fills missing fields with defaults (pollIntervalMs: 100, rollingWindowMs: 2000, cooldownMs: 3000, activityThreshold: 0.15, silenceThreshold: 0.05, healthCheckIntervalMs: 10000, maxConnections: 10, transition: {type: 'cut', durationMs: 0}, scoreEmitIntervalMs: 500, dbFloor: -60, dbCeiling: 0)
    - Implement bounds validation that replaces out-of-bound values with defaults and logs warnings
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

  - [x] 1.4 Create POV feeds repository
    - Create `packages/server/src/db/repositories/povFeedsRepo.ts` with `getAllFeeds()`, `getFeedById(id)`, `insertFeed(feed)`, `deleteFeed(id)`, `updateFeed(id, partial)`, `getFeedByAddress(address)` functions
    - Use better-sqlite3 following existing repository patterns
    - _Requirements: 1.1, 1.3_

- [x] 2. Implement CameraRegistry and CameraConnectionManager
  - [x] 2.1 Implement CameraRegistry module
    - Create `packages/server/src/pov/registry.ts` implementing the `CameraRegistry` interface
    - Implement `register()` with UUID generation, label validation (max 32 chars), capacity check (3-10 feeds)
    - Implement `unregister()`, `updateStatus()`, `updateActivityScore()`, `getActiveFeed()`, `getAllFeeds()`, `getConnectedFeeds()`, `findByAddress()`
    - Reject registration when max connections reached, returning `{ error: 'capacity_reached' }`
    - _Requirements: 1.1, 1.4, 1.7_

  - [x]* 2.2 Write property tests for CameraRegistry
    - **Property 1: Registration produces valid feed entry**
    - **Property 2: Reconnection reuses existing registration**
    - **Property 3: Capacity enforcement**
    - **Validates: Requirements 1.1, 1.3, 1.4, 1.7**

  - [x] 2.3 Implement CameraConnectionManager module
    - Create `packages/server/src/pov/connections.ts` implementing the `CameraConnectionManager` interface
    - Use `obs-websocket-js` to manage independent WebSocket connections per feed
    - Implement exponential backoff retry logic: 15s → 30s → 60s → 120s → 300s (max 5 attempts)
    - Implement health check polling at configurable interval (default 10s) with 5s timeout
    - Mark feed as `unresponsive` on health check timeout, `unreachable` after retry exhaustion
    - Ensure connection failures are isolated — one feed failing does not affect others
    - Emit connection status changes via callback/event emitter
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 1.5, 1.6_

  - [x]* 2.4 Write property tests for CameraConnectionManager
    - **Property 4: Exponential backoff computation**
    - **Property 5: Connection state change emits correct event**
    - **Property 6: Connection failure isolation**
    - **Validates: Requirements 2.3, 2.4, 2.5, 2.6**

- [x] 3. Checkpoint - Ensure registry and connection modules compile and pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement AudioMonitor
  - [x] 4.1 Implement AudioMonitor module
    - Create `packages/server/src/pov/audio-monitor.ts` implementing the `AudioMonitor` interface
    - Implement polling loop that calls `GetInputVolumeMeter` on each connected OBS instance at configurable interval (default 100ms, min 50ms, max 1000ms)
    - Implement dB normalization: `clamp((dbValue - dbFloor) / (dbCeiling - dbFloor), 0, 1)`
    - Implement rolling average using circular buffer per feed over configurable window (default 2s, min 500ms, max 10000ms)
    - Track consecutive missed polls per feed; set Activity Score to 0 after 3 consecutive misses
    - On data resumption, compute score from new readings only (do not carry over zeros)
    - Emit aggregated scores to registered callbacks at configurable rate (default 500ms)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x]* 4.2 Write property tests for audio normalization
    - **Property 7: Audio level normalization**
    - **Validates: Requirements 3.3**

  - [x]* 4.3 Write property tests for Activity Score computation
    - **Property 8: Activity Score rolling average**
    - **Property 9: Missing data zeroing and recovery**
    - **Validates: Requirements 3.2, 3.4, 3.5**

- [x] 5. Implement POVSwitcher decision engine
  - [x] 5.1 Implement POVSwitcher module
    - Create `packages/server/src/pov/switcher.ts` implementing the `POVSwitcher` interface
    - Implement `evaluateScores()` with threshold comparison: switch only if candidate exceeds current by `activityThreshold`
    - Implement silence threshold: no switch when all scores below `silenceThreshold`
    - Implement cooldown enforcement: track `lastSwitchTimestamp`, reject switches within cooldown period
    - Implement initial selection (no active camera): pick highest score immediately without cooldown/threshold
    - Implement tie-breaking: retain current if tied, otherwise select least-recently-active
    - Implement `handleDisconnect()`: if active camera disconnects in auto mode, immediately select highest-scoring connected feed bypassing cooldown
    - Implement manual mode: `setMode('manual')` suspends auto evaluation; `manualSelect(feedId)` validates feed is connected
    - Implement manual feed disconnect fallback: switch to automatic mode and select highest-scoring feed
    - Emit switch events and mode change events via callbacks
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.5, 5.6_

  - [x]* 5.2 Write property tests for automatic switching logic
    - **Property 10: Automatic switching threshold decision**
    - **Property 11: Silence threshold prevents switching**
    - **Property 12: Switch cooldown enforcement**
    - **Property 13: Initial camera selection without constraints**
    - **Property 14: Tie-breaking preserves current or selects least-recently-active**
    - **Property 15: Disconnect triggers immediate fallback switch**
    - **Validates: Requirements 4.1, 4.2, 4.4, 4.6, 4.7, 4.8**

  - [x]* 5.3 Write property tests for manual mode logic
    - **Property 16: Manual mode suspends automatic switching**
    - **Property 17: Manual selection rejects unavailable feeds**
    - **Property 18: Manual feed disconnect triggers automatic fallback**
    - **Validates: Requirements 5.2, 5.5, 5.6**

- [x] 6. Implement TransitionQueue
  - [x] 6.1 Implement TransitionQueue module
    - Create `packages/server/src/pov/transition-queue.ts` implementing the `TransitionQueue` interface
    - Implement queue with max depth of 5; discard oldest when full
    - Execute transitions via output OBS `SetCurrentProgramScene` command with configured transition type and duration
    - Wait for transition completion event or 10s timeout before processing next item
    - Implement retry logic: retry once after 500ms on failure; skip and dequeue next on second failure; emit `pov:error` with `transition_failed` code
    - Discard queued requests referencing disconnected feeds
    - Support `cut` (0ms) and `fade` (100-60000ms) transition types
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x]* 6.2 Write property tests for TransitionQueue
    - **Property 22: Transition queue respects max depth**
    - **Property 23: Queued requests for disconnected feeds are discarded**
    - **Validates: Requirements 8.3, 8.5, 8.7**

- [x] 7. Checkpoint - Ensure all server-side POV modules compile and pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Wire server modules and expose REST/Socket APIs
  - [x] 8.1 Create POV orchestrator to wire all modules together
    - Create `packages/server/src/pov/index.ts` that instantiates and connects CameraRegistry, CameraConnectionManager, AudioMonitor, POVSwitcher, and TransitionQueue
    - Load persisted config from `povConfigRepo` on startup and apply to all modules
    - Load persisted feeds from `povFeedsRepo` on startup and initiate connections
    - Wire AudioMonitor score updates into POVSwitcher.evaluateScores()
    - Wire POVSwitcher switch decisions into TransitionQueue.enqueue()
    - Wire connection status changes into CameraRegistry.updateStatus() and Socket.IO broadcasts
    - _Requirements: 7.2, 2.1, 3.1, 4.1_

  - [x] 8.2 Create POV REST routes
    - Create `packages/server/src/routes/pov.ts` with Fastify route handlers
    - `GET /api/config/pov` — return current POV switching configuration
    - `PATCH /api/config/pov` — validate, persist, and apply updated config; emit `config:patch` event
    - `GET /api/pov/feeds` — list all registered camera feeds with current status
    - `POST /api/pov/feeds` — register a new camera feed (validate label ≤ 32 chars, initiate connection)
    - `DELETE /api/pov/feeds/:id` — unregister and disconnect a camera feed
    - `PATCH /api/pov/feeds/:id` — update feed metadata (label, scene mapping)
    - Register routes in the main Fastify app in `packages/server/src/index.ts`
    - _Requirements: 6.4, 6.5, 6.6, 7.3, 1.1_

  - [x] 8.3 Create POV Socket.IO event handlers
    - Create `packages/server/src/socket/povHandlers.ts` with Socket.IO event handlers
    - Handle `pov:mode:set` — call POVSwitcher.setMode(), emit `pov:status` to all clients
    - Handle `pov:select` — call POVSwitcher.manualSelect(), emit `pov:switch` on success or `pov:error` on failure
    - Handle `pov:config:update` — validate, persist, apply config changes
    - Emit `pov:status` to newly connected admin clients with current mode, active camera, and feed list
    - Broadcast `pov:scores` at configured interval
    - Broadcast `pov:feed:status` on connection state changes
    - Broadcast `pov:switch` on camera switches
    - Register handlers in `packages/server/src/socket/handlers.ts`
    - _Requirements: 2.4, 3.6, 4.5, 5.1, 5.4, 6.2_

- [x] 9. Implement Admin Panel Camera Dashboard
  - [x] 9.1 Create CameraDashboard panel component
    - Create `packages/admin/src/features/pov/CameraDashboard.tsx`
    - Display list of all registered camera feeds with connection status (connected/disconnected/unresponsive), player label, and numeric Activity Score (0-1)
    - Visually distinguish the Active Camera with a persistent highlight indicator
    - Show real-time activity score bars updated via `pov:scores` Socket.IO events (within 1s of receiving update)
    - Display empty state message when no camera feeds are registered
    - _Requirements: 6.1, 6.2, 6.3, 6.7_

  - [x] 9.2 Implement switching controls and manual override UI
    - Add mode toggle (automatic/manual) that emits `pov:mode:set` event
    - Add manual camera selection buttons for each connected feed that emit `pov:select` event
    - Show error toast when manual selection of unavailable feed is rejected
    - Display current mode indicator updated via `pov:status` events
    - _Requirements: 5.1, 5.2, 5.4, 6.3_

  - [x] 9.3 Implement configuration controls panel
    - Add controls to adjust Switch_Cooldown (1-30s range), activity threshold (0.01-1.0 range), silence threshold (0.0-1.0), polling interval, rolling window, and transition type/duration
    - Persist configuration via `PATCH /api/config/pov` endpoint
    - Display confirmation indicator on successful save
    - Display error indicator on save failure and retain form values
    - Apply changes within 2 seconds of submission
    - _Requirements: 6.4, 6.5, 6.6, 8.4_

  - [x] 9.4 Create POV API client functions
    - Create `packages/admin/src/api/povApi.ts` with functions: `getPovConfig()`, `updatePovConfig(config)`, `getFeeds()`, `registerFeed(feed)`, `deleteFeed(id)`, `updateFeed(id, data)`
    - Follow existing API client patterns in `packages/admin/src/api/`
    - _Requirements: 6.4, 6.5_

  - [x] 9.5 Integrate CameraDashboard into admin panel navigation
    - Add POV/Camera panel to the admin panel sidebar/navigation in `packages/admin/src/App.tsx`
    - Wire Socket.IO event listeners for `pov:status`, `pov:switch`, `pov:scores`, `pov:feed:status`, `pov:error`
    - _Requirements: 6.1_

- [x] 10. Checkpoint - Ensure full integration compiles and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Configuration persistence and validation
  - [x] 11.1 Integrate POV config into ConfigService
    - Extend `packages/server/src/services/ConfigService.ts` to load and serve POV config using `withPovConfigDefaults()`
    - Ensure config is loaded on server start and applied to POV modules
    - Emit `config:patch` event on config updates so admin clients receive new values
    - Validate bounds on all config fields; replace out-of-bound values with defaults and log warnings
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x]* 11.2 Write property tests for configuration persistence
    - **Property 19: Configuration persistence round-trip**
    - **Property 20: Default values applied for missing config fields**
    - **Property 21: Out-of-bound values replaced with defaults**
    - **Validates: Requirements 7.1, 7.4, 7.5**

- [x] 12. Add test infrastructure and remaining unit tests
  - [x] 12.1 Set up Vitest and fast-check in server package
    - Add `vitest` and `fast-check` to `@ieom/server` devDependencies
    - Create `vitest.config.ts` in `packages/server/`
    - Add `"test": "vitest --run"` script to `packages/server/package.json`
    - Create test directory structure: `packages/server/src/pov/__tests__/`
    - _Requirements: (testing infrastructure)_

  - [x]* 12.2 Write unit tests for edge cases
    - Test registration with exact 32-character label
    - Test registration with empty label (validation failure)
    - Test health check timeout marking feed as unresponsive
    - Test retry exhaustion marking feed as unreachable
    - Test manual selection of connected feed succeeds
    - Test mode change emits correct event
    - Test transition retry on first failure, skip on second
    - Test config save with out-of-bound values
    - _Requirements: 1.1, 1.5, 2.3, 2.6, 5.1, 5.4, 8.6, 7.5_

- [x] 13. Final checkpoint - Ensure all tests pass and feature is complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (23 properties total)
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout, with `fast-check` for property-based tests and `vitest` as the test runner
- All server modules follow the existing patterns: Fastify for HTTP, Socket.IO for real-time events, better-sqlite3 for persistence
- The admin panel follows existing React patterns with feature-based directory structure

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "12.1"] },
    { "id": 2, "tasks": ["2.1", "2.3"] },
    { "id": 3, "tasks": ["2.2", "2.4", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 6, "tasks": ["6.2", "8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3", "9.4"] },
    { "id": 8, "tasks": ["9.1", "9.2", "9.3", "11.1"] },
    { "id": 9, "tasks": ["9.5", "11.2", "12.2"] }
  ]
}
```
