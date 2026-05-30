# Implementation Plan: Browser POV Online

## Overview

This plan implements the Browser POV Online extension to the Multi-Camera POV Switching system. Remote players connect via web browser, share camera/microphone through WebRTC, and send client-side audio levels to the server via Socket.IO. The server reuses the existing POVSwitcher decision engine (separate instance per room) to determine the active speaker. The host captures the active feed in OBS using a Browser Source overlay. Implementation follows existing project patterns (Fastify routes, Socket.IO events, better-sqlite3 persistence, TypeScript throughout) and builds incrementally from shared types through server modules to frontend components.

## Tasks

- [x] 1. Define shared types and online Socket.IO contracts
  - [x] 1.1 Create online domain types in shared package
    - Create `packages/shared/src/domain/online.ts` with `OnlineModeConfig`, `ParticipantInfo`, `OnlineRoomStatus`, `SwitchReason` types
    - Include all config fields with their defaults and valid ranges as documented in the design
    - Export from `packages/shared/src/index.ts`
    - _Requirements: 11.1, 11.4, 11.5_

  - [x] 1.2 Create online Socket.IO event contracts in shared package
    - Create `packages/shared/src/contracts/online-socket.ts` with typed event payloads for the `/online` namespace
    - Define server-to-client events: `pov-online:room:created`, `pov-online:room:closed`, `pov-online:room:idle`, `pov-online:participant:joined`, `pov-online:participant:left`, `pov-online:scores`, `pov-online:switch`, `pov-online:status`
    - Define server-to-player events: `pov-online:joined`, `pov-online:join:error`, `pov-online:peer:joined`, `pov-online:peer:left`, `pov-online:room:closed`
    - Define server-to-overlay events: `pov-online:switch`, `pov-online:peer:joined`, `pov-online:peer:left`
    - Define client-to-server events: `pov-online:join`, `pov-online:audio-level`, `pov-online:signal`, `pov-online:room:create`, `pov-online:room:close`, `pov-online:mode:set`, `pov-online:select`, `pov-online:overlay:subscribe`
    - Include `SignalingMessage` interface (type, from, to, roomCode, payload)
    - Export from `packages/shared/src/index.ts`
    - _Requirements: 2.4, 3.3, 3.6, 4.1, 4.2, 4.7, 6.5, 7.3, 7.5, 8.2, 9.3_

- [x] 2. Set up database schema and configuration persistence for online mode
  - [x] 2.1 Create database migration for online_config table
    - Add `online_config` single-row table to `packages/server/src/db/migrations.ts` following existing migration pattern
    - Columns: id, audio_report_interval_ms, rolling_window_ms, cooldown_ms, activity_threshold, silence_threshold, max_players_per_room, max_active_rooms, score_emit_interval_ms, idle_timeout_ms, transition_type, transition_duration_ms
    - Apply defaults as specified in the design
    - _Requirements: 11.1_

  - [x] 2.2 Create online config repository
    - Create `packages/server/src/db/repositories/onlineConfigRepo.ts` with `getOnlineConfig()`, `upsertOnlineConfig(config)` functions
    - Implement `withOnlineConfigDefaults()` function that fills missing fields with defaults
    - Implement bounds validation that replaces out-of-bound values with defaults and logs warnings (audio report interval 50-500ms, rolling window 500-10000ms, cooldown 1000-30000ms, activity threshold 0.01-1.0, silence threshold 0.0-1.0, max players 2-20, max rooms 1-10)
    - Follow existing `povConfigRepo.ts` patterns
    - _Requirements: 11.1, 11.4, 11.5_

  - [x]* 2.3 Write property test for online config persistence round-trip
    - **Property 12: Online config persistence round-trip**
    - **Validates: Requirements 11.1**

  - [x]* 2.4 Write property test for online config validation
    - **Property 13: Online config validation**
    - **Validates: Requirements 11.4, 11.5**

- [x] 3. Implement AudioScoreProcessor
  - [x] 3.1 Implement AudioScoreProcessor module
    - Create `packages/server/src/online/audio-score-processor.ts` implementing the `AudioScoreProcessor` interface
    - Maintain a circular buffer of timestamped readings per participant
    - Compute Activity Score as arithmetic mean of readings within the rolling window
    - Track consecutive missed reports per participant; set score to 0 after 3 consecutive misses
    - On report resumption, compute score from new readings only (no carry-over of zeros)
    - Implement periodic score emission via callback at configurable rate (default 500ms)
    - Clamp incoming audio level values to [0, 1] before processing
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x]* 3.2 Write property test for rolling average activity score
    - **Property 9: Rolling average activity score**
    - **Validates: Requirements 6.1**

  - [x]* 3.3 Write property test for missing data zeroing and recovery
    - **Property 10: Missing data zeroing and recovery**
    - **Validates: Requirements 6.3, 6.4**

