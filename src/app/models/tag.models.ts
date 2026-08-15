/** Tag taxonomy models — mirrors legacy asset-database Tag / TagCategory. */

export interface TagRecord {
  dataId: string;
  label: string;
  /** Category dataIds this tag belongs to. */
  categories: string[];
}

export interface TagCategoryRecord {
  dataId: string;
  label: string;
  /** Tag dataIds in this category. */
  tags: string[];
}

export interface TagTaxonomy {
  categories: TagCategoryRecord[];
  tags: TagRecord[];
}

export const TAG_TAXONOMY_FILE = 'tag-taxonomy.json';
export const TAG_TAXONOMY_STORAGE_KEY = 'simx-asset-viewer-tag-taxonomy';
export const EMPTY_TAG_TAXONOMY: TagTaxonomy = { categories: [], tags: [] };
