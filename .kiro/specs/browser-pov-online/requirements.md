# Requirements Document

## Introduction

Browser POV Online extends the existing Multi-Camera POV Switching system with a remote-player mode. Instead of requiring each player to run OBS locally and connect via obs-websocket on a LAN, remote players open a URL in their web browser, share their camera and microphone via WebRTC, and send client-side audio level data to the server via Socket.IO. The server reuses the existing POVSwitcher decision engine to determine the active speaker. The host captures the active feed in OBS using a Browser Source that renders the currently active player's video full-screen. The existing LAN mode (OBS direct connection) remains completely separate and fully functional.

## Glossary

- **Online_Room**: A server-managed session that groups remote players together for a single POV switching experience, identified by a unique room code
- **Room_Code**: A short alphanumeric string (6 characters, uppercase) that uniquely identifies an Online_Room and is used in the join URL
- **Remote_Player**: A participant who connects via web browser, shares camera and microphone through WebRTC, and sends audio level data to the server
- **Player_Client**: The browser-based application that a Remote_Player uses to share media and transmit audio levels
- **Audio_Level_Report**: A numeric payload sent from the Player_Client to the server via Socket.IO containing the current audio amplitude (0-1 linear scale) computed client-side using the Web Audio API AnalyserNode
- **POV_Switcher**: The existing server-side decision engine that evaluates activity scores and determines which feed is active (reused from LAN mode)
- **Activity_Score**: A computed numeric value (0-1) representing how much audio activity a Remote_Player has, derived from Audio_Level_Reports over a rolling time window
- **Active_Player**: The Remote_Player currently selected by the POV_Switcher as the primary feed for display
- **Browser_Source_Overlay**: A dedicated web page served by the IEOM server that renders the Active_Player's video feed full-screen, intended to be loaded as an OBS Browser Source by the host
- **Signaling_Server**: The server-side component that facilitates WebRTC peer connection establishment by relaying SDP offers, answers, and ICE candidates between peers via Socket.IO
- **Host**: The admin user who creates Online_Rooms, monitors connected players, and manages switching from the admin panel
- **Online_Session_Manager**: The server-side module responsible for creating, managing, and destroying Online_Rooms and tracking their participants

## Requirements

### Requirement 1: Online Room Creation

**User Story:** As a host, I want to create an online room from the admin panel, so that remote players have a session to join.

#### Acceptance Criteria

1. WHEN the Host requests room creation from the admin panel, THE Online_Session_Manager SHALL create a new Online_Room with a unique 6-character uppercase alphanumeric Room_Code and return the Room_Code and join URL to the Host within 1 second
2. THE Online_Session_Manager SHALL ensure each generated Room_Code is unique among all currently active Online_Rooms
3. WHEN an Online_Room is created, THE Online_Session_Manager SHALL initialize the room with a maximum player capacity (default 10, configurable between 2 and 20) and an empty participant list
4. THE Online_Session_Manager SHALL support at most 5 simultaneously active Online_Rooms
5. IF the Host requests room creation when the maximum number of active rooms is reached, THEN THE Online_Session_Manager SHALL reject the request and return an error indicating the room limit has been reached

### Requirement 2: Online Room Lifecycle

**User Story:** As a host, I want to manage the lifecycle of online rooms, so that I can start and end sessions cleanly.

#### Acceptance Criteria

1. WHEN the Host closes an Online_Room from the admin panel, THE Online_Session_Manager SHALL disconnect all Remote_Players in the room, release all associated WebRTC resources, and remove the room from the active rooms list within 5 seconds
2. WHEN the last Remote_Player disconnects from an Online_Room and no new player joins within 60 seconds, THE Online_Session_Manager SHALL mark the room as idle and emit a notification to the Host
3. WHEN the Host explicitly destroys an idle room, THE Online_Session_Manager SHALL remove the room from the active rooms list
4. WHILE an Online_Room is active, THE Online_Session_Manager SHALL track the number of connected Remote_Players and emit participant count updates to the Host via Socket.IO whenever a player joins or leaves
5. IF the server restarts while Online_Rooms are active, THEN THE Online_Session_Manager SHALL treat all rooms as destroyed and require the Host to create new rooms (rooms are ephemeral and not persisted)