- [x] 4. Implement ParticipantRegistry and OnlineSessionManager
  - [x] 4.1 Implement ParticipantRegistry module
    - Create `packages/server/src/online/participant-registry.ts` implementing the `ParticipantRegistry` interface
    - Implement `getActiveFeed()`, `getConnectedFeeds()`, `updateActivityScore()` methods
    - Backed by the room's participant map, adapting participants to the feed interface expected by POVSwitcher
    - _Requirements: 12.2, 12.4_

  - [x] 4.2 Implement OnlineSessionManager module
    - Create `packages/server/src/online/session-manager.ts` implementing the `OnlineSessionManager` interface
    - Implement `createRoom()`: generate unique 6-char uppercase alphanumeric Room_Code, enforce max active rooms limit, initialize room with empty participant list and per-room POVSwitcher + AudioScoreProcessor + ParticipantRegistry instances
    - Implement `closeRoom()`: disconnect all participants, release resources, remove from active rooms map
    - Implement `joinRoom()`: validate room code, check capacity, assign UUID participant ID, add to participant list
    - Implement `leaveRoom()`: remove participant, start idle timer if room empty (60s default)
    - Implement `handleAudioReport()`: feed level into room's AudioScoreProcessor
    - Implement `manualSelect()` and `setMode()`: delegate to room's POVSwitcher instance
    - Implement `updateConfig()`: apply new config to all active rooms
    - Wire AudioScoreProcessor score updates into POVSwitcher.evaluateScores() per room
    - Rooms stored in `Map<string, OnlineRoom>` (ephemeral, in-memory only)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 3.4, 3.5, 3.6, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x]* 4.3 Write property test for room code validity and uniqueness
    - **Property 1: Room code validity and uniqueness**
    - **Validates: Requirements 1.1, 1.2**

  - [x]* 4.4 Write property test for room and player capacity enforcement
    - **Property 2: Room and player capacity enforcement**
    - **Validates: Requirements 1.3, 1.4, 1.5, 3.5**

  - [x]* 4.5 Write property test for participant count invariant
    - **Property 3: Participant count invariant**
    - **Validates: Requirements 2.4**

  - [x]* 4.6 Write property test for invalid room code rejection
    - **Property 4: Invalid room code rejection**
    - **Validates: Requirements 3.4**

  - [x]* 4.7 Write property test for participant ID uniqueness
    - **Property 5: Participant ID uniqueness**
    - **Validates: Requirements 3.6**

  - [x]* 4.8 Write property test for POVSwitcher instance isolation
    - **Property 14: POVSwitcher instance isolation**
    - **Validates: Requirements 12.2, 12.4**

- [x] 5. Checkpoint - Ensure core server modules compile and pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement SignalingServer
  - [x] 6.1 Implement SignalingServer module
    - Create `packages/server/src/online/signaling.ts` implementing the `SignalingServer` interface
    - Implement `relay()`: forward signaling messages (SDP offers, answers, ICE candidates) to target peer without inspecting or modifying payload
    - Implement `notifyNewPeer()`: emit peer-joined notification to all existing participants in the room
    - Implement `notifyPeerDisconnect()`: emit peer-left notification to all remaining participants
    - Validate that signaling messages come from authenticated participants in the room
    - Drop messages to unknown targets silently with a warning log
    - _Requirements: 4.1, 4.2, 4.3, 4.7_

  - [x]* 6.2 Write property test for signaling relay integrity
    - **Property 6: Signaling relay integrity**
    - **Validates: Requirements 4.2**

  - [x]* 6.3 Write property test for signaling notifications
    - **Property 7: Signaling notifications reach all relevant participants**
    - **Validates: Requirements 4.3, 4.7**

- [x] 7. Implement switch event emission and active speaker logic
  - [x] 7.1 Implement switch event emission in OnlineSessionManager
    - Wire POVSwitcher switch decisions to emit `pov-online:switch` events to admin, overlay, and players
    - Include previous participant ID (or null), new participant ID, timestamp, and reason (automatic/manual/fallback)
    - Handle active player disconnect: immediately select highest-scoring connected player bypassing cooldown
    - Handle initial selection: pick highest score immediately without cooldown/threshold when no active player is set
    - Handle silence: remain on current active player when all scores below silence threshold
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x]* 7.2 Write property test for switch event emission correctness
    - **Property 11: Switch event emission correctness**
    - **Validates: Requirements 7.3**

