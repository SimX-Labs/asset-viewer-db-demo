/**
 * File-backed curated asset meta store.
 * Persists under db/meta/<assetId>/record.json + media/.
 * Scrape pipeline must never touch this tree.
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const STATUSES = new Set(['Development', 'Functional', 'Stable', 'Deprecated']);
const LEGACY_STATUSES = {
  Working: 'Functional',
  Complete: 'Stable',
};

/** @param {unknown} status */
function normalizeStatus(status) {
  if (typeof status !== 'string') return undefined;
  if (STATUSES.has(status)) return status;
  return LEGACY_STATUSES[status];
}

const ALLOWED_EXT = new Map([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
  ['video/quicktime', '.mov'],
]);

const EXT_CONTENT_TYPE = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

/** @param {unknown} raw @returns {string[]} */
function normalizeTags(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const label = item.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/**
 * @typedef {{ sub: string, name?: string, email?: string }} Author
 * @typedef {{ id: string, filename: string, contentType: string }} MediaEntry
 * @typedef {{ id: string, type: 'markdown', markdown: string }
 *   | { id: string, type: 'image', mediaId: string, alt?: string }
 *   | { id: string, type: 'video', mediaId: string, caption?: string }
 *   | { id: string, type: 'carousel', mediaIds: string[], caption?: string, slideCaptions?: Record<string, string> }} NoteBlock
 * @typedef {{ id: string, body: string, createdAt: string, author: Author }} Comment
 * @typedef {{
 *   assetId: string,
 *   assetKey?: string,
 *   type?: string,
 *   name?: string,
 *   status?: string,
 *   tags: string[],
 *   notes: NoteBlock[],
 *   media: MediaEntry[],
 *   comments: Comment[],
 *   updatedAt?: string,
 *   updatedBy?: Author,
 * }} AssetMetaRecord
 */

/**
 * @param {string} dbRoot
 */
export function createAssetMetaStore(dbRoot) {
  const metaRoot = path.join(dbRoot, 'meta');

  function ensureMetaRoot() {
    fs.mkdirSync(metaRoot, { recursive: true });
  }

  /** @param {string} assetId */
  function assetDir(assetId) {
    return path.join(metaRoot, assetId);
  }

  /** @param {string} assetId */
  function recordPath(assetId) {
    return path.join(assetDir(assetId), 'record.json');
  }

  /** @param {string} assetId */
  function mediaDir(assetId) {
    return path.join(assetDir(assetId), 'media');
  }

  function aliasesPath() {
    return path.join(metaRoot, 'aliases.json');
  }

  /** @returns {Record<string, string>} */
  function readAliases() {
    try {
      const p = aliasesPath();
      if (!fs.existsSync(p)) return {};
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
      return Object.fromEntries(
        Object.entries(raw).filter(
          ([k, v]) => typeof k === 'string' && typeof v === 'string',
        ),
      );
    } catch {
      return {};
    }
  }

  /** @param {string} assetId */
  function resolveId(assetId) {
    const aliases = readAliases();
    return aliases[assetId] ?? assetId;
  }

  /**
   * @param {unknown} raw
   * @param {string} fallbackId
   * @returns {AssetMetaRecord}
   */
  function normalize(raw, fallbackId) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const assetId =
      typeof r.assetId === 'string' && r.assetId ? r.assetId : fallbackId;
    const status = normalizeStatus(r.status);
    return {
      assetId,
      assetKey: typeof r.assetKey === 'string' ? r.assetKey : undefined,
      type: typeof r.type === 'string' ? r.type : undefined,
      name: typeof r.name === 'string' ? r.name : undefined,
      status,
      tags: normalizeTags(r.tags),
      notes: Array.isArray(r.notes) ? r.notes : [],
      media: Array.isArray(r.media) ? r.media : [],
      comments: Array.isArray(r.comments) ? r.comments : [],
      updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
      updatedBy: r.updatedBy,
    };
  }

  /** @param {string} assetId @returns {AssetMetaRecord | null} */
  function read(assetId) {
    const id = resolveId(assetId);
    const p = recordPath(id);
    if (!fs.existsSync(p)) return null;
    try {
      return normalize(JSON.parse(fs.readFileSync(p, 'utf8')), id);
    } catch (e) {
      console.warn(`  ! asset-meta read failed for ${id}: ${e.message}`);
      return null;
    }
  }

  /**
   * @param {AssetMetaRecord} record
   * @param {Author | undefined} updatedBy
   */
  function write(record, updatedBy) {
    ensureMetaRoot();
    const id = record.assetId;
    const dir = assetDir(id);
    fs.mkdirSync(dir, { recursive: true });
    const next = {
      ...record,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy ?? record.updatedBy,
    };
    fs.writeFileSync(recordPath(id), JSON.stringify(next, null, 2) + '\n');
    // Do not rewrite index.json here. That file is watched by ng serve via the
    // db link, and a write live-reloads the viewer ("Loading assets…").
    // `npm run db:index` and GET /asset-meta keep the listing current.
    return next;
  }

  /** Ensure index.json assetMeta lists this record. */
  function patchIndex(assetId) {
    const indexPath = path.join(dbRoot, 'index.json');
    if (!fs.existsSync(indexPath)) return;
    try {
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      const rel = `meta/${assetId}/record.json`;
      let changed = false;
      if (!Array.isArray(index.assetMeta)) {
        index.assetMeta = [];
        changed = true;
      }
      if (!index.assetMeta.includes(rel)) {
        index.assetMeta.push(rel);
        index.assetMeta.sort((a, b) => a.localeCompare(b));
        changed = true;
      }
      if (!index.assetMetaAliases) {
        index.assetMetaAliases = 'meta/aliases.json';
        changed = true;
      }
      if (index.meta && typeof index.meta === 'object') {
        const prev = index.meta.counts?.assetMeta;
        index.meta.counts = {
          ...(index.meta.counts ?? {}),
          assetMeta: index.assetMeta.length,
        };
        if (prev !== index.meta.counts.assetMeta) changed = true;
      }
      // Skip no-op writes — rewriting index.json live-reloads the Angular app.
      if (!changed) return;
      fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
    } catch (e) {
      console.warn(`  ! asset-meta index patch failed: ${e.message}`);
    }
  }

  /** @returns {AssetMetaRecord[]} */
  function listAll() {
    ensureMetaRoot();
    if (!fs.existsSync(metaRoot)) return [];
    const out = [];
    for (const name of fs.readdirSync(metaRoot)) {
      if (name === 'aliases.json') continue;
      const dir = path.join(metaRoot, name);
      try {
        if (!fs.statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }
      const record = read(name);
      if (record) out.push(record);
    }
    return out;
  }

  /**
   * Collect media ids referenced by note blocks.
   * @param {AssetMetaRecord} record
   */
  function referencedMediaIds(record) {
    const ids = new Set();
    for (const block of record.notes ?? []) {
      if (block?.type === 'image' && block.mediaId) ids.add(block.mediaId);
      if (block?.type === 'video' && block.mediaId) ids.add(block.mediaId);
      if (block?.type === 'carousel' && Array.isArray(block.mediaIds)) {
        for (const mid of block.mediaIds) ids.add(mid);
      }
    }
    return ids;
  }

  /**
   * Drop unreferenced media files and index rows.
   * @param {AssetMetaRecord} record
   */
  function pruneUnreferencedMedia(record) {
    const used = referencedMediaIds(record);
    const kept = [];
    const dir = mediaDir(record.assetId);
    for (const entry of record.media ?? []) {
      if (used.has(entry.id)) {
        kept.push(entry);
        continue;
      }
      const fp = path.join(dir, entry.filename);
      try {
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch {
        /* ignore */
      }
    }
    record.media = kept;
    // Also remove stray files not in the index.
    if (fs.existsSync(dir)) {
      const indexed = new Set(kept.map((m) => m.filename));
      for (const file of fs.readdirSync(dir)) {
        if (!indexed.has(file)) {
          try {
            fs.unlinkSync(path.join(dir, file));
          } catch {
            /* ignore */
          }
        }
      }
    }
  }

  /**
   * @param {string} assetId
   * @param {object} body
   * @param {Author | undefined} updatedBy
   */
  function upsert(assetId, body, updatedBy) {
    const id = resolveId(assetId);
    const existing =
      read(id) ??
      normalize(
        {
          assetId: id,
          assetKey: body?.assetKey,
          type: body?.type,
          name: body?.name,
        },
        id,
      );

    if (body?.assetKey != null) existing.assetKey = String(body.assetKey);
    if (body?.type != null) existing.type = String(body.type);
    if (body?.name != null) existing.name = String(body.name);

    if (body && Object.prototype.hasOwnProperty.call(body, 'status')) {
      if (body.status === null || body.status === '' || body.status === undefined) {
        delete existing.status;
      } else {
        const status = normalizeStatus(body.status);
        if (status) existing.status = status;
      }
    }

    if (Array.isArray(body?.notes)) {
      existing.notes = body.notes;
      pruneUnreferencedMedia(existing);
    }

    if (Array.isArray(body?.tags)) {
      existing.tags = normalizeTags(body.tags);
    }

    // Comments are only replaced when explicitly sent (avoid clobber on notes save).
    if (Array.isArray(body?.comments)) {
      existing.comments = body.comments;
    }

    return write(existing, updatedBy);
  }

  /**
   * @param {string} assetId
   * @param {{ body: string, author?: Author, assetKey?: string, type?: string, name?: string }} payload
   * @param {Author | undefined} fallbackAuthor
   */
  function addComment(assetId, payload, fallbackAuthor) {
    const id = resolveId(assetId);
    const existing =
      read(id) ??
      normalize(
        {
          assetId: id,
          assetKey: payload?.assetKey,
          type: payload?.type,
          name: payload?.name,
        },
        id,
      );
    if (payload?.assetKey) existing.assetKey = String(payload.assetKey);
    if (payload?.type) existing.type = String(payload.type);
    if (payload?.name) existing.name = String(payload.name);

    const author = payload?.author ?? fallbackAuthor ?? {
      sub: 'anonymous',
      name: 'Anonymous',
    };
    const comment = {
      id: randomUUID(),
      body: String(payload?.body ?? '').trim(),
      createdAt: new Date().toISOString(),
      author: {
        sub: String(author.sub ?? 'anonymous'),
        name: author.name ? String(author.name) : undefined,
        email: author.email ? String(author.email) : undefined,
      },
    };
    if (!comment.body) {
      throw new Error('Comment body is required.');
    }
    existing.comments = [...(existing.comments ?? []), comment];
    return write(existing, author);
  }

  /**
   * @param {string} assetId
   * @param {{ buffer: Buffer, originalname?: string, mimetype?: string }} file
   * @param {{ assetKey?: string, type?: string, name?: string }} snapshot
   * @param {Author | undefined} updatedBy
   */
  function addMedia(assetId, file, snapshot, updatedBy) {
    const id = resolveId(assetId);
    const mime = String(file?.mimetype ?? '').toLowerCase();
    let ext = ALLOWED_EXT.get(mime);
    if (!ext && file?.originalname) {
      const m = String(file.originalname)
        .toLowerCase()
        .match(/\.(jpe?g|png|webp|gif|mp4|webm|mov)$/);
      if (m) {
        ext = m[1] === 'jpeg' ? '.jpg' : `.${m[1]}`;
      }
    }
    if (!ext) {
      throw new Error(
        'Only jpeg, png, webp, gif images and mp4, webm, mov videos are allowed.',
      );
    }

    const existing =
      read(id) ??
      normalize(
        {
          assetId: id,
          assetKey: snapshot?.assetKey,
          type: snapshot?.type,
          name: snapshot?.name,
        },
        id,
      );
    if (snapshot?.assetKey) existing.assetKey = String(snapshot.assetKey);
    if (snapshot?.type) existing.type = String(snapshot.type);
    if (snapshot?.name) existing.name = String(snapshot.name);

    const mediaId = randomUUID();
    const filename = `${mediaId}${ext}`;
    const dir = mediaDir(id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), file.buffer);

    const contentType =
      mime && ALLOWED_EXT.has(mime)
        ? mime === 'image/jpg'
          ? 'image/jpeg'
          : mime
        : (EXT_CONTENT_TYPE[ext] ?? 'application/octet-stream');

    const entry = { id: mediaId, filename, contentType };
    existing.media = [...(existing.media ?? []), entry];
    const record = write(existing, updatedBy);
    return {
      id: mediaId,
      filename,
      contentType,
      url: `/db/meta/${id}/media/${filename}`,
      record,
    };
  }

  /**
   * @param {string} assetId
   * @param {string} mediaId
   * @param {Author | undefined} updatedBy
   */
  function deleteMedia(assetId, mediaId, updatedBy) {
    const id = resolveId(assetId);
    const existing = read(id);
    if (!existing) return null;

    const entry = (existing.media ?? []).find((m) => m.id === mediaId);
    if (entry) {
      const fp = path.join(mediaDir(id), entry.filename);
      try {
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch {
        /* ignore */
      }
    }

    existing.media = (existing.media ?? []).filter((m) => m.id !== mediaId);
    existing.notes = (existing.notes ?? [])
      .map((block) => {
        if (block?.type === 'image' && block.mediaId === mediaId) return null;
        if (block?.type === 'video' && block.mediaId === mediaId) return null;
        if (block?.type === 'carousel') {
          const mediaIds = (block.mediaIds ?? []).filter((mid) => mid !== mediaId);
          const slideCaptions = { ...(block.slideCaptions ?? {}) };
          delete slideCaptions[mediaId];
          return {
            ...block,
            mediaIds,
            slideCaptions:
              Object.keys(slideCaptions).length > 0 ? slideCaptions : undefined,
          };
        }
        return block;
      })
      .filter(Boolean)
      // Drop empty carousels after slide removal.
      .filter(
        (block) =>
          !(block.type === 'carousel' && !(block.mediaIds?.length > 0)),
      );

    pruneUnreferencedMedia(existing);
    return write(existing, updatedBy);
  }

  /**
   * Delete one overlay folder (record + media). Aliases are left in place.
   * @param {string} assetId
   * @returns {{ deleted: boolean, assetId: string }}
   */
  function remove(assetId) {
    const id = resolveId(assetId);
    const dir = assetDir(id);
    if (!fs.existsSync(dir)) {
      return { deleted: false, assetId: id };
    }
    fs.rmSync(dir, { recursive: true, force: true });
    return { deleted: true, assetId: id };
  }

  /**
   * Delete every overlay folder under meta/. Keeps aliases.json.
   * @returns {{ deleted: number }}
   */
  function clearAll() {
    ensureMetaRoot();
    if (!fs.existsSync(metaRoot)) return { deleted: 0 };
    let deleted = 0;
    for (const name of fs.readdirSync(metaRoot)) {
      if (name === 'aliases.json') continue;
      const dir = path.join(metaRoot, name);
      try {
        if (!fs.statSync(dir).isDirectory()) continue;
        fs.rmSync(dir, { recursive: true, force: true });
        deleted += 1;
      } catch {
        /* ignore */
      }
    }
    return { deleted };
  }

  return {
    metaRoot,
    listAll,
    get: read,
    getAliases: readAliases,
    upsert,
    addComment,
    addMedia,
    deleteMedia,
    remove,
    clearAll,
  };
}
