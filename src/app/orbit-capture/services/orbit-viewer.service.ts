// services/orbit-viewer.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { OrbitCaptureBundle } from '../models/orbit-manifest';
import {
  BirdsEyeCapture,
  BirdsEyeManifest,
  parseBirdsEyeProjection,
} from '../models/birdseye-projection';
import { OrbitCaptureLoaderService } from './orbit-capture-loader.service';
import { localFolderDataEnabled } from '../../utils/runtime-host.util';

const IDB_NAME = 'orbit-viewer';
const IDB_STORE = 'handles';
const ROOT_KEY = 'modelsRoot';

type PermissionHandle = FileSystemDirectoryHandle & {
  queryPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

/**
 * Central owner of the orbit-capture modal + the "models root" folder.
 * The root folder contains one subfolder per tool addressable; a capture is
 * resolved by matching the asset's addressable to a subfolder name.
 *
 * The root handle is persisted in IndexedDB so it survives reloads (permission
 * is re-requested on first use, which needs a user gesture).
 */
@Injectable({ providedIn: 'root' })
export class OrbitViewerService {
  private readonly loader = inject(OrbitCaptureLoaderService);

  /** Currently displayed capture (null when the modal is closed). */
  readonly bundle = signal<OrbitCaptureBundle | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  /** Name of the configured models root folder, or null if unset. */
  readonly rootName = signal<string | null>(null);

  /** Subfolder names under the models root (each = a tool addressable). */
  readonly captureNames = signal<string[]>([]);
  /** Whether the model-library browser window is open. */
  readonly browserOpen = signal(false);

  private rootHandle?: FileSystemDirectoryHandle;

  constructor() {
    if (localFolderDataEnabled()) void this.restoreRoot();
  }

  get supported(): boolean {
    return this.loader.supportsDirectoryPicker;
  }

  get hasRoot(): boolean {
    return !!this.rootHandle;
  }

  /** Prompt the user to choose the root folder that holds addressable subfolders. */
  async setRootFolder(): Promise<void> {
    if (!localFolderDataEnabled()) return;
    this.error.set(null);
    try {
      const dir = await this.loader.showDirectoryPicker();
      await this.applyRootHandle(dir, { openBrowser: true });
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
      this.handleError(e);
    }
  }

  /**
   * Use an already-picked models root (e.g. the `assets/` folder from View Local Data).
   * Skips the library browser unless `openBrowser` is set.
   */
  async applyRootHandle(
    dir: FileSystemDirectoryHandle,
    options?: { openBrowser?: boolean },
  ): Promise<void> {
    if (!localFolderDataEnabled()) return;
    this.rootHandle = dir;
    this.rootName.set(dir.name);
    await this.persistRoot(dir);
    await this.scanRoot();
    if (options?.openBrowser) this.browserOpen.set(true);
  }

  clearRootFolder(): void {
    this.rootHandle = undefined;
    this.rootName.set(null);
    this.captureNames.set([]);
    this.browserOpen.set(false);
    void this.deletePersistedRoot();
  }

  /** Open the model-library browser (scans the root first if needed). */
  async openBrowser(): Promise<void> {
    this.error.set(null);
    if (!this.rootHandle) {
      this.error.set('Set a models folder first (top bar → Orbit).');
      return;
    }
    if (!(await this.ensurePermission(this.rootHandle))) {
      this.error.set('Permission to read the models folder was denied.');
      return;
    }
    if (!this.captureNames().length) await this.scanRoot();
    this.browserOpen.set(true);
  }

  closeBrowser(): void {
    this.browserOpen.set(false);
  }

  /** Load a capture bundle for a library entry (by subfolder name). */
  loadEntry(name: string): Promise<OrbitCaptureBundle> {
    if (!this.rootHandle) throw new Error('No models folder is set.');
    return this.loader.fromRootByAddressable(this.rootHandle, name);
  }

  /** Non-interactive check: is the root already readable (permission granted)? */
  async isRootReadable(): Promise<boolean> {
    if (!this.rootHandle) return false;
    const h = this.rootHandle as PermissionHandle;
    if (!h.queryPermission) return true; // API absent → assume ok
    return (await h.queryPermission({ mode: 'read' })) === 'granted';
  }

  /** Interactive: prompt for read access to the root (needs a user gesture). */
  requestRootAccess(): Promise<boolean> {
    if (!this.rootHandle) return Promise.resolve(false);
    return this.ensurePermission(this.rootHandle);
  }

  /**
   * Bird's-eye PNG + projection from the local assets folder. Returns null when
   * the capture is unpublished or the root is not readable.
   */
  async loadBirdsEye(captureKey: string): Promise<BirdsEyeCapture | null> {
    const key = captureKey.trim();
    if (!this.rootHandle || !key) return null;
    if (!(await this.isRootReadable())) return null;
    try {
      const sub = await this.childDirectory(this.rootHandle, key);
      if (!sub) return null;
      const manifestFile = await (
        await sub.getFileHandle('birdseye.json')
      ).getFile();
      const manifest = JSON.parse(await manifestFile.text()) as BirdsEyeManifest;
      const projection = parseBirdsEyeProjection(manifest);
      if (!projection) return null;
      const imageName = manifest.image || 'birdseye.png';
      const imageFile = await (await sub.getFileHandle(imageName)).getFile();
      return {
        imageUrl: URL.createObjectURL(imageFile),
        projection,
        manifest,
      };
    } catch {
      return null;
    }
  }

  private async childDirectory(
    root: FileSystemDirectoryHandle,
    name: string,
  ): Promise<FileSystemDirectoryHandle | null> {
    try {
      return await root.getDirectoryHandle(name);
    } catch {
      const wanted = name.toLowerCase();
      for await (const [entryName, handle] of (root as unknown as {
        entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
      }).entries()) {
        if (handle.kind === 'directory' && entryName.toLowerCase() === wanted) {
          return handle as FileSystemDirectoryHandle;
        }
      }
    }
    return null;
  }

  /** Enumerate the subdirectories of the root folder (sorted). */
  private async scanRoot(): Promise<void> {
    if (!this.rootHandle) return;
    const names: string[] = [];
    for await (const [name, handle] of (this.rootHandle as unknown as {
      entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
    }).entries()) {
      if (handle.kind === 'directory') names.push(name);
    }
    names.sort((a, b) => a.localeCompare(b));
    this.captureNames.set(names);
  }

  /** Open a capture by resolving the addressable to a subfolder of the root. */
  async openByAddressable(addressable: string | null | undefined): Promise<void> {
    this.error.set(null);
    const key = (addressable ?? '').trim();
    if (!key) {
      this.error.set('This asset has no addressable to look up.');
      return;
    }
    if (!this.rootHandle) {
      this.error.set('Set a models folder first (top bar → Orbit captures).');
      return;
    }
    if (!(await this.ensurePermission(this.rootHandle))) {
      this.error.set('Permission to read the models folder was denied.');
      return;
    }
    this.busy.set(true);
    try {
      const bundle = await this.loader.fromRootByAddressable(this.rootHandle, key);
      this.show(bundle);
    } catch (e) {
      this.handleError(e);
    } finally {
      this.busy.set(false);
    }
  }

  /** Manual single-folder open (the folder that directly contains manifest.json). */
  async openSingleFolder(): Promise<void> {
    if (!localFolderDataEnabled()) return;
    this.error.set(null);
    this.busy.set(true);
    try {
      const bundle = await this.loader.pickCaptureFolder();
      this.show(bundle);
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
      this.handleError(e);
    } finally {
      this.busy.set(false);
    }
  }

  /** Open from a webkitdirectory <input> file list (Firefox/Safari fallback). */
  async openFromFileList(list: FileList | File[]): Promise<void> {
    if (!localFolderDataEnabled()) return;
    this.error.set(null);
    this.busy.set(true);
    try {
      const bundle = await this.loader.fromFileList(list);
      this.show(bundle);
    } catch (e) {
      this.handleError(e);
    } finally {
      this.busy.set(false);
    }
  }

  close(): void {
    const b = this.bundle();
    this.bundle.set(null);
    b?.revoke();
  }

  private show(bundle: OrbitCaptureBundle): void {
    this.bundle()?.revoke();
    this.bundle.set(bundle);
  }

  private handleError(e: unknown): void {
    console.error('[OrbitViewerService]', e);
    this.error.set(e instanceof Error ? e.message : 'Failed to open orbit capture.');
  }

  private async ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
    const h = handle as PermissionHandle;
    if (!h.queryPermission) return true; // API not present; assume ok
    const opts = { mode: 'read' as const };
    if ((await h.queryPermission(opts)) === 'granted') return true;
    return (await h.requestPermission?.(opts)) === 'granted';
  }

  // --- IndexedDB persistence of the directory handle ----------------------

  private async restoreRoot(): Promise<void> {
    try {
      const handle = await this.idbGet(ROOT_KEY);
      if (handle) {
        this.rootHandle = handle;
        this.rootName.set(handle.name);
      }
    } catch {
      /* ignore restore failures */
    }
  }

  private async persistRoot(handle: FileSystemDirectoryHandle): Promise<void> {
    try {
      await this.idbSet(ROOT_KEY, handle);
    } catch {
      /* non-fatal */
    }
  }

  private async deletePersistedRoot(): Promise<void> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(ROOT_KEY);
    } catch {
      /* ignore */
    }
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async idbGet(key: string): Promise<FileSystemDirectoryHandle | undefined> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result as FileSystemDirectoryHandle | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  private async idbSet(key: string, value: FileSystemDirectoryHandle): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
