/**
 * Ensure public/db is a junction/symlink to the external Unity asset DB folder
 * (unity-asset-documentation/db by default, or UNITY_ASSET_DB_DIR).
 *
 * The folder is gitignored so the repo stays free of db JSON. Replace the
 * target path (or later serve UNITY_DB_ROOT from S3) when the bucket is ready.
 *
 * Usage:
 *   node scripts/ensure-db-link.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_UNITY_ASSET_DB_DIR,
  projectRoot,
  resolveDbRoot,
} from './resolve-db-root.mjs';

const linkPath = path.join(projectRoot, 'public', 'db');
const target = resolveDbRoot();
const allowMissing =
  process.env.ALLOW_MISSING_DB === '1' || process.env.CI === 'true';

function isLink(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function removeLinkOrEmptyStub(p) {
  if (!fs.existsSync(p) && !isLink(p)) return;
  const stat = fs.lstatSync(p);
  if (stat.isSymbolicLink()) {
    fs.unlinkSync(p);
    return;
  }
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(p);
    if (entries.length === 0) {
      fs.rmdirSync(p);
      return;
    }
    throw new Error(
      `${p} is a real directory with ${entries.length} entries. ` +
        `Delete or move it before linking (it should not live in this repo).`,
    );
  }
  fs.unlinkSync(p);
}

function writeEmptyIndex(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const index = {
    meta: {
      source: 'empty-stub',
      generatedAt: new Date().toISOString(),
      counts: {
        characters: 0,
        equipment: 0,
        tools: 0,
        interactions: 0,
      },
    },
    characters: [],
    equipment: [],
    tools: [],
    interactions: [],
    clothing: 'clothing.json',
    medications: 'medications.json',
    waveforms: 'waveforms.json',
    scenarios: 'scenarios.json',
    tagTaxonomy: 'tag-taxonomy.json',
    characterMetadata: 'character-metadata.json',
    toolMetadata: 'tool-metadata.json',
  };
  fs.writeFileSync(
    path.join(dir, 'index.json'),
    JSON.stringify(index, null, 2) + '\n',
  );
}

if (!fs.existsSync(target)) {
  if (allowMissing) {
    console.warn(
      `Unity asset DB not found at ${target}\n` +
        `Creating empty public/db stub (set UNITY_ASSET_DB_DIR to fix).`,
    );
    try {
      removeLinkOrEmptyStub(linkPath);
    } catch {
      /* stub may already exist */
    }
    if (isLink(linkPath)) fs.unlinkSync(linkPath);
    else if (fs.existsSync(linkPath)) {
      /* keep existing real dir in CI edge cases */
    } else {
      writeEmptyIndex(linkPath);
    }
    process.exit(0);
  }
  console.error(`Unity asset DB folder not found: ${target}`);
  console.error(
    `Set UNITY_ASSET_DB_DIR, or clone unity-asset-documentation next to SimX/Custom ` +
      `(default: ${DEFAULT_UNITY_ASSET_DB_DIR}).`,
  );
  process.exit(1);
}

try {
  if (isLink(linkPath)) {
    const current = fs.readlinkSync(linkPath);
    const resolvedCurrent = path.resolve(path.dirname(linkPath), current);
    if (path.resolve(resolvedCurrent) === path.resolve(target)) {
      console.log(`public/db already linked → ${target}`);
      process.exit(0);
    }
    fs.unlinkSync(linkPath);
  } else if (fs.existsSync(linkPath)) {
    removeLinkOrEmptyStub(linkPath);
  }
} catch (err) {
  console.error(String(err.message || err));
  process.exit(1);
}

fs.mkdirSync(path.dirname(linkPath), { recursive: true });
const linkType = process.platform === 'win32' ? 'junction' : 'dir';
fs.symlinkSync(target, linkPath, linkType);
console.log(`Linked public/db → ${target} (${linkType})`);
