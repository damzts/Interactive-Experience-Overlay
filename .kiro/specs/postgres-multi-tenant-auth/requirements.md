# Requirements Document

## Introduction

Migrate the IEOM application from a single-tenant SQLite architecture to a multi-tenant PostgreSQL architecture with Google OAuth 2.0 authentication. The system will allow multiple independent users to each have isolated configuration, scenes, applications, and settings — all served from a single Fastify server instance connected to a shared PostgreSQL database. Public-facing pages (overlay, player, online room joining) remain unauthenticated but are scoped to a specific user via URL path segments.

## Glossary

- **Server**: The @ieom/server Fastify + Socket.IO backend process
- **Admin_UI**: The @ieom/admin React application used to configure scenes, applications, and settings
- **Overlay_Client**: The @ieom/overlay React application rendered on-stream, accessed via public URL
- **Auth_Module**: The server-side module responsible for Google OAuth 2.0 flow, session/token management, and request authentication
- **User**: A registered person who authenticates via Google OAuth and owns isolated configuration data
- **User_ID**: A unique identifier assigned to each User, used as a foreign key for data isolation
- **Config_Service**: The server-side service that loads, caches, and persists AppConfig for a specific User
- **Repository**: A data-access class that encapsulates all SQL queries for a specific domain table
- **Database_Pool**: A PostgreSQL connection pool managed by the Server for concurrent query execution
- **Auth_Middleware**: A Fastify hook that validates authentication tokens on protected HTTP routes
- **Socket_Auth_Middleware**: A Socket.IO middleware that validates authentication tokens on connection handshake
- **Public_Route**: An HTTP route or Socket.IO namespace that does not require authentication but is scoped to a User via URL path
- **Protected_Route**: An HTTP route that requires a valid authentication token
- **JWT**: A JSON Web Token used to represent authenticated session state
- **Refresh_Token**: A long-lived token used to obtain new JWTs without re-authentication
- **Migration_Runner**: A module that applies schema changes to the PostgreSQL database on server startup

## Requirements

### Requirement 1: PostgreSQL Connection Management

**User Story:** As a server operator, I want the server to connect to PostgreSQL via a connection pool, so that the application can handle concurrent multi-tenant requests efficiently.

#### Acceptance Criteria

1. WHEN the Server starts, THE Database_Pool SHALL establish a connection pool to PostgreSQL using configuration from environment variables (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD)
2. IF the Database_Pool fails to connect on startup, THEN THE Server SHALL log the connection error and terminate the process with a non-zero exit code
3. THE Database_Pool SHALL reuse connections across requests to minimize connection overhead
4. WHEN the Server shuts down, THE Database_Pool SHALL close all active connections gracefully

### Requirement 2: Schema Migration

**User Story:** As a server operator, I want the database schema to be automatically applied on startup, so that I do not need to run manual migration scripts.

#### Acceptance Criteria

1. WHEN the Server starts and the database has no existing schema, THE Migration_Runner SHALL create all required tables including the users table and all tenant-scoped configuration tables
2. WHEN the Server starts and the database schema version is behind the current application version, THE Migration_Runner SHALL apply pending migrations in sequential order within a transaction
3. IF a migration fails, THEN THE Migration_Runner SHALL roll back the transaction and terminate the Server with a descriptive error message
4. THE Migration_Runner SHALL track the current schema version in a dedicated migrations table

### Requirement 3: Users Table and Registration

**User Story:** As a new visitor, I want to sign in with my Google account and have a user record created automatically, so that I can start configuring my overlay immediately.

#### Acceptance Criteria

1. THE Server SHALL maintain a users table with columns: id (UUID primary key), google_id (unique), email, display_name, avatar_url, created_at, updated_at
2. WHEN a User authenticates via Google OAuth for the first time, THE Auth_Module SHALL create a new user record with the Google profile information
3. WHEN a User authenticates via Google OAuth and a record with the same google_id already exists, THE Auth_Module SHALL update the display_name and avatar_url from the Google profile and return the existing user record
4. THE Server SHALL generate a URL-safe short identifier (slug) for each User to use in public URL paths

### Requirement 4: Google OAuth 2.0 Authentication Flow

**User Story:** As a user, I want to log in with my Google account, so that I can securely access my admin panel without creating a separate password.

#### Acceptance Criteria