- [x] 8. Wire Socket.IO event handlers and REST endpoints
  - [x] 8.1 Create online Socket.IO namespace handler
    - Create `packages/server/src/socket/onlineHandlers.ts` with Socket.IO event handlers on the `/online` namespace
    - Handle `pov-online:join`: validate room code and display name, call OnlineSessionManager.joinRoom(), emit joined/error response
    - Handle `pov-online:audio-level`: call OnlineSessionManager.handleAudioReport()
    - Handle `pov-online:signal`: call SignalingServer.relay()
    - Handle `pov-online:room:create`: call OnlineSessionManager.createRoom(), emit room:created
    - Handle `pov-online:room:close`: call OnlineSessionManager.closeRoom(), emit room:closed
    - Handle `pov-online:mode:set`: call OnlineSessionManager.setMode()
    - Handle `pov-online:select`: call OnlineSessionManager.manualSelect()
    - Handle `pov-online:overlay:subscribe`: subscribe overlay socket to room switch events
    - Handle socket disconnect: call OnlineSessionManager.leaveRoom(), notify SignalingServer
    - Emit `pov-online:scores` at configured interval to admin clients
    - Emit `pov-online:status` updates on participant join/leave
    - Register namespace in `packages/server/src/socket/handlers.ts`
    - _Requirements: 2.4, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.7, 5.2, 5.4, 5.5, 6.1, 6.2, 6.5, 7.3, 7.5, 8.2, 9.3_

  - [x] 8.2 Create online REST routes
    - Create `packages/server/src/routes/online.ts` with Fastify route handlers
    - `GET /api/config/online` — return current online mode configuration from repository
    - `PATCH /api/config/online` — validate, persist, and apply updated config; emit config update event
    - `GET /api/online/rooms` — list all active online rooms with status
    - Register routes in `packages/server/src/index.ts`
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 8.3 Create online mode orchestrator
    - Create `packages/server/src/online/index.ts` that instantiates and connects OnlineSessionManager, SignalingServer, and ConfigService integration
    - Load persisted online config from `onlineConfigRepo` on startup and apply to OnlineSessionManager
    - Wire config update events to OnlineSessionManager.updateConfig()
    - Integrate with existing server startup in `packages/server/src/index.ts`
    - _Requirements: 11.2, 12.1, 12.2, 12.4, 12.5_

- [x] 9. Checkpoint - Ensure server-side online mode is fully wired and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Player Client (browser frontend)
  - [x] 10.1 Create Player Client audio level analyzer
    - Create `packages/overlay/src/online/player/audio-analyzer.ts`
    - Implement `AudioLevelAnalyzer` class using Web Audio API `AnalyserNode`
    - Implement `computeRmsLevel(frequencyData: Uint8Array): number` as a pure function: `sqrt(mean(((sample - 128) / 128)^2))` clamped to [0, 1]
    - Start periodic level reporting at configurable interval (default 100ms)
    - Send level 0 when microphone is muted or audio context is suspended
    - Display warning indicator when AnalyserNode is unavailable
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x]* 10.2 Write property test for RMS audio level computation
    - **Property 8: RMS audio level computation**
    - **Validates: Requirements 5.1, 5.3**

  - [x] 10.3 Create Player Client Socket.IO and WebRTC connection logic
    - Create `packages/overlay/src/online/player/connection.ts`
    - Establish Socket.IO connection to `/online` namespace
    - Emit `pov-online:join` with room code and display name, handle ack response
    - Create WebRTC peer connection on successful join, send SDP offer via `pov-online:signal`
    - Handle incoming signaling messages (SDP answers, ICE candidates)
    - Handle `pov-online:peer:joined` and `pov-online:peer:left` events for peer connection management
    - Implement connection timeout (15s) with one retry on failure
    - Constrain video to max 720p @ 30fps
    - Use Socket.IO built-in reconnection (max 5 attempts) on disconnect
    - Send periodic `pov-online:audio-level` events from AudioLevelAnalyzer
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.4, 4.5, 4.6, 5.2, 10.3, 10.4_

  - [x] 10.4 Create Player Client UI component
    - Create `packages/overlay/src/online/player/PlayerClient.tsx`
    - Display join interface: room code input (from URL), display name input (1-32 chars), join button
    - Request camera and microphone permissions on name submission
    - Display error messages for: room not found, room full, invalid name, permissions denied
    - Once connected: show camera preview, audio level meter, connection status (connected/connecting/disconnected)
    - Show room code and connected participant count
    - Provide mute/unmute microphone button (sends level 0 when muted)
    - Provide enable/disable camera button (stops video transmission, continues audio reports)
    - Show "Reconnecting" status during reconnection attempts, "Disconnected" with "Rejoin" button after 5 failed attempts
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 10.5 Create Player Client page route
    - Create `packages/overlay/src/online/player/index.html` or integrate into existing overlay routing
    - Serve Player Client SPA at `/online/room/:roomCode`
    - Extract room code from URL path and pass to PlayerClient component
    - _Requirements: 3.1_

