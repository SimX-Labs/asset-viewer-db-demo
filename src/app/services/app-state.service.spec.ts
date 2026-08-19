import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { DboAsset } from '../models/dbo.models';
import { AppStateService } from './app-state.service';

function asset(id: string, name = id): DboAsset {
  return { AssetId: id, AssetName: name, AssetType: 'Tool', Data: {} };
}

describe('AppStateService tab preview', () => {
  let state: AppStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });
    state = TestBed.inject(AppStateService);
    state.assetMap.set({
      scalpel: asset('scalpel', 'Scalpel'),
      tray: asset('tray', 'Tray'),
      forceps: asset('forceps', 'Forceps'),
    });
  });

  it('shows a list selection without creating a persistent tab', () => {
    state.previewAsset('scalpel');

    expect(state.activeTabId()).toBe('scalpel');
    expect(state.activeAssetId()).toBe('scalpel');
    expect(state.previewTabId()).toBe('scalpel');
    expect(state.openTabIds()).toEqual([]);
  });

  it('discards an uncommitted preview when another list item is selected', () => {
    state.previewAsset('scalpel');
    state.previewAsset('tray');

    expect(state.activeTabId()).toBe('tray');
    expect(state.previewTabId()).toBe('tray');
    expect(state.openTabIds()).toEqual([]);
    expect(state.tabHistory()['scalpel']).toBeUndefined();
  });

  it('commits a preview after the user interacts with the detail page', () => {
    state.previewAsset('scalpel');
    state.commitPreviewTab();

    expect(state.previewTabId()).toBeNull();
    expect(state.openTabIds()).toEqual(['scalpel']);
    expect(state.activeTabId()).toBe('scalpel');
  });

  it('reuses an existing committed tab instead of creating a preview', () => {
    state.openAssetTab('scalpel', true);
    state.previewAsset('tray');
    state.previewAsset('scalpel');

    expect(state.openTabIds()).toEqual(['scalpel']);
    expect(state.previewTabId()).toBeNull();
    expect(state.activeTabId()).toBe('scalpel');
  });

  it('discards an uncommitted preview when switching to another committed tab', () => {
    state.openAssetTab('scalpel', true);
    state.previewAsset('tray');
    state.activateTab('scalpel');

    expect(state.previewTabId()).toBeNull();
    expect(state.openTabIds()).toEqual(['scalpel']);
    expect(state.activeTabId()).toBe('scalpel');
    expect(state.tabHistory()['tray']).toBeUndefined();
  });

  it('commits the current preview when the user pins or follows a link', () => {
    state.previewAsset('scalpel');
    state.togglePin('scalpel');

    expect(state.openTabIds()).toEqual(['scalpel']);
    expect(state.previewTabId()).toBeNull();
    expect(state.isPinned('scalpel')).toBeTrue();

    state.previewAsset('tray');
    state.openAssetTab('forceps', false);

    expect(state.openTabIds()).toContain('tray');
    expect(state.previewTabId()).toBeNull();
  });
});

describe('AppStateService tag filters', () => {
  let state: AppStateService;

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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });
    state = TestBed.inject(AppStateService);
    state.rawData.set({
      'unity.json': {
        Tooling: [
          tool('scalpel', ['Grabbable']),
          tool('cart', ['Grabbable', 'Generator']),
          tool('tray', ['Prop']),
        ],
        Characters: [tool('adult', ['Core'])],
      },
    });
    state.currentFile.set('unity.json');
    state.currentCategory.set('Tooling');
  });

  it('filters the list to assets that have every selected tag', () => {
    state.toggleTagFilter('Grabbable');
    expect(state.filteredListItems().map((i) => i.AssetId)).toEqual([
      'scalpel',
      'cart',
    ]);

    state.toggleTagFilter('Generator');
    expect(state.filteredListItems().map((i) => i.AssetId)).toEqual(['cart']);
  });

  it('filters the list to assets that have any selected tag in OR mode', () => {
    state.toggleTagFilter('Grabbable');
    state.toggleTagFilter('Prop');
    expect(state.filteredListItems().map((i) => i.AssetId)).toEqual([]);

    state.setTagMatchMode('or');
    expect(state.filteredListItems().map((i) => i.AssetId)).toEqual([
      'scalpel',
      'cart',
      'tray',
    ]);
  });

  it('keeps match mode when switching categories', () => {
    state.setTagMatchMode('or');
    state.toggleTagFilter('Grabbable');
    state.selectCategory('Characters', 'unity.json');

    expect(state.tagMatchMode()).toBe('or');
    expect(state.selectedTagLabels()).toEqual([]);
    expect(state.filteredListItems().map((i) => i.AssetId)).toEqual(['adult']);
  });

  it('drops type-specific tags when switching categories', () => {
    state.toggleTagFilter('Grabbable');
    state.selectCategory('Characters', 'unity.json');

    expect(state.selectedTagLabels()).toEqual([]);
    expect(state.filteredListItems().map((i) => i.AssetId)).toEqual(['adult']);
  });
});
