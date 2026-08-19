# SimX Asset Database Viewer

Angular app for browsing SimX Unity Asset DB exports with WebGL preview support. The classic DBO format remains available for comparison but will be removed in a future release.

**Live demo:** https://simx-labs.github.io/asset-viewer-db-demo/

## Local development

```bash
npm install
npm start
```

Open http://localhost:4300

On startup the viewer loads the **Unity Asset DB** via `public/db` (a junction/symlink to an external folder — see below). Switch to DBO (legacy) under **Settings → Data Source** if you need a side-by-side comparison.

**Tags** (header button, or Settings) opens a dedicated page for the global tag list (accepted on any asset type) plus per-type tags. Edits stay local until you leave that page, so writing `tag-taxonomy.json` does not live-reload the viewer on every change.

## Unity Asset DB (external folder)

The JSON tree is **not** stored in this repo. Locally it comes from `unity-asset-documentation/db` (same layout that will later live on S3):

| Role | Setting |
|------|---------|
| Filesystem (API, import scripts, `npm run db:link`) | `UNITY_ASSET_DB_DIR` — default `../../unity-asset-documentation/db` |
| Browser URL (`UNITY_DB_ROOT` in the app) | `db` today (served through the link); replace with an S3/HTTPS URL later |

```bash
# optional override (PowerShell)
$env:UNITY_ASSET_DB_DIR="C:\SimX\unity-asset-documentation\db"
npm start
```

`npm start` / `npm run build` run `db:link` then regenerate `index.json` in that folder.

Layout:

```
db/
  characters/<assetKey>.<8hex>.json
  equipment/<assetKey>.<8hex>.json
  tools/<assetKey>.<8hex>.json
  interactions/<location>.<8hex>.json
  audio/<assetKey>.<8hex>.json
  videos/<assetKey>.<8hex>.json   # Ultrasound clips; MP4s in videos/media/
  clothing.json
  medications.json          # from Unity MedicationDatabase export (not scraped)
  waveforms.json            # from scenario-creator case waveforms[] (not Unity scrape)
  scenarios.json            # from scenario-creator case files (summary rows)
  tag-taxonomy.json         # global + per-type tags (Tags page; written on leave)
  character-metadata.json
  tool-metadata.json
  index.json                 # generated; browser needs a file list
```

Refresh the manifest:

```bash
npm run db:index
```

Re-import medications from a Unity `medicationDatabase.json` export:

```bash
npm run db:import-medications -- path/to/medicationDatabase.json
```

Re-import waveforms from scenario-creator case files:

```bash
npm run db:import-waveforms -- C:/SimX/scenario-creator-cases/scenarios
```

Re-import scenarios from scenario-creator case files:

```bash
npm run db:import-scenarios -- C:/SimX/scenario-creator-cases/scenarios
```

Imports write into `UNITY_ASSET_DB_DIR` (not into this repo).

You can also load a different `db/` folder at runtime via **Settings → Load Unity DB folder...**.

### Switching to S3 later

1. Host the same folder layout (including `index.json`) on the bucket.
2. Change `UNITY_DB_ROOT` in `src/app/models/unity-asset.models.ts` to the public HTTPS base URL (or wire it via environment config).
3. Point the API’s `UNITY_ASSET_DB_DIR` at a local sync/cache of that bucket, or teach the API to fetch remotely.

## DBO content files (legacy)

> **Deprecation notice:** DBO parsing is kept temporarily for comparison with the Unity Asset DB. It will be removed in a future release. Prefer the Unity Asset DB for all new work.

DBO JSON exports (`DBO_*.json`) are **not** included in this repository. Share them separately and load them in the app via **Settings → Data Source → DBO → Load DBO File(s)...**

Expected filenames:

- `DBO_Tools.json`
- `DBO_Authoring.json`
- `DBO_Cases.json`
- `DBO_Characters.json`
- `DBO_Dialog.json`
- `DBO_Other.json`
- `DBO_Scenes.json`

Place files in `public/` for local development, or use the in-app file picker when using the hosted demo.

## Asset Database API (scenario-creator Next)

PoC HTTP layer over the Unity asset DB folder so scenario-creator can use header **Asset DB → Next** for tool / equipment / interaction pickers. DBO is not used by this API.

```bash
npm run api:install
npm run api:start
```

Override the folder with `UNITY_ASSET_DB_DIR`. Listens on **http://localhost:4301** (override with `PORT`) so it does not collide with the viewer on 4300.

| Method | Path | Notes |
|--------|------|--------|
| POST | `/assets` | Library-compatible query; **tool**, **equipment**, **interaction**, **medication**, **waveform**, **scenario**, **environment**, **authored-environment**, **audio**, and **video** |
| GET | `/tags` | Curated taxonomy tags (`{ dataId, label, categories }`); falls back to asset label strings if empty |
| POST / PATCH / DELETE | `/tags`, `/tags/:dataId` | Create / update / delete curated tags |
| GET | `/tag-categories` | Curated categories (`{ dataId, label, tags }`) |
| POST / PATCH / DELETE | `/tag-categories`, `/tag-categories/:dataId` | Create / update / delete categories |
| GET / PUT | `/tag-taxonomy` | Full taxonomy dump / replace (persists `tag-taxonomy.json`) |
| GET | `/asset-image/:id` | 501 — no image store |
| GET | `/models/<key>/model.glb` | Orbit Capture GLB (see below) |
| GET | `/models-index` | `{ count, keys }` of published captures |
| GET | `/system/health` | `{ status: "ok" }` |

Unsupported Asset Library types (`character`, `environment`, `settings`) return **501** with a clear message. Point scenario-creator `NG_APP_ASSET_LIBRARY_NEXT_API_URL` at `http://localhost:4301`.

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

GitHub Pages CI builds without the sibling `unity-asset-documentation` checkout (empty DB stub). Once S3 is ready, point `UNITY_DB_ROOT` at the bucket so the hosted demo loads live data.

## Deployment

Pushes to `main` deploy automatically via GitHub Actions. In the repository **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions** if it is not already enabled.
