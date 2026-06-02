> **AI Agent Notes**
> Auth flows change less often than engine features but are harder to debug when broken.
> The key constraint: the self-hosted server has no auth logic. It delegates entirely to the cloud API.
> The Vite proxy split (some routes to cloud, most to local) is the most common source of confusion for new contributors.

---

# Auth Flow

## Design principle

Authentication is handled entirely by the cloud API. The self-hosted server has no auth server, no session management, and no OAuth integration. It trusts whatever the cloud API issues.

Auth is optional. The admin panel and overlay work fully without a login. Signing in unlocks cloud features — online rooms, multi-participant WebRTC. Everything local runs without it.

## Web flow (admin panel in a browser)

The browser stays on the same page throughout — no popups, no new tabs. The flow is a same-window redirect cycle:

1. User clicks Sign In in the admin panel
2. Admin panel redirects the entire window to the cloud API's Google auth endpoint, passing the local admin URL as the redirect destination
3. Cloud API handles the Google OAuth exchange
4. Cloud API redirects back to the local admin URL with an auth success signal
5. Admin panel calls the cloud API's identity endpoint to confirm the session (routed through the Vite dev proxy so cookies attach correctly)

The cookie is set by the cloud API and sent with subsequent requests via the proxy. The local server never sees auth credentials.

## Desktop flow (Electron)

The Electron app can't do a same-window redirect because that would navigate away from the app. Instead:

1. Electron opens the system browser to the cloud API's Google auth endpoint, with `redirect=desktop` in the query
2. Google OAuth completes in the system browser
3. Cloud API redirects to the `ieom://` custom protocol URL with a JWT token embedded
4. Electron's registered protocol handler intercepts the URL before the browser can handle it
5. Electron extracts the JWT and uses it as a Bearer token for all subsequent API and WebSocket calls

The `ieom://` deep link is why Electron is justified here — a browser bookmark cannot register a custom protocol handler.

## Vite dev proxy routing

During development, the admin panel's Vite dev server proxies requests to avoid CORS issues and to split traffic correctly:

- Auth endpoints go to the cloud API (the cloud handles all OAuth)
- All other API calls go to the local server
- Socket.IO connections go to the local server
- Static asset requests go to the local server

This means a developer working locally never needs to run the cloud API — only the specific auth-related endpoints hit the cloud, and those only trigger on sign-in.

## Key configuration

Four environment values control auth behavior:

- The frontend needs to know the cloud API origin to construct auth redirect URLs
- The cloud API needs the authorized Google redirect URI to match what Google Console expects
- The cloud API needs the list of allowed redirect origins (to prevent open redirects back to arbitrary URLs)
- The desktop app needs the backend origin to construct its OAuth and API calls

If Google auth stops working, the first thing to check is whether the redirect URI in Google Console matches what the cloud API is configured with. This mismatch is the most common breakage point.
