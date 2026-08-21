// Writes index.json into the Unity asset DB folder so the browser can
// load the per-file tree without directory listing.
//
// Usage:
//   node scripts/write-db-index.mjs [path-to-db-folder]
//
// Default: UNITY_ASSET_DB_DIR, else ../../unity-asset-documentation/db.
// When that folder is missing (GitHub Pages CI), index the db-link stub
// created by ensure-db-link.mjs instead of failing the build.

import { readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { allowMissingDb, resolveIndexRoot } from './resolve-db-root.mjs';

const dbRoot = resolve(process.argv[2] ?? resolveIndexRoot());

if (!existsSync(dbRoot)) {
  if (allowMissingDb()) {
    console.warn(
      `db folder not found: ${dbRoot}\nSkipping index (empty viewer; set UNITY_ASSET_DB_DIR to fix).`,
    );
    process.exit(0);
  }
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

/** Curated overlay: db/meta/<uuid>/record.json (never scrape-owned). */
function listAssetMeta() {
  const metaRoot = join(dbRoot, 'meta');
  if (!existsSync(metaRoot)) return [];
  return readdirSync(metaRoot)
    .filter((name) => {
      if (name === 'aliases.json') return false;
      const dir = join(metaRoot, name);
      try {
        if (!statSync(dir).isDirectory()) return false;
      } catch {
        return false;
      }
      return existsSync(join(dir, 'record.json'));
    })
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `meta/${name}/record.json`);
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
  environments: listJson('environments'),
  authoredEnvironments: listJson('authored-environments'),
  audio: listJson('audio'),
  videos: listJson('videos'),
  clothing: requireFile('clothing.json'),
  medications: requireFile('medications.json'),
  waveforms: requireFile('waveforms.json'),
  scenarios: requireFile('scenarios.json'),
  tagTaxonomy: requireFile('tag-taxonomy.json'),
  characterMetadata: requireFile('character-metadata.json'),
  toolMetadata: requireFile('tool-metadata.json'),
  gitAuthorship: requireFile('git-authorship.json'),
  // Curated overlay (scrape must never write here). Key is assetMeta — not
  // "meta", which is reserved for { source, generatedAt, counts }.
  assetMeta: listAssetMeta(),
  assetMetaAliases: requireFile('meta/aliases.json'),
};

index.meta.counts = {
  characters: index.characters.length,
  equipment: index.equipment.length,
  tools: index.tools.length,
  interactions: index.interactions.length,
  environments: index.environments.length,
  authoredEnvironments: index.authoredEnvironments.length,
  audio: index.audio.length,
  videos: index.videos.length,
  assetMeta: index.assetMeta.length,
};

const outPath = join(dbRoot, 'index.json');
writeFileSync(outPath, JSON.stringify(index, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
console.table(index.meta.counts);
