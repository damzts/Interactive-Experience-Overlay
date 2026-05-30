# Implementation Plan: HttpOnly Cookie Authentication

## Overview

Migrate the IEOM application from client-side JWT token management (sessionStorage + Authorization headers) to server-managed HttpOnly cookie authentication with CSRF protection. The implementation proceeds server-first (cookie utilities → middleware → routes), then client-side (API client → AuthContext → Socket), followed by integration wiring and testing.

## Tasks

- [x] 1. Install dependency and create cookie utility module
  - [x] 1.1 Install @fastify/cookie and register the plugin
    - Run `pnpm add @fastify/cookie --filter @ieom/server`
    - Register `@fastify/cookie` in `packages/server/src/index.ts` before auth routes
    - _Requirements: 1.1, 1.2, 9.5_

  - [x] 1.2 Create cookie utility module at `packages/server/src/auth/cookies.ts`
    - Implement `getCookieOptions(type: 'access' | 'refresh' | 'csrf')` returning environment-aware options (HttpOnly, Secure, SameSite, Path, maxAge)
    - Implement `generateCsrfToken()` using `crypto.randomBytes(32).toString('hex')`
    - Implement `setAuthCookies(reply, accessToken, refreshToken, csrfToken)` that sets all three cookies
    - Implement `clearAuthCookies(reply)` that expires all three cookies
    - Access token: HttpOnly=true, Path=/, maxAge=86400
    - Refresh token: HttpOnly=true, Path=/auth/refresh, maxAge=2592000
    - CSRF token: HttpOnly=false, Path=/, maxAge=86400
    - Secure=true and SameSite=Strict in production; Secure=false and SameSite=Lax in development
    - _Requirements: 1.1, 1.2, 1.4, 4.1, 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 2. Update server-side authentication middleware
  - [x] 2.1 Rewrite `packages/server/src/auth/authMiddleware.ts` to extract JWT from cookies
    - Read `access_token` from `request.cookies` instead of Authorization header
    - Ignore the Authorization header entirely
    - Return 401 `{ error: "unauthorized" }` for missing/invalid tokens
    - Return 401 `{ error: "token_expired" }` for expired tokens
    - Continue to attach `request.userId` from the JWT `sub` claim on success
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Create CSRF guard middleware at `packages/server/src/auth/csrfMiddleware.ts`
    - Exempt GET, HEAD, OPTIONS methods from validation
    - For state-changing methods: read `csrf_token` cookie and compare against `X-CSRF-Token` header
    - Return 403 `{ error: "csrf_invalid" }` on mismatch or missing header
    - Export a `registerCsrfGuard(app)` function that applies the hook to protected routes
    - _Requirements: 4.3, 4.4, 4.5_

  - [x] 2.3 Register CSRF guard in `packages/server/src/index.ts`
    - Import and call `registerCsrfGuard(app)` after `registerAuthMiddleware(app)`
    - Ensure CSRF guard applies to the same protected prefixes as auth middleware
    - _Requirements: 4.3, 4.5_

- [x] 3. Update auth routes to use cookies
  - [x] 3.1 Rewrite OAuth callback in `packages/server/src/auth/authRoutes.ts`
    - After successful token exchange, call `setAuthCookies(reply, accessToken, refreshToken, csrfToken)`
    - Redirect to `/admin` (no tokens in URL, no fragment, no query params)
    - On failure, redirect to `/admin/login?error=oauth_failed` without setting cookies
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 4.1_

  - [x] 3.2 Rewrite refresh endpoint in `packages/server/src/auth/authRoutes.ts`
    - Read refresh token from `request.cookies.refresh_token` instead of request body
    - On success: set new cookies via `setAuthCookies()`, return 200
    - On failure: clear all cookies via `clearAuthCookies()`, return 401 `{ error: "refresh_invalid" }`
    - _Requirements: 3.2, 3.3_

  - [x] 3.3 Rewrite logout endpoint in `packages/server/src/auth/authRoutes.ts`
    - Read access token from `request.cookies.access_token` instead of Authorization header
    - Invalidate refresh token hash in database
    - Clear all auth cookies via `clearAuthCookies()`
    - _Requirements: 6.1, 6.2_

  - [x] 3.4 Add GET /auth/me endpoint in `packages/server/src/auth/authRoutes.ts`
    - Apply auth middleware (cookie-based) to this route
    - Return `{ id, email, name }` from the authenticated user
    - Return 401 if cookie is missing/invalid
    - _Requirements: 8.1, 8.2_

