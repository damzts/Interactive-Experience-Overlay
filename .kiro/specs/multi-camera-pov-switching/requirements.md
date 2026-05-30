# Requirements Document

## Introduction

Multi-Camera POV Switching enables multiple players (3+) to each run their own OBS instance with WebSocket enabled and connect to the central IEOM server. The host/principal manages all connected cameras from the admin panel and the system automatically switches between camera feeds based on audio volume levels — always seeking the player with the most action. Manual override is also supported. Only one camera is displayed at a time (single-POV, not picture-in-picture).

## Glossary

- **POV_Switcher**: The server-side module responsible for evaluating audio levels across all connected cameras and deciding which camera feed to display
- **Camera_Feed**: A single OBS instance connected to the IEOM server via obs-websocket-js, representing one player's point of view
- **Host**: The principal/admin user who manages all connected cameras and can manually override automatic switching
- **Audio_Level**: The volume meter reading (in dB) obtained from an OBS instance via the GetInputVolumeMeter request
- **Activity_Score**: A computed numeric value representing how much action is happening on a given Camera_Feed, derived from Audio_Level readings over a rolling time window
- **Switch_Cooldown**: A minimum time period that must elapse between automatic camera switches to prevent rapid flickering
- **Active_Camera**: The Camera_Feed currently selected for display on the output stream
- **Camera_Registry**: The server-side data structure that tracks all connected Camera_Feeds, their connection status, and metadata

## Requirements

### Requirement 1: Camera Feed Registration

**User Story:** As a player, I want to connect my OBS instance to the IEOM server, so that my camera feed is available for the multi-POV stream.

#### Acceptance Criteria

1. WHEN a player's OBS instance connects via WebSocket, THE Camera_Registry SHALL register the Camera_Feed with a unique identifier, connection timestamp, and player label (maximum 32 characters)
2. WHEN a Camera_Feed connection is lost, THE Camera_Registry SHALL mark the Camera_Feed as disconnected and emit a status update to the Host within 2 seconds of detecting the loss
3. WHEN a previously disconnected Camera_Feed reconnects from the same OBS address, THE Camera_Registry SHALL restore the Camera_Feed to active status using the existing registration without requiring re-registration by the Host
4. THE Camera_Registry SHALL support between 3 and 10 simultaneous Camera_Feed connections
5. IF a Camera_Feed fails to respond to a health check within 5 seconds, THEN THE Camera_Registry SHALL mark the Camera_Feed as unresponsive and emit a status update to the Host
6. THE Camera_Registry SHALL perform health checks on each connected Camera_Feed at a configurable interval (default 10 seconds)
7. IF a new Camera_Feed attempts to connect when the maximum simultaneous connection limit is reached, THEN THE Camera_Registry SHALL reject the connection and emit a notification to the Host indicating the capacity has been reached

### Requirement 2: Multi-OBS Connection Management

**User Story:** As a host, I want the server to maintain connections to multiple OBS instances simultaneously, so that all player cameras are accessible for switching.

#### Acceptance Criteria

1. THE POV_Switcher SHALL maintain independent WebSocket connections to each registered OBS instance, supporting a minimum of 3 and a maximum of 10 simultaneous Camera_Feed connections
2. WHEN the Host configures a new Camera_Feed via the admin panel, THE POV_Switcher SHALL initiate a WebSocket connection to the specified OBS address (host and port) and password within 5 seconds of configuration submission
3. IF a WebSocket connection to an OBS instance fails, THEN THE POV_Switcher SHALL retry the connection using exponential backoff starting at 15 seconds, capping at 300 seconds, for a maximum of 5 attempts without affecting other active connections
4. WHEN a Camera_Feed connection state changes, THE POV_Switcher SHALL emit a connection status event to all admin clients containing the Camera_Feed identifier and the new connection state (connected, disconnected, or reconnecting)
5. THE POV_Switcher SHALL isolate connection failures so that one Camera_Feed disconnecting does not disrupt other Camera_Feed connections or trigger state changes on unrelated Camera_Feeds
6. IF all retry attempts for a Camera_Feed are exhausted without successful connection, THEN THE POV_Switcher SHALL mark the Camera_Feed as unreachable and emit a status event to all admin clients indicating the failure

### Requirement 3: Audio Level Monitoring

**User Story:** As a host, I want the system to continuously monitor audio levels from all connected cameras, so that the system can determine which player has the most action.

