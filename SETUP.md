# Setup Guide — Interactive Experience Overlay

## Prerequisites

### 1. Node.js (v20+)

Download: https://nodejs.org/

### 2. pnpm

```bash
npm install -g pnpm
```

### 3. Python 3.12+

Download: https://www.python.org/downloads/

During install, check **"Add Python to PATH"**.

After install, run:
```bash
pip install meson ninja invoke
```

### 4. Visual Studio Build Tools 2022

Download: https://aka.ms/vs/17/release/vs_BuildTools.exe

In the installer, select:
- **"Desktop development with C++"**

> **Important:** Must be VS 2022 (version 17.x). VS 2025 (18.x) is NOT compatible with the mediasoup native build.

> If you have both VS 2022 and VS 2025 installed, force VS 2022 before installing:
> ```powershell
> $env:VisualStudioVersion = "17.0"
> ```

---

## Installation

```bash
git clone https://github.com/damzts/Interactive-Experience-Overlay.git
cd Interactive-Experience-Overlay
pnpm install
```

The `pnpm install` will compile the mediasoup native worker (~30 seconds). You should see:
```
mediasoup: Running postinstall script, done in Xs
```

### If mediasoup build fails

1. **"meson.exe was blocked by Device Guard"** — Temporarily disable Device Guard or run from an elevated prompt.

2. **"Cannot open include file: prov/der_rsa.h"** — Corrupted build cache. Fix:
   ```powershell
   Remove-Item -Recurse -Force "node_modules\.pnpm\mediasoup@*\node_modules\mediasoup\worker\out"
   pnpm install
   ```

3. **"incompatible types - volatile int* to volatile LONG64*"** — You're using VS 2025. Install VS 2022 and force it:
   ```powershell
   $env:VisualStudioVersion = "17.0"
   pnpm install
   ```

---

## Running (Development)

```bash
pnpm dev
```

This starts all services concurrently:
- **Server**: http://localhost:3000
- **Overlay (dev)**: http://localhost:3001
- **Admin (dev)**: http://localhost:3002

---

## Environment Variables

Copy `.env.example` to `.env`:
```bash
copy .env.example .env
```

Key variables:
| Variable | Description | Default |
|----------|-------------|---------|
| `MEDIASOUP_RTC_MIN_PORT` | UDP port range start for mediasoup | `10000` |
| `MEDIASOUP_RTC_MAX_PORT` | UDP port range end for mediasoup | `10100` |
| `TURN_URL` | TURN server URL (optional, for remote guests) | — |
| `TURN_USERNAME` | TURN username | `ieom` |
| `TURN_CREDENTIAL` | TURN password | — |

---

## Architecture (WebRTC Relay)

```
Guest (browser, remote)
  → WebRTC (werift, full ICE + STUN)
  → Server receives RTP
  → RTP Bridge (localhost UDP) → mediasoup Producer
  → mediasoup Consumer
  → Overlay (localhost, mediasoup-client)
```

- **werift**: Handles guest connections with full ICE (NAT traversal without TURN)
- **mediasoup**: Handles relay to overlay (Producer/Consumer model — overlay can reconnect without video freeze)

---

## Building for Production

```bash
pnpm build
```

This compiles TypeScript and bundles the overlay/admin for production.
