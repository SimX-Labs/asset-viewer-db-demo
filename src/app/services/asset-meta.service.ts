import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  ASSET_META_ALIASES_FILE,
  AssetMetaAliases,
  AssetMetaAuthor,
  AssetMetaEditDraft,
  AssetMetaNoteBlock,
  AssetMetaRecord,
  AssetMetaStatus,
  assetMetaDraftIsDirty,
  collectNoteMediaIds,
  emptyAssetMetaEditDraft,
  emptyAssetMetaRecord,
  mediaUrl,
  normalizeAssetMetaRecord,
  resolveMediaFilename,
} from '../models/asset-meta.models';
import { UNITY_DB_ROOT, UnityDbIndex } from '../models/unity-asset.models';
import { environment } from '../environment';

function normalizeRecord(raw: unknown, fallbackId?: string): AssetMetaRecord {
  return normalizeAssetMetaRecord(raw, fallbackId);
}

@Injectable({ providedIn: 'root' })
export class AssetMetaService {
  private readonly http = inject(HttpClient);
  private apiBase = environment.apiBaseUrl;
  private dbRoot = UNITY_DB_ROOT;

  /** assetId → record (after alias resolution). */
  readonly records = signal<Record<string, AssetMetaRecord>>({});
  /** assetId → unsaved status / tag / note overlay. */
  readonly drafts = signal<Record<string, AssetMetaEditDraft>>({});
  readonly aliases = signal<AssetMetaAliases>({});
  readonly loaded = signal(false);
  readonly savingDraft = signal(false);
  readonly draftError = signal<string | null>(null);

  readonly dirtyIds = computed(() => {
    const drafts = this.drafts();
    void this.records();
    const ids = new Set<string>();
    for (const [id, draft] of Object.entries(drafts)) {
      if (assetMetaDraftIsDirty(this.recordFor(id), draft)) ids.add(id);
    }
    return ids;
  });

  /**
   * Privilege hook for later RBAC. Today: any authenticated caller may edit.
   * UI uses this so a future permission check can wrap it without refactor.
   */
  readonly canEditMeta = signal(false);

  recordFor(assetId: string): AssetMetaRecord | null {
    const map = this.records();
    const resolved = this.resolvedId(assetId);
    return map[resolved] ?? map[assetId] ?? null;
  }

  draftFor(assetId: string): AssetMetaEditDraft | null {
    const drafts = this.drafts();
    const resolved = this.resolvedId(assetId);
    return drafts[resolved] ?? drafts[assetId] ?? null;
  }

  isDirty(assetId: string): boolean {
    const dirty = this.dirtyIds();
    return dirty.has(this.resolvedId(assetId)) || dirty.has(assetId);
  }

  effectiveStatus(assetId: string): AssetMetaStatus | undefined {
    const draft = this.draftFor(assetId);
    if (draft?.status !== undefined) return draft.status ?? undefined;
    return this.recordFor(assetId)?.status;
  }

  effectiveTags(assetId: string): string[] {
    const draft = this.draftFor(assetId);
    if (draft?.tags) return draft.tags;
    return this.recordFor(assetId)?.tags ?? [];
  }

  effectiveNotes(assetId: string): AssetMetaNoteBlock[] {
    const draft = this.draftFor(assetId);
    if (draft?.notes) return draft.notes;
    return this.recordFor(assetId)?.notes ?? [];
  }

  setDraftStatus(assetId: string, status: AssetMetaStatus | null): void {
    this.updateDraft(assetId, (draft) => ({ ...draft, status }));
  }

  setDraftTags(assetId: string, tags: string[]): void {
    this.updateDraft(assetId, (draft) => ({ ...draft, tags: [...tags] }));
  }

  setDraftNotes(assetId: string, notes: AssetMetaNoteBlock[]): void {
    this.updateDraft(assetId, (draft) => ({
      ...draft,
      notes: structuredClone(notes),
    }));
  }

  setDraftEditingNote(assetId: string, noteId: string | null): void {
    this.updateDraft(assetId, (draft) => ({ ...draft, editingNoteId: noteId }));
  }

  beginNewNote(assetId: string, block: AssetMetaNoteBlock): void {
    this.updateDraft(assetId, (draft) => ({
      ...draft,
      notes: [...this.notesFrom(draft, assetId), structuredClone(block)],
      editingNoteId: block.id,
    }));
  }

