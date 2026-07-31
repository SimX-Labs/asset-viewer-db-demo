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

Interaction field names match the current documentation schema: characters/equipment use `interactionLocations`; tools use outbound `interactions` and inbound `interactionLocations`.

## Asset Database API (scenario-creator Next)

PoC HTTP layer over **`public/db/`** so scenario-creator can use header **Asset DB → Next** for tool pickers. DBO is not used by this API.

```bash
npm run api:install
npm run api:start
```

Override the folder with `UNITY_ASSET_DB_DIR`. Listens on **http://localhost:4301** (override with `PORT`) so it does not collide with the viewer on 4300.

| Method | Path | Notes |
|--------|------|--------|
| POST | `/assets` | Library-compatible query; **tool** (`kind === tool`) and **equipment** |
| GET | `/tags`, `/tag-categories` | Empty arrays (no taxonomy yet) |
| GET | `/asset-image/:id` | 501 — no image store |
| GET | `/system/health` | `{ status: "ok" }` |

Unsupported Asset Library types (`character`, `environment`, `settings`, `waveform`) return **501** with a clear message. Point scenario-creator `NG_APP_ASSET_LIBRARY_NEXT_API_URL` at `http://localhost:4301`.

## Build

```bash
npm run build          # production build
npm run build:pages    # GitHub Pages build (base href /asset-viewer-db-demo/)
```

## Deployment

Pushes to `main` deploy automatically via GitHub Actions. In the repository **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions** if it is not already enabled.
