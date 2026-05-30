# Requirements Document

## Introduction

IEOM (Interactive Experience Overlay Manager) is pivoting from a SaaS multi-tenant web application to a desktop application using Electron. The existing monorepo packages (@ieom/server, @ieom/admin, @ieom/overlay, @ieom/shared) will be wrapped into an Electron shell. The server reverts to SQLite single-tenant mode, the Admin UI renders in an Electron BrowserWindow, and the Overlay remains accessible on localhost for OBS browser source consumption. A new LicenseService gates premium features, and authentication flows through deep links to a remote web app.

## Glossary

- **Desktop_App**: The Electron application that hosts the IEOM server, admin UI, and overlay
- **Main_Process**: The Electron main process responsible for app lifecycle, window management, and native integrations
- **Admin_Window**: The Electron BrowserWindow that renders the @ieom/admin React application
- **Overlay_Server**: The localhost HTTP server (port 3000) that serves the overlay UI for OBS browser source consumption
- **Embedded_Server**: The @ieom/server Fastify instance running within the Electron main process (not as a separate spawned process)
- **License_Service**: The service that validates user license tiers against the remote web application
- **Remote_Web_App**: The hosted IEOM web application that handles OAuth, license management, and room signaling
- **Deep_Link**: A custom protocol URL (ieom://...) used to pass data from the system browser back to the Desktop_App
- **Safe_Storage**: Electron's safeStorage API for encrypting sensitive data at rest using OS-level credential stores
- **Tray_Icon**: The system tray icon providing quick access to Desktop_App controls
- **Auto_Updater**: The module that checks for and applies new Desktop_App versions
- **Room_Service**: The service managing WebRTC-based multi-stream connections between room participants
- **App_Data_Directory**: The OS-specific user application data directory where the SQLite database and cached data are stored

## Requirements

### Requirement 1: Electron Application Shell

**User Story:** As a streamer, I want IEOM to run as a native desktop application, so that I have a dedicated app with system tray integration and proper lifecycle management.

#### Acceptance Criteria

1. WHEN the user launches the Desktop_App, THE Main_Process SHALL start the Embedded_Server and open the Admin_Window within 15 seconds of launch
2. IF the Embedded_Server fails to start within 15 seconds, THEN THE Main_Process SHALL display a native error dialog indicating the server failed to start and offer options to retry or quit
3. WHEN the Embedded_Server has started successfully, THE Overlay_Server SHALL be accessible at http://localhost:3000
4. WHEN the user closes the Admin_Window, THE Desktop_App SHALL minimize to the Tray_Icon instead of quitting
5. WHEN the user selects "Quit" from the Tray_Icon context menu, THE Main_Process SHALL shut down the Embedded_Server within 10 seconds and terminate the application, force-terminating if the timeout is exceeded
6. WHILE the Desktop_App is running, THE Tray_Icon SHALL indicate whether the Embedded_Server is running or stopped, and provide a context menu with "Show Window", "Restart Server", and "Quit" options
7. WHEN the user selects "Restart Server" from the Tray_Icon context menu, THE Main_Process SHALL shut down the Embedded_Server and start a new instance, displaying a notification when the server is available again
8. WHEN the user clicks the Tray_Icon, THE Main_Process SHALL show or focus the Admin_Window

### Requirement 2: Embedded Fastify Server

**User Story:** As a streamer, I want the IEOM server to run embedded within the desktop app, so that I do not need to manage a separate server process.

#### Acceptance Criteria

1. WHEN the Desktop_App starts, THE Main_Process SHALL initialize the Embedded_Server within the same Node.js process and complete startup within 10 seconds
2. THE Embedded_Server SHALL serve the overlay static files on http://localhost:3000
3. THE Embedded_Server SHALL serve the admin static files on a /admin path prefix accessible to the Admin_Window
4. WHEN the Embedded_Server encounters a fatal error (unhandled exception, port bind failure, or database corruption), THE Main_Process SHALL display a native error dialog describing the failure reason and offer the user options to restart the server or quit the application
5. THE Embedded_Server SHALL bind only to localhost (127.0.0.1) and reject connections from external network interfaces
6. IF port 3000 is already in use when the Embedded_Server attempts to start, THEN THE Main_Process SHALL display a native error dialog identifying the port conflict and offer the user options to retry or quit the application

### Requirement 3: SQLite Single-Tenant Database

**User Story:** As a streamer, I want my data stored locally in a simple database, so that I do not depend on an external database server.

#### Acceptance Criteria

1. THE Embedded_Server SHALL use SQLite (via better-sqlite3) as the sole database engine
2. THE Embedded_Server SHALL store the SQLite database file in the App_Data_Directory
3. WHEN the Desktop_App launches, THE Embedded_Server SHALL run migrations to apply any pending schema changes and seed default configuration if the database was newly created
4. THE Embedded_Server SHALL open the SQLite database in WAL mode for concurrent read performance
5. THE Embedded_Server SHALL NOT require user_id scoping on any database queries (single-tenant model)
6. IF a migration fails during startup, THEN THE Embedded_Server SHALL roll back the failed migration, display a native error dialog indicating which migration failed, and prevent the server from starting
7. IF the SQLite database file cannot be opened or is corrupted, THEN THE Embedded_Server SHALL display a native error dialog indicating the database is inaccessible and prevent the server from starting

### Requirement 4: Remove Multi-Tenant Auth from Local API

**User Story:** As a streamer, I want to access the local API without authentication, so that the desktop app works immediately without login for local features.

#### Acceptance Criteria

1. THE Embedded_Server SHALL NOT apply authentication middleware to any API routes served on localhost
2. THE Embedded_Server SHALL NOT apply CSRF protection middleware to any API routes served on localhost
3. THE Embedded_Server SHALL NOT require socket authentication for any Socket.IO namespace, allowing connections without tokens, cookies, or authorization headers
4. THE Embedded_Server SHALL NOT establish PostgreSQL connections, create tenant-scoped repositories, or execute queries requiring a user_id parameter
5. WHEN the Admin_Window connects to the Embedded_Server, THE Embedded_Server SHALL serve requests without requiring any authorization headers or cookies
6. WHEN any Socket.IO client connects to the Embedded_Server on localhost, THE Embedded_Server SHALL accept the connection without a handshake authentication step

### Requirement 5: Deep Link Authentication

**User Story:** As a streamer, I want to log in to my IEOM account through my browser, so that I can access premium features and stream rooms without entering credentials in the desktop app.

#### Acceptance Criteria

1. THE Desktop_App SHALL register the "ieom" custom protocol with the operating system
2. WHEN the user initiates login, THE Main_Process SHALL open the system default browser to the Remote_Web_App OAuth page
3. WHEN the Remote_Web_App completes OAuth, THE Remote_Web_App SHALL redirect to ieom://auth?token=<jwt_token>
4. WHEN the Desktop_App receives a deep link matching ieom://auth, THE Main_Process SHALL extract the token parameter from the URL
5. WHEN the Main_Process extracts a token parameter that is a non-empty string parseable as a three-part JWT (header.payload.signature), THE Main_Process SHALL store the token using Safe_Storage
6. IF the deep link URL does not contain a token parameter, or the token parameter is empty, or the token is not parseable as a three-part JWT, THEN THE Main_Process SHALL display an error notification indicating authentication failed and discard the request
7. WHEN the user selects "Logout", THE Main_Process SHALL delete the stored token from Safe_Storage and clear the cached license tier
8. IF the Desktop_App receives a deep link matching ieom://auth while a token is already stored, THEN THE Main_Process SHALL replace the existing token with the newly received token

### Requirement 6: Secure Token Storage

**User Story:** As a streamer, I want my authentication token stored securely, so that other applications on my machine cannot access my IEOM credentials.

#### Acceptance Criteria

1. THE Main_Process SHALL encrypt the authentication token using Electron Safe_Storage before writing it to disk
2. THE Main_Process SHALL store the encrypted token in the App_Data_Directory
3. WHEN the Desktop_App starts and an encrypted token file exists, THE Main_Process SHALL attempt to decrypt and load the stored token from Safe_Storage
4. IF decryption of the stored token fails due to corruption or OS credential changes, THEN THE Main_Process SHALL delete the corrupted token file and notify the user that re-authentication is required
5. IF Safe_Storage is unavailable on the platform and an OS keychain is available, THEN THE Main_Process SHALL store the token in the OS keychain
6. IF Safe_Storage is unavailable on the platform and no OS keychain is available, THEN THE Main_Process SHALL display a warning that token storage is unencrypted and store the token in plaintext in the App_Data_Directory

### Requirement 7: License Validation

**User Story:** As a streamer, I want the desktop app to validate my license, so that I can access features appropriate to my subscription tier.

#### Acceptance Criteria

1. WHEN the Desktop_App starts and a stored token exists, THE License_Service SHALL validate the license by calling GET /api/license/me on the Remote_Web_App with the stored token, using a request timeout of 10 seconds
2. WHEN the License_Service receives a successful response, THE License_Service SHALL cache the license tier (free, pro, pro+rooms) and the validation timestamp locally in the App_Data_Directory
3. WHEN the License_Service receives a 401 response, THE License_Service SHALL clear the stored token and notify the user that re-authentication is required
4. IF the License_Service receives a non-401 error response (e.g., 500, 403, 429) or the request times out, THEN THE License_Service SHALL treat the validation as unreachable and apply the grace period rules
5. WHILE the Desktop_App is running, THE License_Service SHALL re-validate the license every 24 hours
6. IF the Remote_Web_App is unreachable during validation, THEN THE License_Service SHALL use the cached license tier for a grace period of 7 days from the last successful validation timestamp
7. IF the grace period has expired and the Remote_Web_App remains unreachable, THEN THE License_Service SHALL downgrade the user to the free tier until connectivity is restored

### Requirement 8: Feature Gating by License Tier

**User Story:** As a streamer, I want premium features gated by my subscription, so that I get value from upgrading my plan.

#### Acceptance Criteria

1. THE Desktop_App SHALL expose the current license tier to the Admin_Window via an IPC channel
2. WHILE the license tier is "free", THE Desktop_App SHALL disable access to premium features (stream rooms, advanced ambiance presets, priority support) by displaying those features as visually disabled in the Admin_Window with an indication that a plan upgrade is required
3. WHILE the license tier is "pro", THE Desktop_App SHALL enable all features except stream rooms
4. WHILE the license tier is "pro+rooms", THE Desktop_App SHALL enable all features including stream rooms
5. WHEN the license tier changes, THE Main_Process SHALL notify the Admin_Window of the updated tier via IPC within 2 seconds of the change being detected
6. IF a user attempts to activate a feature that is not available in their current license tier, THEN THE Desktop_App SHALL prevent the action and display a message indicating which tier is required to access that feature

### Requirement 9: Stream Rooms Integration

**User Story:** As a streamer, I want to connect to stream rooms with other IEOM users, so that we can share video and audio feeds for collaborative streams.

#### Acceptance Criteria

1. WHEN the user joins a room, THE Room_Service SHALL connect to the Remote_Web_App room signaling WebSocket using the stored authentication token
2. WHEN the signaling connection is established, THE Room_Service SHALL negotiate WebRTC peer connections with other room participants up to a maximum of 8 concurrent peer connections
3. WHILE connected to a room, THE Room_Service SHALL relay incoming video and audio streams to the Overlay_Server for rendering
4. IF the signaling WebSocket disconnects unexpectedly, THEN THE Room_Service SHALL attempt reconnection with exponential backoff (starting at 1 second, maximum 30 seconds) and display a status indicator in the Admin_Window showing the reconnection state
5. WHEN the user leaves a room, THE Room_Service SHALL close all peer connections and disconnect from the signaling WebSocket
6. IF a WebRTC peer connection fails to establish within 15 seconds, THEN THE Room_Service SHALL abandon that peer connection attempt, notify the Admin_Window of the failure, and continue operating with remaining connected peers
7. IF the stored authentication token is rejected (401 response) when joining a room, THEN THE Room_Service SHALL abort the join attempt and notify the user that re-authentication is required

### Requirement 10: Auto-Update System

**User Story:** As a streamer, I want the desktop app to update itself automatically, so that I always have the latest features and bug fixes without manual downloads.

#### Acceptance Criteria

1. WHEN the Desktop_App starts, THE Auto_Updater SHALL check the Remote_Web_App for available updates
2. WHEN an update is available, THE Auto_Updater SHALL download the update in the background without interrupting the user
3. WHEN the download completes, THE Auto_Updater SHALL notify the user via a native OS notification that an update is ready to install
4. WHEN the user accepts the update, THE Auto_Updater SHALL install the update and restart the Desktop_App
5. IF the update download fails, THEN THE Auto_Updater SHALL retry up to 3 times with a 5-minute interval between attempts
6. THE Auto_Updater SHALL verify the integrity of downloaded updates using code signatures before installation
7. IF code signature verification fails, THEN THE Auto_Updater SHALL discard the downloaded update, notify the user that the update could not be verified, and not apply the update
8. IF the user dismisses the update notification, THEN THE Auto_Updater SHALL re-check for the update on the next Desktop_App start

### Requirement 11: Application Packaging and Distribution

**User Story:** As a streamer, I want to install IEOM like any other desktop application on my operating system, so that setup is simple and familiar.

#### Acceptance Criteria

1. THE Desktop_App SHALL produce installers for Windows (.exe), macOS (.dmg), and Linux (.AppImage)
2. THE Desktop_App SHALL be code-signed for Windows and macOS to avoid OS security warnings
3. THE Desktop_App SHALL include all required native dependencies (better-sqlite3, Electron native modules) pre-built for each target platform
4. WHEN installed on Windows, THE Desktop_App SHALL register the "ieom" protocol handler in the Windows Registry
5. WHEN installed on macOS, THE Desktop_App SHALL register the "ieom" protocol handler via the Info.plist CFBundleURLTypes entry
6. WHEN installed on Linux, THE Desktop_App SHALL register the "ieom" protocol handler via a .desktop file with the appropriate MimeType entry

### Requirement 12: Offline Operation

**User Story:** As a streamer, I want the desktop app to work fully offline for local features, so that my stream is not disrupted by internet connectivity issues.

#### Acceptance Criteria

1. WHILE the Desktop_App has no internet connectivity, THE Embedded_Server SHALL continue to serve the overlay and admin UI with the same response times and full functionality as when online
2. WHILE the Desktop_App has no internet connectivity, THE Desktop_App SHALL allow full use of scenes, events, OBS bridge, ambiance, and all local features without any functional limitation
3. WHILE the Desktop_App has no internet connectivity, THE Desktop_App SHALL display a persistent status indicator in the Admin_Window header area showing that online features (rooms, license sync) are unavailable
4. WHEN internet connectivity is restored, THE License_Service SHALL automatically re-validate the license within 30 seconds of detecting restored connectivity without user intervention
5. IF license re-validation fails after internet connectivity is restored, THEN THE License_Service SHALL retry up to 3 times with a 60-second interval before falling back to the cached license tier

### Requirement 13: Admin UI Integration

**User Story:** As a streamer, I want the admin panel to open in a dedicated app window, so that it feels like a native application rather than a browser tab.

#### Acceptance Criteria

1. WHEN the Desktop_App starts, THE Main_Process SHALL create the Admin_Window loading the built admin UI static files from the Embedded_Server
2. THE Admin_Window SHALL have a minimum size of 1024x768 pixels
3. THE Admin_Window SHALL remember its last position and size between sessions by persisting window bounds to the App_Data_Directory
4. IF the stored Admin_Window position is outside the bounds of all currently available displays, THEN THE Main_Process SHALL reset the window to the center of the primary display with default size
5. THE Admin_Window SHALL hide the default Electron menu bar and use the existing admin UI navigation
6. WHEN the Admin_Window loads, THE Main_Process SHALL inject the Embedded_Server base URL (http://localhost:3000) so the admin UI connects to the local server

### Requirement 14: Startup Behavior

**User Story:** As a streamer, I want to configure whether IEOM starts automatically with my computer, so that it is ready when I begin streaming.

#### Acceptance Criteria

1. WHERE the user enables "Launch at startup" in settings, THE Desktop_App SHALL register itself to start automatically when the operating system boots
2. WHERE the user disables "Launch at startup" in settings, THE Desktop_App SHALL remove itself from the operating system auto-start registry
3. WHEN the Desktop_App starts via auto-launch, THE Main_Process SHALL start minimized to the Tray_Icon without showing the Admin_Window
4. WHEN the Desktop_App starts via user action (double-click or shortcut), THE Main_Process SHALL show the Admin_Window immediately
5. IF the Desktop_App is already running when a second instance is launched, THEN THE Main_Process SHALL focus the existing Admin_Window and terminate the second instance
