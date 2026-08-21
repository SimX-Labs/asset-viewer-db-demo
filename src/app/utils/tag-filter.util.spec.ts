import { DboAsset } from '../models/dbo.models';
import {
  assetHasAllTags,
  assetMatchesTags,
  buildContextualTagFilters,
  mergeTagLists,
  tagFilterSuggestions,
} from './tag-filter.util';

function item(id: string, tags: string[], name = id): DboAsset {
  return { AssetId: id, AssetName: name, AssetType: 'Tool', Tags: tags, Data: {} };
}

describe('tag-filter.util', () => {
  const scalpel = item('scalpel', ['Grabbable'], 'Scalpel');
  const cart = item('cart', ['Generator', 'Grabbable'], 'Code Cart');
  const tray = item('tray', ['Prop'], 'Instrument Tray');
  const items = [scalpel, cart, tray];

  it('requires every selected tag', () => {
    expect(assetHasAllTags(cart, ['Grabbable', 'Generator'])).toBeTrue();
    expect(assetHasAllTags(scalpel, ['Grabbable', 'Generator'])).toBeFalse();
    expect(assetHasAllTags(scalpel, [])).toBeTrue();
  });

  it('merges tag lists without duplicates', () => {
    expect(mergeTagLists(['Core', 'Adolescent'], ['Adolescent', 'Pediatric'])).toEqual([
      'Core',
      'Adolescent',
      'Pediatric',
    ]);
  });

  it('matches tags by AND or OR mode', () => {
    expect(assetMatchesTags(cart, ['Grabbable', 'Generator'], 'and')).toBeTrue();
    expect(assetMatchesTags(scalpel, ['Grabbable', 'Generator'], 'and')).toBeFalse();
    expect(assetMatchesTags(scalpel, ['Grabbable', 'Generator'], 'or')).toBeTrue();
    expect(assetMatchesTags(tray, ['Grabbable', 'Generator'], 'or')).toBeFalse();
    expect(assetMatchesTags(tray, [], 'or')).toBeTrue();
    expect(assetMatchesTags(scalpel, ['Grabbable', 'Generator'])).toBeFalse();
  });

  it('lists tags present on the current items, using taxonomy labels', () => {
    const options = buildContextualTagFilters({
      items,
      selectedLabels: [],
      taxonomyTags: [
        { label: 'Grabbable' },
        { label: 'Prop' },
        { label: 'Generator' },
        { label: 'Core' },
      ],
    });

    expect(options.map((o) => o.label)).toEqual([
      'Grabbable',
      'Generator',
      'Prop',
    ]);
    expect(options.find((o) => o.label === 'Grabbable')?.count).toBe(2);
  });

  it('falls back to asset tags when no taxonomy is provided', () => {
    const options = buildContextualTagFilters({
      items,
      selectedLabels: [],
    });
    expect(options.map((o) => o.label).sort()).toEqual([
      'Generator',
      'Grabbable',
      'Prop',
    ]);
  });

  it('keeps a selected tag visible after it filters the list to empty', () => {
    const options = buildContextualTagFilters({
      items: [tray],
      selectedLabels: ['Grabbable'],
      taxonomyTags: [{ label: 'Grabbable' }, { label: 'Prop' }],
    });
    expect(options[0]).toEqual({
      label: 'Grabbable',
      count: 0,
      selected: true,
    });
  });

  it('does not narrow other-tag counts in OR mode', () => {
    const andOptions = buildContextualTagFilters({
      items,
      selectedLabels: ['Grabbable'],
      taxonomyTags: [
        { label: 'Grabbable' },
        { label: 'Prop' },
        { label: 'Generator' },
      ],
    });
    expect(andOptions.find((o) => o.label === 'Prop')).toBeUndefined();

    const orOptions = buildContextualTagFilters({
      items,
      selectedLabels: ['Grabbable'],
      matchMode: 'or',
      taxonomyTags: [
        { label: 'Grabbable' },
        { label: 'Prop' },
        { label: 'Generator' },
      ],
    });
    expect(orOptions.find((o) => o.label === 'Prop')?.count).toBe(1);
    expect(orOptions.find((o) => o.label === 'Generator')?.count).toBe(1);
  });

  it('narrows counts by the current search query', () => {
    const options = buildContextualTagFilters({
      items,
      selectedLabels: [],
      query: 'scalpel',
      taxonomyTags: [{ label: 'Grabbable' }, { label: 'Prop' }],
    });
    expect(options.find((o) => o.label === 'Grabbable')?.count).toBe(1);
    expect(options.find((o) => o.label === 'Prop')).toBeUndefined();
  });

  it('suggests unselected tags that match the typed query', () => {
    const options = buildContextualTagFilters({
      items,
      selectedLabels: [],
      taxonomyTags: [
        { label: 'Grabbable' },
        { label: 'Prop' },
        { label: 'Generator' },
      ],
    });
    expect(tagFilterSuggestions(options, 'grab').map((o) => o.label)).toEqual([
      'Grabbable',
    ]);
    expect(tagFilterSuggestions(options, '')).toEqual([]);

    const selected = buildContextualTagFilters({
      items,
      selectedLabels: ['Grabbable'],
      taxonomyTags: [
        { label: 'Grabbable' },
        { label: 'Prop' },
        { label: 'Generator' },
      ],
    });
    expect(tagFilterSuggestions(selected, 'grab')).toEqual([]);
  });
});
