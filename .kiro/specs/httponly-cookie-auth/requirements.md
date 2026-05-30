# Requirements Document

## Introduction

This feature migrates the IEOM application from a client-side JWT token authentication system (vulnerable to XSS) to a production-grade HttpOnly cookie-based authentication system. The new system stores tokens exclusively in HttpOnly cookies that are inaccessible to JavaScript, implements CSRF protection to guard against cross-site request forgery, and updates all authentication flows (REST API, Socket.IO, OAuth callback) to work with cookies instead of Authorization headers or handshake payloads.

## Glossary

- **Auth_Server**: The Fastify server component responsible for issuing, validating, and refreshing authentication tokens via HttpOnly cookies
- **Admin_Client**: The React-based admin panel SPA served at the `/admin` path (or via Vite dev server on port 3002 in development)
- **Cookie_Middleware**: The server-side middleware that reads authentication cookies from incoming requests and attaches the authenticated user identity to the request context
- **CSRF_Guard**: The server-side mechanism that validates CSRF tokens on state-changing requests to prevent cross-site request forgery
- **Socket_Auth_Middleware**: The Socket.IO middleware that authenticates WebSocket connections using cookies from the handshake request
- **Access_Token_Cookie**: An HttpOnly, Secure, SameSite cookie containing the short-lived JWT access token
- **Refresh_Token_Cookie**: An HttpOnly, Secure, SameSite cookie containing the long-lived refresh token
- **CSRF_Token**: A non-HttpOnly cookie or response header value used by the client to prove request origin
- **OAuth_Callback_Handler**: The server route that handles the Google OAuth redirect and issues authentication cookies

## Requirements

### Requirement 1: Cookie Issuance After OAuth Login

**User Story:** As an admin user, I want the server to set HttpOnly cookies after I log in with Google, so that my authentication tokens are never exposed to client-side JavaScript.

#### Acceptance Criteria

1. WHEN the OAuth_Callback_Handler receives a valid authorization code from Google, THE Auth_Server SHALL set an Access_Token_Cookie with the flags HttpOnly, Secure (in production), SameSite=Strict, and Path=/
2. WHEN the OAuth_Callback_Handler receives a valid authorization code from Google, THE Auth_Server SHALL set a Refresh_Token_Cookie with the flags HttpOnly, Secure (in production), SameSite=Strict, and Path=/auth/refresh
3. WHEN the OAuth_Callback_Handler sets authentication cookies, THE Auth_Server SHALL redirect the Admin_Client to the authenticated landing page without including any tokens in the URL
4. WHILE the application is running in development mode, THE Auth_Server SHALL set the Secure flag to false and SameSite to Lax on authentication cookies to allow localhost operation over HTTP
5. WHEN the OAuth_Callback_Handler receives an invalid or missing authorization code, THE Auth_Server SHALL redirect to the login page with an error parameter and SHALL NOT set any authentication cookies

### Requirement 2: Cookie-Based Request Authentication

**User Story:** As an admin user, I want my API requests to be authenticated automatically via cookies, so that I do not need to manage tokens in JavaScript.

#### Acceptance Criteria

1. WHEN a request arrives at a protected API endpoint, THE Cookie_Middleware SHALL extract the JWT from the Access_Token_Cookie and attach the authenticated user ID to the request context
2. IF the Access_Token_Cookie is missing or contains an invalid JWT, THEN THE Cookie_Middleware SHALL return a 401 response with error code "unauthorized"
3. IF the Access_Token_Cookie contains an expired JWT, THEN THE Cookie_Middleware SHALL return a 401 response with error code "token_expired"
4. THE Cookie_Middleware SHALL ignore the Authorization header entirely and authenticate exclusively from the Access_Token_Cookie

### Requirement 3: Server-Side Token Refresh

**User Story:** As an admin user, I want my session to be refreshed automatically without any client-side token handling, so that my experience is seamless and secure.

#### Acceptance Criteria

1. WHEN the Admin_Client receives a 401 "token_expired" response, THE Admin_Client SHALL send a POST request to /auth/refresh (with credentials included) to trigger a cookie-based refresh
2. WHEN the Auth_Server receives a valid POST /auth/refresh request with a valid Refresh_Token_Cookie, THE Auth_Server SHALL set a new Access_Token_Cookie and a new Refresh_Token_Cookie and return a 200 response
3. IF the Refresh_Token_Cookie is missing, expired, or does not match the stored hash, THEN THE Auth_Server SHALL return a 401 response and clear all authentication cookies
4. WHEN a token refresh succeeds, THE Admin_Client SHALL retry the original failed request exactly once
5. IF the token refresh fails, THEN THE Admin_Client SHALL clear its authentication state and redirect the user to the login page

### Requirement 4: CSRF Protection

