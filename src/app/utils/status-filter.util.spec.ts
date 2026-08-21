import { AssetMetaStatus } from '../models/asset-meta.models';
import {
  assetMatchesStatuses,
  buildStatusFilters,
  ListedAsset,
  statusFilterSuggestions,
  statusOf,
} from './status-filter.util';

function item(id: string, status?: AssetMetaStatus): ListedAsset {
  return { AssetId: id, AssetName: id, AssetType: 'Tool', Data: {}, status };
}

describe('status-filter.util', () => {
  const functional = item('scalpel', 'Functional');
  const stable = item('cart', 'Stable');
  const deprecated = item('old', 'Deprecated');
  const unset = item('tray');
  const items = [functional, stable, deprecated, unset];

  it('treats a missing overlay as unset', () => {
    expect(statusOf(unset)).toBe('unset');
    expect(statusOf(functional)).toBe('Functional');
  });

  it('includes selected statuses and leaves an empty selection unfiltered', () => {
    expect(assetMatchesStatuses(functional, ['Functional'], 'include')).toBeTrue();
    expect(assetMatchesStatuses(stable, ['Functional'], 'include')).toBeFalse();
    expect(assetMatchesStatuses(unset, ['unset'], 'include')).toBeTrue();
    expect(assetMatchesStatuses(functional, [], 'include')).toBeTrue();
  });

  it('excludes selected statuses', () => {
    expect(assetMatchesStatuses(functional, ['Functional'], 'exclude')).toBeFalse();
    expect(assetMatchesStatuses(stable, ['Functional'], 'exclude')).toBeTrue();
    expect(
      assetMatchesStatuses(unset, ['Functional', 'Stable'], 'exclude'),
    ).toBeTrue();
    expect(assetMatchesStatuses(functional, [], 'exclude')).toBeTrue();
  });

  it('lists every status with counts narrowed by the search query', () => {
    const options = buildStatusFilters({
      items,
      selected: ['Functional'],
      query: 'scalpel',
    });
    expect(options.map((o) => [o.value, o.count, o.selected])).toEqual([
      ['Development', 0, false],
      ['Functional', 1, true],
      ['Stable', 0, false],
      ['Deprecated', 0, false],
      ['unset', 0, false],
    ]);
  });

  it('suggests unselected statuses that match the typed query', () => {
    const options = buildStatusFilters({ items, selected: [] });
    expect(statusFilterSuggestions(options, 'work').map((o) => o.value)).toEqual([
      'Functional',
    ]);
    expect(statusFilterSuggestions(options, 'dev').map((o) => o.value)).toEqual([
      'Development',
    ]);
    expect(statusFilterSuggestions(options, 'none').map((o) => o.value)).toEqual([
      'unset',
    ]);
    expect(statusFilterSuggestions(options, '').length).toBe(0);

    const selected = buildStatusFilters({ items, selected: ['Functional'] });
    expect(statusFilterSuggestions(selected, 'work')).toEqual([]);
    expect(statusFilterSuggestions(selected, 'status').map((o) => o.value)).toEqual([
      'Development',
      'Stable',
      'Deprecated',
      'unset',
    ]);
  });
});
