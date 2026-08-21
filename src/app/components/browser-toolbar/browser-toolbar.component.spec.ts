import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { emptyAssetMetaRecord } from '../../models/asset-meta.models';
import { DboAsset } from '../../models/dbo.models';
import { AppStateService } from '../../services/app-state.service';
import { AssetMetaService } from '../../services/asset-meta.service';
import { TagTaxonomyService } from '../../services/tag-taxonomy.service';
import { BrowserToolbarComponent } from './browser-toolbar.component';

function tool(id: string, tags: string[]): DboAsset {
  return {
    AssetId: id,
    AssetName: id,
    AssetType: 'Tool',
    Tags: tags,
    Data: {},
    _Category: 'Tooling',
    _File: 'unity.json',
  };
}

describe('BrowserToolbarComponent', () => {
  let fixture: ComponentFixture<BrowserToolbarComponent>;
  let state: AppStateService;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [BrowserToolbarComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const tags = TestBed.inject(TagTaxonomyService);
    http = TestBed.inject(HttpTestingController);
    const loaded = tags.ensureLoaded();
    http.expectOne('http://localhost:4301/tag-taxonomy').flush({
      categories: [],
      tags: [],
    });
    await loaded;

    state = TestBed.inject(AppStateService);
    state.rawData.set({
      'unity.json': {
        Tooling: [
          tool('scalpel', ['Grabbable']),
          tool('cart', ['Grabbable', 'Generator']),
          tool('tray', ['Prop']),
        ],
      },
    });
    state.currentFile.set('unity.json');
    state.currentCategory.set('Tooling');

    fixture = TestBed.createComponent(BrowserToolbarComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('offers a matching tag from the search box', () => {
    const input = fixture.debugElement.query(By.css('input'));
    input.triggerEventHandler('ngModelChange', 'grab');
    input.triggerEventHandler('focus', null);
    fixture.detectChanges();

    const suggestion = fixture.debugElement.query(By.css('.tag-suggest-item'));
    expect(suggestion.nativeElement.textContent).toContain('Grabbable');
    suggestion.triggerEventHandler('mousedown', new MouseEvent('mousedown'));
    fixture.detectChanges();

    expect(state.selectedTagLabels()).toEqual(['Grabbable']);
    expect(state.searchQuery()).toBe('');
  });

  it('offers a matching status from the search box', () => {
    TestBed.inject(AssetMetaService).records.set({
      scalpel: { ...emptyAssetMetaRecord('scalpel'), status: 'Functional' },
    });
    fixture.detectChanges();

    const input = fixture.debugElement.query(By.css('input'));
    input.triggerEventHandler('ngModelChange', 'work');
    input.triggerEventHandler('focus', null);
    fixture.detectChanges();

    const suggestion = fixture.debugElement.query(By.css('.tag-suggest-item'));
    expect(suggestion.nativeElement.textContent).toContain('Functional');
    suggestion.triggerEventHandler('mousedown', new MouseEvent('mousedown'));
    fixture.detectChanges();

    expect(state.selectedStatuses()).toEqual(['Functional']);
    expect(state.searchQuery()).toBe('');
  });

  it('puts Status and Tags pickers in the search row, not a chip row', () => {
    expect(fixture.debugElement.query(By.css('.active-filters'))).toBeNull();
    expect(
      fixture.debugElement.query(By.css('[data-filter="status"]')).nativeElement
        .textContent,
    ).toContain('Include');
    expect(fixture.debugElement.query(By.css('[data-filter="tags"]'))).toBeTruthy();
  });

  it('opens a type-scoped tag picker from the toolbar', () => {
    fixture.debugElement.query(By.css('[data-filter="tags"]')).nativeElement.click();
    fixture.detectChanges();

    const labels = fixture.debugElement
      .queryAll(By.css('.tag-picker-option'))
      .map((el) => (el.nativeElement as HTMLElement).textContent ?? '');
    expect(labels.some((t) => t.includes('Grabbable'))).toBeTrue();
    expect(labels.some((t) => t.includes('Generator'))).toBeTrue();
    expect(labels.some((t) => t.includes('Prop'))).toBeTrue();
    expect(labels.some((t) => t.includes('Core'))).toBeFalse();
  });

  it('shows selected tag chips in a row under the search bar', () => {
    fixture.debugElement.query(By.css('[data-filter="tags"]')).nativeElement.click();
    fixture.detectChanges();

    const grabbable = fixture.debugElement
      .queryAll(By.css('.tag-picker-option'))
      .find((el) =>
        (el.nativeElement as HTMLElement).textContent?.includes('Grabbable'),
      );
    expect(grabbable).toBeTruthy();
    grabbable!.query(By.css('input')).nativeElement.click();
    fixture.detectChanges();

    expect(state.selectedTagLabels()).toEqual(['Grabbable']);
    expect(state.filteredListItems().map((item) => item.AssetId)).toEqual([
      'scalpel',
      'cart',
    ]);

    const chips = fixture.debugElement
      .queryAll(By.css('.active-filters .tag-filter'))
      .map((el) => (el.nativeElement as HTMLElement).textContent ?? '');
    expect(chips.some((t) => t.includes('Grabbable'))).toBeTrue();
  });

  it('matches any selected tag after switching to OR', () => {
    fixture.debugElement.query(By.css('[data-filter="tags"]')).nativeElement.click();
    fixture.detectChanges();

    fixture.debugElement.query(By.css('[data-mode="or"]')).nativeElement.click();
    fixture.debugElement
      .queryAll(By.css('.tag-picker-option'))
      .find((el) =>
        (el.nativeElement as HTMLElement).textContent?.includes('Grabbable'),
      )!
      .query(By.css('input'))
      .nativeElement.click();
    fixture.debugElement
      .queryAll(By.css('.tag-picker-option'))
      .find((el) =>
        (el.nativeElement as HTMLElement).textContent?.includes('Prop'),
      )!
      .query(By.css('input'))
      .nativeElement.click();
    fixture.detectChanges();

    expect(state.filteredListItems().map((item) => item.AssetId)).toEqual([
      'scalpel',
      'cart',
      'tray',
    ]);

    fixture.debugElement.query(By.css('[data-mode="and"]')).nativeElement.click();
    fixture.detectChanges();
    expect(state.filteredListItems().map((item) => item.AssetId)).toEqual([]);
  });

  it('includes Custom overlay tags in the category picker', async () => {
    const taxonomy = TestBed.inject(TagTaxonomyService);
    const registering = taxonomy.ensureAuthoredTags(['Needs Review']);
    const req = http.expectOne(
      (r) => r.method === 'PUT' && r.url === 'http://localhost:4301/tag-taxonomy',
    );
    req.flush(req.request.body);
    await registering;

    TestBed.inject(AssetMetaService).records.set({
      scalpel: {
        ...emptyAssetMetaRecord('scalpel'),
        tags: ['Needs Review'],
      },
    });
    fixture.detectChanges();

    fixture.debugElement.query(By.css('[data-filter="tags"]')).nativeElement.click();
    fixture.detectChanges();

    const labels = fixture.debugElement
      .queryAll(By.css('.tag-picker-option'))
      .map((el) => (el.nativeElement as HTMLElement).textContent ?? '');
    expect(labels.some((t) => t.includes('Needs Review'))).toBeTrue();
  });

  it('filters picker tags by the popup search', () => {
    fixture.debugElement.query(By.css('[data-filter="tags"]')).nativeElement.click();
    fixture.detectChanges();

    const search = fixture.debugElement.query(By.css('.tag-picker-search'));
    search.triggerEventHandler('ngModelChange', 'prop');
    fixture.detectChanges();

    const labels = fixture.debugElement
      .queryAll(By.css('.tag-picker-option'))
      .map((el) => (el.nativeElement as HTMLElement).textContent ?? '');
    expect(labels.length).toBe(1);
    expect(labels[0]).toContain('Prop');
  });

  it('filters the list from the Status picker and keeps chips in the extra row', () => {
    TestBed.inject(AssetMetaService).records.set({
      scalpel: { ...emptyAssetMetaRecord('scalpel'), status: 'Functional' },
      cart: { ...emptyAssetMetaRecord('cart'), status: 'Stable' },
    });
    fixture.detectChanges();

    fixture.debugElement.query(By.css('[data-filter="status"]')).nativeElement.click();
    fixture.detectChanges();

    fixture.debugElement
      .queryAll(By.css('.status-picker .tag-picker-option'))
      .find((el) =>
        (el.nativeElement as HTMLElement).textContent?.includes('Functional'),
      )!
      .query(By.css('input'))
      .nativeElement.click();
    fixture.detectChanges();

    expect(state.filteredListItems().map((item) => item.AssetId)).toEqual([
      'scalpel',
    ]);
    expect(
      fixture.debugElement.query(By.css('.active-filters .status-filter'))
        .nativeElement.textContent,
    ).toContain('Functional');

    fixture.debugElement.query(By.css('[data-mode="exclude"]')).nativeElement.click();
    fixture.detectChanges();
    expect(state.filteredListItems().map((item) => item.AssetId)).toEqual([
      'cart',
      'tray',
    ]);
  });
});