**User Story:** As a security-conscious operator, I want state-changing requests to be protected against CSRF attacks, so that malicious sites cannot perform actions on behalf of authenticated users.

#### Acceptance Criteria

1. WHEN the Auth_Server issues authentication cookies, THE Auth_Server SHALL also set a CSRF_Token as a non-HttpOnly cookie readable by JavaScript
2. WHEN the Admin_Client sends a state-changing request (POST, PUT, PATCH, DELETE), THE Admin_Client SHALL include the CSRF_Token value in a custom request header (X-CSRF-Token)
3. WHEN the CSRF_Guard receives a state-changing request to a protected endpoint, THE CSRF_Guard SHALL validate that the X-CSRF-Token header matches the CSRF_Token cookie value
4. IF the X-CSRF-Token header is missing or does not match the CSRF_Token cookie, THEN THE CSRF_Guard SHALL reject the request with a 403 response and error code "csrf_invalid"
5. THE CSRF_Guard SHALL exempt GET, HEAD, and OPTIONS requests from CSRF validation

### Requirement 5: Socket.IO Cookie Authentication

**User Story:** As an admin user, I want my WebSocket connection to authenticate using cookies, so that no token is passed in the Socket.IO handshake payload.

#### Acceptance Criteria

1. WHEN the Admin_Client establishes a Socket.IO connection, THE Admin_Client SHALL configure the connection with withCredentials=true so that cookies are sent during the handshake
2. WHEN a Socket.IO connection handshake arrives on the default namespace, THE Socket_Auth_Middleware SHALL extract the JWT from the Access_Token_Cookie in the handshake headers
3. IF the Access_Token_Cookie is missing or invalid in the Socket.IO handshake, THEN THE Socket_Auth_Middleware SHALL reject the connection with an "authentication_error" message
4. THE Admin_Client SHALL NOT pass any token in the Socket.IO auth payload

### Requirement 6: Logout and Cookie Clearing

**User Story:** As an admin user, I want logging out to completely clear my session cookies, so that my session cannot be reused after I log out.

#### Acceptance Criteria

1. WHEN the Admin_Client sends a POST /auth/logout request, THE Auth_Server SHALL invalidate the refresh token in the database
2. WHEN the Auth_Server processes a successful logout, THE Auth_Server SHALL clear the Access_Token_Cookie, Refresh_Token_Cookie, and CSRF_Token cookie by setting them with an expired date
3. WHEN the Admin_Client logs out, THE Admin_Client SHALL redirect the user to the login page
4. IF the logout request fails due to a network error, THEN THE Admin_Client SHALL still redirect the user to the login page (best-effort server invalidation)

### Requirement 7: Client-Side Token Removal

**User Story:** As a security engineer, I want all client-side token storage and handling removed, so that there is no JavaScript-accessible authentication material that could be stolen via XSS.

#### Acceptance Criteria

1. THE Admin_Client SHALL NOT store any authentication tokens in sessionStorage, localStorage, or JavaScript variables
2. THE Admin_Client SHALL NOT read tokens from the URL fragment hash
3. THE Admin_Client SHALL send all API requests with credentials: "include" so that cookies are attached automatically
4. THE Admin_Client SHALL determine authentication status by calling a dedicated /auth/me endpoint rather than by inspecting local token state

### Requirement 8: Authentication Status Endpoint

**User Story:** As an admin user, I want the application to verify my login status on page load, so that I see the correct UI without relying on client-side token inspection.

#### Acceptance Criteria

1. THE Auth_Server SHALL expose a GET /auth/me endpoint that returns the authenticated user's profile (id, email, name) when a valid Access_Token_Cookie is present
2. IF the Access_Token_Cookie is missing or invalid on GET /auth/me, THEN THE Auth_Server SHALL return a 401 response
3. WHEN the Admin_Client loads, THE Admin_Client SHALL call GET /auth/me to determine if the user is authenticated
4. IF GET /auth/me returns 401, THEN THE Admin_Client SHALL display the login page

### Requirement 9: Development and Production Environment Compatibility

**User Story:** As a developer, I want the cookie authentication to work in both local development and production, so that I can develop and test without environment-specific workarounds.

#### Acceptance Criteria

1. WHILE the application is running in production mode, THE Auth_Server SHALL set the Secure flag to true on all authentication cookies
2. WHILE the application is running in development mode, THE Auth_Server SHALL set the Secure flag to false on all authentication cookies to allow HTTP on localhost
3. WHILE the application is running in production mode, THE Auth_Server SHALL set SameSite=Strict on all authentication cookies
4. WHILE the application is running in development mode, THE Auth_Server SHALL set SameSite=Lax on all authentication cookies to allow the Vite proxy to forward cookies
5. THE Auth_Server SHALL determine the environment mode from the NODE_ENV environment variable
