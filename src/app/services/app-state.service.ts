import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DboAsset, MessageMode, TabState, ToolNode } from '../models/dbo.models';
import { UNITY_SUBCATEGORY_DEFS } from '../models/unity-asset.models';
import { dataSourceLabel } from '../models/data-source';
import { DboLoadResult } from './dbo-data.service';
import { UnityDataService } from './unity-data.service';
import { matchesFilter } from '../utils/property.util';
import {
  assetMatchesStatuses,
  StatusFilterValue,
  StatusMatchMode,
} from '../utils/status-filter.util';
import { assetMatchesTags, mergeTagLists, TagMatchMode } from '../utils/tag-filter.util';
import { AssetMetaService } from './asset-meta.service';
import { OrbitViewerService } from '../orbit-capture/services/orbit-viewer.service';
import { resolveLocalDataPack } from '../utils/local-data-pack.util';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private readonly unityData = inject(UnityDataService);
  private readonly assetMeta = inject(AssetMetaService);
  private readonly orbitViewer = inject(OrbitViewerService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly loaded = signal(false);
  /**
   * Full-screen "Loading assets…" cover. On for the cold start (no catalog
   * yet). In-app work must call `requestLoadingCover()` to show it again.
   */
  readonly showLoadingCover = signal(true);
  readonly statusMessage = signal('');
  readonly statusError = signal(false);
  readonly rawData = signal<Record<string, Record<string, DboAsset[]>>>({});
  readonly loadedFileNames = signal<string[]>([]);
  readonly assetMap = signal<Record<string, DboAsset>>({});
  readonly allToolsMap = signal<Record<string, ToolNode>>({});

  readonly currentCategory = signal<string | null>(null);
  readonly currentFile = signal<string | null>(null);
  // Optional second-level filter within a category, keyed by the
  // value of that category's UNITY_SUBCATEGORY_DEFS field.
  readonly currentSubCategory = signal<string | null>(null);
  readonly searchQuery = signal('');
  /** Tag labels; scoped to the current category in the list UI. */
  readonly selectedTagLabels = signal<string[]>([]);
  /** How selected tags combine. Default AND matches existing list behavior. */
  readonly tagMatchMode = signal<TagMatchMode>('and');
  /** Overlay statuses to include or exclude. */
  readonly selectedStatuses = signal<StatusFilterValue[]>([]);
  /** Include selected statuses, or hide them. Default include. */
  readonly statusMatchMode = signal<StatusMatchMode>('include');

  readonly pinnedAssetIds = signal<string[]>([]);
  readonly openTabIds = signal<string[]>([]);
  /** List-cell preview that is not yet a persistent tab. */
  readonly previewTabId = signal<string | null>(null);
  readonly activeTabId = signal<string | null>(null);
  readonly tabHistory = signal<Record<string, string[]>>({});
  readonly messageMode = signal<MessageMode>('package');
  readonly currentWebGLAssetId = signal<string | null>(null);
  // Expanded state for categories that have subcategories (Tooling, Vessels, Audio, Videos).
  readonly expandedCategories = signal<Record<string, boolean>>({});

  /** Current category (and subcategory) before search / tag filters. */
  readonly categoryListItems = computed(() => {
    const cat = this.currentCategory();
    const file = this.currentFile();
    const sub = this.currentSubCategory();
    const data = this.rawData();
    if (!cat || !file || !data[file]?.[cat]) return [];
    let items = data[file][cat];
    if (sub) {
      const def = UNITY_SUBCATEGORY_DEFS[cat];
      if (def) {
        items = items.filter(
          (item) => ((item.Data?.[def.field] as string) ?? def.fallback) === sub,
        );
      }
    }
    return items;
  });

  /** Category items with overlay tags merged onto scrape tags. */
  readonly categoryListItemsWithTags = computed(() => {
    void this.assetMeta.records();
    void this.assetMeta.drafts();
    return this.categoryListItems().map((item) => ({
      ...item,
      Tags: mergeTagLists(item.Tags, this.assetMeta.tagsFor(item.AssetId)),
      status: this.assetMeta.effectiveStatus(item.AssetId),
    }));
  });

  readonly filteredListItems = computed(() => {
    const query = this.searchQuery();
    const tags = this.selectedTagLabels();
    const mode = this.tagMatchMode();
    const statuses = this.selectedStatuses();
    const statusMode = this.statusMatchMode();
    return this.categoryListItemsWithTags().filter(
      (item) =>
        matchesFilter(item, query) &&
        assetMatchesTags(item, tags, mode) &&
        assetMatchesStatuses(item, statuses, statusMode),
    );
  });

  readonly activeAssetId = computed(() => {
    const tabId = this.activeTabId();
    if (!tabId) return null;
    const history = this.tabHistory()[tabId];
    return history?.[history.length - 1] ?? null;
  });

  async loadDefaults(): Promise<void> {
    await this.loadUnityDb();
  }

  private async loadUnityDb(): Promise<void> {
    try {
      const result = await this.unityData.loadDb();
      this.applyLoadResult(result);
      const count = Object.keys(result.assetMap).length;
      this.statusMessage.set(
        count === 0
          ? 'No local data loaded. Settings → View Local Data.'
          : `Loaded Unity asset DB (${count} assets).`,
      );
      this.statusError.set(false);
      this.loaded.set(true);
      this.dismissLoadingCover();
      this.handleInitialNavigation();
    } catch {
      this.statusMessage.set(
        'No catalog on this host. Settings → View Local Data.',
      );
      this.statusError.set(false);
      this.loaded.set(true);
      this.dismissLoadingCover();
    }
  }

  /** Show the asset-load cover for an explicit catalog reload (folder). */
  requestLoadingCover(): void {
    this.showLoadingCover.set(true);
  }

  dismissLoadingCover(): void {
    this.showLoadingCover.set(false);
  }

  private resetCatalog(): void {
    this.openTabIds.set([]);
    this.previewTabId.set(null);
    this.activeTabId.set(null);
    this.tabHistory.set({});
    this.pinnedAssetIds.set([]);
    this.currentCategory.set(null);
    this.currentFile.set(null);
    this.currentSubCategory.set(null);
    this.expandedCategories.set({});
    this.searchQuery.set('');
    this.selectedTagLabels.set([]);
    this.tagMatchMode.set('and');
    this.selectedStatuses.set([]);
    this.statusMatchMode.set('include');
    this.currentWebGLAssetId.set(null);
    this.assetMeta.clearDrafts();
    this.setUrlHash('');
  }

  applyLoadResult(result: DboLoadResult): void {
    this.rawData.set(result.rawData);
    this.loadedFileNames.set(result.loadedFileNames);
    this.assetMap.set(result.assetMap);
    this.allToolsMap.set(result.allToolsMap);
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

  selectCategory(cat: string, file: string, subCategory: string | null = null): void {
    const prevCat = this.currentCategory();
    this.currentCategory.set(cat);
    this.currentFile.set(file);
    this.currentSubCategory.set(subCategory);
    this.searchQuery.set('');
    if (prevCat !== cat) this.pruneSelectedTags();
    // Keep a category's accordion open when it (or one of its subcategories) is
    // the active selection, so linking straight to a vessel reveals the tree.
    if (subCategory) {
      this.expandedCategories.set({ ...this.expandedCategories(), [cat]: true });
    }
  }

  toggleTagFilter(label: string): void {
    const trimmed = label.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    this.selectedTagLabels.update((list) => {
      const exists = list.some((t) => t.toLowerCase() === lower);
      return exists
        ? list.filter((t) => t.toLowerCase() !== lower)
        : [...list, trimmed];
    });
  }

  clearTagFilters(): void {
    this.selectedTagLabels.set([]);
  }

  setTagMatchMode(mode: TagMatchMode): void {
    this.tagMatchMode.set(mode);
  }

  toggleStatusFilter(value: StatusFilterValue): void {
    this.selectedStatuses.update((list) =>
      list.includes(value)
        ? list.filter((status) => status !== value)
        : [...list, value],
    );
  }

  clearStatusFilters(): void {
    this.selectedStatuses.set([]);
  }

  setStatusMatchMode(mode: StatusMatchMode): void {
    this.statusMatchMode.set(mode);
  }

  private pruneSelectedTags(): void {
    const present = new Set(
      this.categoryListItems().flatMap((item) =>
        (item.Tags ?? []).map((tag) => tag.toLowerCase()),
      ),
    );
    this.selectedTagLabels.update((list) =>
      list.filter((label) => present.has(label.toLowerCase())),
    );
  }

  toggleCategoryAccordion(cat: string): void {
    const current = this.expandedCategories();
    this.expandedCategories.set({ ...current, [cat]: !current[cat] });
  }

  togglePin(assetId: string): void {
    const pins = [...this.pinnedAssetIds()];
    const idx = pins.indexOf(assetId);
    if (idx === -1) pins.push(assetId);
    else pins.splice(idx, 1);
    this.pinnedAssetIds.set(pins);
    this.commitPreviewTab();
  }

  isPinned(assetId: string): boolean {
    return this.pinnedAssetIds().includes(assetId);
  }

  /**
   * Show an asset from a list-cell click without creating a persistent tab.
   * An existing committed tab is reused. A previous uncommitted preview is discarded.
   */
  previewAsset(assetId: string): void {
    const asset = this.assetMap()[assetId];
    if (!asset) return;

    if (this.openTabIds().includes(assetId)) {
      this.discardPreview();
      this.activateTab(assetId);
      return;
    }

    if (this.previewTabId() === assetId && this.activeTabId() === assetId) {
      this.setUrlHash(assetId);
      return;
    }

    this.discardPreview();
    const history = { ...this.tabHistory() };
    history[assetId] = [assetId];
    this.tabHistory.set(history);
    this.previewTabId.set(assetId);
    this.activeTabId.set(assetId);
    this.setUrlHash(assetId);
  }

  /** Promote the current list preview into a real tab after the user interacts with the page. */
  commitPreviewTab(): void {
    const previewId = this.previewTabId();
    if (!previewId) return;
    const tabs = [...this.openTabIds()];
    if (!tabs.includes(previewId)) {
      tabs.push(previewId);
      this.openTabIds.set(tabs);
    }
    if (!this.tabHistory()[previewId]?.length) {
      const history = { ...this.tabHistory() };
      history[previewId] = [previewId];
      this.tabHistory.set(history);
    }
    this.previewTabId.set(null);
    this.activateTab(previewId);
  }

  private discardPreview(): void {
    const previewId = this.previewTabId();
    if (!previewId) return;
    if (!this.openTabIds().includes(previewId)) {
      const history = { ...this.tabHistory() };
      delete history[previewId];
      this.tabHistory.set(history);
    }
    this.previewTabId.set(null);
  }

  openAssetTab(assetId: string, isRoot = false): void {
    const asset = this.assetMap()[assetId];
    if (!asset) return;

    const previewId = this.previewTabId();
    if (previewId && (previewId === assetId || !isRoot)) {
      this.commitPreviewTab();
    } else if (previewId) {
      this.discardPreview();
    }

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
    if (this.previewTabId() && this.previewTabId() !== tabId) {
      this.discardPreview();
    }
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
    if (this.previewTabId() === assetId) this.previewTabId.set(null);
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
    this.previewTabId.set(null);
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

  isTabDirty(tabId: string): boolean {
    void this.assetMeta.dirtyIds();
    const history = this.tabHistory()[tabId] ?? [tabId];
    return history.some((id) => this.assetMeta.isDirty(id));
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

  async loadUnityDbFolder(files: FileList): Promise<void> {
    this.requestLoadingCover();
    try {
      const result = await this.unityData.buildFromFolderFiles(Array.from(files));
      this.resetCatalog();
      this.applyLoadResult(result);
      this.statusMessage.set(
        `Loaded Unity asset DB (${Object.keys(result.assetMap).length} assets).`
      );
      this.statusError.set(false);
      this.loaded.set(true);
      this.handleInitialNavigation();
    } catch (err) {
      this.statusMessage.set(`Error: ${(err as Error).message}`);
      this.statusError.set(true);
    } finally {
      this.dismissLoadingCover();
    }
  }

  /**
   * Load a shared zip extract: a folder containing `db/` and `assets/`.
   * The directory handle is resolved lazily so 3D files are not read up front.
   */
  async loadLocalDataPack(root: FileSystemDirectoryHandle): Promise<void> {
    this.requestLoadingCover();
    try {
      const pack = await resolveLocalDataPack(root);
      if (!pack.db) {
        throw new Error(
          'No db/ folder found. Select the unzipped folder that contains db/ and assets/.',
        );
      }
      const result = await this.unityData.buildFromDirectoryHandle(pack.db);
      this.resetCatalog();
      this.applyLoadResult(result);
      const count = Object.keys(result.assetMap).length;
      if (pack.assets) {
        await this.orbitViewer.applyRootHandle(pack.assets);
        const captures = this.orbitViewer.captureNames().length;
        this.statusMessage.set(
          `Loaded local data (${count} assets, ${captures} 3D captures).`,
        );
      } else {
        this.statusMessage.set(
          `Loaded local db (${count} assets). No assets/ folder — 3D models unavailable.`,
        );
      }
      this.statusError.set(false);
      this.loaded.set(true);
      this.handleInitialNavigation();
    } catch (err) {
      this.statusMessage.set(
        `Error: ${err instanceof Error ? err.message : 'Failed to load local data.'}`,
      );
      this.statusError.set(true);
    } finally {
      this.dismissLoadingCover();
    }
  }

  exportCsv(): void {
    const items = this.filteredListItems();
    const cat = this.currentCategory() ?? 'export';
    if (!items.length) {
      alert('No items to export.');
      return;
    }

    const headers = [
      'AssetId',
      'AssetName',
      'AssetType',
      'Source',
      'Tags',
      'AssetAddress',
      'HasWebGLView',
    ];
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
        `"${item._Source ? dataSourceLabel(item._Source) : ''}"`,
        `"${(item.Tags ?? []).join(';')}"`,
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
