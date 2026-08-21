import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  CUSTOM_TAG_CATEGORY_ID,
  EMPTY_TAG_TAXONOMY,
  GLOBAL_TAG_CATEGORY_ID,
  TAG_TAXONOMY_DRAFT_KEY,
  TAG_TAXONOMY_FILE,
  TAG_TAXONOMY_STORAGE_KEY,
  TagCategoryRecord,
  TagRecord,
  TagTaxonomy,
  ensureBuiltInTagCategories,
  isBuiltInTagCategoryId,
  isGlobalScopeCategoryId,
  isScrapedTag,
  typeTagCategoryId,
} from '../models/tag.models';
import { UNITY_DB_ROOT } from '../models/unity-asset.models';

const API_BASE_DEFAULT = 'http://localhost:4301';

function newId(): string {
  return crypto.randomUUID();
}

function normalize(raw: unknown): TagTaxonomy {
  const r = (raw ?? {}) as Partial<TagTaxonomy>;
  return {
    categories: Array.isArray(r.categories)
      ? r.categories
          .filter((c): c is TagCategoryRecord => !!c && typeof c.dataId === 'string')
          .map((c) => {
            const isGlobal =
              c.scope === 'global' || isGlobalScopeCategoryId(c.dataId);
            return {
              dataId: c.dataId,
              label: String(c.label ?? ''),
              tags: Array.isArray(c.tags)
                ? c.tags.filter((t): t is string => typeof t === 'string')
                : [],
              scope: (isGlobal ? 'global' : 'type') as TagCategoryRecord['scope'],
              assetType: isGlobal
                ? undefined
                : typeof c.assetType === 'string' && c.assetType
                  ? c.assetType
                  : String(c.label ?? ''),
            };
          })
      : [],
    tags: Array.isArray(r.tags)
      ? r.tags
          .filter((t): t is TagRecord => !!t && typeof t.dataId === 'string')
          .map((t) => ({
            dataId: t.dataId,
            label: String(t.label ?? ''),
            categories: Array.isArray(t.categories)
              ? t.categories.filter((c): c is string => typeof c === 'string')
              : [],
            source:
              t.source === 'scraped' ||
              String(t.dataId).startsWith('scraped:')
                ? 'scraped'
                : 'authored',
          }))
      : [],
  };
}

function hydrate(raw: unknown): TagTaxonomy {
  return syncRelations(ensureBuiltInTagCategories(normalize(raw)));
}

/** Keep category.tags ↔ tag.categories mirrored. */
function syncRelations(taxonomy: TagTaxonomy): TagTaxonomy {
  const tagIds = new Set(taxonomy.tags.map((t) => t.dataId));
  const catIds = new Set(taxonomy.categories.map((c) => c.dataId));

  for (const cat of taxonomy.categories) {
    cat.tags = cat.tags.filter((id) => tagIds.has(id));
  }
  for (const tag of taxonomy.tags) {
    tag.categories = tag.categories.filter((id) => catIds.has(id));
  }
  for (const tag of taxonomy.tags) {
    for (const catId of tag.categories) {
      const cat = taxonomy.categories.find((c) => c.dataId === catId);
      if (cat && !cat.tags.includes(tag.dataId)) cat.tags.push(tag.dataId);
    }
  }
  for (const cat of taxonomy.categories) {
    for (const tagId of cat.tags) {
      const tag = taxonomy.tags.find((t) => t.dataId === tagId);
      if (tag && !tag.categories.includes(cat.dataId)) {
        tag.categories.push(cat.dataId);
      }
    }
  }
  return taxonomy;
}

@Injectable({ providedIn: 'root' })
export class TagTaxonomyService {
  private readonly http = inject(HttpClient);

  readonly taxonomy = signal<TagTaxonomy>({ ...EMPTY_TAG_TAXONOMY });
  readonly loaded = signal(false);
  readonly pageOpen = signal(false);
  readonly dirty = signal(false);
  readonly statusMessage = signal('');

  private apiBase = API_BASE_DEFAULT;

  openPage(): void {
    this.pageOpen.set(true);
    void this.ensureLoaded();
  }