### Requirement 3: Remote Player Join Flow

**User Story:** As a remote player, I want to join a room by opening a URL in my browser, so that I can participate without installing any software.

#### Acceptance Criteria

1. WHEN a Remote_Player navigates to the join URL (format: `/room/{Room_Code}`), THE Player_Client SHALL display a join interface requesting the player's display name (1-32 characters)
2. WHEN the Remote_Player submits their display name, THE Player_Client SHALL request camera and microphone permissions from the browser
3. WHEN camera and microphone permissions are granted, THE Player_Client SHALL establish a Socket.IO connection to the server and emit a join event containing the Room_Code and display name
4. IF the Room_Code is invalid or the room is not active, THEN THE Online_Session_Manager SHALL reject the join request and the Player_Client SHALL display an error message indicating the room was not found
5. IF the Online_Room has reached its maximum player capacity, THEN THE Online_Session_Manager SHALL reject the join request and the Player_Client SHALL display an error message indicating the room is full
6. WHEN the join is accepted, THE Online_Session_Manager SHALL assign the Remote_Player a unique participant ID, add the player to the room's participant list, and emit a participant-joined event to the Host and all other players in the room
7. IF camera or microphone permissions are denied by the browser, THEN THE Player_Client SHALL display an error message explaining that camera and microphone access are required to participate

### Requirement 4: WebRTC Media Streaming

**User Story:** As a remote player, I want to share my camera and microphone via WebRTC, so that other participants and the host can see and hear me.

#### Acceptance Criteria

1. WHEN a Remote_Player successfully joins an Online_Room, THE Player_Client SHALL create a WebRTC peer connection and send an SDP offer to the Signaling_Server via Socket.IO
2. THE Signaling_Server SHALL relay SDP offers, SDP answers, and ICE candidates between peers without inspecting or modifying the media content
3. WHEN a new Remote_Player joins, THE Signaling_Server SHALL notify all existing participants in the room so they can establish peer connections with the new player
4. THE Player_Client SHALL transmit video at a maximum resolution of 720p (1280x720) and a maximum frame rate of 30fps to conserve bandwidth
5. WHEN a Remote_Player's network connection degrades, THE Player_Client SHALL reduce video quality automatically using WebRTC's built-in adaptive bitrate mechanisms
6. IF a WebRTC peer connection fails to establish within 15 seconds, THEN THE Player_Client SHALL retry the connection once, and if the retry also fails, display an error message to the Remote_Player indicating the connection could not be established
7. WHEN a Remote_Player disconnects (browser closed, network lost), THE Signaling_Server SHALL notify all remaining participants and the Host within 3 seconds so they can clean up the corresponding peer connection

### Requirement 5: Client-Side Audio Level Analysis

**User Story:** As a remote player, I want my browser to analyze my microphone audio levels locally, so that the server can determine who is speaking without processing raw audio.

#### Acceptance Criteria

1. WHILE a Remote_Player is connected to an Online_Room, THE Player_Client SHALL analyze the microphone audio stream using the Web Audio API AnalyserNode and compute a linear amplitude value between 0 and 1
2. THE Player_Client SHALL send Audio_Level_Reports to the server via Socket.IO at a configurable interval (default 100ms, minimum 50ms, maximum 500ms)
3. THE Player_Client SHALL compute the audio level by taking the RMS (root mean square) of the AnalyserNode frequency data and normalizing it to a 0-1 linear scale
4. WHILE the Remote_Player's microphone is muted or the audio stream is inactive, THE Player_Client SHALL send an Audio_Level_Report with a value of 0
5. IF the Player_Client fails to access the AnalyserNode (audio context suspended or stream ended), THEN THE Player_Client SHALL send Audio_Level_Reports with a value of 0 and display a warning indicator to the Remote_Player

### Requirement 6: Server-Side Audio Score Processing

**User Story:** As a host, I want the server to process audio levels from all remote players using the existing scoring engine, so that automatic switching works the same as in LAN mode.

#### Acceptance Criteria

