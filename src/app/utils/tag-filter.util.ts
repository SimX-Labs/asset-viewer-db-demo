import { DboAsset } from '../models/dbo.models';
import { TagRecord } from '../models/tag.models';
import { matchesFilter } from './property.util';

export type TagMatchMode = 'and' | 'or';

export interface TagFilterOption {
  label: string;
  count: number;
  selected: boolean;
}

/** Deduped labels, first-seen casing wins. */
export function mergeTagLists(...lists: (readonly string[] | undefined | null)[]): string[] {
  const seen = new Map<string, string>();
  for (const list of lists) {
    for (const raw of list ?? []) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) seen.set(key, trimmed);
    }
  }
  return [...seen.values()];
}

export function assetHasTag(item: Pick<DboAsset, 'Tags'>, label: string): boolean {
  const lower = label.trim().toLowerCase();
  if (!lower) return true;
  return (item.Tags ?? []).some((t) => t.toLowerCase() === lower);
}

export function assetHasAllTags(
  item: Pick<DboAsset, 'Tags'>,
  labels: string[],
): boolean {
  return labels.every((label) => assetHasTag(item, label));
}

/** AND: every label; OR: any label. Empty labels match all assets. */
export function assetMatchesTags(
  item: Pick<DboAsset, 'Tags'>,
  labels: string[],
  mode: TagMatchMode = 'and',
): boolean {
  if (!labels.length) return true;
  return mode === 'or'
    ? labels.some((label) => assetHasTag(item, label))
    : assetHasAllTags(item, labels);
}

function canonicalLabel(
  label: string,
  taxonomyByLower: Map<string, string>,
): string {
  const trimmed = label.trim();
  return taxonomyByLower.get(trimmed.toLowerCase()) ?? trimmed;
}

function uniqueLabels(items: Pick<DboAsset, 'Tags'>[], extra: string[]): string[] {
  const seen = new Map<string, string>();
  const add = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  };
  for (const item of items) {
    for (const tag of item.Tags ?? []) add(tag);
  }
  for (const label of extra) add(label);
  return [...seen.values()];
}

/**
 * Tag chips for the current category: labels on those assets, scoped to
 * global + type taxonomy tags when that list is provided.
 */
export function buildContextualTagFilters(args: {
  items: DboAsset[];
  selectedLabels: string[];
  query?: string;
  taxonomyTags?: Pick<TagRecord, 'label'>[];
  matchMode?: TagMatchMode;
}): TagFilterOption[] {
  const taxonomyByLower = new Map(
    (args.taxonomyTags ?? [])
      .map((t) => t.label.trim())
      .filter(Boolean)
      .map((label) => [label.toLowerCase(), label] as const),
  );
  const selectedLower = new Set(
    args.selectedLabels.map((l) => l.trim().toLowerCase()).filter(Boolean),
  );
  const query = args.query ?? '';

  let labels = uniqueLabels(args.items, args.selectedLabels).map((label) =>
    canonicalLabel(label, taxonomyByLower),
  );
  if (taxonomyByLower.size) {
    labels = labels.filter(
      (label) =>
        taxonomyByLower.has(label.toLowerCase()) ||
        selectedLower.has(label.toLowerCase()),
    );
  }

  const matchMode = args.matchMode ?? 'and';
  const options = labels.map((label) => {
    const lower = label.toLowerCase();
    const others = args.selectedLabels.filter(
      (selected) => selected.trim().toLowerCase() !== lower,
    );
    const pool = args.items.filter((item) => {
      if (!matchesFilter(item, query)) return false;
      if (!others.length || matchMode === 'or') return true;
      return assetHasAllTags(item, others);
    });
    return {
      label,
      count: pool.filter((item) => assetHasTag(item, label)).length,
      selected: selectedLower.has(lower),
    };
  });

  options.sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1;
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
  return options.filter((option) => option.selected || option.count > 0);
}

export function tagFilterSuggestions(
  options: TagFilterOption[],
  query: string,
): TagFilterOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: TagFilterOption[] = [];
  const contains: TagFilterOption[] = [];
  for (const option of options) {
    if (option.selected) continue;
    const label = option.label.toLowerCase();
    if (label.startsWith(q)) starts.push(option);
    else if (label.includes(q)) contains.push(option);
  }
  return [...starts, ...contains];
}