  async closePage(): Promise<void> {
    await this.flush();
    this.pageOpen.set(false);
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded()) return;
    await this.reload();
  }

  async reload(): Promise<void> {
    // Prefer an unflushed local draft (refresh mid-edit), then API, then
    // localStorage overlay, then the static db file.
    let data: TagTaxonomy | null = this.readDraft();

    if (!data) {
      try {
        data = hydrate(
          await firstValueFrom(
            this.http.get<TagTaxonomy>(`${this.apiBase}/tag-taxonomy`),
          ),
        );
      } catch {
        /* API optional */
      }
    }

    if (!data) {
      const stored = localStorage.getItem(TAG_TAXONOMY_STORAGE_KEY);
      if (stored) {
        try {
          data = hydrate(JSON.parse(stored));
        } catch {
          /* ignore */
        }
      }
    }

    if (!data) {
      try {
        data = hydrate(
          await firstValueFrom(
            this.http.get<TagTaxonomy>(`${UNITY_DB_ROOT}/${TAG_TAXONOMY_FILE}`),
          ),
        );
      } catch {
        data = hydrate({ categories: [], tags: [] });
      }
    }

    this.taxonomy.set(syncRelations(data));
    this.loaded.set(true);
  }

  categories(): TagCategoryRecord[] {
    return this.taxonomy().categories;
  }

  globalCategory(): TagCategoryRecord | undefined {
    return this.taxonomy().categories.find(
      (c) => c.dataId === GLOBAL_TAG_CATEGORY_ID,
    );
  }

  customCategory(): TagCategoryRecord | undefined {
    return this.taxonomy().categories.find(
      (c) => c.dataId === CUSTOM_TAG_CATEGORY_ID,
    );
  }

  typeCategories(): TagCategoryRecord[] {
    return this.taxonomy().categories.filter(
      (c) => c.scope === 'type' && isBuiltInTagCategoryId(c.dataId),
    );
  }

  otherCategories(): TagCategoryRecord[] {
    return this.taxonomy().categories.filter(
      (c) => !isBuiltInTagCategoryId(c.dataId),
    );
  }

  tags(): TagRecord[] {
    return this.taxonomy().tags;
  }

  tagsForCategory(categoryId: string): TagRecord[] {
    const cat = this.taxonomy().categories.find((c) => c.dataId === categoryId);
    if (!cat) return [];
    const byId = new Map(this.taxonomy().tags.map((t) => [t.dataId, t]));
    return cat.tags.map((id) => byId.get(id)).filter((t): t is TagRecord => !!t);
  }

  /** Global + Custom tags plus tags scoped to this Unity asset type. */
  tagsAvailableForAssetType(assetType: string): TagRecord[] {
    const seen = new Set<string>();
    const out: TagRecord[] = [];
    const typeId = typeTagCategoryId(assetType);
    for (const cat of this.taxonomy().categories) {
      if (cat.scope !== 'global' && cat.dataId !== typeId) continue;
      for (const tag of this.tagsForCategory(cat.dataId)) {
        if (seen.has(tag.dataId)) continue;
        seen.add(tag.dataId);
        out.push(tag);
      }
    }
    return out;
  }

  /**
   * Put labels that are not already in the taxonomy onto Custom (or another
   * group). Existing Global / type / scraped tags are left where they are.
   */
  async ensureAuthoredTags(
    labels: readonly string[],
    categoryId = CUSTOM_TAG_CATEGORY_ID,
  ): Promise<TagRecord[]> {
    if (!this.loaded()) await this.reload();
    const existingByLower = new Map(
      this.taxonomy().tags.map((t) => [t.label.trim().toLowerCase(), t]),
    );
    const additions: TagRecord[] = [];
    for (const raw of labels) {
      const label = raw.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (existingByLower.has(key)) continue;
      const tag: TagRecord = {
        dataId: newId(),
        label,
        categories: [categoryId],
        source: 'authored',
      };
      additions.push(tag);
      existingByLower.set(key, tag);
    }
    if (!additions.length) return [];
    await this.persist({
      categories: this.taxonomy().categories,
      tags: [...this.taxonomy().tags, ...additions],
    });
    return additions;
  }

  async createCategory(label = '[[ New Tag Category ]]'): Promise<TagCategoryRecord> {
    const trimmed = label.trim() || '[[ New Tag Category ]]';
    const category: TagCategoryRecord = {
      dataId: newId(),
      label: trimmed,
      tags: [],
      scope: 'type',
      assetType: trimmed,
    };
    const next = syncRelations({
      ...this.taxonomy(),
      categories: [...this.taxonomy().categories, category],
    });
    await this.persist(next);
    return next.categories.find((c) => c.dataId === category.dataId)!;
  }

  async updateCategoryLabel(dataId: string, label: string): Promise<void> {
    if (isBuiltInTagCategoryId(dataId)) return;
    const next = syncRelations({
      ...this.taxonomy(),
      categories: this.taxonomy().categories.map((c) =>
        c.dataId === dataId
          ? { ...c, label: label.trim() || c.label, assetType: label.trim() || c.assetType }
          : c,
      ),
    });
    await this.persist(next);
  }

  async deleteCategory(dataId: string): Promise<void> {
    if (isBuiltInTagCategoryId(dataId)) return;
    const remainingCats = this.taxonomy().categories.filter(
      (c) => c.dataId !== dataId,
    );
    const tags = this.taxonomy()
      .tags.map((t) => ({
        ...t,
        categories: t.categories.filter((id) => id !== dataId),
      }))
      .filter((t) => t.categories.length > 0);
    const next = syncRelations({
      categories: remainingCats,
      tags,
    });
    await this.persist(next);
  }

  async createTag(
    categoryId: string,
    label = '[[ New Tag ]]',
  ): Promise<TagRecord> {
    const tag: TagRecord = {
      dataId: newId(),
      label: label.trim() || '[[ New Tag ]]',
      categories: categoryId ? [categoryId] : [GLOBAL_TAG_CATEGORY_ID],
      source: 'authored',
    };
    const next = syncRelations({
      categories: this.taxonomy().categories,
      tags: [...this.taxonomy().tags, tag],
    });
    await this.persist(next);
    return next.tags.find((t) => t.dataId === tag.dataId)!;
  }

  async updateTagLabel(dataId: string, label: string): Promise<void> {
    const current = this.taxonomy().tags.find((t) => t.dataId === dataId);
    if (current && isScrapedTag(current)) return;
    const next = syncRelations({
      ...this.taxonomy(),
      tags: this.taxonomy().tags.map((t) =>
        t.dataId === dataId ? { ...t, label: label.trim() || t.label } : t,
      ),
    });
    await this.persist(next);
  }

  async deleteTag(dataId: string): Promise<void> {
    const current = this.taxonomy().tags.find((t) => t.dataId === dataId);
    if (current && isScrapedTag(current)) return;
    const next = syncRelations({
      tags: this.taxonomy().tags.filter((t) => t.dataId !== dataId),
      categories: this.taxonomy().categories.map((c) => ({
        ...c,
        tags: c.tags.filter((id) => id !== dataId),
      })),
    });
    await this.persist(next);
  }

  /**
   * Write the current taxonomy to the API. The tag page defers this until
   * leave so `db-link/tag-taxonomy.json` does not trip the Angular watcher
   * on every keystroke.
   */
  async flush(): Promise<void> {
    if (!this.dirty()) return;
    await this.writeRemote(this.taxonomy());
    this.dirty.set(false);
  }

  private readDraft(): TagTaxonomy | null {
    if (localStorage.getItem(TAG_TAXONOMY_DRAFT_KEY) !== '1') return null;
    const stored = localStorage.getItem(TAG_TAXONOMY_STORAGE_KEY);
    if (!stored) return null;
    try {
      this.dirty.set(true);
      return hydrate(JSON.parse(stored));
    } catch {
      return null;
    }
  }

  private async persist(taxonomy: TagTaxonomy): Promise<void> {
    const synced = syncRelations(
      ensureBuiltInTagCategories(structuredClone(taxonomy)),
    );
    this.taxonomy.set(synced);
    localStorage.setItem(TAG_TAXONOMY_STORAGE_KEY, JSON.stringify(synced));

    // While the tag page is open, keep edits local so writing the linked
    // db file does not live-reload the whole viewer on every change.
    if (this.pageOpen()) {
      this.dirty.set(true);
      localStorage.setItem(TAG_TAXONOMY_DRAFT_KEY, '1');
      this.statusMessage.set('Unsaved — written when you leave this page');
      return;
    }

    await this.writeRemote(synced);
  }

  private async writeRemote(taxonomy: TagTaxonomy): Promise<void> {
    try {
      await firstValueFrom(
        this.http.put<TagTaxonomy>(`${this.apiBase}/tag-taxonomy`, taxonomy),
      );
      localStorage.removeItem(TAG_TAXONOMY_DRAFT_KEY);
      this.statusMessage.set('Saved');
    } catch {
      this.statusMessage.set('Saved locally (API offline)');
    }
  }
}