1. WHEN the server receives an Audio_Level_Report from a Remote_Player, THE Online_Session_Manager SHALL feed the reported level into the existing Activity_Score computation using the same rolling average algorithm as the LAN mode (configurable window, default 2 seconds)
2. THE Online_Session_Manager SHALL compute Activity_Scores for each Remote_Player in the room and pass the scores to the POV_Switcher for evaluation using the same threshold, cooldown, and silence detection logic as LAN mode
3. IF a Remote_Player fails to send an Audio_Level_Report for 3 consecutive expected intervals, THEN THE Online_Session_Manager SHALL assign an Activity_Score of 0 to that player
4. WHEN a Remote_Player that was previously assigned an Activity_Score of 0 due to missing reports resumes sending Audio_Level_Reports, THE Online_Session_Manager SHALL resume computing the Activity_Score from new reports without carrying over the zero values
5. THE Online_Session_Manager SHALL emit Activity_Score updates to the Host's admin panel at a configurable rate (default every 500ms) containing the score and participant identifier for each connected Remote_Player in the room

### Requirement 7: Active Speaker Switching

**User Story:** As a host, I want the system to automatically switch to the active speaker among remote players, so that viewers always see who is talking.

#### Acceptance Criteria

1. WHILE automatic switching is enabled for an Online_Room, THE POV_Switcher SHALL evaluate Activity_Scores and select the Remote_Player with the highest score as the Active_Player, provided the score exceeds the current Active_Player's score by the configured activity threshold
2. THE POV_Switcher SHALL enforce the configured Switch_Cooldown between automatic switches in online mode using the same cooldown logic as LAN mode
3. WHEN the Active_Player changes, THE Online_Session_Manager SHALL emit a switch event to the Host and to the Browser_Source_Overlay containing the previous and new participant identifiers
4. IF all Remote_Players have an Activity_Score below the configured silence threshold, THEN THE POV_Switcher SHALL remain on the current Active_Player without switching
5. WHEN the Host manually selects a Remote_Player from the admin panel, THE POV_Switcher SHALL switch the Active_Player to the selected participant within 500ms and suspend automatic switching until the Host re-enables automatic mode
6. IF the current Active_Player disconnects, THEN THE POV_Switcher SHALL immediately select the connected Remote_Player with the highest Activity_Score as the new Active_Player, bypassing the Switch_Cooldown
7. WHEN automatic switching is enabled and no Active_Player is currently set, THE POV_Switcher SHALL select the Remote_Player with the highest Activity_Score immediately without applying the cooldown or activity threshold

### Requirement 8: Browser Source Overlay for OBS

**User Story:** As a host, I want a Browser Source URL that shows the active player's video full-screen, so that I can capture it in OBS without additional software.

#### Acceptance Criteria

1. THE IEOM_Server SHALL serve the Browser_Source_Overlay at a URL path of `/online/overlay/{Room_Code}` that renders the Active_Player's video feed full-screen with no visible UI chrome
2. WHEN the Browser_Source_Overlay loads, THE overlay page SHALL establish a Socket.IO connection to the server and subscribe to switch events for the specified Online_Room
3. WHEN a switch event is received, THE Browser_Source_Overlay SHALL transition the displayed video from the previous Active_Player to the new Active_Player using the configured transition type (cut or fade) and duration
4. THE Browser_Source_Overlay SHALL establish WebRTC peer connections with all Remote_Players in the room to receive their video streams, and display only the Active_Player's stream at any given time
5. IF the Active_Player's video stream is unavailable (connection lost, stream ended), THEN THE Browser_Source_Overlay SHALL display a black frame until a new Active_Player is selected or the stream recovers
6. THE Browser_Source_Overlay SHALL render video at the native resolution of the incoming stream (up to 1280x720) scaled to fill the browser viewport while maintaining aspect ratio
7. WHILE no Remote_Players are connected to the room, THE Browser_Source_Overlay SHALL display a black frame with no text or indicators

### Requirement 9: Host Admin Panel — Online Mode

