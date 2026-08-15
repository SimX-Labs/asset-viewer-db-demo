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

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** asset-viewer-db project root (parent of scripts/). */
export const projectRoot = path.resolve(__dirname, '..');

/** Default local path until S3 is wired up. */
export const DEFAULT_UNITY_ASSET_DB_DIR = path.resolve(
  projectRoot,
  '../../unity-asset-documentation/db',
);

/**
 * @param {string} [override] optional CLI / caller override
 * @returns {string} absolute path
 */
export function resolveDbRoot(override) {
  const fromEnv = process.env.UNITY_ASSET_DB_DIR?.trim();
  const raw = override?.trim() || fromEnv || DEFAULT_UNITY_ASSET_DB_DIR;
  return path.resolve(raw);
}
