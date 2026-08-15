// Writes index.json into the Unity asset DB folder so the browser can
// load the per-file tree without directory listing.
//
// Usage:
//   node scripts/write-db-index.mjs [path-to-db-folder]
//
// Default: UNITY_ASSET_DB_DIR, else ../../unity-asset-documentation/db
// (public/db is a junction to that folder — see ensure-db-link.mjs)

import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolveDbRoot } from './resolve-db-root.mjs';

const dbRoot = resolve(process.argv[2] ?? resolveDbRoot());

if (!existsSync(dbRoot)) {
  console.error(`db folder not found: ${dbRoot}`);
  console.error(
    'Usage: node scripts/write-db-index.mjs [path-to-db-folder]\n' +
      'Or set UNITY_ASSET_DB_DIR / run npm run db:link first.',
  );
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
  interactions: listJson('interactions'),
  clothing: requireFile('clothing.json'),
  medications: requireFile('medications.json'),
  waveforms: requireFile('waveforms.json'),
  scenarios: requireFile('scenarios.json'),
  tagTaxonomy: requireFile('tag-taxonomy.json'),
  characterMetadata: requireFile('character-metadata.json'),
  toolMetadata: requireFile('tool-metadata.json'),
};

index.meta.counts = {
  characters: index.characters.length,
  equipment: index.equipment.length,
  tools: index.tools.length,
  interactions: index.interactions.length,
};

const outPath = join(dbRoot, 'index.json');
writeFileSync(outPath, JSON.stringify(index, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
console.table(index.meta.counts);
