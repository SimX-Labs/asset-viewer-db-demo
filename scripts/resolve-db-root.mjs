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

/** Unity client checkout used to preview BodyTexture / OverlayTexture albedos. */
export const DEFAULT_UNITY_CLIENT_ROOT = path.resolve(
  projectRoot,
  '../../unity-client-alt',
);

/** Live Orbit Capture export (tools + characters + body/overlay textures). */
export const DEFAULT_ORBIT_CAPTURES_EXPORT = path.resolve(
  projectRoot,
  '../../unity-env-authoring/OrbitCaptures/EXPORT',
);

/** Stale snapshot copied into this repo; tools were copied, newer client captures were not. */
export const FALLBACK_ORBIT_CAPTURES_DIR = path.join(projectRoot, 'public/models');

/** Character / body / overlay captures from the Unity client (no tools). */
export const DEFAULT_UNITY_CLIENT_ORBIT_DIR = path.resolve(
  projectRoot,
  '../../unity-client/OrbitCaptures',
);

/**
 * @param {string} [override]
 * @returns {string} absolute path to the Unity client repo root
 */
export function resolveUnityClientRoot(override) {
  const fromEnv = process.env.UNITY_CLIENT_ROOT?.trim();
  const raw = override?.trim() || fromEnv || DEFAULT_UNITY_CLIENT_ROOT;
  return path.resolve(raw);
}

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
 * Orbit Capture folder served at /models.
 *
 * Priority:
 *   1. override argument
 *   2. ORBIT_CAPTURES_DIR env var
 *   3. Sibling unity-env-authoring/OrbitCaptures/EXPORT when it exists
 *   4. This repo's public/models snapshot
 *
 * @param {string} [override]
 * @returns {string} absolute path
 */
export function resolveOrbitCapturesDir(override) {
  const fromEnv = process.env.ORBIT_CAPTURES_DIR?.trim();
  const raw = override?.trim() || fromEnv;
  if (raw) return path.resolve(raw);
  if (fs.existsSync(DEFAULT_ORBIT_CAPTURES_EXPORT)) {
    return DEFAULT_ORBIT_CAPTURES_EXPORT;
  }
  return FALLBACK_ORBIT_CAPTURES_DIR;
}

/**
 * Known sibling folders the Settings / Orbit UI can switch between.
 *
 * @returns {{ id: string, label: string, dir: string, hint: string }[]}
 */
export function orbitCaptureSuggestions() {
  return [
    {
      id: 'export',
      label: 'Unity env-authoring export',
      dir: DEFAULT_ORBIT_CAPTURES_EXPORT,
      hint: 'Live OrbitCaptures/EXPORT — tools, characters, body textures, and overlays.',
    },
    {
      id: 'public',
      label: 'Viewer public/models copy',
      dir: FALLBACK_ORBIT_CAPTURES_DIR,
      hint: 'Older snapshot in this repo. Tools were copied here; newer client character captures were not.',
    },
    {
      id: 'client',
      label: 'Unity client captures',
      dir: DEFAULT_UNITY_CLIENT_ORBIT_DIR,
      hint: 'Characters / body / overlay only — tool models are not in this folder.',
    },
  ];
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
