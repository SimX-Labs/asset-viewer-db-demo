import {
  ASSET_META_STATUSES,
  AssetMetaStatus,
} from '../models/asset-meta.models';
import { DboAsset } from '../models/dbo.models';
import { matchesFilter } from './property.util';

export type StatusFilterValue = AssetMetaStatus | 'unset';
export type StatusMatchMode = 'include' | 'exclude';

export interface ListedAsset extends DboAsset {
  status?: AssetMetaStatus;
}

export interface StatusFilterOption {
  value: StatusFilterValue;
  label: string;
  count: number;
  selected: boolean;
}

export const STATUS_FILTER_VALUES: StatusFilterValue[] = [
  ...ASSET_META_STATUSES,
  'unset',
];

export const STATUS_FILTER_LABELS: Record<StatusFilterValue, string> = {
  Development: 'Development',
  Functional: 'Functional',
  Stable: 'Stable',
  Deprecated: 'Deprecated',
  unset: 'No status',
};

const STATUS_ALIASES: Record<StatusFilterValue, string[]> = {
  Development: ['development', 'dev'],
  Functional: ['functional', 'working'],
  Stable: ['stable', 'complete'],
  Deprecated: ['deprecated'],
  unset: ['unset', 'none', 'no status', 'unassigned', '—', '-'],
};

export function statusOf(item: Pick<ListedAsset, 'status'>): StatusFilterValue {
  return item.status ?? 'unset';
}

export function statusFilterLabel(value: StatusFilterValue): string {
  return STATUS_FILTER_LABELS[value];
}

/** Include: any selected status. Exclude: none of the selected statuses. Empty = all. */
export function assetMatchesStatuses(
  item: Pick<ListedAsset, 'status'>,
  selected: StatusFilterValue[],
  mode: StatusMatchMode = 'include',
): boolean {
  if (!selected.length) return true;
  const has = selected.includes(statusOf(item));
  return mode === 'exclude' ? !has : has;
}

export function buildStatusFilters(args: {
  items: ListedAsset[];
  selected: StatusFilterValue[];
  query?: string;
}): StatusFilterOption[] {
  const selected = new Set(args.selected);
  const pool = args.items.filter((item) => matchesFilter(item, args.query ?? ''));
  return STATUS_FILTER_VALUES.map((value) => ({
    value,
    label: STATUS_FILTER_LABELS[value],
    count: pool.filter((item) => statusOf(item) === value).length,
    selected: selected.has(value),
  }));
}

export function statusFilterSuggestions(
  options: StatusFilterOption[],
  query: string,
): StatusFilterOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (q === 'status' || q === 'stat') {
    return options.filter((option) => !option.selected);
  }
  return options.filter((option) => {
    if (option.selected) return false;
    if (option.label.toLowerCase().includes(q)) return true;
    return STATUS_ALIASES[option.value].some(
      (alias) => alias.startsWith(q) || q.startsWith(alias),
    );
  });
}
