# SimX DBO Explorer

Angular app for browsing SimX DBO (database object) asset exports with WebGL preview support.

**Live demo:** https://simx-labs.github.io/asset-viewer-db-demo/

## DBO content files

DBO JSON exports (`DBO_*.json`) are **not** included in this repository. Share them separately and load them in the app via **Settings → Load DBO File(s)...**

Expected filenames:

- `DBO_Tools.json`
- `DBO_Authoring.json`
- `DBO_Cases.json`
- `DBO_Characters.json`
- `DBO_Dialog.json`
- `DBO_Other.json`
- `DBO_Scenes.json`

Place files in `public/` for local development, or use the in-app file picker when using the hosted demo.

## Local development

```bash
npm install
npm start
```

Open http://localhost:4300

## Unity Asset DB (`public/db`)

The viewer loads the per-file Unity asset graph from `public/db/` (same layout as `unity-asset-documentation/db`):

```
public/db/
  characters/<assetKey>.<8hex>.json
  equipment/<assetKey>.<8hex>.json
  tools/<assetKey>.<8hex>.json
  interactions/<location>.<8hex>.json
  clothing.json
  character-metadata.json
  tool-metadata.json
  index.json                 # generated; browser needs a file list
```

Refresh the manifest after copying a new scrape:

```bash
npm run db:index
```

`npm start` / `npm run build` regenerate `index.json` automatically. Point `UNITY_DB_ROOT` (app constant) at a remote host later — keep the same folder layout and ship an `index.json` beside it.

Interaction rows live under `interactions/` (location-keyed, with authored options). Their
`canSendAssetIds` identify tools with outbound interactions, while `canReceiveAssetIds` identify
characters, equipment, and tools exposing matching interaction locations. Asset rows reference
the interaction via `interactionId` on `interactionLocations` / `interactions` entries.

## Asset Database API (scenario-creator Next)

PoC HTTP layer over **`public/db/`** so scenario-creator can use header **Asset DB → Next** for tool / equipment / interaction pickers. DBO is not used by this API.

```bash
npm run api:install
npm run api:start
```

Override the folder with `UNITY_ASSET_DB_DIR`. Listens on **http://localhost:4301** (override with `PORT`) so it does not collide with the viewer on 4300.

| Method | Path | Notes |
|--------|------|--------|
| POST | `/assets` | Library-compatible query; **tool** (`kind === tool`), **equipment**, and **interaction** |
| GET | `/tags`, `/tag-categories` | Empty arrays (no taxonomy yet) |
| GET | `/asset-image/:id` | 501 — no image store |
| GET | `/models/<key>/model.glb` | Orbit Capture GLB (see below) |
| GET | `/models-index` | `{ count, keys }` of published captures |
| GET | `/system/health` | `{ status: "ok" }` |

Unsupported Asset Library types (`character`, `environment`, `settings`, `waveform`) return **501** with a clear message. Point scenario-creator `NG_APP_ASSET_LIBRARY_NEXT_API_URL` at `http://localhost:4301`.

### Serving Orbit Captures over HTTP

The Orbit viewer normally reads GLBs from a local folder you pick with the File System Access API. That API is **blocked in cross-origin iframes**, so embedded previews (the scenario-creator tool picker) could never load a model. The API therefore also serves the capture export directly:

```bash
# PowerShell
$env:ORBIT_CAPTURES_DIR="C:\SimX\unity-env-authoring\OrbitCaptures\EXPORT"; npm run api:start
```

`ORBIT_CAPTURES_DIR` defaults to `public/models`. The folder is a flat set of capture directories named by addressable key, each with `manifest.json` and `model.glb` — exactly what the Unity export produces:

```
EXPORT/
  tool_gauze_kerlix/
    manifest.json
    model.glb
```

The inline viewer prefers a locally linked folder when one is readable and falls back to HTTP otherwise, so standalone use is unchanged.

### Deep links & embed (scenario-creator)

| URL | Purpose |
|-----|---------|
| `http://localhost:4300/?source=unity#<assetUuid>` | Open an asset in the full viewer (Unity DB) |
| `http://localhost:4300/?embed=1&source=unity&id=<assetUuid>#<assetUuid>` | Detail-only layout (iframe-friendly; forces Unity DB mode) |
| `http://localhost:4300/?embed=1&source=unity&preview=model&id=<assetUuid>#<assetUuid>` | Model-only thumbnail embed for asset pickers |

Add `&models=<apiBaseUrl>` to point the embed at a models server (scenario-creator does this automatically using its Asset DB API URL); it defaults to `http://localhost:4301`.

Tool `/assets` responses include Unity extras under `data` (`assetKey`, `toolId`, `prefabPath`, interaction/group counts) for richer pickers. Point scenario-creator `NG_APP_ASSET_DATABASE_VIEWER_URL` at `http://localhost:4300`.

## Build

```bash
npm run build          # production build
npm run build:pages    # GitHub Pages build (base href /asset-viewer-db-demo/)
```

## Deployment

Pushes to `main` deploy automatically via GitHub Actions. In the repository **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions** if it is not already enabled.
