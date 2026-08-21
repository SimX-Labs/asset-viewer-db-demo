/**
 * Curated per-asset overlay (status, rich notes, comments).
 * Lives under db/meta/<assetId>/ — never mixed into scraped row JSON.
 */

export type AssetMetaStatus =
  | 'Development'
  | 'Functional'
  | 'Stable'
  | 'Deprecated';

export const ASSET_META_STATUSES: AssetMetaStatus[] = [
  'Development',
  'Functional',
  'Stable',
  'Deprecated',
];

/** Older overlay values rewritten on load. */
const LEGACY_ASSET_META_STATUSES: Record<string, AssetMetaStatus> = {
  Working: 'Functional',
  Complete: 'Stable',
};

export function isAssetMetaStatus(value: unknown): value is AssetMetaStatus {
  return (
    typeof value === 'string' &&
    (ASSET_META_STATUSES as readonly string[]).includes(value)
  );
}

export function normalizeAssetMetaStatus(
  value: unknown,
): AssetMetaStatus | undefined {
  if (isAssetMetaStatus(value)) return value;
  if (typeof value === 'string' && value in LEGACY_ASSET_META_STATUSES) {
    return LEGACY_ASSET_META_STATUSES[value];
  }
  return undefined;
}

export interface AssetMetaAuthor {
  sub: string;
  name?: string;
  email?: string;
}

export interface AssetMetaMediaEntry {
  id: string;
  filename: string;
  contentType: string;
}

export interface AssetMetaMarkdownBlock {
  id: string;
  type: 'markdown';
  markdown: string;
}

export interface AssetMetaImageBlock {
  id: string;
  type: 'image';
  mediaId: string;
  alt?: string;
}

export interface AssetMetaVideoBlock {
  id: string;
  type: 'video';
  mediaId: string;
  caption?: string;
}

export interface AssetMetaCarouselBlock {
  id: string;
  type: 'carousel';
  mediaIds: string[];
  /** Legacy carousel-wide caption; used when no per-slide caption exists. */
  caption?: string;
  /** Caption keyed by media id. */
  slideCaptions?: Record<string, string>;
}

export type AssetMetaNoteBlock =
  | AssetMetaMarkdownBlock
  | AssetMetaImageBlock
  | AssetMetaVideoBlock
  | AssetMetaCarouselBlock;

export interface AssetMetaComment {
  id: string;
  body: string;
  createdAt: string;
  author: AssetMetaAuthor;
}

export interface AssetMetaRecord {
  assetId: string;
  assetKey?: string;
  type?: string;
  name?: string;
  status?: AssetMetaStatus;
  /** Authored labels stored on the overlay — not mixed into the scrape. */
  tags: string[];
  notes: AssetMetaNoteBlock[];
  media: AssetMetaMediaEntry[];
  comments: AssetMetaComment[];
  updatedAt?: string;
  updatedBy?: AssetMetaAuthor;
}

/** oldId → newId after an addressable/seed rename. */
export type AssetMetaAliases = Record<string, string>;

export const ASSET_META_DIR = 'meta';
export const ASSET_META_RECORD_FILE = 'record.json';
export const ASSET_META_ALIASES_FILE = 'meta/aliases.json';
export const ASSET_META_MEDIA_DIR = 'media';

export function normalizeAssetMetaTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
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

export function emptyAssetMetaRecord(
  assetId: string,
  snapshot?: { assetKey?: string; type?: string; name?: string },
): AssetMetaRecord {
  return {
    assetId,
    assetKey: snapshot?.assetKey,
    type: snapshot?.type,
    name: snapshot?.name,
    tags: [],
    notes: [],
    media: [],
    comments: [],
  };
}

/** True when the overlay has any authored status, tags, notes, media, or comments. */
export function assetMetaRecordHasContent(
  record: AssetMetaRecord | null | undefined,
): boolean {
  if (!record) return false;
  return (
    !!record.status ||
    (record.tags?.length ?? 0) > 0 ||
    (record.notes?.length ?? 0) > 0 ||
    (record.comments?.length ?? 0) > 0 ||
    (record.media?.length ?? 0) > 0
  );
}

