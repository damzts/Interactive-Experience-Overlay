# Implementation Plan: PostgreSQL Multi-Tenant Auth

## Overview

Migrate the IEOM server from single-tenant SQLite (better-sqlite3) to multi-tenant PostgreSQL with Google OAuth 2.0 authentication. The implementation proceeds in layers: database pool and migrations, auth module, tenant-scoped repositories, multi-tenant ConfigService, public routes, and finally admin UI integration.

## Tasks

- [x] 1. Set up PostgreSQL infrastructure and environment validation
  - [x] 1.1 Install PostgreSQL dependencies and configure environment validation
    - Add `pg`, `@types/pg` to server package dependencies
    - Create `src/db/envValidation.ts` that validates required environment variables (PGHOST, PGDATABASE, PGUSER, PGPASSWORD, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET) on startup
    - Support optional `DATABASE_URL` as alternative to individual PG* variables
    - Log missing variables and call `process.exit(1)` if any required variable is absent
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 1.2 Create PostgreSQL connection pool module
    - Create `src/db/pool.ts` with `createPool()` function using `pg.Pool`
    - Configure pool from environment variables (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD) or DATABASE_URL
    - Set pool max connections to 20
    - Add graceful shutdown logic to close all connections on SIGTERM/SIGINT
    - Log and exit with non-zero code if initial connection fails
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.3 Create migration runner and initial schema migration
    - Create `src/db/migrationRunner.ts` with `MigrationRunner` class
    - Implement `schema_migrations` table creation on first run
    - Implement sequential migration application within transactions
    - Rollback and exit on migration failure with descriptive error
    - Create migration 001: `users` table with id (UUID), google_id (unique), email, display_name, avatar_url, slug (unique), refresh_token_hash, created_at, updated_at
    - Create migration 002: all tenant-scoped tables (scenes, applications, desktop_config, widget_layouts, events, keybinds, obs_config, audio_config, overlay_style, desktop_ambiance, source_presets, media_library, pov_config, pov_feeds, online_config) with user_id FK and composite PKs
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 8.1_

  - [x]* 1.4 Write property test for environment variable validation
    - **Property 11: Environment Variable Validation**
    - **Validates: Requirements 14.2**