- [x] 4. Checkpoint - Server-side changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update Socket.IO authentication middleware
  - [x] 5.1 Rewrite `packages/server/src/auth/socketAuthMiddleware.ts` to use cookies
    - Parse cookies from `socket.handshake.headers.cookie` (use the cookie-parsing utility from @fastify/cookie or a lightweight parser)
    - Extract `access_token` cookie value and verify the JWT
    - Set `socket.data.userId` on success
    - Reject with `authentication_error` on missing/invalid cookie
    - No longer read from `socket.handshake.auth.token`
    - _Requirements: 5.2, 5.3, 5.4_

- [x] 6. Rewrite client-side API client
  - [x] 6.1 Rewrite `packages/admin/src/api/client.ts` to use cookie-based auth
    - Remove `tokenStore`, `setTokens`, `getAccessToken`, `clearTokens` exports
    - Remove `authHeaders()` function and all Authorization header logic
    - Add `getCsrfToken()` that reads `csrf_token` from `document.cookie`
    - Update `apiFetch<T>()` to use `credentials: "include"` on all requests
    - Update `apiSend()` to include `credentials: "include"` and `X-CSRF-Token` header on mutations
    - Update refresh logic: POST `/auth/refresh` with `credentials: "include"` (no body needed)
    - On refresh failure: redirect to login page
    - Keep the deduplicated refresh promise pattern
    - Update `logout()` to POST `/auth/logout` with `credentials: "include"` and CSRF header
    - _Requirements: 3.1, 3.4, 3.5, 4.2, 7.1, 7.3_

- [x] 7. Rewrite client-side auth context and socket client
  - [x] 7.1 Rewrite `packages/admin/src/auth/AuthContext.tsx`
    - Remove all sessionStorage logic (no more `STORAGE_KEY_ACCESS`, `STORAGE_KEY_REFRESH`)
    - Remove `accessToken` and `refreshToken` state and exports
    - Add `user` state (`{ id, email, name } | null`) and `isLoading` state
    - On mount: call `GET /auth/me` with `credentials: "include"` to determine auth status
    - Set `isAuthenticated = user !== null`
    - `login()` redirects to `/auth/google`
    - `logout()` calls the API client's `logout()`, then redirects to login
    - Export `checkAuth()` for manual re-verification
    - _Requirements: 7.1, 7.2, 7.4, 8.3, 8.4_

  - [x] 7.2 Rewrite `packages/admin/src/socket/client.ts` to use cookie auth
    - Remove import of `getAccessToken`
    - Configure socket with `withCredentials: true`
    - Set `autoConnect: false` (connect only after auth check confirms user is authenticated)
    - Remove the `auth` callback that passes the token
    - Update `reconnectSocket()` accordingly
    - _Requirements: 5.1, 5.4_

  - [x] 7.3 Update `packages/admin/src/auth/LoginPage.tsx` if it reads URL fragments
    - Remove any logic that reads `#access_token` or `#refresh_token` from the URL hash
    - The login page should simply show the login button; auth status is determined by `/auth/me`
    - _Requirements: 7.2_