#### Acceptance Criteria

1. WHILE a Camera_Feed is connected, THE POV_Switcher SHALL poll Audio_Level data from the OBS instance at a configurable interval (default 100ms, minimum 50ms, maximum 1000ms)
2. THE POV_Switcher SHALL compute an Activity_Score between 0 and 1 for each Camera_Feed using a rolling average of normalized Audio_Level readings over a configurable time window (default 2 seconds, minimum 500ms, maximum 10000ms)
3. WHEN Audio_Level data is received, THE POV_Switcher SHALL normalize the dB values to a 0-1 linear scale by mapping a configurable floor (default -60 dB) to 0 and a configurable ceiling (default 0 dB) to 1, clamping values outside this range
4. IF a Camera_Feed fails to provide Audio_Level data for 3 consecutive poll cycles, THEN THE POV_Switcher SHALL assign an Activity_Score of 0 to that Camera_Feed
5. WHEN a Camera_Feed that was previously assigned an Activity_Score of 0 due to missing data resumes providing Audio_Level data, THE POV_Switcher SHALL resume computing its Activity_Score from incoming readings without carrying over the previous zero score
6. THE POV_Switcher SHALL emit Activity_Score updates to admin clients at a configurable rate (default every 500ms, minimum 100ms, maximum 5000ms) containing the Activity_Score and Camera_Feed identifier for each connected Camera_Feed

### Requirement 4: Automatic Camera Switching

**User Story:** As a host, I want the system to automatically switch to the camera with the most action, so that viewers always see the most exciting perspective.

#### Acceptance Criteria

1. WHILE automatic switching is enabled, THE POV_Switcher SHALL evaluate Activity_Scores each time new scores are computed and select the Camera_Feed with the highest Activity_Score as the Active_Camera, provided the score exceeds the current Active_Camera score by the configured activity threshold (default 0.15)
2. THE POV_Switcher SHALL enforce a configurable Switch_Cooldown (default 3 seconds, minimum 1 second, maximum 30 seconds) between automatic switches to prevent rapid flickering
3. WHEN the Active_Camera changes, THE POV_Switcher SHALL command the output OBS instance to transition to the scene or source mapped to the new Camera_Feed in the Camera_Registry configuration
4. IF all Camera_Feeds have an Activity_Score below a configurable silence threshold (default 0.05), THEN THE POV_Switcher SHALL remain on the current Active_Camera without switching
5. WHEN automatic switching selects a new Active_Camera, THE POV_Switcher SHALL emit a switch event to all admin clients containing the previous and new Camera_Feed identifiers and the timestamp of the switch
6. WHEN automatic switching is enabled and no Active_Camera is currently set, THE POV_Switcher SHALL select the Camera_Feed with the highest Activity_Score immediately without applying the Switch_Cooldown or activity threshold
7. IF two or more Camera_Feeds share the highest Activity_Score during automatic evaluation, THEN THE POV_Switcher SHALL retain the current Active_Camera if it is among the tied feeds, or otherwise select the Camera_Feed that has been active least recently
8. IF the current Active_Camera disconnects while automatic switching is enabled, THEN THE POV_Switcher SHALL immediately select the connected Camera_Feed with the highest Activity_Score as the new Active_Camera, bypassing the Switch_Cooldown

### Requirement 5: Manual Override

**User Story:** As a host, I want to manually select which camera is active, so that I can override the automatic switching when needed.

#### Acceptance Criteria

1. WHEN the Host selects a Camera_Feed via the admin panel, THE POV_Switcher SHALL switch the Active_Camera to the selected Camera_Feed within 500ms
2. WHILE a manual override is active, THE POV_Switcher SHALL suspend automatic switching until the Host explicitly re-enables automatic mode
3. WHEN the Host re-enables automatic switching, THE POV_Switcher SHALL resume Activity_Score evaluation and switch to the highest-scoring Camera_Feed after the next Switch_Cooldown period
4. WHEN the switching mode changes between automatic and manual, THE POV_Switcher SHALL emit a status event indicating the current mode to all connected admin clients, and SHALL emit the current mode to any admin client upon connection
5. IF the manually selected Camera_Feed disconnects, THEN THE POV_Switcher SHALL fall back to automatic switching and emit a status event to the Host indicating the fallback reason
6. IF the Host selects a Camera_Feed that is currently disconnected or unresponsive, THEN THE POV_Switcher SHALL reject the selection and emit an error event to the Host indicating the Camera_Feed is unavailable

