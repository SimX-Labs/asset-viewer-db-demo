import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { emptyAssetMetaRecord } from '../models/asset-meta.models';
import { UnityDbIndex } from '../models/unity-asset.models';
import { environment } from '../environment';
import { AssetMetaService } from './asset-meta.service';

describe('AssetMetaService drafts', () => {
  let meta: AssetMetaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });
    meta = TestBed.inject(AssetMetaService);
    meta.records.set({
      'asset-1': {
        ...emptyAssetMetaRecord('asset-1'),
        status: 'Functional',
        tags: ['Core'],
      },
    });
  });

  it('keeps tag and status edits local until commit', async () => {
    spyOn(meta, 'saveRecord').and.resolveTo({
      ...emptyAssetMetaRecord('asset-1'),
      status: 'Stable',
      tags: ['Core', 'Pediatric'],
    });

    meta.setDraftTags('asset-1', ['Core', 'Pediatric']);
    meta.setDraftStatus('asset-1', 'Stable');

    expect(meta.isDirty('asset-1')).toBeTrue();
    expect(meta.effectiveTags('asset-1')).toEqual(['Core', 'Pediatric']);
    expect(meta.effectiveStatus('asset-1')).toBe('Stable');
    expect(meta.saveRecord).not.toHaveBeenCalled();

    await meta.commitDraft('asset-1', { name: 'Board' });

    expect(meta.saveRecord).toHaveBeenCalledWith(
      'asset-1',
      jasmine.objectContaining({
        status: 'Stable',
        tags: ['Core', 'Pediatric'],
        name: 'Board',
      }),
    );
    expect(meta.isDirty('asset-1')).toBeFalse();
  });

  it('discards draft fields and pending uploads', async () => {
    spyOn(meta, 'deleteMedia').and.resolveTo(emptyAssetMetaRecord('asset-1'));
    meta.setDraftTags('asset-1', ['Pediatric']);
    meta.addPendingUpload('asset-1', 'media-1');

    await meta.discardDraft('asset-1');

    expect(meta.isDirty('asset-1')).toBeFalse();
    expect(meta.effectiveTags('asset-1')).toEqual(['Core']);
    expect(meta.deleteMedia).toHaveBeenCalledWith('asset-1', 'media-1');
  });

  it('treats a new note as a dirty edit', () => {
    meta.beginNewNote('asset-1', {
      id: 'n1',
      type: 'markdown',
      markdown: 'Draft note',
    });

    expect(meta.isDirty('asset-1')).toBeTrue();
    expect(meta.effectiveNotes('asset-1')).toEqual([
      { id: 'n1', type: 'markdown', markdown: 'Draft note' },
    ]);
    expect(meta.draftFor('asset-1')?.editingNoteId).toBe('n1');
  });

  it('lists unique overlay tags from saved records and drafts', () => {
    meta.records.set({
      'asset-1': {
        ...emptyAssetMetaRecord('asset-1'),
        tags: ['Core'],
      },
      'asset-2': {
        ...emptyAssetMetaRecord('asset-2'),
        tags: ['Needs Review', 'core'],
      },
    });
    meta.setDraftTags('asset-1', ['Core', 'WIP']);
    expect(meta.overlayTagLabels()).toEqual(['Core', 'WIP', 'Needs Review']);
  });
});

describe('AssetMetaService loadFromIndex', () => {
  let meta: AssetMetaService;
  let http: HttpTestingController;

  const emptyIndex: UnityDbIndex = {
    characters: [],
    equipment: [],
    tools: [],
    interactions: [],
    clothing: 'clothing.json',
    medications: 'medications.json',
    waveforms: 'waveforms.json',
    scenarios: 'scenarios.json',
    characterMetadata: 'character-metadata.json',
    toolMetadata: 'tool-metadata.json',
    assetMeta: [],
    assetMetaAliases: 'meta/aliases.json',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    meta = TestBed.inject(AssetMetaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('merges API records that are not listed in index.json', async () => {
    const pending = meta.loadFromIndex(emptyIndex, 'db');

    http.expectOne('db/meta/aliases.json').flush({});
    http.expectOne(`${environment.apiBaseUrl}/asset-meta`).flush({
      records: [
        {
          ...emptyAssetMetaRecord('new-1'),
          comments: [
            {
              id: 'c1',
              body: 'Hello',
              createdAt: '2026-01-01T00:00:00.000Z',
              author: { sub: 'user-1', name: 'Ada' },
            },
          ],
        },
      ],
      aliases: {},
    });

    await pending;
    expect(meta.recordFor('new-1')?.comments[0].body).toBe('Hello');
  });
});

describe('AssetMetaService clear overlay', () => {
  let meta: AssetMetaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    meta = TestBed.inject(AssetMetaService);
    http = TestBed.inject(HttpTestingController);
    meta.records.set({
      'asset-1': {
        ...emptyAssetMetaRecord('asset-1'),
        status: 'Functional',
      },
    });
    meta.setDraftStatus('asset-1', 'Stable');
  });

  afterEach(() => {
    http.verify();
  });

  it('drops the local overlay after a successful delete', async () => {
    const pending = meta.clearRecord('asset-1');
    const req = http.expectOne(`${environment.apiBaseUrl}/asset-meta/asset-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ deleted: true, assetId: 'asset-1' });
    await pending;

    expect(meta.recordFor('asset-1')).toBeNull();
    expect(meta.isDirty('asset-1')).toBeFalse();
  });

  it('treats a missing overlay as already cleared', async () => {
    const pending = meta.clearRecord('asset-1');
    http.expectOne(`${environment.apiBaseUrl}/asset-meta/asset-1`).flush(
      { message: 'Asset meta not found.' },
      { status: 404, statusText: 'Not Found' },
    );
    await pending;

    expect(meta.recordFor('asset-1')).toBeNull();
  });

  it('clears every local overlay after confirm=all', async () => {
    meta.records.set({
      'asset-1': emptyAssetMetaRecord('asset-1'),
      'asset-2': emptyAssetMetaRecord('asset-2'),
    });
    const pending = meta.clearAllRecords();
    const req = http.expectOne(`${environment.apiBaseUrl}/asset-meta/clear-all`);
    expect(req.request.method).toBe('POST');
    req.flush({ deleted: 2 });
    expect(await pending).toEqual({ deleted: 2 });

    expect(meta.recordFor('asset-1')).toBeNull();
    expect(meta.recordFor('asset-2')).toBeNull();
  });

  it('serves overlay media from a local db folder pick', () => {
    meta.records.set({
      'asset-1': {
        ...emptyAssetMetaRecord('asset-1'),
        media: [{ id: 'img-1', filename: 'shot.png', contentType: 'image/png' }],
      },
    });
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    meta.setLocalMediaFiles(
      new Map([['meta/asset-1/media/shot.png', file]]),
    );
    expect(meta.mediaSrc('asset-1', 'img-1')).toMatch(/^blob:/);
  });
});
