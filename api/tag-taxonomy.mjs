/**
 * File-backed tag taxonomy for the Asset Database PoC API.
 * Persists to tag-taxonomy.json in the Unity asset DB folder.
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * @typedef {{ dataId: string, label: string, categories: string[] }} TagRecord
 * @typedef {{ dataId: string, label: string, tags: string[] }} TagCategoryRecord
 * @typedef {{ categories: TagCategoryRecord[], tags: TagRecord[] }} TagTaxonomy
 */

/**
 * @param {string} dbRoot
 */
export function createTagTaxonomyStore(dbRoot) {
  const filePath = path.join(dbRoot, 'tag-taxonomy.json');

  /** @returns {TagTaxonomy} */
  function read() {
    try {
      if (!fs.existsSync(filePath)) {
        return { categories: [], tags: [] };
      }
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return normalize(raw);
    } catch (e) {
      console.warn(`  ! tag-taxonomy read failed: ${e.message}`);
      return { categories: [], tags: [] };
    }
  }

  /** @param {TagTaxonomy} taxonomy */
  function write(taxonomy) {
    const normalized = normalize(taxonomy);
    fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2) + '\n');
    return normalized;
  }

  /** @param {unknown} raw @returns {TagTaxonomy} */
  function normalize(raw) {
    const categories = Array.isArray(raw?.categories) ? raw.categories : [];
    const tags = Array.isArray(raw?.tags) ? raw.tags : [];
    return {
      categories: categories
        .filter((c) => c && typeof c.dataId === 'string')
        .map((c) => ({
          dataId: c.dataId,
          label: String(c.label ?? ''),
          tags: Array.isArray(c.tags)
            ? c.tags.filter((t) => typeof t === 'string')
            : [],
        })),
      tags: tags
        .filter((t) => t && typeof t.dataId === 'string')
        .map((t) => ({
          dataId: t.dataId,
          label: String(t.label ?? ''),
          categories: Array.isArray(t.categories)
            ? t.categories.filter((c) => typeof c === 'string')
            : [],
        })),
    };
  }

  /** Keep category.tags and tag.categories mirrored. */
  function syncRelations(taxonomy) {
    const tagIds = new Set(taxonomy.tags.map((t) => t.dataId));
    const catIds = new Set(taxonomy.categories.map((c) => c.dataId));

    for (const cat of taxonomy.categories) {
      cat.tags = cat.tags.filter((id) => tagIds.has(id));
    }
    for (const tag of taxonomy.tags) {
      tag.categories = tag.categories.filter((id) => catIds.has(id));
    }

    // Mirror: if tag lists a category, ensure category lists the tag (and vice versa).
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

  return {
    filePath,
    listTags() {
      return read().tags;
    },
    listCategories() {
      return read().categories;
    },
    getTaxonomy() {
      return read();
    },
    /** @param {{ label: string, categories?: string[] }} body */
    createTag(body) {
      const taxonomy = read();
      const label = String(body?.label ?? '').trim() || '[[ New Tag ]]';
      const categories = Array.isArray(body?.categories)
        ? body.categories.filter((id) =>
            taxonomy.categories.some((c) => c.dataId === id),
          )
        : [];
      const tag = { dataId: randomUUID(), label, categories };
      taxonomy.tags.push(tag);
      return write(syncRelations(taxonomy)).tags.find(
        (t) => t.dataId === tag.dataId,
      );
    },
    /** @param {string} dataId @param {{ label?: string, categories?: string[] }} body */
    updateTag(dataId, body) {
      const taxonomy = read();
      const tag = taxonomy.tags.find((t) => t.dataId === dataId);
      if (!tag) return null;
      if (typeof body?.label === 'string') tag.label = body.label.trim() || tag.label;
      if (Array.isArray(body?.categories)) {
        // Clear old category memberships first.
        for (const cat of taxonomy.categories) {
          cat.tags = cat.tags.filter((id) => id !== dataId);
        }
        tag.categories = body.categories.filter((id) =>
          taxonomy.categories.some((c) => c.dataId === id),
        );
      }
      return write(syncRelations(taxonomy)).tags.find((t) => t.dataId === dataId);
    },
    /** @param {string} dataId */
    deleteTag(dataId) {
      const taxonomy = read();
      const before = taxonomy.tags.length;
      taxonomy.tags = taxonomy.tags.filter((t) => t.dataId !== dataId);
      for (const cat of taxonomy.categories) {
        cat.tags = cat.tags.filter((id) => id !== dataId);
      }
      if (taxonomy.tags.length === before) return false;
      write(syncRelations(taxonomy));
      return true;
    },
    /** @param {{ label: string, tags?: string[] }} body */
    createCategory(body) {
      const taxonomy = read();
      const label = String(body?.label ?? '').trim() || '[[ New Tag Category ]]';
      const tags = Array.isArray(body?.tags)
        ? body.tags.filter((id) => taxonomy.tags.some((t) => t.dataId === id))
        : [];
      const category = { dataId: randomUUID(), label, tags };
      taxonomy.categories.push(category);
      return write(syncRelations(taxonomy)).categories.find(
        (c) => c.dataId === category.dataId,
      );
    },
    /** @param {string} dataId @param {{ label?: string, tags?: string[] }} body */
    updateCategory(dataId, body) {
      const taxonomy = read();
      const category = taxonomy.categories.find((c) => c.dataId === dataId);
      if (!category) return null;
      if (typeof body?.label === 'string') {
        category.label = body.label.trim() || category.label;
      }
      if (Array.isArray(body?.tags)) {
        for (const tag of taxonomy.tags) {
          tag.categories = tag.categories.filter((id) => id !== dataId);
        }
        category.tags = body.tags.filter((id) =>
          taxonomy.tags.some((t) => t.dataId === id),
        );
      }
      return write(syncRelations(taxonomy)).categories.find(
        (c) => c.dataId === dataId,
      );
    },
    /** @param {string} dataId */
    deleteCategory(dataId) {
      const taxonomy = read();
      const before = taxonomy.categories.length;
      taxonomy.categories = taxonomy.categories.filter(
        (c) => c.dataId !== dataId,
      );
      taxonomy.tags = taxonomy.tags
        .map((t) => ({
          ...t,
          categories: t.categories.filter((id) => id !== dataId),
        }))
        .filter((t) => t.categories.length > 0);
      if (taxonomy.categories.length === before) return false;
      write(syncRelations(taxonomy));
      return true;
    },
    /** Replace entire taxonomy (viewer sync). */
    replaceTaxonomy(body) {
      return write(syncRelations(normalize(body)));
    },
  };
}