  patchDraftNote(
    assetId: string,
    noteId: string,
    updater: (block: AssetMetaNoteBlock) => AssetMetaNoteBlock,
  ): void {
    this.updateDraft(assetId, (draft) => {
      const notes = structuredClone(this.notesFrom(draft, assetId));
      const index = notes.findIndex((block) => block.id === noteId);
      if (index === -1) return draft;
      notes[index] = updater(notes[index]);
      return { ...draft, notes };
    });
  }

  removeDraftNote(assetId: string, noteId: string): void {
    this.updateDraft(assetId, (draft) => ({
      ...draft,
      notes: this.notesFrom(draft, assetId).filter((block) => block.id !== noteId),
      editingNoteId: draft.editingNoteId === noteId ? null : draft.editingNoteId,
    }));
  }

  addPendingUpload(assetId: string, mediaId: string): void {
    this.updateDraft(assetId, (draft) => ({
      ...draft,
      pendingUploads: [...draft.pendingUploads, mediaId],
    }));
  }

  async commitDraft(
    assetId: string,
    snapshot?: { assetKey?: string; type?: string; name?: string },
  ): Promise<AssetMetaRecord | null> {
    const draft = this.draftFor(assetId);
    if (!draft || !this.isDirty(assetId) || this.savingDraft()) {
      return this.recordFor(assetId);
    }
    this.savingDraft.set(true);
    this.draftError.set(null);
    const notes = draft.notes ?? this.recordFor(assetId)?.notes ?? [];
    const referenced = collectNoteMediaIds(notes);
    const unused = draft.pendingUploads.filter((id) => !referenced.has(id));
    try {
      const saved = await this.saveRecord(assetId, {
        ...snapshot,
        ...(draft.status !== undefined ? { status: draft.status } : {}),
        ...(draft.tags !== undefined ? { tags: draft.tags } : {}),
        ...(draft.notes !== undefined ? { notes: draft.notes } : {}),
      });
      this.clearDraft(assetId);
      await this.deleteUploads(assetId, unused);
      return saved;
    } catch (e: unknown) {
      this.draftError.set(
        e instanceof Error ? e.message : 'Failed to save changes.',
      );
      throw e;
    } finally {
      this.savingDraft.set(false);
    }
  }

  async discardDraft(assetId: string): Promise<void> {
    if (this.savingDraft()) return;
    const draft = this.draftFor(assetId);
    this.savingDraft.set(true);
    this.draftError.set(null);
    try {
      this.clearDraft(assetId);
      if (draft?.pendingUploads.length) {
        await this.deleteUploads(assetId, draft.pendingUploads);
      }
    } finally {
      this.savingDraft.set(false);
    }
  }

  clearDrafts(): void {
    this.drafts.set({});
    this.savingDraft.set(false);
    this.draftError.set(null);
  }

  mediaSrc(assetId: string, mediaId: string): string | null {
    const record = this.recordFor(assetId);
    if (!record) return null;
    const filename = resolveMediaFilename(record, mediaId);
    if (!filename) return null;
    return mediaUrl(this.dbRoot, record.assetId, filename);
  }