export function normalizeAssetMetaRecord(
  raw: unknown,
  fallbackId?: string,
): AssetMetaRecord {
  const r = (raw ?? {}) as Partial<AssetMetaRecord>;
  const assetId =
    typeof r.assetId === 'string' && r.assetId
      ? r.assetId
      : (fallbackId ?? '');
  return {
    assetId,
    assetKey: typeof r.assetKey === 'string' ? r.assetKey : undefined,
    type: typeof r.type === 'string' ? r.type : undefined,
    name: typeof r.name === 'string' ? r.name : undefined,
    status: normalizeAssetMetaStatus(r.status),
    tags: normalizeAssetMetaTags(r.tags),
    notes: Array.isArray(r.notes) ? (r.notes as AssetMetaNoteBlock[]) : [],
    media: Array.isArray(r.media) ? r.media : [],
    comments: Array.isArray(r.comments) ? (r.comments as AssetMetaComment[]) : [],
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
    updatedBy: r.updatedBy,
  };
}

export function mediaUrl(
  dbRoot: string,
  assetId: string,
  filename: string,
): string {
  const base = dbRoot.replace(/\/+$/, '');
  return `${base}/${ASSET_META_DIR}/${assetId}/${ASSET_META_MEDIA_DIR}/${filename}`;
}

export function resolveMediaFilename(
  record: AssetMetaRecord,
  mediaId: string,
): string | null {
  const entry = record.media?.find((m) => m.id === mediaId);
  return entry?.filename ?? null;
}

export function collectNoteMediaIds(
  notes: AssetMetaNoteBlock[] | null | undefined,
): Set<string> {
  const ids = new Set<string>();
  for (const block of notes ?? []) {
    if (block.type === 'image' && block.mediaId) ids.add(block.mediaId);
    if (block.type === 'video' && block.mediaId) ids.add(block.mediaId);
    if (block.type === 'carousel') {
      for (const id of block.mediaIds ?? []) ids.add(id);
    }
  }
  return ids;
}

export function collectReferencedMediaIds(record: AssetMetaRecord): Set<string> {
  return collectNoteMediaIds(record.notes);
}

/** Local, unsaved overlay for status / tags / notes on one asset. */
export interface AssetMetaEditDraft {
  status?: AssetMetaStatus | null;
  tags?: string[];
  notes?: AssetMetaNoteBlock[];
  pendingUploads: string[];
  editingNoteId?: string | null;
}

export function emptyAssetMetaEditDraft(): AssetMetaEditDraft {
  return { pendingUploads: [] };
}

export function sameAssetMetaStatus(
  a?: AssetMetaStatus | null,
  b?: AssetMetaStatus | null,
): boolean {
  return (a ?? null) === (b ?? null);
}

export function sameAssetMetaTags(a: string[] = [], b: string[] = []): boolean {
  if (a.length !== b.length) return false;
  return a.every((tag, i) => tag === b[i]);
}

export function sameAssetMetaNotes(
  a: AssetMetaNoteBlock[] = [],
  b: AssetMetaNoteBlock[] = [],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** True when the draft differs from the saved record or has leftover uploads. */
export function assetMetaDraftIsDirty(
  saved: AssetMetaRecord | null | undefined,
  draft: AssetMetaEditDraft | null | undefined,
): boolean {
  if (!draft) return false;
  if ((draft.pendingUploads?.length ?? 0) > 0) return true;
  if (
    draft.status !== undefined &&
    !sameAssetMetaStatus(saved?.status, draft.status)
  ) {
    return true;
  }
  if (draft.tags !== undefined && !sameAssetMetaTags(saved?.tags, draft.tags)) {
    return true;
  }
  if (
    draft.notes !== undefined &&
    !sameAssetMetaNotes(saved?.notes, draft.notes)
  ) {
    return true;
  }
  return false;
}

/** Caption for the slide at `index`, preferring a per-image caption. */
export function carouselSlideCaption(
  block: AssetMetaCarouselBlock,
  index: number,
): string {
  const id = block.mediaIds?.[index];
  const perSlide = (id && block.slideCaptions?.[id]) || '';
  if (perSlide.trim()) return perSlide.trim();
  const hasAnySlideCaption = Object.values(block.slideCaptions ?? {}).some((c) =>
    String(c ?? '').trim(),
  );
  if (hasAnySlideCaption) return '';
  return (block.caption ?? '').trim();
}
