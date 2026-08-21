/**
 * Resolve the filesystem path to the Unity asset DB folder.
 *
 * Priority:
 *   1. UNITY_ASSET_DB_DIR env var (absolute or relative to cwd)
 *   2. Default sibling checkout: ../../unity-asset-documentation/db
 *      (asset-viewer-db lives under SimX/Custom/)
 *
 * Later this same folder layout will be hosted on S3; the Angular app's
 * UNITY_DB_ROOT constant is the URL side of that switch.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** asset-viewer-db project root (parent of scripts/). */
export const projectRoot = path.resolve(__dirname, '..');

/** Local junction/stub Angular copies to /db. */
export const dbLinkPath = path.join(projectRoot, 'db-link');

/** Default local path until S3 is wired up. */
export const DEFAULT_UNITY_ASSET_DB_DIR = path.resolve(
  projectRoot,
  '../../unity-asset-documentation/db',
);

/** GitHub Pages / CI has no sibling unity-asset-documentation checkout. */
export function allowMissingDb() {
  return process.env.ALLOW_MISSING_DB === '1' || process.env.CI === 'true';
}

/**
 * @param {string} [override] optional CLI / caller override
 * @returns {string} absolute path
 */
export function resolveDbRoot(override) {
  const fromEnv = process.env.UNITY_ASSET_DB_DIR?.trim();
  const raw = override?.trim() || fromEnv || DEFAULT_UNITY_ASSET_DB_DIR;
  return path.resolve(raw);
}

/**
 * Folder to write index.json into: the real DB if present, else the db-link
 * stub created by ensure-db-link.mjs when the sibling repo is missing.
 *
 * @param {string} [override]
 * @returns {string}
 */
export function resolveIndexRoot(override) {
  const primary = resolveDbRoot(override);
  if (fs.existsSync(primary)) return primary;
  if (fs.existsSync(dbLinkPath)) return dbLinkPath;
  return primary;
}
