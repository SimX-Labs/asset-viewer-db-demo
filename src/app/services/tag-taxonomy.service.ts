import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  EMPTY_TAG_TAXONOMY,
  TAG_TAXONOMY_FILE,
  TAG_TAXONOMY_STORAGE_KEY,
  TagCategoryRecord,
  TagRecord,
  TagTaxonomy,
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
          .map((c) => ({
            dataId: c.dataId,
            label: String(c.label ?? ''),
            tags: Array.isArray(c.tags)
              ? c.tags.filter((t): t is string => typeof t === 'string')
              : [],
          }))
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
          }))
      : [],
  };
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
  readonly modalOpen = signal(false);
  readonly statusMessage = signal('');

  private apiBase = API_BASE_DEFAULT;

  openModal(): void {
    this.modalOpen.set(true);
    void this.ensureLoaded();
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded()) return;
    await this.reload();
  }

  async reload(): Promise<void> {
    // Prefer API (authoritative when running), then localStorage overlay, then static db file.
    let data: TagTaxonomy | null = null;

    try {
      data = normalize(
        await firstValueFrom(
          this.http.get<TagTaxonomy>(`${this.apiBase}/tag-taxonomy`),
        ),
      );
    } catch {
      /* API optional */
    }

    if (!data) {
      const stored = localStorage.getItem(TAG_TAXONOMY_STORAGE_KEY);
      if (stored) {
        try {
          data = normalize(JSON.parse(stored));
        } catch {
          /* ignore */
        }
      }
    }

    if (!data) {
      try {
        data = normalize(
          await firstValueFrom(
            this.http.get<TagTaxonomy>(`${UNITY_DB_ROOT}/${TAG_TAXONOMY_FILE}`),
          ),
        );
      } catch {
        data = { categories: [], tags: [] };
      }
    }

    this.taxonomy.set(syncRelations(data));
    this.loaded.set(true);
  }

  categories(): TagCategoryRecord[] {
    return this.taxonomy().categories;
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

  async createCategory(label = '[[ New Tag Category ]]'): Promise<TagCategoryRecord> {
    const category: TagCategoryRecord = {
      dataId: newId(),
      label: label.trim() || '[[ New Tag Category ]]',
      tags: [],
    };
    const next = syncRelations({
      ...this.taxonomy(),
      categories: [...this.taxonomy().categories, category],
    });
    await this.persist(next);
    return next.categories.find((c) => c.dataId === category.dataId)!;
  }

  async updateCategoryLabel(dataId: string, label: string): Promise<void> {
    const next = syncRelations({
      ...this.taxonomy(),
      categories: this.taxonomy().categories.map((c) =>
        c.dataId === dataId ? { ...c, label: label.trim() || c.label } : c,
      ),
    });
    await this.persist(next);
  }

  async deleteCategory(dataId: string): Promise<void> {
    const remainingCats = this.taxonomy().categories.filter(
      (c) => c.dataId !== dataId,
    );
    const tags = this.taxonomy()
      .tags.map((t) => ({
        ...t,
        categories: t.categories.filter((id) => id !== dataId),
      }))
      // Drop tags that no longer belong to any category (UI is category-centric).
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
      categories: categoryId ? [categoryId] : [],
    };
    const next = syncRelations({
      categories: this.taxonomy().categories,
      tags: [...this.taxonomy().tags, tag],
    });
    await this.persist(next);
    return next.tags.find((t) => t.dataId === tag.dataId)!;
  }

  async updateTagLabel(dataId: string, label: string): Promise<void> {
    const next = syncRelations({
      ...this.taxonomy(),
      tags: this.taxonomy().tags.map((t) =>
        t.dataId === dataId ? { ...t, label: label.trim() || t.label } : t,
      ),
    });
    await this.persist(next);
  }

  async deleteTag(dataId: string): Promise<void> {
    const next = syncRelations({
      tags: this.taxonomy().tags.filter((t) => t.dataId !== dataId),
      categories: this.taxonomy().categories.map((c) => ({
        ...c,
        tags: c.tags.filter((id) => id !== dataId),
      })),
    });
    await this.persist(next);
  }

  private async persist(taxonomy: TagTaxonomy): Promise<void> {
    const synced = syncRelations(structuredClone(taxonomy));
    this.taxonomy.set(synced);
    localStorage.setItem(TAG_TAXONOMY_STORAGE_KEY, JSON.stringify(synced));

    try {
      await firstValueFrom(
        this.http.put<TagTaxonomy>(`${this.apiBase}/tag-taxonomy`, synced),
      );
      this.statusMessage.set('Saved');
    } catch {
      this.statusMessage.set('Saved locally (API offline)');
    }
  }
}
