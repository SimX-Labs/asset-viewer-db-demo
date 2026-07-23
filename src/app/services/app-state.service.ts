import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  DboAsset,
  MessageMode,
  TabState,
  ToolNode,
} from '../models/dbo.models';
import { DboDataService, DboLoadResult } from './dbo-data.service';
import { UnityDataService } from './unity-data.service';
import { matchesFilter } from '../utils/property.util';

export type DataMode = 'dbo' | 'unity';
const DATA_MODE_KEY = 'assetViewer.dataMode';
const COLLAPSED_PROPS_KEY = 'assetViewer.collapsedProps';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private readonly dboData = inject(DboDataService);
  private readonly unityData = inject(UnityDataService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly dataMode = signal<DataMode>('dbo');

  readonly loaded = signal(false);
  readonly statusMessage = signal('');
  readonly statusError = signal(false);
  readonly rawData = signal<Record<string, Record<string, DboAsset[]>>>({});
  readonly loadedFileNames = signal<string[]>([]);
  readonly assetMap = signal<Record<string, DboAsset>>({});
  readonly allToolsMap = signal<Record<string, ToolNode>>({});

  readonly currentCategory = signal<string | null>(null);
  readonly currentFile = signal<string | null>(null);
  readonly searchQuery = signal('');

  readonly pinnedAssetIds = signal<string[]>([]);
  readonly openTabIds = signal<string[]>([]);
  readonly activeTabId = signal<string | null>(null);
  readonly tabHistory = signal<Record<string, string[]>>({});
  readonly messageMode = signal<MessageMode>('package');
  readonly currentWebGLAssetId = signal<string | null>(null);
  readonly expandedFiles = signal<Record<string, boolean>>({});

  // Collapsed detail-property sections, keyed by property name so the state
  // persists as the user switches between assets (and across reloads).
  readonly collapsedPropKeys = signal<Record<string, boolean>>(this.loadCollapsedPropKeys());

  readonly filteredListItems = computed(() => {
    const cat = this.currentCategory();
    const file = this.currentFile();
    const query = this.searchQuery();
    const data = this.rawData();
    if (!cat || !file || !data[file]?.[cat]) return [];
    return data[file][cat].filter((item) => matchesFilter(item, query));
  });

  readonly activeAssetId = computed(() => {
    const tabId = this.activeTabId();
    if (!tabId) return null;
    const history = this.tabHistory()[tabId];
    return history?.[history.length - 1] ?? null;
  });

  async loadDefaults(): Promise<void> {
    this.dataMode.set(this.readStoredMode());
    await this.loadForCurrentMode();
  }

  private async loadForCurrentMode(): Promise<void> {
    try {
      const mode = this.dataMode();
      const result =
        mode === 'unity'
          ? await this.unityData.loadBundle()
          : await this.dboData.loadDefaultFiles();
      this.applyLoadResult(result);
      const label = mode === 'unity' ? 'Unity asset DB' : 'DBO files';
      this.statusMessage.set(
        `Loaded ${label} (${Object.keys(result.assetMap).length} assets).`
      );
      this.statusError.set(false);
      this.loaded.set(true);
      this.handleInitialNavigation();
    } catch (err) {
      this.statusMessage.set(`Error: ${(err as Error).message}`);
      this.statusError.set(true);
    }
  }

  async setDataMode(mode: DataMode): Promise<void> {
    if (mode === this.dataMode()) return;
    this.dataMode.set(mode);
    this.persistMode(mode);
    this.resetForModeSwitch();
    this.loaded.set(false);
    await this.loadForCurrentMode();
  }

  private resetForModeSwitch(): void {
    this.openTabIds.set([]);
    this.activeTabId.set(null);
    this.tabHistory.set({});
    this.pinnedAssetIds.set([]);
    this.currentCategory.set(null);
    this.currentFile.set(null);
    this.searchQuery.set('');
    this.currentWebGLAssetId.set(null);
    this.setUrlHash('');
  }

  private readStoredMode(): DataMode {
    if (!isPlatformBrowser(this.platformId)) return this.dataMode();
    return localStorage.getItem(DATA_MODE_KEY) === 'unity' ? 'unity' : 'dbo';
  }

  private persistMode(mode: DataMode): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(DATA_MODE_KEY, mode);
  }

  applyLoadResult(result: DboLoadResult): void {
    this.rawData.set(result.rawData);
    this.loadedFileNames.set(result.loadedFileNames);
    this.assetMap.set(result.assetMap);
    this.allToolsMap.set(result.allToolsMap);
    const expanded: Record<string, boolean> = {};
    result.loadedFileNames.forEach((f, i) => (expanded[f] = i === 0));
    this.expandedFiles.set(expanded);
  }

  private handleInitialNavigation(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const hash = window.location.hash.substring(1);
    const map = this.assetMap();
    if (hash && map[hash]) {
      const asset = map[hash];
      if (asset._Category && asset._File) this.selectCategory(asset._Category, asset._File);
      this.openAssetTab(hash, true);
      return;
    }
    const names = this.loadedFileNames();
    if (names.length > 0) {
      const firstFile = names[0];
      const firstCat = Object.keys(this.rawData()[firstFile])[0];
      if (firstCat) this.selectCategory(firstCat, firstFile);
    }
  }

  selectCategory(cat: string, file: string): void {
    this.currentCategory.set(cat);
    this.currentFile.set(file);
    this.searchQuery.set('');
  }

  toggleFileAccordion(fileName: string): void {
    const current = this.expandedFiles();
    this.expandedFiles.set({ ...current, [fileName]: !current[fileName] });
  }

  isPropCollapsed(key: string): boolean {
    return this.collapsedPropKeys()[key] === true;
  }

  togglePropKey(key: string): void {
    const current = { ...this.collapsedPropKeys() };
    if (current[key]) delete current[key];
    else current[key] = true;
    this.collapsedPropKeys.set(current);
    this.persistCollapsedPropKeys(current);
  }

  private loadCollapsedPropKeys(): Record<string, boolean> {
    if (!isPlatformBrowser(this.platformId)) return {};
    try {
      const raw = localStorage.getItem(COLLAPSED_PROPS_KEY);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  }

  private persistCollapsedPropKeys(value: Record<string, boolean>): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(COLLAPSED_PROPS_KEY, JSON.stringify(value));
  }

  togglePin(assetId: string): void {
    const pins = [...this.pinnedAssetIds()];
    const idx = pins.indexOf(assetId);
    if (idx === -1) pins.push(assetId);
    else pins.splice(idx, 1);
    this.pinnedAssetIds.set(pins);
  }

  isPinned(assetId: string): boolean {
    return this.pinnedAssetIds().includes(assetId);
  }

  openAssetTab(assetId: string, isRoot = false): void {
    const asset = this.assetMap()[assetId];
    if (!asset) return;

    if (!isRoot && this.activeTabId()) {
      const tabId = this.activeTabId()!;
      const current = this.tabHistory()[tabId] ?? [];
      // Already viewing this asset — just sync the URL, don't grow the trail.
      if (current[current.length - 1] === assetId) {
        this.setUrlHash(assetId);
        return;
      }
      // Revisiting an asset already in the trail: jump back to it instead of
      // appending a duplicate. Duplicate ids in the breadcrumb produce
      // duplicate @for track keys (NG0955), which corrupts view rendering.
      const existingIdx = current.indexOf(assetId);
      const history = { ...this.tabHistory() };
      history[tabId] =
        existingIdx === -1
          ? [...current, assetId]
          : current.slice(0, existingIdx + 1);
      this.tabHistory.set(history);
      this.setUrlHash(assetId);
      return;
    }

    const tabs = [...this.openTabIds()];
    if (!tabs.includes(assetId)) {
      tabs.push(assetId);
      this.openTabIds.set(tabs);
      const history = { ...this.tabHistory() };
      history[assetId] = [assetId];
      this.tabHistory.set(history);
    }
    this.activateTab(assetId);
  }

  activateTab(tabId: string): void {
    this.activeTabId.set(tabId);
    const history = this.tabHistory()[tabId];
    if (history?.length) this.setUrlHash(history[history.length - 1]);
  }

  navigateBreadcrumb(tabId: string, index: number): void {
    const history = { ...this.tabHistory() };
    history[tabId] = history[tabId].slice(0, index + 1);
    this.tabHistory.set(history);
    const targetId = history[tabId][history[tabId].length - 1];
    this.setUrlHash(targetId);
  }

  closeTab(assetId: string): void {
    if (this.currentWebGLAssetId() === assetId) this.closeWebGLView();
    const prevTabs = this.openTabIds();
    const idx = prevTabs.indexOf(assetId);
    const tabs = prevTabs.filter((id) => id !== assetId);
    const history = { ...this.tabHistory() };
    delete history[assetId];
    this.tabHistory.set(history);
    this.openTabIds.set(tabs);

    if (tabs.length === 0) {
      this.activeTabId.set(null);
      this.setUrlHash('');
    } else if (this.activeTabId() === assetId) {
      const nextId = tabs[Math.max(0, idx - 1)] ?? tabs[0];
      this.activateTab(nextId);
    }
  }

  closeAllTabs(): void {
    this.closeWebGLView();
    this.openTabIds.set([]);
    this.activeTabId.set(null);
    this.tabHistory.set({});
    this.setUrlHash('');
  }

  getActiveAsset(): DboAsset | null {
    const tabId = this.activeTabId();
    if (!tabId) return null;
    const history = this.tabHistory()[tabId];
    const assetId = history?.[history.length - 1];
    return assetId ? this.assetMap()[assetId] ?? null : null;
  }

  getTabAsset(tabId: string): DboAsset | null {
    const history = this.tabHistory()[tabId];
    const assetId = history?.[history.length - 1];
    return assetId ? this.assetMap()[assetId] ?? null : null;
  }

  openWebGLView(assetId: string): void {
    this.currentWebGLAssetId.set(assetId);
  }

  closeWebGLView(): void {
    this.currentWebGLAssetId.set(null);
  }

  setUrlHash(id: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!id) {
      history.replaceState(null, '', ' ');
    } else if (window.location.hash.substring(1) !== id) {
      window.location.hash = id;
    }
  }

  handleHashChange(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const id = window.location.hash.substring(1);
    if (!id || !this.assetMap()[id]) return;

    const activeTab = this.activeTabId();
    if (activeTab) {
      const history = this.tabHistory()[activeTab];
      if (history?.[history.length - 1] === id) return;
      if (history?.includes(id)) {
        const idx = history.indexOf(id);
        this.navigateBreadcrumb(activeTab, idx);
        return;
      }
    }

    if (this.openTabIds().includes(id)) {
      this.activateTab(id);
      return;
    }

    this.openAssetTab(id, true);
  }

  async loadFilesFromInput(files: FileList, shiftKey: boolean): Promise<void> {
    if (this.dataMode() === 'unity') {
      const first = files.item(0);
      if (!first) return;
      const text = await first.text();
      const result = this.unityData.buildFromText(this.unityData.parseText(text));
      this.resetForModeSwitch();
      this.applyLoadResult(result);
      this.statusMessage.set(
        `Loaded Unity asset DB (${Object.keys(result.assetMap).length} assets).`
      );
      this.statusError.set(false);
      this.loaded.set(true);
      this.handleInitialNavigation();
      return;
    }

    const results: { name: string; data: Record<string, DboAsset[]> }[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text();
      results.push({ name: file.name, data: this.dboData.loadFromText(text, file.name) });
    }
    const result = this.dboData.mergeMultipleFiles(
      shiftKey ? this.rawData() : null,
      shiftKey ? this.loadedFileNames() : [],
      results,
      shiftKey
    );
    this.applyLoadResult(result);
    this.statusMessage.set(`Loaded ${result.loadedFileNames.length} file(s).`);
    this.statusError.set(false);
    this.loaded.set(true);
  }

  exportCsv(): void {
    const items = this.filteredListItems();
    const cat = this.currentCategory() ?? 'export';
    if (!items.length) {
      alert('No items to export.');
      return;
    }

    const headers = ['AssetId', 'AssetName', 'AssetType', 'AssetAddress', 'HasWebGLView'];
    const sample = items[0];
    if (sample.Data?.['ContainedTools']) {
      headers.push('ContainedTools_Count', 'ContainedTools_List');
    }
    if (sample.Data?.['InteractionSenders']) {
      headers.push('InteractionSenders_Count');
    }

    let csv = headers.join(',') + '\n';
    for (const item of items) {
      const row: (string | number | boolean)[] = [
        `"${item.AssetId ?? ''}"`,
        `"${item.AssetName ?? ''}"`,
        `"${item.AssetType ?? ''}"`,
        `"${(item.Data?.['AssetAddress'] as string) ?? ''}"`,
        Boolean(item.Data?.['HasWebGLView']),
      ];
      if (headers.includes('ContainedTools_Count')) {
        const tools = (item.Data?.['ContainedTools'] as { AssetId: string }[]) ?? [];
        row.push(tools.length, `"${tools.map((t) => t.AssetId).join(';')}"`);
      }
      if (headers.includes('InteractionSenders_Count')) {
        const senders = (item.Data?.['InteractionSenders'] as unknown[]) ?? [];
        row.push(senders.length);
      }
      csv += row.join(',') + '\n';
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SimX_Export_${cat}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
