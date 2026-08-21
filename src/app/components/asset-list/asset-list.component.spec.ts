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
import { AssetListComponent } from './asset-list.component';

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

function names(fixture: ComponentFixture<AssetListComponent>): string[] {
  return fixture.debugElement
    .queryAll(By.css('.asset-name'))
    .map((el) => (el.nativeElement as HTMLElement).textContent?.trim() ?? '');
}

describe('AssetListComponent tag filters', () => {
  let fixture: ComponentFixture<AssetListComponent>;
  let state: AppStateService;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AssetListComponent],
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

    fixture = TestBed.createComponent(AssetListComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('lists every asset before a tag is selected', () => {
    expect(names(fixture)).toEqual(['scalpel', 'cart', 'tray']);
  });

  it('filters the list when a tag is selected', () => {
    state.toggleTagFilter('Grabbable');
    fixture.detectChanges();
    expect(names(fixture)).toEqual(['scalpel', 'cart']);
  });

  it('matches any selected tag after switching to OR', () => {
    state.setTagMatchMode('or');
    state.toggleTagFilter('Grabbable');
    state.toggleTagFilter('Prop');
    fixture.detectChanges();
    expect(names(fixture)).toEqual(['scalpel', 'cart', 'tray']);

    state.setTagMatchMode('and');
    fixture.detectChanges();
    expect(names(fixture)).toEqual([]);
  });
});

describe('AssetListComponent status filters', () => {
  let fixture: ComponentFixture<AssetListComponent>;
  let state: AppStateService;
  let http: HttpTestingController;

  function tool(id: string): DboAsset {
    return {
      AssetId: id,
      AssetName: id,
      AssetType: 'Tool',
      Tags: ['Grabbable'],
      Data: {},
      _Category: 'Tooling',
      _File: 'unity.json',
    };
  }

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AssetListComponent],
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
    TestBed.inject(AssetMetaService).records.set({
      scalpel: { ...emptyAssetMetaRecord('scalpel'), status: 'Functional' },
      cart: { ...emptyAssetMetaRecord('cart'), status: 'Stable' },
    });
    state.rawData.set({
      'unity.json': {
        Tooling: [tool('scalpel'), tool('cart'), tool('tray')],
      },
    });
    state.currentFile.set('unity.json');
    state.currentCategory.set('Tooling');

    fixture = TestBed.createComponent(AssetListComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('filters the list with Include/Exclude status', () => {
    state.toggleStatusFilter('Functional');
    fixture.detectChanges();
    expect(names(fixture)).toEqual(['scalpel']);

    state.setStatusMatchMode('exclude');
    fixture.detectChanges();
    expect(names(fixture)).toEqual(['cart', 'tray']);
  });

  it('marks each row with overlay status for the selected bar', () => {
    const statuses = fixture.debugElement
      .queryAll(By.css('.asset-item'))
      .map((el) => (el.nativeElement as HTMLElement).getAttribute('data-status'));
    expect(statuses).toEqual(['Functional', 'Stable', 'unset']);
  });
});