- [x] 2. Checkpoint - Ensure database infrastructure compiles and migrations run
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement authentication module
  - [x] 3.1 Create JWT sign/verify utilities
    - Create `src/auth/jwt.ts` with `signAccessToken`, `verifyAccessToken`, `signRefreshToken`, `verifyRefreshToken` functions
    - Install `jsonwebtoken` and `@types/jsonwebtoken` dependencies
    - Read JWT_SECRET, JWT_EXPIRATION (default "24h"), REFRESH_TOKEN_EXPIRATION (default "30d") from environment
    - Define `JwtPayload` interface with sub (user_id), email, iat, exp
    - _Requirements: 5.1, 5.5_

  - [x]* 3.2 Write property test for JWT sign/verify round-trip
    - **Property 1: JWT Sign/Verify Round-Trip**
    - **Validates: Requirements 5.1**

  - [x] 3.3 Create Google OAuth module
    - Create `src/auth/googleOAuth.ts` with functions to build authorization URL, exchange code for tokens, and extract profile from ID token
    - Install `google-auth-library` dependency
    - Read GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI from environment
    - Request scopes: openid, email, profile
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [x] 3.4 Create UserRepository
    - Create `src/db/repositories/UserRepository.ts` with methods: findByGoogleId, findBySlug, findById, upsertFromGoogle, storeRefreshTokenHash, getRefreshTokenHash, invalidateRefreshToken
    - Implement slug generation (URL-safe, lowercase alphanumeric with hyphens)
    - Handle slug collision by appending random suffix and retrying
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x]* 3.5 Write property test for slug URL-safety and uniqueness
    - **Property 3: Slug URL-Safety and Uniqueness**
    - **Validates: Requirements 3.4**

  - [x]* 3.6 Write property test for user upsert idempotence
    - **Property 2: User Upsert Idempotence**
    - **Validates: Requirements 3.2, 3.3**

  - [x] 3.7 Create auth routes (login, callback, refresh, logout)
    - Create `src/auth/authRoutes.ts` as a Fastify plugin
    - `GET /auth/google` — redirect to Google authorization URL
    - `GET /auth/google/callback` — exchange code, upsert user, issue JWT + refresh token, redirect to admin
    - `POST /auth/refresh` — validate refresh token, issue new JWT + new refresh token, invalidate old
    - `POST /auth/logout` — invalidate refresh token in database
    - Handle OAuth failures by redirecting to login page with error parameter
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.6_

  - [x]* 3.8 Write property test for refresh token rotation
    - **Property 5: Refresh Token Rotation Invalidates Previous**
    - **Validates: Requirements 5.3, 5.4, 5.6**

  - [x] 3.9 Create HTTP auth middleware
    - Create `src/auth/authMiddleware.ts` as a Fastify `onRequest` hook
    - Validate JWT from Authorization header (Bearer scheme)
    - Attach `userId` to `request.userId` on success
    - Return 401 with `{ error: "unauthorized" }` for missing/invalid tokens
    - Return 401 with `{ error: "token_expired" }` for expired tokens
    - Apply to all routes under /api/config, /api/assets, /api/upload, /api/archive, /api/pov, /api/online (except room-joining)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x]* 3.10 Write property test for auth middleware token validation
    - **Property 4: Auth Middleware Token Validation**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

  - [x] 3.11 Create Socket.IO auth middleware
    - Create `src/auth/socketAuthMiddleware.ts` for the default namespace
    - Validate JWT from `socket.handshake.auth.token`
    - Attach userId to `socket.data.userId` on success
    - Reject connection with `{ message: "authentication_error" }` on failure
    - Allow unauthenticated connections to /overlay and /online namespaces
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 4. Checkpoint - Ensure auth module compiles and unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Migrate repositories to PostgreSQL with tenant scoping
  - [x] 5.1 Convert SceneRepository to async PostgreSQL with user_id scoping
    - Rewrite `src/db/repositories/SceneRepository.ts` to use Pool instead of better-sqlite3
    - Make all methods async, add `userId: string` as first parameter
    - Add `WHERE user_id = $N` to all SELECT/UPDATE/DELETE queries
    - Set `user_id` on all INSERT queries
    - Use parameterized queries for SQL injection prevention
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.2 Convert ApplicationRepository to async PostgreSQL with user_id scoping
    - Rewrite `src/db/repositories/ApplicationRepository.ts` following same pattern as SceneRepository
    - All methods async with userId parameter, parameterized queries
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.3 Convert DesktopRepository to async PostgreSQL with user_id scoping
    - Rewrite `src/db/repositories/DesktopRepository.ts` — single-row-per-user pattern (user_id as PK)
    - All methods async with userId parameter
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.4 Convert remaining repositories to async PostgreSQL with user_id scoping
    - Convert EventRepository, KeybindRepository, ObsConfigRepository, AudioConfigRepository, OverlayStyleRepository, AmbianceRepository, SourcePresetRepository, MediaRepository, povConfigRepo, povFeedsRepo, onlineConfigRepo
    - All methods async with userId parameter, parameterized queries with user_id scoping
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.5 Update repository index and create TenantRepositories type
    - Update `src/db/repositories/index.ts` to export all converted repositories
    - Create a `TenantRepositories` interface/type that bundles all tenant-scoped repositories
    - Factory function to instantiate all repositories from a Pool
    - _Requirements: 8.1_

  - [x]* 5.6 Write property test for tenant data isolation
    - **Property 6: Tenant Data Isolation**
    - **Validates: Requirements 8.2, 8.3, 8.4**

- [x] 6. Checkpoint - Ensure all repositories compile with new async signatures
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement multi-tenant ConfigService
  - [x] 7.1 Rewrite ConfigService for multi-tenant per-user caching
    - Rewrite `src/services/ConfigService.ts` with per-user cache Map
    - Implement `getForUser(userId)` — load from DB if not cached
    - Implement `persistForUser(userId, next, updates)` — persist and update cache
    - Implement `seedNewUser(userId)` — insert DEFAULT_CONFIG rows in a transaction, rollback on failure
    - Implement `evictIdle()` — remove entries idle longer than configurable timeout (default 30 min)
    - Start eviction interval timer on construction
    - Emit config:update and config:patch events only to sockets in the user's room
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 13.1, 13.2, 13.3_

  - [x]* 7.2 Write property test for ConfigService per-user cache isolation
    - **Property 7: ConfigService Per-User Cache Isolation**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

  - [x]* 7.3 Write property test for cache eviction by idle time
    - **Property 8: Cache Eviction by Idle Time**
    - **Validates: Requirements 9.5**

  - [x]* 7.4 Write property test for new user seeding atomicity
    - **Property 9: New User Seeding Atomicity and Completeness**
    - **Validates: Requirements 9.6, 13.1, 13.2**