- [x] 8. Checkpoint - Full integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Property-based tests for cookie authentication
  - [ ]* 9.1 Write property test: Cookie flags are environment-correct
    - **Property 1: Cookie flags are environment-correct**
    - **Validates: Requirements 1.1, 1.2, 1.4, 9.1, 9.2, 9.3, 9.4**
    - Create test file `packages/server/src/auth/__tests__/cookieAuth.property.test.ts`
    - Generate arbitrary NODE_ENV values, verify Secure and SameSite flags match spec

  - [ ]* 9.2 Write property test: Cookie middleware extracts user identity
    - **Property 4: Cookie middleware extracts user identity**
    - **Validates: Requirements 2.1**
    - Generate random user IDs, sign valid JWTs, verify middleware sets request.userId

  - [ ]* 9.3 Write property test: Cookie middleware rejects invalid tokens
    - **Property 5: Cookie middleware rejects invalid tokens**
    - **Validates: Requirements 2.2**
    - Generate random invalid strings as cookie values, verify 401 unauthorized

  - [ ]* 9.4 Write property test: Cookie middleware distinguishes expired tokens
    - **Property 6: Cookie middleware distinguishes expired tokens**
    - **Validates: Requirements 2.3**
    - Generate tokens with past `exp` claims, verify error code is "token_expired" not "unauthorized"

  - [ ]* 9.5 Write property test: Authorization header is ignored
    - **Property 7: Authorization header is ignored**
    - **Validates: Requirements 2.4**
    - Generate valid JWTs in Authorization header with missing/invalid cookie, verify rejection

  - [ ]* 9.6 Write property test: CSRF double-submit validation
    - **Property 10: CSRF double-submit validation**
    - **Validates: Requirements 4.3, 4.4**
    - Generate random token pairs (matching and mismatching), verify accept/reject behavior

  - [ ]* 9.7 Write property test: CSRF exempts safe methods
    - **Property 11: CSRF exempts safe methods**
    - **Validates: Requirements 4.5**
    - Generate requests with GET/HEAD/OPTIONS methods, verify CSRF is not enforced

  - [ ]* 9.8 Write property test: Socket middleware authenticates from cookies
    - **Property 12: Socket middleware authenticates from handshake cookies**
    - **Validates: Requirements 5.2**
    - Generate random user IDs, create cookie strings with valid JWTs, verify extraction

  - [ ]* 9.9 Write property test: Socket middleware rejects invalid cookies
    - **Property 13: Socket middleware rejects missing/invalid handshake cookies**
    - **Validates: Requirements 5.3**
    - Generate invalid cookie values, verify connection rejection

- [ ] 10. Unit tests for auth routes and flows
  - [ ]* 10.1 Write unit tests for cookie auth routes
    - Test OAuth callback happy path (sets all three cookies, redirects to /admin)
    - Test OAuth callback error path (no cookies, redirects with error)
    - Test refresh endpoint happy path (new cookies, 200)
    - Test refresh endpoint failure paths (missing cookie, expired, hash mismatch)
    - Test logout endpoint (invalidates DB, clears cookies)
    - Test `/auth/me` endpoint (returns profile or 401)
    - Create test file `packages/server/src/auth/__tests__/cookieAuth.unit.test.ts`
    - _Requirements: 1.1, 1.3, 1.5, 3.2, 3.3, 6.1, 6.2, 8.1, 8.2_

  - [ ]* 10.2 Write unit tests for CSRF middleware
    - Test CSRF exemption for GET/HEAD/OPTIONS
    - Test CSRF rejection on POST without header
    - Test CSRF acceptance on POST with matching header and cookie
    - Test development mode cookie flags (Secure=false, SameSite=Lax)
    - _Requirements: 4.3, 4.4, 4.5, 9.2, 9.4_

- [x] 11. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The server uses `@fastify/cookie` for cookie parsing/setting; no custom parser needed for HTTP routes
- Socket.IO cookie parsing requires a lightweight parser since it operates outside Fastify's request lifecycle
- The existing refresh deduplication pattern (shared promise) is preserved in the client rewrite

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "2.2", "3.1", "3.2", "3.3", "3.4"] },
    { "id": 3, "tasks": ["2.3", "5.1"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 6, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7", "9.8", "9.9"] },
    { "id": 7, "tasks": ["10.1", "10.2"] }
  ]
}
```
