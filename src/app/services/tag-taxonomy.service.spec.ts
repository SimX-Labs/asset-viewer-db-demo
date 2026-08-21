import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  CUSTOM_TAG_CATEGORY_ID,
  GLOBAL_TAG_CATEGORY_ID,
  TAG_TAXONOMY_DRAFT_KEY,
  TAG_TAXONOMY_STORAGE_KEY,
  typeTagCategoryId,
} from '../models/tag.models';
import { UNITY_CATEGORY_ORDER } from '../models/unity-asset.models';
import { TagTaxonomyService } from './tag-taxonomy.service';

const API = 'http://localhost:4301/tag-taxonomy';

describe('TagTaxonomyService', () => {
  let service: TagTaxonomyService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem(TAG_TAXONOMY_STORAGE_KEY);
    localStorage.removeItem(TAG_TAXONOMY_DRAFT_KEY);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TagTaxonomyService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem(TAG_TAXONOMY_STORAGE_KEY);
    localStorage.removeItem(TAG_TAXONOMY_DRAFT_KEY);
  });

  async function loadEmpty(): Promise<void> {
    const loaded = service.ensureLoaded();
    http.expectOne(API).flush({ categories: [], tags: [] });
    await loaded;
  }

  it('hydrates Global, Custom, plus every Unity asset type from an empty file', async () => {
    await loadEmpty();
    expect(service.globalCategory()?.dataId).toBe(GLOBAL_TAG_CATEGORY_ID);
    expect(service.customCategory()?.dataId).toBe(CUSTOM_TAG_CATEGORY_ID);
    expect(service.typeCategories().map((c) => c.label)).toEqual([
      ...UNITY_CATEGORY_ORDER,
    ]);
  });

  it('defers the API write until the tag page is closed', async () => {
    await loadEmpty();
    service.openPage();

    await service.createTag(GLOBAL_TAG_CATEGORY_ID, 'OR');
    http.expectNone(API);
    expect(service.dirty()).toBeTrue();
    expect(localStorage.getItem(TAG_TAXONOMY_DRAFT_KEY)).toBe('1');

    const leaving = service.closePage();
    const req = http.expectOne(
      (r) => r.method === 'PUT' && r.url === API,
    );
    expect(req.request.body.categories[0].dataId).toBe(GLOBAL_TAG_CATEGORY_ID);
    expect(
      req.request.body.tags.map((t: { label: string }) => t.label),
    ).toContain('OR');
    req.flush(req.request.body);
    await leaving;

    expect(service.pageOpen()).toBeFalse();
    expect(service.dirty()).toBeFalse();
    expect(localStorage.getItem(TAG_TAXONOMY_DRAFT_KEY)).toBeNull();
  });

  it('writes immediately when the tag page is not open', async () => {
    await loadEmpty();

    const creating = service.createTag(typeTagCategoryId('Characters'), 'Adult');
    const req = http.expectOne(
      (r) => r.method === 'PUT' && r.url === API,
    );
    expect(
      req.request.body.tags.map((t: { label: string }) => t.label),
    ).toContain('Adult');
    req.flush(req.request.body);
    await creating;

    expect(service.dirty()).toBeFalse();
    expect(
      service.tagsAvailableForAssetType('Characters').map((t) => t.label),
    ).toContain('Adult');
  });

  it('combines global and type tags for a given asset type', async () => {
    await loadEmpty();

    const addGlobal = service.createTag(GLOBAL_TAG_CATEGORY_ID, 'Reviewed');
    let req = http.expectOne((r) => r.method === 'PUT' && r.url === API);
    req.flush(req.request.body);
    await addGlobal;

    const addTooling = service.createTag(typeTagCategoryId('Tooling'), 'Airway');
    req = http.expectOne((r) => r.method === 'PUT' && r.url === API);
    req.flush(req.request.body);
    await addTooling;

    const addCharacters = service.createTag(
      typeTagCategoryId('Characters'),
      'Pediatric',
    );
    req = http.expectOne((r) => r.method === 'PUT' && r.url === API);
    req.flush(req.request.body);
    await addCharacters;

    const toolingLabels = service
      .tagsAvailableForAssetType('Tooling')
      .map((t) => t.label);
    expect(toolingLabels).toContain('Reviewed');
    expect(toolingLabels).toContain('Airway');
    expect(toolingLabels).toContain('Grabbable');
    const characterLabels = service
      .tagsAvailableForAssetType('Characters')
      .map((t) => t.label);
    expect(characterLabels).toContain('Reviewed');
    expect(characterLabels).toContain('Pediatric');
    expect(characterLabels).toContain('Core');
  });

  it('registers unknown overlay labels onto Custom for every type', async () => {
    await loadEmpty();

    const registering = service.ensureAuthoredTags(['Needs Review', 'Military']);
    const req = http.expectOne((r) => r.method === 'PUT' && r.url === API);
    expect(
      req.request.body.tags.map((t: { label: string }) => t.label),
    ).toContain('Needs Review');
    expect(
      req.request.body.tags.filter((t: { label: string }) => t.label === 'Military')
        .length,
    ).toBe(1);
    req.flush(req.request.body);
    await registering;

    expect(
      service.tagsForCategory(CUSTOM_TAG_CATEGORY_ID).map((t) => t.label),
    ).toEqual(['Needs Review']);
    expect(
      service.tagsAvailableForAssetType('Tooling').map((t) => t.label),
    ).toContain('Needs Review');
    expect(
      service.tagsAvailableForAssetType('Characters').map((t) => t.label),
    ).toContain('Needs Review');
  });

  it('refuses to delete a scraped tag', async () => {
    await loadEmpty();
    const core = service.tags().find((t) => t.label === 'Core');
    expect(core).toBeTruthy();
    await service.deleteTag(core!.dataId);
    http.expectNone(API);
    expect(service.tags().some((t) => t.label === 'Core')).toBeTrue();
  });

  it('refuses to delete a built-in type group', async () => {
    await loadEmpty();
    await service.deleteCategory(typeTagCategoryId('Tooling'));
    http.expectNone(API);
    expect(
      service.typeCategories().some((c) => c.label === 'Tooling'),
    ).toBeTrue();
  });

  it('reloads an unflushed draft instead of the API copy', async () => {
    localStorage.setItem(TAG_TAXONOMY_DRAFT_KEY, '1');
    localStorage.setItem(
      TAG_TAXONOMY_STORAGE_KEY,
      JSON.stringify({
        categories: [
          {
            dataId: GLOBAL_TAG_CATEGORY_ID,
            label: 'Global',
            tags: [],
            scope: 'global',
          },
        ],
        tags: [],
      }),
    );

    await service.reload();
    http.expectNone(API);
    expect(service.globalCategory()?.label).toBe('Global');
    expect(service.typeCategories().length).toBe(UNITY_CATEGORY_ORDER.length);
    expect(service.dirty()).toBeTrue();
  });
});