### Requirement 6: Host Camera Dashboard

**User Story:** As a host, I want to see the status of all connected cameras and their activity levels in real time, so that I can monitor the multi-POV experience.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a list of all registered Camera_Feeds with their connection status (connected, disconnected, or unresponsive), player label, and current Activity_Score displayed as a numeric value between 0 and 1
2. WHEN a Camera_Feed Activity_Score changes, THE Admin_Panel SHALL update the visual activity indicator within 1 second of receiving the update event from the server
3. THE Admin_Panel SHALL visually distinguish the current Active_Camera from other Camera_Feeds using a persistent visual indicator that remains visible without user interaction
4. THE Admin_Panel SHALL provide controls to enable or disable automatic switching, adjust Switch_Cooldown within a range of 1 to 30 seconds, and set the activity threshold within a range of 0.01 to 1.0
5. WHEN the Host adjusts switching parameters, THE Admin_Panel SHALL persist the configuration and apply changes within 2 seconds, and display a confirmation indicator to the Host upon successful save
6. IF the Admin_Panel fails to persist switching parameter changes, THEN THE Admin_Panel SHALL display an error indication to the Host and retain the previously entered values in the form controls
7. IF no Camera_Feeds are registered, THEN THE Admin_Panel SHALL display an empty state message indicating that no cameras are connected

### Requirement 7: Switching Configuration Persistence

**User Story:** As a host, I want my camera switching settings to be saved, so that I do not have to reconfigure them each session.

#### Acceptance Criteria

1. THE ConfigService SHALL persist POV switching configuration including polling interval (default 100ms), rolling window duration (default 2 seconds), Switch_Cooldown (default 3 seconds), activity threshold (default 0.15), and silence threshold (default 0.05)
2. WHEN the server starts, THE ConfigService SHALL load saved POV switching configuration and apply the values to the POV_Switcher so that it begins operating with the persisted polling interval, rolling window, Switch_Cooldown, activity threshold, and silence threshold
3. WHEN the Host updates switching parameters via the admin panel, THE ConfigService SHALL persist the changes to the database synchronously before returning the HTTP response, and emit a config:patch event so that connected admin clients receive the updated values
4. THE ConfigService SHALL apply default values for any missing POV switching configuration fields using the existing withConfigDefaults pattern: polling interval 100ms, rolling window 2 seconds, Switch_Cooldown 3 seconds, activity threshold 0.15, silence threshold 0.05
5. IF persisted POV switching configuration contains values outside valid bounds (polling interval less than 50ms or greater than 2000ms, rolling window less than 500ms or greater than 10000ms, Switch_Cooldown less than 1 second or greater than 30 seconds, activity threshold less than 0.01 or greater than 1.0, silence threshold less than 0.0 or greater than 1.0), THEN THE ConfigService SHALL replace the out-of-bound field with its default value and log a warning

### Requirement 8: OBS Scene Transition on Switch

**User Story:** As a host, I want camera switches to use smooth transitions in OBS, so that the viewer experience is not jarring.

#### Acceptance Criteria

1. WHEN the Active_Camera changes, THE POV_Switcher SHALL command the output OBS instance to execute the configured transition type (default: cut) with the configured duration (default: 0ms for cut, 500ms for fade), bounded between 100ms and 60000ms for non-cut transitions
2. THE POV_Switcher SHALL support at minimum cut and fade transition types for camera switches
3. WHEN a transition is in progress, THE POV_Switcher SHALL queue subsequent switch requests up to a maximum depth of 5 and execute the next queued request after the output OBS instance emits a transition completion event or a 10-second timeout elapses, whichever occurs first
4. WHEN the Host configures the transition type and duration via the admin panel, THE POV_Switcher SHALL apply the new settings to subsequent camera switches without restarting connections
5. IF the queue depth limit is reached, THEN THE POV_Switcher SHALL discard the oldest queued switch request before appending the new request
6. IF the output OBS instance fails to execute a transition command, THEN THE POV_Switcher SHALL retry the command once after 500ms, and if the retry also fails, skip the transition, dequeue the next pending request, and emit an error status event to admin clients indicating the failed transition
7. IF a queued switch request references a Camera_Feed that has disconnected before the request is executed, THEN THE POV_Switcher SHALL discard that request and proceed to the next item in the queue