**User Story:** As a host, I want to see and manage all connected remote players from the admin panel, so that I can monitor the online session.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display an "Online Rooms" section listing all active Online_Rooms with their Room_Code, join URL, participant count, and creation timestamp
2. THE Admin_Panel SHALL provide a button to create a new Online_Room and display the generated Room_Code and a copyable join URL upon creation
3. WHEN a Remote_Player joins or leaves an Online_Room, THE Admin_Panel SHALL update the participant list within 1 second showing each player's display name, connection status, and current Activity_Score
4. THE Admin_Panel SHALL visually distinguish the current Active_Player from other participants using a persistent visual indicator
5. THE Admin_Panel SHALL provide controls to enable or disable automatic switching, adjust Switch_Cooldown, and set the activity threshold for the online room, reusing the same configuration controls as LAN mode
6. THE Admin_Panel SHALL provide a button to close an Online_Room, with a confirmation prompt before executing the close action
7. THE Admin_Panel SHALL display the Browser Source URL for each active room so the Host can copy it into OBS

### Requirement 10: Player Client UI

**User Story:** As a remote player, I want a simple browser UI that shows my connection status and audio level, so that I know the system is working.

#### Acceptance Criteria

1. WHILE connected to an Online_Room, THE Player_Client SHALL display the player's own camera preview, current audio level as a visual meter, and connection status (connected, connecting, or disconnected)
2. THE Player_Client SHALL display the Online_Room's Room_Code and the number of other connected participants
3. WHEN the Remote_Player's connection to the server is lost, THE Player_Client SHALL display a "Reconnecting" status and attempt to reconnect using Socket.IO's built-in reconnection mechanism
4. IF reconnection fails after 5 attempts, THEN THE Player_Client SHALL display a "Disconnected" status with a manual "Rejoin" button
5. THE Player_Client SHALL provide a button to mute/unmute the microphone, and WHEN muted, THE Player_Client SHALL send Audio_Level_Reports with a value of 0 and display a muted indicator
6. THE Player_Client SHALL provide a button to enable/disable the camera, and WHEN disabled, THE Player_Client SHALL stop transmitting video while continuing to send Audio_Level_Reports
7. THE Player_Client SHALL function on modern desktop and mobile browsers (Chrome, Firefox, Safari, Edge — latest 2 major versions) without requiring plugins or extensions

### Requirement 11: Online Mode Configuration

**User Story:** As a host, I want to configure online mode settings, so that I can tune the experience for remote players.

#### Acceptance Criteria

1. THE ConfigService SHALL persist online mode configuration including audio report interval (default 100ms), rolling window duration (default 2 seconds), Switch_Cooldown (default 3 seconds), activity threshold (default 0.15), silence threshold (default 0.05), maximum players per room (default 10), and maximum active rooms (default 5)
2. WHEN the server starts, THE ConfigService SHALL load saved online mode configuration and apply the values to the Online_Session_Manager
3. WHEN the Host updates online mode parameters via the admin panel, THE ConfigService SHALL persist the changes to the database and emit a config update event so that connected admin clients receive the updated values
4. THE ConfigService SHALL apply default values for any missing online mode configuration fields using the existing withConfigDefaults pattern
5. IF persisted online mode configuration contains values outside valid bounds (audio report interval less than 50ms or greater than 500ms, rolling window less than 500ms or greater than 10000ms, Switch_Cooldown less than 1 second or greater than 30 seconds, activity threshold less than 0.01 or greater than 1.0, silence threshold less than 0.0 or greater than 1.0, max players less than 2 or greater than 20, max rooms less than 1 or greater than 10), THEN THE ConfigService SHALL replace the out-of-bound field with its default value and log a warning

### Requirement 12: Coexistence with LAN Mode

**User Story:** As a host, I want the online mode to coexist with the existing LAN mode, so that I can use either or both depending on the situation.

#### Acceptance Criteria

1. THE IEOM_Server SHALL operate LAN mode (OBS WebSocket direct connections) and Online mode (browser WebRTC connections) independently without interference between the two systems
2. WHILE both modes are active simultaneously, THE POV_Switcher SHALL maintain separate switching contexts for LAN mode feeds and Online mode rooms so that switching decisions in one mode do not affect the other
3. THE Admin_Panel SHALL present LAN mode and Online mode as separate sections, each with their own controls, feed lists, and status indicators
4. THE Online_Session_Manager SHALL use the same POVSwitcher algorithm and configuration parameter types as LAN mode, but operate on its own instance with its own state
5. IF the server is restarted, THEN LAN mode Camera_Feed registrations (persisted in the database) SHALL be restored while Online_Rooms (ephemeral) SHALL not be restored

