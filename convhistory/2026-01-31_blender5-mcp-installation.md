# Blender 5 + MCP Installation Session
**Date:** 2026-01-31
**Project:** C:\Proyectos\Artifacts\CharacterTests

---

## User Request
Install Blender 5 and everything required for MCP (Model Context Protocol) integration.

---

## Pre-Installation Check
Checked system for existing tools:
- **Python:** Found at multiple locations
  - `C:\Python310\python.exe`
  - `C:\Program Files\Python313\python.exe`
  - `C:\Users\jean0\AppData\Local\Microsoft\WindowsApps\python.exe`
- **uv:** Not installed
- **winget:** Available (v1.12.460)

---

## MCP Server Selection
User asked about which MCP server would be installed.

**Selected:** [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)
- Most popular community Blender MCP integration (5k+ GitHub stars)
- Listed on claudemcp.com and mcp.so
- Runs via `uvx blender-mcp`

**How it works:**
1. A Blender addon runs a local server on port 9876
2. The MCP server connects to that addon
3. Claude can then create/modify 3D objects, apply materials, execute Python code in Blender

**Alternative considered:** [skyiron/blender-mcp-claude](https://github.com/skyiron/blender-mcp-claude)

User confirmed to proceed with ahujasid/blender-mcp.

---

## Installation Steps

### 1. Blender 5.0.1 Installation
**Command:**
```
winget install BlenderFoundation.Blender --accept-package-agreements --accept-source-agreements
```
**Result:** Successfully installed Blender 5.0.1
- Downloaded from: https://download.blender.org/release/Blender5.0/blender-5.0.1-windows-x64.msi
- Size: ~344 MB

### 2. uv Package Manager Installation
**Command:**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```
**Result:** Successfully installed uv 0.9.28
- Installed to: `C:\Users\jean0\.local\bin`
- Binaries: `uv.exe`, `uvx.exe`, `uvw.exe`

### 3. Blender MCP Addon Download
**Command:**
```powershell
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/ahujasid/blender-mcp/main/addon.py' -OutFile 'C:\Proyectos\Artifacts\CharacterTests\blender_mcp_addon.py'
```
**Result:** Downloaded addon (~112 KB)
- Saved to: `C:\Proyectos\Artifacts\CharacterTests\blender_mcp_addon.py`

### 4. Local MCP Configuration
User requested MCP to be configured only for this project (not globally).

**Created:** `C:\Proyectos\Artifacts\CharacterTests\.mcp.json`
```json
{
  "mcpServers": {
    "blender": {
      "command": "C:\\Users\\jean0\\.local\\bin\\uvx.exe",
      "args": ["blender-mcp"]
    }
  }
}
```

---

## Files Created/Modified

| File | Location | Purpose |
|------|----------|---------|
| `.mcp.json` | Project root | Local MCP server configuration |
| `blender_mcp_addon.py` | Project root | Blender addon for MCP communication |

---

## Post-Installation Steps Required (Manual)

### Install Addon in Blender:
1. Open **Blender 5**
2. Go to **Edit → Preferences → Add-ons**
3. Click **Install...** and select: `C:\Proyectos\Artifacts\CharacterTests\blender_mcp_addon.py`
4. Enable the addon (checkbox next to "Blender MCP")
5. In Blender, press **N** to open side panel → find **BlenderMCP** tab → click **Start Server**

### Use with Claude Code:
- Restart Claude Code in this project folder
- MCP tools will appear automatically when Blender server is running

---

## MCP Capabilities (Once Active)
- Create, modify, delete 3D objects
- Apply and modify materials/colors
- Inspect Blender scene
- Execute arbitrary Python code in Blender
- Viewport screenshots
- PolyHaven integration
- Sketchfab integration

---

## Resources
- Blender Download: https://www.blender.org/download/
- Blender MCP GitHub: https://github.com/ahujasid/blender-mcp
- Blender MCP Website: https://blender-mcp.com/
- MCP Directory: https://www.claudemcp.com/servers/blender-mcp
