import {
  CUSTOM_TAG_CATEGORY_ID,
  EMPTY_TAG_TAXONOMY,
  GLOBAL_TAG_CATEGORY_ID,
  SCRAPED_TAGS,
  builtInTagCategories,
  ensureBuiltInTagCategories,
  scrapedTagId,
  typeTagCategoryId,
} from './tag.models';
import { UNITY_CATEGORY_ORDER } from './unity-asset.models';

describe('ensureBuiltInTagCategories', () => {
  it('seeds Global, Custom, plus every Unity asset type on an empty taxonomy', () => {
    const next = ensureBuiltInTagCategories(EMPTY_TAG_TAXONOMY);
    expect(next.categories[0]).toEqual(
      jasmine.objectContaining({
        dataId: GLOBAL_TAG_CATEGORY_ID,
        label: 'Global',
        scope: 'global',
      }),
    );
    expect(next.categories[1]).toEqual(
      jasmine.objectContaining({
        dataId: CUSTOM_TAG_CATEGORY_ID,
        label: 'Custom',
        scope: 'global',
      }),
    );
    expect(next.categories.slice(2).map((c) => c.label)).toEqual([
      ...UNITY_CATEGORY_ORDER,
    ]);
    expect(next.categories).toEqual(builtInTagCategories());
  });

  it('remaps a legacy category named after a type onto the stable id', () => {
    const legacyId = 'uuid-characters';
    const next = ensureBuiltInTagCategories({
      categories: [
        { dataId: legacyId, label: 'Characters', tags: ['tag-1'], scope: 'type' },
      ],
      tags: [
        {
          dataId: 'tag-1',
          label: 'Adult',
          categories: [legacyId],
        },
      ],
    });

    const characters = next.categories.find(
      (c) => c.dataId === typeTagCategoryId('Characters'),
    );
    expect(characters?.tags).toEqual(['tag-1']);
    expect(next.tags[0].categories).toEqual([typeTagCategoryId('Characters')]);
    expect(
      next.categories.some((c) => c.dataId === legacyId),
    ).toBeFalse();
  });

  it('seeds locked scrape tags onto their type groups', () => {
    const next = ensureBuiltInTagCategories(EMPTY_TAG_TAXONOMY);
    expect(next.tags.filter((t) => t.source === 'scraped').map((t) => t.label)).toEqual(
      SCRAPED_TAGS.map((t) => t.label),
    );
    const core = next.tags.find((t) => t.dataId === scrapedTagId('core'));
    expect(core?.categories).toEqual([
      typeTagCategoryId('Characters'),
      typeTagCategoryId('Environments'),
    ]);
  });

  it('keeps unmatched custom categories after the built-in list', () => {
    const next = ensureBuiltInTagCategories({
      categories: [
        {
          dataId: 'rooms',
          label: 'Rooms',
          tags: ['or'],
          scope: 'type',
        },
      ],
      tags: [{ dataId: 'or', label: 'OR', categories: ['rooms'] }],
    });

    const extra = next.categories[next.categories.length - 1];
    expect(extra).toEqual(
      jasmine.objectContaining({
        dataId: 'rooms',
        label: 'Rooms',
        tags: ['or'],
        scope: 'type',
        assetType: 'Rooms',
      }),
    );
  });
});
