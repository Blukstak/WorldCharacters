# WorldCharacters - Multiplayer 3D Character Viewer

Real-time multiplayer 3D character viewer with click-to-move pathfinding, business card popups, and optional video streaming. Built with Babylon.js, Colyseus, and React.

## Quick Start

### Prerequisites
- Docker with devcontainer support (VS Code Dev Containers)
- Chrome running on host with remote debugging enabled (for automated tests)

### Running the Application

1. **Start Colyseus Server** (Terminal 1):
   ```bash
   cd /WorldCharacters/colyseus-server && npm start
   ```
   Server: `ws://localhost:2567`

2. **Start Frontend** (Terminal 2):
   ```bash
   cd /WorldCharacters/3d-viewer && npm run dev
   ```
   Frontend: `http://localhost:5174`

3. **Open browser tabs** to `http://localhost:5174`, click "Multiplayer Mode", click on the floor to move.

## Project Structure

```
/WorldCharacters/
├── 3d-viewer/                  # Frontend (React + Babylon.js + Vite)
│   ├── src/
│   │   ├── components/         # BabylonViewer, BusinessCardPopup, VideoStreamOverlay
│   │   ├── data/               # Preset business profiles
│   │   ├── multiplayer/        # ColyseusManager client
│   │   ├── pathfinding/        # Yuka.js navmesh pathfinding
│   │   ├── player/             # PlayerController, RemotePlayer
│   │   └── hooks/              # useColyseus
│   ├── public/models/          # 3D character models (.glb)
│   └── test-*.mjs              # Integration tests (Puppeteer)
│
├── colyseus-server/            # Backend (Colyseus multiplayer)
│   └── src/
│       ├── rooms/GameRoom.ts   # Room logic, join/leave, model assignment
│       ├── schema/             # Player and GameState schemas
│       └── index.ts            # Server entry point
│
├── livekit-stream/             # Video/audio streaming (optional)
└── .devcontainer/              # Docker dev environment
```

## Features

- **Multiplayer click-to-move** - Click the floor to move your character; all players see movement in real-time
- **Server-authoritative state** - Colyseus handles game state, validates moves, broadcasts to all clients
- **Client-side pathfinding** - Yuka.js navmesh pathfinding for instant response with server validation
- **Business card popups** - Click any character to see their conference-style business card (name, profession, contact info)
- **Multiple character models** - GreenGuy and BusinessMan models assigned round-robin on join
- **Smooth interpolation** - RemotePlayer positions interpolated for lag compensation
- **Join/leave handling** - Players appear/disappear dynamically with proper mesh cleanup
- **Video streaming** - Optional LiveKit integration for video/audio overlay

## Architecture

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend | React + TypeScript + Babylon.js | 3D rendering, UI, click handling |
| Multiplayer | Colyseus + @colyseus/schema | Server authority, state sync, WebSocket |
| Pathfinding | Yuka.js | Client-side navmesh path calculation |
| Video/Audio | LiveKit WebRTC | Optional streaming overlay |
| Styling | Tailwind CSS + Space Grotesk / JetBrains Mono | UI and business card typography |

### Click-to-Move Flow

1. Player clicks floor → `BabylonViewer` does two-phase pick (character first, then floor)
2. If character hit → dispatches `babylonCharacterClick` → shows BusinessCardPopup
3. If floor hit → dispatches `babylonClick` → `PlayerController` calculates path via Yuka.js
4. `PlayerController` sends position updates → `ColyseusManager` → Colyseus server
5. Server validates and broadcasts → all clients receive update
6. `RemotePlayer` interpolates to target position

## Testing with Puppeteer

### Setup

Tests use **Puppeteer + Chrome DevTools Protocol (CDP)** to connect to a Chrome instance running on the host machine. This avoids running a headless browser inside the container and gives access to real WebGL rendering.

**Requirements:**
- Chrome running on the host with remote debugging:
  ```
  chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0
  ```
- From inside the devcontainer, Chrome is reachable at `192.168.65.254:9222` (Docker Desktop host gateway)

### Running Tests

Both servers must be running before executing tests.

```bash
# Two-player multiplayer sync test
node 3d-viewer/test-2-players.mjs

# Full multiplayer test suite (2-player, 3-player, disconnect, movement)
node 3d-viewer/test-multiplayer.mjs

# CDP pipeline test (WebGL check, multiplayer activation, player count)
node 3d-viewer/test-multiplayer-cdp.mjs

# Animation state after model switching
node 3d-viewer/test-animation-state.mjs

# Console validation during model switching
node 3d-viewer/test-animation-switching.mjs

# Model selector UI test
node 3d-viewer/test-puppeteer.mjs

# Business card popup click test
node test-business-card.mjs
```

### Test Descriptions

| Test | File | What it verifies |
|------|------|-----------------|
| Two-Player Sync | `3d-viewer/test-2-players.mjs` | Two players connect, see each other, click-to-move syncs |
| Multiplayer Suite | `3d-viewer/test-multiplayer.mjs` | 5 scenarios: 2-player, 3-player, disconnect, movement sync |
| CDP Pipeline | `3d-viewer/test-multiplayer-cdp.mjs` | 6-step pipeline: WebGL init, multiplayer activation, player count |
| Animation State | `3d-viewer/test-animation-state.mjs` | Animations play correctly after switching character models |
| Animation Switch | `3d-viewer/test-animation-switching.mjs` | Console output validation during model switching |
| Model Selector | `3d-viewer/test-puppeteer.mjs` | Model selector dropdown works, character loads |
| Business Card | `test-business-card.mjs` | Character click triggers business card popup overlay |

## Port Configuration

Forwarded ports (configured in `.devcontainer/devcontainer.json`):

| Port | Service |
|------|---------|
| 2567 | Colyseus WebSocket server |
| 5174 | 3D Viewer (Vite dev server) |
| 5173 | LiveKit Stream (optional) |
| 6080 | noVNC browser access |
| 9009 | Browser MCP WebSocket |

## Development Notes

- **Colyseus server** must be restarted manually after code changes (no HMR)
- **Vite HMR** works for frontend files
- **Character models** are in `3d-viewer/public/models/` — GreenGuy_Animated.glb and BusinessMan.glb
- **Business profiles** are in `3d-viewer/src/data/presetProfiles.ts` — 8 presets assigned by join order
