import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { DboAsset } from '../../models/dbo.models';
import { AppStateService } from '../../services/app-state.service';
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

  function openPicker(): void {
    const btn = fixture.debugElement.query(By.css('.tag-picker-btn'));
    expect(btn).toBeTruthy();
    btn.nativeElement.click();
    fixture.detectChanges();
  }

  function pickerOption(label: string) {
    return fixture.debugElement
      .queryAll(By.css('.tag-picker-option'))
      .find((el) =>
        (el.nativeElement as HTMLElement).textContent?.includes(label),
      );
  }

  it('shows a Tags button that opens a picker of type-scoped tags', () => {
    expect(fixture.debugElement.query(By.css('.tag-picker-btn'))).toBeTruthy();
    expect(fixture.debugElement.queryAll(By.css('.tag-filter')).length).toBe(0);

    openPicker();

    const labels = fixture.debugElement
      .queryAll(By.css('.tag-picker-option'))
      .map((el) => (el.nativeElement as HTMLElement).textContent ?? '');
    expect(labels.some((t) => t.includes('Grabbable'))).toBeTrue();
    expect(labels.some((t) => t.includes('Generator'))).toBeTrue();
    expect(labels.some((t) => t.includes('Prop'))).toBeTrue();
    expect(labels.some((t) => t.includes('Core'))).toBeFalse();
  });

  it('filters the list when a picker tag is selected and keeps the chip visible', () => {
    openPicker();
    const grabbable = pickerOption('Grabbable');
    expect(grabbable).toBeTruthy();
    grabbable!.query(By.css('input')).nativeElement.click();
    fixture.detectChanges();

    const names = fixture.debugElement
      .queryAll(By.css('.asset-name'))
      .map((el) => (el.nativeElement as HTMLElement).textContent?.trim());
    expect(names).toEqual(['scalpel', 'cart']);

    const chips = fixture.debugElement
      .queryAll(By.css('.tag-filters > .tag-filter'))
      .map((el) => (el.nativeElement as HTMLElement).textContent ?? '');
    expect(chips.some((t) => t.includes('Grabbable'))).toBeTrue();
  });

  it('matches any selected tag after switching to OR', () => {
    openPicker();
    fixture.debugElement.query(By.css('[data-mode="or"]')).nativeElement.click();
    fixture.detectChanges();

    pickerOption('Grabbable')!.query(By.css('input')).nativeElement.click();
    pickerOption('Prop')!.query(By.css('input')).nativeElement.click();
    fixture.detectChanges();

    expect(
      fixture.debugElement
        .queryAll(By.css('.asset-name'))
        .map((el) => (el.nativeElement as HTMLElement).textContent?.trim()),
    ).toEqual(['scalpel', 'cart', 'tray']);

    fixture.debugElement.query(By.css('[data-mode="and"]')).nativeElement.click();
    fixture.detectChanges();

    expect(
      fixture.debugElement
        .queryAll(By.css('.asset-name'))
        .map((el) => (el.nativeElement as HTMLElement).textContent?.trim()),
    ).toEqual([]);
  });

  it('filters picker tags by the popup search', () => {
    openPicker();
    const search = fixture.debugElement.query(By.css('.tag-picker-search'));
    search.triggerEventHandler('ngModelChange', 'prop');
    fixture.detectChanges();

    const labels = fixture.debugElement
      .queryAll(By.css('.tag-picker-option'))
      .map((el) => (el.nativeElement as HTMLElement).textContent ?? '');
    expect(labels.length).toBe(1);
    expect(labels[0]).toContain('Prop');
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
});