  /**
   * Load curated overlay listed in index.json (assetMeta paths + aliases).
   * Does not mix into scraped row JSON.
   */
  async loadFromIndex(index: UnityDbIndex, dbRoot = UNITY_DB_ROOT): Promise<void> {
    this.dbRoot = dbRoot.replace(/\/+$/, '');
    const base = this.dbRoot;
    const paths = Array.isArray(index.assetMeta) ? index.assetMeta : [];
    const aliasPath = index.assetMetaAliases ?? ASSET_META_ALIASES_FILE;

    const [aliasRaw, remote, ...rows] = await Promise.all([
      firstValueFrom(
        this.http.get<AssetMetaAliases>(`${base}/${aliasPath}`),
      ).catch(() => ({}) as AssetMetaAliases),
      firstValueFrom(
        this.http.get<{ records?: unknown[]; aliases?: AssetMetaAliases }>(
          `${this.apiBase}/asset-meta`,
        ),
      ).catch(() => null),
      ...paths.map((rel) =>
        firstValueFrom(this.http.get<unknown>(`${base}/${rel}`)).catch(
          () => null,
        ),
      ),
    ]);

    const aliases: AssetMetaAliases =
      aliasRaw && typeof aliasRaw === 'object' && !Array.isArray(aliasRaw)
        ? Object.fromEntries(
            Object.entries(aliasRaw).filter(
              ([k, v]) => typeof k === 'string' && typeof v === 'string',
            ),
          )
        : {};
    if (remote?.aliases && typeof remote.aliases === 'object') {
      for (const [oldId, newId] of Object.entries(remote.aliases)) {
        if (typeof oldId === 'string' && typeof newId === 'string') {
          aliases[oldId] = newId;
        }
      }
    }

    const map: Record<string, AssetMetaRecord> = {};
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      if (!raw) continue;
      const pathId = paths[i]?.match(/^meta\/([^/]+)\//)?.[1];
      const record = normalizeRecord(raw, pathId);
      if (!record.assetId) continue;
      map[record.assetId] = record;
    }
    // API listing includes records created after the last index.json write
    // (comments / first-time overlay) without requiring a live-reload.
    for (const raw of remote?.records ?? []) {
      const record = normalizeRecord(raw);
      if (!record.assetId) continue;
      map[record.assetId] = record;
    }

    for (const [oldId, newId] of Object.entries(aliases)) {
      if (map[newId]) map[oldId] = map[newId];
    }

    this.aliases.set(aliases);
    this.records.set(map);
    this.loaded.set(true);
  }

  clear(): void {
    this.records.set({});
    this.aliases.set({});
    this.loaded.set(false);
    this.clearDrafts();
  }

  setCanEdit(can: boolean): void {
    this.canEditMeta.set(can);
  }

  private upsertLocal(record: AssetMetaRecord): void {
    const next = { ...this.records() };
    next[record.assetId] = record;
    for (const [oldId, newId] of Object.entries(this.aliases())) {
      if (newId === record.assetId) next[oldId] = record;
    }
    this.records.set(next);
  }

  tagsFor(assetId: string): string[] {
    return this.effectiveTags(assetId);
  }

  /** Saved + draft overlay tags across every loaded record. */
  overlayTagLabels(): string[] {
    void this.drafts();
    const seen = new Set<string>();
    const out: string[] = [];
    for (const record of Object.values(this.records())) {
      for (const label of this.effectiveTags(record.assetId)) {
        const key = label.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(label.trim());
      }
    }
    return out;
  }

  private resolvedId(assetId: string): string {
    return this.aliases()[assetId] ?? assetId;
  }

  private notesFrom(draft: AssetMetaEditDraft, assetId: string): AssetMetaNoteBlock[] {
    return draft.notes ?? structuredClone(this.recordFor(assetId)?.notes ?? []);
  }

  private updateDraft(
    assetId: string,
    fn: (draft: AssetMetaEditDraft) => AssetMetaEditDraft,
  ): void {
    const id = this.resolvedId(assetId);
    const current = this.draftFor(assetId) ?? emptyAssetMetaEditDraft();
    const next = { ...this.drafts(), [id]: fn(current) };
    this.drafts.set(next);
  }

  private clearDraft(assetId: string): void {
    const id = this.resolvedId(assetId);
    const next = { ...this.drafts() };
    delete next[id];
    delete next[assetId];
    this.drafts.set(next);
  }

  private async deleteUploads(assetId: string, ids: string[]): Promise<void> {
    for (const id of ids) {
      try {
        await this.deleteMedia(assetId, id);
      } catch {
        /* file may already be pruned by a successful notes save */
      }
    }
  }

  private dropLocal(assetId: string): void {
    const id = this.resolvedId(assetId);
    const next = { ...this.records() };
    delete next[id];
    delete next[assetId];
    for (const [oldId, newId] of Object.entries(this.aliases())) {
      if (newId === id) delete next[oldId];
    }
    this.records.set(next);
    this.clearDraft(assetId);
  }

  /** Wipe the saved overlay for one asset (status, tags, notes, comments, media). */
  async clearRecord(assetId: string): Promise<void> {
    if (this.savingDraft()) return;
    this.savingDraft.set(true);
    this.draftError.set(null);
    try {
      await firstValueFrom(
        this.http.delete(
          `${this.apiBase}/asset-meta/${encodeURIComponent(assetId)}`,
        ),
      );
      this.dropLocal(assetId);
    } catch (e: unknown) {
      if (e instanceof HttpErrorResponse && e.status === 404) {
        this.dropLocal(assetId);
        return;
      }
      this.draftError.set(
        e instanceof Error ? e.message : 'Failed to clear metadata.',
      );
      throw e;
    } finally {
      this.savingDraft.set(false);
    }
  }

