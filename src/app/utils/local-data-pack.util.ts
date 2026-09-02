/**
 * Layout helpers for a locally shared viewer pack:
 *   <unzipped root>/
 *     db/       Unity asset DB (index.json, characters/, …)
 *     assets/   Orbit Capture export (one subfolder per addressable)
 */

export const LOCAL_DB_DIR_NAME = 'db';
export const LOCAL_ASSETS_DIR_NAME = 'assets';

const DB_DIR_ALIASES = new Set(['db']);
const ASSETS_DIR_ALIASES = new Set(['assets', 'models', 'export']);

const DB_TOP_LEVEL_DIRS = new Set([
  'characters',
  'body-textures',
  'overlay-textures',
  'equipment',
  'tools',
  'interactions',
  'environments',
  'authored-environments',
  'audio',
  'videos',
  'meta',
]);

const DB_TOP_LEVEL_FILES = new Set([
  'index.json',
  'clothing.json',
  'medications.json',
  'waveforms.json',
  'scenarios.json',
  'tag-taxonomy.json',
  'character-metadata.json',
  'tool-metadata.json',
  'git-authorship.json',
]);

export type LocalPackKind = 'db' | 'assets' | 'other';

export interface ClassifiedPackPath {
  kind: LocalPackKind;
  /** Path inside db/ or assets/, with no leading folder name. */
  inner: string;
}

export function normalizeRelativePath(rel: string): string {
  return rel.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function firstSegment(path: string): string {
  const i = path.indexOf('/');
  return (i < 0 ? path : path.slice(0, i)).toLowerCase();
}

function restAfterFirst(path: string): string {
  const i = path.indexOf('/');
  return i < 0 ? '' : path.slice(i + 1);
}

function isDbDirName(name: string): boolean {
  return DB_DIR_ALIASES.has(name.toLowerCase());
}

function isAssetsDirName(name: string): boolean {
  return ASSETS_DIR_ALIASES.has(name.toLowerCase());
}

/** True when `path` is already inside a db tree (no wrapping zip folder). */
export function looksLikeDbContentPath(path: string): boolean {
  const normalized = normalizeRelativePath(path);
  const top = firstSegment(normalized);
  if (DB_TOP_LEVEL_FILES.has(top)) return true;
  return DB_TOP_LEVEL_DIRS.has(top);
}

/**
 * Classify a webkitdirectory relative path from a pack root, a wrapping folder,
 * or a bare `db/` pick.
 */
export function classifyPackPath(rel: string): ClassifiedPackPath {
  const path = normalizeRelativePath(rel);
  if (!path) return { kind: 'other', inner: '' };

  const parts = path.split('/').filter(Boolean);
  let start = 0;
  if (
    parts.length >= 2 &&
    !isDbDirName(parts[0]) &&
    !isAssetsDirName(parts[0]) &&
    (isDbDirName(parts[1]) || isAssetsDirName(parts[1]))
  ) {
    start = 1;
  }

  const root = parts[start] ?? '';
  const inner = parts.slice(start + 1).join('/');
  if (isDbDirName(root)) return { kind: 'db', inner };
  if (isAssetsDirName(root)) return { kind: 'assets', inner };

  const remainder = parts.slice(start).join('/');
  if (looksLikeDbContentPath(remainder)) {
    return { kind: 'db', inner: remainder };
  }
  return { kind: 'other', inner: remainder };
}

/** Keep only db-tree files, keyed by path inside db/. */
export function indexDbFiles(files: File[]): Map<string, File> {
  const byRel = new Map<string, File>();
  for (const file of files) {
    const rel =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name;
    const classified = classifyPackPath(rel);
    if (classified.kind !== 'db' || !classified.inner) continue;
    byRel.set(classified.inner, file);
  }
  return byRel;
}

async function getChildDirectory(
  parent: FileSystemDirectoryHandle,
  aliases: Set<string>,
): Promise<FileSystemDirectoryHandle | null> {
  for (const name of aliases) {
    try {
      return await parent.getDirectoryHandle(name);
    } catch {
      /* try next alias / scan */
    }
  }
  for await (const [name, handle] of entriesOf(parent)) {
    if (handle.kind === 'directory' && aliases.has(name.toLowerCase())) {
      return handle as FileSystemDirectoryHandle;
    }
  }
  return null;
}

function entriesOf(
  dir: FileSystemDirectoryHandle,
): AsyncIterableIterator<[string, FileSystemHandle]> {
  return (
    dir as unknown as {
      entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
    }
  ).entries();
}

export async function directoryHasFile(
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

export async function directoryHasChild(
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<boolean> {
  try {
    await dir.getDirectoryHandle(name);
    return true;
  } catch {
    return false;
  }
}

export async function looksLikeDbDirectory(
  dir: FileSystemDirectoryHandle,
): Promise<boolean> {
  if (await directoryHasFile(dir, 'index.json')) return true;
  return directoryHasChild(dir, 'characters');
}

export async function looksLikeAssetsDirectory(
  dir: FileSystemDirectoryHandle,
): Promise<boolean> {
  let scanned = 0;
  for await (const [, handle] of entriesOf(dir)) {
    if (handle.kind !== 'directory') continue;
    if (await directoryHasFile(handle as FileSystemDirectoryHandle, 'manifest.json')) {
      return true;
    }
    if (++scanned >= 24) break;
  }
  return false;
}

export interface LocalDataPackHandles {
  db: FileSystemDirectoryHandle | null;
  assets: FileSystemDirectoryHandle | null;
}

/**
 * Resolve `db/` and `assets/` from the folder the user picked. Accepts the zip
 * root, a bare db folder, or a bare assets/EXPORT folder.
 */
export async function resolveLocalDataPack(
  root: FileSystemDirectoryHandle,
): Promise<LocalDataPackHandles> {
  const dbChild = await getChildDirectory(root, DB_DIR_ALIASES);
  const assetsChild = await getChildDirectory(root, ASSETS_DIR_ALIASES);
  if (dbChild || assetsChild) {
    return { db: dbChild, assets: assetsChild };
  }
  if (await looksLikeDbDirectory(root)) {
    return { db: root, assets: null };
  }
  if (await looksLikeAssetsDirectory(root)) {
    return { db: null, assets: root };
  }
  return { db: null, assets: null };
}

/** Recursively collect files under a directory, keyed by slash-separated relative paths. */
export async function collectDirectoryFiles(
  dir: FileSystemDirectoryHandle,
  prefix = '',
): Promise<Map<string, File>> {
  const map = new Map<string, File>();
  for await (const [name, handle] of entriesOf(dir)) {
    const rel = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'file') {
      map.set(rel.replace(/\\/g, '/'), await (handle as FileSystemFileHandle).getFile());
    } else if (handle.kind === 'directory') {
      const nested = await collectDirectoryFiles(
        handle as FileSystemDirectoryHandle,
        rel,
      );
      for (const [key, file] of nested) map.set(key, file);
    }
  }
  return map;
}