1. WHEN a User navigates to the login endpoint, THE Auth_Module SHALL redirect the User to Google's OAuth 2.0 authorization endpoint with the configured client_id, redirect_uri, and scopes (openid, email, profile)
2. WHEN Google redirects back with an authorization code, THE Auth_Module SHALL exchange the code for access and ID tokens via Google's token endpoint
3. WHEN the token exchange succeeds, THE Auth_Module SHALL extract the user profile (google_id, email, name, picture) from the ID token
4. IF the token exchange fails, THEN THE Auth_Module SHALL redirect the User to the Admin_UI login page with an error parameter
5. THE Server SHALL store Google OAuth client_id and client_secret in environment variables (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
6. THE Server SHALL read the OAuth redirect_uri from an environment variable (GOOGLE_REDIRECT_URI)

### Requirement 5: JWT Session Management

**User Story:** As an authenticated user, I want my session to persist across page reloads without re-authenticating, so that I have a seamless experience.

#### Acceptance Criteria

1. WHEN authentication succeeds, THE Auth_Module SHALL issue a JWT containing the User_ID and email with a configurable expiration (default 24 hours)
2. WHEN authentication succeeds, THE Auth_Module SHALL issue a Refresh_Token with a longer expiration (default 30 days) and store its hash in the database
3. WHEN a valid Refresh_Token is presented to the token refresh endpoint, THE Auth_Module SHALL issue a new JWT and a new Refresh_Token, invalidating the previous Refresh_Token
4. IF an expired or invalid Refresh_Token is presented, THEN THE Auth_Module SHALL return a 401 status and the client must re-authenticate via Google OAuth
5. THE Auth_Module SHALL sign JWTs using a secret key read from the JWT_SECRET environment variable
6. WHEN a User explicitly logs out, THE Auth_Module SHALL invalidate the associated Refresh_Token in the database

### Requirement 6: HTTP Route Protection

**User Story:** As a server operator, I want all admin API routes to require authentication, so that users cannot access or modify another user's data.

#### Acceptance Criteria

1. THE Auth_Middleware SHALL validate the JWT from the Authorization header (Bearer scheme) on all Protected_Routes
2. IF the JWT is missing or invalid, THEN THE Auth_Middleware SHALL return a 401 status with an error message
3. IF the JWT is expired, THEN THE Auth_Middleware SHALL return a 401 status with an "expired" error code so the client can attempt token refresh
4. WHEN the JWT is valid, THE Auth_Middleware SHALL attach the authenticated User_ID to the Fastify request object for downstream handlers
5. THE Auth_Middleware SHALL apply to all routes under /api/config, /api/assets, /api/upload, /api/archive, /api/pov, and /api/online (except room-joining endpoints)

### Requirement 7: Socket.IO Connection Authentication

**User Story:** As an authenticated user, I want my real-time Socket.IO connection to be authenticated, so that config updates and commands are scoped to my account.

#### Acceptance Criteria

1. WHEN a Socket.IO client connects to the default namespace, THE Socket_Auth_Middleware SHALL validate the JWT provided in the handshake auth payload
2. IF the JWT is missing or invalid during Socket.IO handshake, THEN THE Socket_Auth_Middleware SHALL reject the connection with an authentication error
3. WHEN the JWT is valid, THE Socket_Auth_Middleware SHALL attach the User_ID to the socket instance for use in all event handlers
4. THE Server SHALL allow unauthenticated Socket.IO connections to the /overlay namespace and the /online namespace for public clients

### Requirement 8: Tenant Data Isolation

**User Story:** As a user, I want my configuration, scenes, and applications to be completely isolated from other users, so that no one else can see or modify my data.

#### Acceptance Criteria

1. THE Repository SHALL include a user_id column (foreign key to users.id) on all tenant-scoped tables: scenes, applications, desktop_config, widget_layouts, events, keybinds, obs_config, audio_config, overlay_style, desktop_ambiance, source_presets, media_library, pov_config, pov_feeds, online_config
2. THE Repository SHALL include a WHERE user_id = $1 clause in every SELECT, UPDATE, and DELETE query on tenant-scoped tables
3. THE Repository SHALL set the user_id column on every INSERT into tenant-scoped tables
4. IF a query attempts to access a record belonging to a different User, THEN THE Repository SHALL return no results (SELECT) or affect zero rows (UPDATE/DELETE)

### Requirement 9: User-Scoped ConfigService

**User Story:** As a user, I want the server to load and cache my configuration independently from other users, so that my overlay responds to my settings in real time.

#### Acceptance Criteria

1. WHEN an authenticated request arrives, THE Config_Service SHALL load the AppConfig for the authenticated User_ID from the database if not already cached
2. THE Config_Service SHALL maintain separate in-memory caches per User_ID
3. WHEN a User's configuration is updated, THE Config_Service SHALL persist changes to the database scoped to that User_ID
4. WHEN a User's configuration is updated, THE Config_Service SHALL emit config:update and config:patch events only to Socket.IO connections belonging to that User_ID
5. THE Config_Service SHALL evict a User's cached configuration after a configurable idle timeout (default 30 minutes) to limit memory usage
6. WHEN a new User is created, THE Config_Service SHALL initialize their configuration with DEFAULT_CONFIG values

### Requirement 10: Public Overlay and Player Routes

**User Story:** As a streamer, I want my overlay URL to be publicly accessible without login, so that OBS and viewers can load it without authentication.

#### Acceptance Criteria

1. THE Server SHALL serve overlay pages at the path /u/{user_slug}/overlay without requiring authentication
2. THE Server SHALL serve player pages at the path /u/{user_slug}/player without requiring authentication
3. WHEN a Public_Route is accessed with a valid user_slug, THE Server SHALL resolve the user_slug to a User_ID and scope all data loading to that User
4. IF a Public_Route is accessed with an invalid user_slug, THEN THE Server SHALL return a 404 status
5. THE Overlay_Client SHALL connect to Socket.IO with the resolved User_ID context so it receives only that User's real-time updates

### Requirement 11: Online Room Public Access

**User Story:** As a viewer, I want to join an online room without logging in, so that participation is frictionless.

#### Acceptance Criteria

1. THE Server SHALL allow unauthenticated access to online room-joining endpoints (joining a session by room code)
2. WHEN a room is created, THE Server SHALL require authentication and associate the room with the authenticated User_ID
3. WHEN a participant joins a room, THE Server SHALL scope the room data to the owning User_ID without requiring the participant to authenticate

### Requirement 12: Admin UI Authentication Integration

**User Story:** As a user, I want the admin panel to show a login screen and manage my session, so that I can securely access my configuration.

#### Acceptance Criteria

1. WHEN an unauthenticated user navigates to the Admin_UI, THE Admin_UI SHALL display a login page with a "Sign in with Google" button
2. WHEN the user clicks "Sign in with Google", THE Admin_UI SHALL redirect to the Server's OAuth login endpoint
3. WHEN authentication completes, THE Admin_UI SHALL store the JWT and Refresh_Token in memory (not localStorage for security) and redirect to the dashboard
4. WHEN the Admin_UI receives a 401 response with an "expired" error code, THE Admin_UI SHALL attempt to refresh the token using the Refresh_Token before prompting re-login
5. THE Admin_UI SHALL include the JWT in the Authorization header of all API requests
6. THE Admin_UI SHALL pass the JWT in the Socket.IO handshake auth payload
7. WHEN the user clicks "Log out", THE Admin_UI SHALL call the logout endpoint and clear all stored tokens

### Requirement 13: Database Seeding for New Users

**User Story:** As a new user, I want my account to start with sensible default configuration, so that I can explore the overlay system immediately.

#### Acceptance Criteria

1. WHEN a new User record is created, THE Server SHALL insert default rows into all tenant-scoped tables for that User_ID using values from DEFAULT_CONFIG
2. THE Server SHALL perform the seeding operation within a single database transaction
3. IF seeding fails, THEN THE Server SHALL roll back the transaction and return an error to the authentication flow

### Requirement 14: Environment Configuration

**User Story:** As a server operator, I want all sensitive configuration to come from environment variables, so that secrets are not committed to source control.

#### Acceptance Criteria

1. THE Server SHALL read the following environment variables: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, JWT_SECRET, JWT_EXPIRATION, REFRESH_TOKEN_EXPIRATION
2. IF any required environment variable (PGHOST, PGDATABASE, PGUSER, PGPASSWORD, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET) is missing on startup, THEN THE Server SHALL log which variables are missing and terminate with a non-zero exit code
3. THE Server SHALL support an optional DATABASE_URL environment variable as an alternative to individual PG* variables
