// Writes public/db/index.json — a manifest of relative paths so the browser can
// load the per-file Unity asset DB without directory listing.
//
// Usage:
//   node scripts/write-db-index.mjs [path-to-db-folder]
//
// Default db folder: public/db
//
// Layout (see unity-asset-documentation):
//   characters/<assetKey>.<8hex>.json
//   equipment/<assetKey>.<8hex>.json
//   tools/<assetKey>.<8hex>.json
//   clothing.json
//   character-metadata.json
//   tool-metadata.json
//   index.json                 ← written by this script

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dbRoot = resolve(process.argv[2] ?? 'public/db');

if (!existsSync(dbRoot)) {
  console.error(`db folder not found: ${dbRoot}`);
  console.error('Usage: node scripts/write-db-index.mjs [path-to-db-folder]');
  process.exit(1);
}

function listJson(sub) {
  const dir = join(dbRoot, sub);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
    .map((f) => `${sub}/${f}`);
}

function requireFile(name) {
  const path = join(dbRoot, name);
  if (!existsSync(path)) {
    console.warn(`  ! missing ${name} (index will still reference it)`);
  }
  return name;
}

const index = {
  meta: {
    source: 'unity-asset-documentation/db',
    generatedAt: new Date().toISOString(),
  },
  characters: listJson('characters'),
  equipment: listJson('equipment'),
  tools: listJson('tools'),
  clothing: requireFile('clothing.json'),
  characterMetadata: requireFile('character-metadata.json'),
  toolMetadata: requireFile('tool-metadata.json'),
};

index.meta.counts = {
  characters: index.characters.length,
  equipment: index.equipment.length,
  tools: index.tools.length,
};

const outPath = join(dbRoot, 'index.json');
writeFileSync(outPath, JSON.stringify(index, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
console.table(index.meta.counts);
