// Consolidates the "database-shaped JSON" graph (the unity-asset-documentation `db/` folder)
// into a single bundle that the app can fetch at runtime.
//
// Usage:
//   node scripts/build-unity-db.mjs <path-to-db-folder> [outFile]
//
// Default outFile: public/unity-asset-db.json
//
// The db/ folder layout (see unity-asset-documentation):
//   characters/<assetKey>.<8hex>.json   one file per character
//   equipment/<assetKey>.<8hex>.json    one file per equipment row
//   tools/<assetKey>.<8hex>.json        one file per tool / kit / group / vessel
//   clothing.json                       array of clothing rows
//   character-metadata.json             array of patient script keys
//   tool-metadata.json                  array of shared tool keys

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dbRoot = process.argv[2];
const outFile = resolve(process.argv[3] ?? 'public/unity-asset-db.json');

if (!dbRoot || !existsSync(dbRoot)) {
  console.error('Usage: node scripts/build-unity-db.mjs <path-to-db-folder> [outFile]');
  console.error(`db folder not found: ${dbRoot}`);
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readDir(sub) {
  const dir = join(dbRoot, sub);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .map((f) => {
      try {
        return readJson(join(dir, f));
      } catch (e) {
        console.warn(`  ! skipped ${sub}/${f}: ${e.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

function readArray(file) {
  const path = join(dbRoot, file);
  if (!existsSync(path)) return [];
  const data = readJson(path);
  return Array.isArray(data) ? data : [];
}

const bundle = {
  meta: {
    source: 'unity-asset-documentation/db',
    generatedAt: new Date().toISOString(),
  },
  characters: readDir('characters'),
  equipment: readDir('equipment'),
  tools: readDir('tools'),
  clothing: readArray('clothing.json'),
  characterMetadata: readArray('character-metadata.json'),
  toolMetadata: readArray('tool-metadata.json'),
};

bundle.meta.counts = {
  characters: bundle.characters.length,
  equipment: bundle.equipment.length,
  tools: bundle.tools.length,
  clothing: bundle.clothing.length,
  characterMetadata: bundle.characterMetadata.length,
  toolMetadata: bundle.toolMetadata.length,
};

writeFileSync(outFile, JSON.stringify(bundle));
console.log(`Wrote ${outFile}`);
console.table(bundle.meta.counts);