  /** Wipe every overlay folder. Keeps ID aliases. */
  async clearAllRecords(): Promise<{ deleted: number }> {
    if (this.savingDraft()) return { deleted: 0 };
    this.savingDraft.set(true);
    this.draftError.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<{ deleted: number }>(
          `${this.apiBase}/asset-meta/clear-all`,
          {},
        ),
      );
      this.records.set({});
      this.clearDrafts();
      return { deleted: result?.deleted ?? 0 };
    } catch (e: unknown) {
      this.draftError.set(
        e instanceof Error ? e.message : 'Failed to clear metadata.',
      );
      throw e;
    } finally {
      this.savingDraft.set(false);
    }
  }

  async saveRecord(
    assetId: string,
    patch: {
      status?: AssetMetaStatus | null;
      notes?: AssetMetaNoteBlock[];
      tags?: string[];
      assetKey?: string;
      type?: string;
      name?: string;
    },
  ): Promise<AssetMetaRecord> {
    const body: Record<string, unknown> = {
      assetKey: patch.assetKey,
      type: patch.type,
      name: patch.name,
    };
    if (patch.status !== undefined) {
      body['status'] = patch.status === null ? null : patch.status;
    }
    if (patch.notes !== undefined) body['notes'] = patch.notes;
    if (patch.tags !== undefined) body['tags'] = patch.tags;
    const saved = await firstValueFrom(
      this.http.put<AssetMetaRecord>(
        `${this.apiBase}/asset-meta/${encodeURIComponent(assetId)}`,
        body,
      ),
    );
    const record = normalizeRecord(saved, assetId);
    this.upsertLocal(record);
    return record;
  }

  async addComment(
    assetId: string,
    body: string,
    author: AssetMetaAuthor,
    snapshot?: { assetKey?: string; type?: string; name?: string },
  ): Promise<AssetMetaRecord> {
    const saved = await firstValueFrom(
      this.http.post<AssetMetaRecord>(
        `${this.apiBase}/asset-meta/${encodeURIComponent(assetId)}/comments`,
        { body, author, ...snapshot },
      ),
    );
    const record = normalizeRecord(saved, assetId);
    this.upsertLocal(record);
    return record;
  }

  async uploadMedia(
    assetId: string,
    file: File,
    snapshot?: { assetKey?: string; type?: string; name?: string },
  ): Promise<{
    id: string;
    filename: string;
    url: string;
    record: AssetMetaRecord;
  }> {
    const form = new FormData();
    form.append('file', file, file.name);
    if (snapshot?.assetKey) form.append('assetKey', snapshot.assetKey);
    if (snapshot?.type) form.append('type', snapshot.type);
    if (snapshot?.name) form.append('name', snapshot.name);

    const result = await firstValueFrom(
      this.http.post<{
        id: string;
        filename: string;
        url: string;
        contentType: string;
        record: AssetMetaRecord;
      }>(
        `${this.apiBase}/asset-meta/${encodeURIComponent(assetId)}/media`,
        form,
      ),
    );
    const record = normalizeRecord(result.record, assetId);
    this.upsertLocal(record);
    return {
      id: result.id,
      filename: result.filename,
      url: result.url,
      record,
    };
  }

  async deleteMedia(
    assetId: string,
    mediaId: string,
  ): Promise<AssetMetaRecord> {
    const saved = await firstValueFrom(
      this.http.delete<AssetMetaRecord>(
        `${this.apiBase}/asset-meta/${encodeURIComponent(assetId)}/media/${encodeURIComponent(mediaId)}`,
      ),
    );
    const record = normalizeRecord(saved, assetId);
    this.upsertLocal(record);
    return record;
  }

  ensureLocalStub(
    assetId: string,
    snapshot?: { assetKey?: string; type?: string; name?: string },
  ): AssetMetaRecord {
    const existing = this.recordFor(assetId);
    if (existing) return existing;
    const stub = emptyAssetMetaRecord(assetId, snapshot);
    this.upsertLocal(stub);
    return stub;
  }
}