- [x] 8. Implement public routes and slug resolution
  - [x] 8.1 Create public route resolver plugin
    - Create `src/routes/public.ts` as a Fastify plugin
    - Register routes: `GET /u/:slug/overlay`, `GET /u/:slug/player`
    - Resolve slug to userId via UserRepository.findBySlug
    - Return 404 `{ error: "user_not_found" }` for invalid slugs
    - Attach resolved userId to request for downstream handlers
    - Serve overlay/player static assets scoped to the resolved user
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x]* 8.2 Write property test for slug resolution correctness
    - **Property 10: Slug Resolution Correctness**
    - **Validates: Requirements 10.3, 10.4**

  - [x] 8.3 Update Socket.IO overlay namespace for user-scoped rooms
    - Modify overlay Socket.IO namespace to accept userId context from public route
    - Join sockets to user-specific rooms so config:update events are scoped
    - Allow unauthenticated connections to /overlay namespace
    - _Requirements: 10.5, 7.4_

  - [x] 8.4 Update online room system for multi-tenant ownership
    - Modify online room creation to require authentication and set user_id on room record
    - Allow unauthenticated participants to join rooms scoped to the owning user's data
    - _Requirements: 11.1, 11.2, 11.3_

  - [x]* 8.5 Write property test for room ownership association
    - **Property 12: Room Ownership Association**
    - **Validates: Requirements 11.2, 11.3**

- [x] 9. Checkpoint - Ensure public routes and socket scoping work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Wire everything together and update server entry point
  - [x] 10.1 Update server entry point to initialize PostgreSQL stack
    - Modify `src/index.ts` to: run env validation, create pool, run migrations, instantiate repositories, instantiate multi-tenant ConfigService, register auth routes, apply auth middleware to protected routes, register public routes
    - Remove better-sqlite3 initialization code
    - Add graceful shutdown for pool on process exit
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 14.1, 14.2_

  - [x] 10.2 Update all route handlers to use async repositories and userId
    - Update `src/routes/config.ts`, `src/routes/archive.ts`, `src/routes/media.ts`, `src/routes/pov.ts`, `src/routes/online.ts` to pass `request.userId` to ConfigService and repositories
    - Convert all handler functions to async where needed
    - _Requirements: 6.4, 8.2, 8.3, 9.1, 9.3_

  - [x] 10.3 Update Socket.IO handlers for multi-tenant scoping
    - Update `src/socket/handlers.ts` to read `socket.data.userId` and pass to ConfigService
    - Update `src/socket/povHandlers.ts` and `src/socket/onlineHandlers.ts` for user-scoped operations
    - Join authenticated sockets to user-specific rooms
    - _Requirements: 7.3, 9.4_

  - [x]* 10.4 Write integration tests for full auth flow and data isolation
    - Test Google OAuth mock → user creation → JWT issuance → protected route access
    - Test multi-tenant data isolation: two users, verify complete isolation
    - Test public overlay route: slug resolution → config loading
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 8.2, 10.3_

- [x] 11. Implement Admin UI authentication integration
  - [x] 11.1 Create login page and OAuth redirect flow in Admin UI
    - Create login page component with "Sign in with Google" button
    - Redirect to `/auth/google` on button click
    - Handle OAuth callback redirect with JWT and refresh token
    - Store tokens in memory (not localStorage)
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 11.2 Add auth interceptor and token refresh logic to Admin UI API client
    - Update `packages/admin/src/api/client.ts` to include JWT in Authorization header on all requests
    - Implement 401 "token_expired" interceptor that attempts token refresh before re-login
    - Pass JWT in Socket.IO handshake auth payload
    - Implement logout flow: call `/auth/logout`, clear stored tokens
    - _Requirements: 12.4, 12.5, 12.6, 12.7_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses Vitest as test runner and fast-check for property-based tests
- Integration tests requiring PostgreSQL should use testcontainers or a local Docker instance

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["3.1", "3.3"] },
    { "id": 4, "tasks": ["3.2", "3.4"] },
    { "id": 5, "tasks": ["3.5", "3.6", "3.7"] },
    { "id": 6, "tasks": ["3.8", "3.9", "3.11"] },
    { "id": 7, "tasks": ["3.10", "5.1", "5.2", "5.3"] },
    { "id": 8, "tasks": ["5.4"] },
    { "id": 9, "tasks": ["5.5", "5.6"] },
    { "id": 10, "tasks": ["7.1"] },
    { "id": 11, "tasks": ["7.2", "7.3", "7.4", "8.1"] },
    { "id": 12, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 13, "tasks": ["8.5"] },
    { "id": 14, "tasks": ["10.1"] },
    { "id": 15, "tasks": ["10.2", "10.3"] },
    { "id": 16, "tasks": ["10.4", "11.1"] },
    { "id": 17, "tasks": ["11.2"] }
  ]
}
```
