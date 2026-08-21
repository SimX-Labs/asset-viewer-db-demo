import {
  collectNoteMediaIds,
  AssetMetaCarouselBlock,
  assetMetaDraftIsDirty,
  assetMetaRecordHasContent,
  carouselSlideCaption,
  emptyAssetMetaRecord,
  normalizeAssetMetaRecord,
} from './asset-meta.models';

function carousel(
  partial: Partial<AssetMetaCarouselBlock> & Pick<AssetMetaCarouselBlock, 'mediaIds'>,
): AssetMetaCarouselBlock {
  return { id: 'c1', type: 'carousel', ...partial };
}

describe('carouselSlideCaption', () => {
  it('prefers the caption for the current slide', () => {
    expect(
      carouselSlideCaption(
        carousel({
          mediaIds: ['a', 'b'],
          slideCaptions: { a: 'First', b: 'Second' },
          caption: 'Legacy',
        }),
        1,
      ),
    ).toBe('Second');
  });

  it('falls back to the legacy carousel caption when no slide captions exist', () => {
    expect(
      carouselSlideCaption(carousel({ mediaIds: ['a', 'b'], caption: 'Overview' }), 0),
    ).toBe('Overview');
  });

  it('does not use the legacy caption once any slide has its own', () => {
    expect(
      carouselSlideCaption(
        carousel({
          mediaIds: ['a', 'b'],
          slideCaptions: { a: 'Only first' },
          caption: 'Overview',
        }),
        1,
      ),
    ).toBe('');
  });
});

describe('assetMetaDraftIsDirty', () => {
  const saved = emptyAssetMetaRecord('asset-1');

  it('ignores an editor session with no field changes', () => {
    expect(
      assetMetaDraftIsDirty(saved, {
        pendingUploads: [],
        editingNoteId: 'n1',
      }),
    ).toBeFalse();
  });

  it('treats a status change as dirty', () => {
    expect(
      assetMetaDraftIsDirty(saved, {
        pendingUploads: [],
        status: 'Functional',
      }),
    ).toBeTrue();
  });

  it('treats reverting status to unset as clean', () => {
    expect(
      assetMetaDraftIsDirty(saved, {
        pendingUploads: [],
        status: null,
      }),
    ).toBeFalse();
  });

  it('treats tag and note edits as dirty', () => {
    expect(
      assetMetaDraftIsDirty(saved, {
        pendingUploads: [],
        tags: ['Pediatric'],
      }),
    ).toBeTrue();
    expect(
      assetMetaDraftIsDirty(saved, {
        pendingUploads: [],
        notes: [{ id: 'n1', type: 'markdown', markdown: 'Hello' }],
      }),
    ).toBeTrue();
  });
});

describe('normalizeAssetMetaRecord', () => {
  it('rewrites legacy Working and Complete statuses', () => {
    expect(normalizeAssetMetaRecord({ assetId: 'a', status: 'Working' }).status).toBe(
      'Functional',
    );
    expect(normalizeAssetMetaRecord({ assetId: 'a', status: 'Complete' }).status).toBe(
      'Stable',
    );
    expect(
      normalizeAssetMetaRecord({ assetId: 'a', status: 'Development' }).status,
    ).toBe('Development');
  });
});

describe('collectNoteMediaIds', () => {
  it('includes image, video, and carousel media', () => {
    expect(
      collectNoteMediaIds([
        { id: 'n1', type: 'markdown', markdown: 'hi' },
        { id: 'n2', type: 'image', mediaId: 'img-1' },
        { id: 'n3', type: 'video', mediaId: 'vid-1' },
        { id: 'n4', type: 'carousel', mediaIds: ['c-1', 'c-2'] },
      ]),
    ).toEqual(new Set(['img-1', 'vid-1', 'c-1', 'c-2']));
  });
});

describe('assetMetaRecordHasContent', () => {
  it('is false for an empty overlay', () => {
    expect(assetMetaRecordHasContent(emptyAssetMetaRecord('a'))).toBeFalse();
    expect(assetMetaRecordHasContent(null)).toBeFalse();
  });

  it('is true when status, tags, notes, comments, or media exist', () => {
    expect(
      assetMetaRecordHasContent({ ...emptyAssetMetaRecord('a'), status: 'Stable' }),
    ).toBeTrue();
    expect(
      assetMetaRecordHasContent({ ...emptyAssetMetaRecord('a'), tags: ['Core'] }),
    ).toBeTrue();
  });
});
