# Browser MCP in the Dev Container

## How Browser MCP works

Browser MCP has three components that form a communication chain:

```
Claude Code  <--stdio-->  MCP Server (npx)  <--WebSocket:9009-->  Browser Extension
```

1. **Claude Code** spawns the MCP server as a child process and communicates over stdin/stdout (stdio transport).
2. **The MCP server** (`@browsermcp/mcp`) starts a WebSocket server on port 9009 and waits for the browser extension to connect.
3. **The browser extension** (installed in Chrome/Edge on the host) connects to `ws://localhost:9009` and executes commands (click, type, snapshot, etc.) on the active tab.

When Claude Code calls an MCP tool (e.g. `click`), the server sends a WebSocket message to the extension, the extension performs the action in the browser, and the result flows back through the same chain.

## Dev container requirements

### 1. Node.js runtime

**What:** The MCP server is distributed as an npm package and launched via `npx @browsermcp/mcp@latest`.

**How it's met:** The Dockerfile uses `node:20-slim` as the base image, which includes `node`, `npm`, and `npx`.

```dockerfile
# Dockerfile line 1
FROM node:20-slim
```

### 2. `lsof` system utility

**What:** On startup, the MCP server calls `lsof -ti:9009 | xargs kill -9` to clear any stale process holding port 9009 before binding the WebSocket server. This runs via `execSync` in `src/utils/port.ts`. If `lsof` is not installed, the `execSync` call throws an unhandled error and the server crashes immediately — Claude Code then reports the MCP server as not enabled.

**How it's met:** `lsof` is explicitly installed in the Dockerfile's apt-get layer.

```dockerfile
# Dockerfile lines 3–7
RUN apt-get update && apt-get install -y \
    git \
    curl \
    sudo \
    lsof \
    ...
```

### 3. Port 9009 exposed from container to host

**What:** The browser extension runs in Chrome/Edge on the Windows host and connects to `ws://localhost:9009`. The WebSocket server listens on port 9009 inside the container. For the two to reach each other, port 9009 must be forwarded from the container to the host.

**How it's met:** Port forwarding is configured in two places:

**docker-compose.yml** — publishes the port from the container to the Docker host (WSL):

```yaml
# docker-compose.yml line 18
ports:
  - "9009:9009"   # Browser MCP WebSocket
```

**devcontainer.json** — tells VS Code to forward the port from WSL to Windows `localhost`:

```json
// devcontainer.json lines 21, 35–38
"forwardPorts": [5173, 5174, 6080, 9009],
"portsAttributes": {
  "9009": {
    "label": "Browser MCP WebSocket",
    "onAutoForward": "silent"
  }
}
```

The `"silent"` auto-forward means VS Code forwards the port automatically without showing a notification, since this is a background service rather than something the user opens in a browser.

### 4. MCP server configuration for Claude Code

**What:** Claude Code needs a config entry telling it how to start the MCP server. This is defined in `.mcp.json` (project scope) at the workspace root.

**How it's met:**

```json
// .mcp.json
{
  "mcpServers": {
    "browsermcp": {
      "command": "npx",
      "args": ["@browsermcp/mcp@latest"]
    }
  }
}
```

The project root is mounted into the container at `/WorldCharacters` via the volume mount in docker-compose.yml (`../:/WorldCharacters:cached`), so this file is visible to Claude Code running inside the container.

### 5. Claude Code installed in the container

**What:** Claude Code must be running inside the dev container to spawn and manage the MCP server process.

**How it's met:** The Claude Code VS Code extension is included in the dev container's extension list:

```json
// devcontainer.json lines 8–17
"customizations": {
  "vscode": {
    "extensions": [
      ...
      "anthropic.claude-code"
    ]
  }
}
```

### 6. Network access for npx package download

**What:** The first time `npx @browsermcp/mcp@latest` runs, it downloads the package from the npm registry. The container needs outbound HTTPS access to `registry.npmjs.org`.

**How it's met:** The docker-compose.yml does not restrict outbound network access — the container uses the default bridge network which has full internet access through the Docker host.

## Summary

| Requirement | Provided by | Config location |
|---|---|---|
| Node.js + npx | `node:20-slim` base image | `Dockerfile:1` |
| `lsof` utility | apt-get install | `Dockerfile:7` |
| Port 9009 container → WSL | Docker port publish | `docker-compose.yml:18` |
| Port 9009 WSL → Windows | VS Code port forwarding | `devcontainer.json:21` |
| MCP server config | `.mcp.json` in project root | `.mcp.json` |
| Claude Code | VS Code extension auto-install | `devcontainer.json:16` |
| npm registry access | Default Docker networking | (no restriction) |

## Using it

1. Rebuild the dev container if you haven't already (to pick up the `lsof` addition).
2. Open Claude Code inside the dev container.
3. In your Windows browser, install the Browser MCP extension from [browsermcp.io/install](https://browsermcp.io/install).
4. Navigate to the page you want to control, open the extension, and click **Connect**.
5. Browser MCP tools should now appear in your Claude Code session.

## Alternative: Puppeteer via Chrome DevTools Protocol (WIP)

**Status:** Work in progress - Chrome connection verified, Puppeteer test script not yet implemented.

### Why Puppeteer?

Browser MCP has limitations when interacting with React SPAs:
- WebSocket timeouts on state changes
- Cannot reliably click buttons that trigger re-renders
- Poor support for dynamic modals/dialogs

Puppeteer uses Chrome DevTools Protocol (CDP), which is more stable and designed for programmatic browser automation.

### Setup

**1. Launch Chrome in Windows with remote debugging:**

```powershell
# Windows PowerShell or CMD:
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --user-data-dir="C:\temp\chrome-debug"
```

**Important flags:**
- `--remote-debugging-port=9222` - Opens CDP WebSocket server
- `--remote-debugging-address=0.0.0.0` - Binds to all interfaces (accessible from Docker)
- `--user-data-dir` - Separate profile to avoid conflicts

**2. Connection verified from devcontainer:**

```bash
# Windows host is accessible via special hostname
$ getent hosts host.docker.internal
192.168.65.254 host.docker.internal

# Chrome CDP endpoint is responding
$ curl http://192.168.65.254:9222/json/version
{
   "Browser": "Chrome/144.0.7559.111",
   "Protocol-Version": "1.3",
   "webSocketDebuggerUrl": "ws://192.168.65.254:9222/devtools/browser/..."
}
```

**3. Connect with Puppeteer (TODO):**

```javascript
const puppeteer = require('puppeteer-core');

const browser = await puppeteer.connect({
  browserURL: 'http://192.168.65.254:9222'
});

const page = await browser.newPage();
await page.goto('http://localhost:5174'); // Vite dev server
await page.click('button:has-text("Models")'); // Works reliably!
await page.screenshot({ path: 'screenshot.png' });
```

### TODO

- [ ] Install puppeteer-core in devcontainer
- [ ] Create test script for 3D viewer model switching
- [ ] Verify it can click through React modals
- [ ] Document any Windows Firewall issues (if any)
