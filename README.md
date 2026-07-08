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

Open http://localhost:4200

## Build

```bash
npm run build          # production build
npm run build:pages    # GitHub Pages build (base href /asset-viewer-db-demo/)
```

## Deployment

Pushes to `main` deploy automatically via GitHub Actions. In the repository **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions** if it is not already enabled.