- [x] 11. Implement Browser Source Overlay page
  - [x] 11.1 Create Browser Source Overlay component
    - Create `packages/overlay/src/online/overlay/BrowserSourceOverlay.tsx`
    - Establish Socket.IO connection to `/online` namespace, emit `pov-online:overlay:subscribe` with room code
    - Establish WebRTC peer connections with all players in the room to receive video streams
    - Display only the active player's video stream full-screen with no UI chrome
    - Handle `pov-online:switch` events: transition from previous to new active player (cut or fade)
    - Handle `pov-online:peer:joined`: establish new peer connection to receive stream
    - Handle `pov-online:peer:left`: clean up peer connection
    - Display black frame when active player's stream is unavailable or no players are connected
    - Render video at native resolution (up to 720p) scaled to fill viewport maintaining aspect ratio
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 11.2 Create Browser Source Overlay page route
    - Serve overlay page at `/online/overlay/:roomCode`
    - Extract room code from URL path and pass to BrowserSourceOverlay component
    - _Requirements: 8.1_

- [x] 12. Checkpoint - Ensure player client and overlay compile and integrate with server
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement Admin Panel Online Rooms section
  - [x] 13.1 Create online rooms API client
    - Create `packages/admin/src/api/onlineApi.ts` with functions: `getOnlineConfig()`, `updateOnlineConfig(config)`, `getOnlineRooms()`
    - Follow existing API client patterns in `packages/admin/src/api/`
    - _Requirements: 9.1, 9.2, 11.3_

  - [x] 13.2 Create OnlineRoomsPanel component
    - Create `packages/admin/src/features/pov/OnlineRoomsPanel.tsx`
    - Display list of active online rooms with room code, join URL (copyable), participant count, creation timestamp
    - Provide "Create Room" button that emits `pov-online:room:create` and displays generated room code + copyable join URL
    - Per-room expandable section showing participants with display name, connection status, activity score bar
    - Visually distinguish current Active Player with persistent highlight indicator
    - Display Browser Source URL for each room (copyable)
    - Provide mode toggle (automatic/manual) emitting `pov-online:mode:set`
    - Provide manual player selection buttons emitting `pov-online:select`
    - Provide config controls for Switch_Cooldown, activity threshold, silence threshold (reusing existing POV config UI patterns)
    - Provide "Close Room" button with confirmation prompt
    - Wire Socket.IO event listeners for `pov-online:room:created`, `pov-online:room:closed`, `pov-online:participant:joined`, `pov-online:participant:left`, `pov-online:scores`, `pov-online:switch`, `pov-online:status`
    - Update participant list within 1 second of join/leave events
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x] 13.3 Integrate OnlineRoomsPanel into admin panel
    - Add Online Rooms section to the admin panel POV area in `packages/admin/src/features/pov/` or `packages/admin/src/App.tsx`
    - Present as a separate section from LAN mode with its own controls and status indicators
    - Connect to `/online` Socket.IO namespace for real-time updates
    - _Requirements: 12.3_

- [x] 14. Integrate online config into ConfigService
  - [x] 14.1 Extend ConfigService for online mode
    - Extend `packages/server/src/services/ConfigService.ts` to load and serve online config using `withOnlineConfigDefaults()`
    - Load online config on server start and apply to OnlineSessionManager
    - Emit config update event on changes so admin clients receive updated values
    - Ensure LAN mode config and Online mode config are independent
    - _Requirements: 11.1, 11.2, 11.3, 12.1_

- [x] 15. Final checkpoint - Ensure all modules integrate, all tests pass, feature is complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (14 properties total)
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout, with `fast-check` for property-based tests and `vitest` as the test runner (both already devDependencies)
- All server modules follow existing patterns: Fastify for HTTP, Socket.IO for real-time events, better-sqlite3 for persistence
- Online mode uses a dedicated `/online` Socket.IO namespace to isolate from LAN mode events
- Online rooms are ephemeral (in-memory only) — not persisted to database
- The admin panel follows existing React patterns with feature-based directory structure
- WebRTC signaling is relay-only; no media passes through the server
- Each online room gets its own POVSwitcher instance (same class, separate state from LAN mode)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "4.5", "4.6", "4.7"] },
    { "id": 5, "tasks": ["4.8", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "7.1"] },
    { "id": 7, "tasks": ["7.2", "8.1", "8.2", "8.3"] },
    { "id": 8, "tasks": ["10.1", "13.1"] },
    { "id": 9, "tasks": ["10.2", "10.3", "11.1"] },
    { "id": 10, "tasks": ["10.4", "10.5", "11.2", "13.2"] },
    { "id": 11, "tasks": ["13.3", "14.1"] }
  ]
}
```
