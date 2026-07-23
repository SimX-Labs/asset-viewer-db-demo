// services/orbit-capture-loader.service.ts
import { Injectable } from '@angular/core';
import { OrbitCaptureBundle, OrbitCaptureManifest } from '../models/orbit-manifest';

@Injectable({ providedIn: 'root' })
export class OrbitCaptureLoaderService {
  /** True when the Chromium File System Access API is available. */
  get supportsDirectoryPicker(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  async pickCaptureFolder(): Promise<OrbitCaptureBundle> {
    const dir = await this.showDirectoryPicker();
    return this.fromDirectoryHandle(dir);
  }

  /** Prompt for a directory (secure context / Chromium only). */
  showDirectoryPicker(): Promise<FileSystemDirectoryHandle> {
    return (window as unknown as {
      showDirectoryPicker: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker({ mode: 'read' });
  }

  /** Build a bundle from a capture directory handle (the folder with manifest.json). */
  async fromDirectoryHandle(dir: FileSystemDirectoryHandle): Promise<OrbitCaptureBundle> {
    const files = await this.readDirectoryFiles(dir);
    return this.buildBundle(files);
  }

  /**
   * Find a capture subfolder named after the addressable under a root directory
   * and build its bundle. Matches case-insensitively.
   */
  async fromRootByAddressable(
    root: FileSystemDirectoryHandle,
    addressable: string,
  ): Promise<OrbitCaptureBundle> {
    const key = addressable.trim();
    if (!key) throw new Error('No addressable provided.');

    let sub: FileSystemDirectoryHandle | undefined;
    try {
      sub = await (root as unknown as {
        getDirectoryHandle: (name: string) => Promise<FileSystemDirectoryHandle>;
      }).getDirectoryHandle(key);
    } catch {
      // Fall back to a case-insensitive scan of the root's subdirectories.
      const wanted = key.toLowerCase();
      for await (const [name, handle] of (root as unknown as {
        entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
      }).entries()) {
        if (handle.kind === 'directory' && name.toLowerCase() === wanted) {
          sub = handle as FileSystemDirectoryHandle;
          break;
        }
      }
    }

    if (!sub) {
      throw new Error(`No capture folder named "${key}" was found in the selected models folder.`);
    }
    return this.fromDirectoryHandle(sub);
  }

  /** Fallback: <input type="file" webkitdirectory multiple /> */
  async fromFileList(list: FileList | File[]): Promise<OrbitCaptureBundle> {
    const files = Array.from(list);
    const map = new Map<string, File>();
    for (const f of files) {
      // webkitRelativePath like "tool_iv_bag_generic/manifest.json"
      const key = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      map.set(this.normalizeKey(key), f);
    }
    return this.buildBundle(map);
  }

  private normalizeKey(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\.\//, '');
  }

  private basename(path: string): string {
    const p = this.normalizeKey(path);
    const i = p.lastIndexOf('/');
    return i >= 0 ? p.slice(i + 1) : p;
  }

  private async readDirectoryFiles(dir: FileSystemDirectoryHandle): Promise<Map<string, File>> {
    const map = new Map<string, File>();
    for await (const [name, handle] of (dir as unknown as {
      entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
    }).entries()) {
      if (handle.kind === 'file') {
        map.set(name, await (handle as FileSystemFileHandle).getFile());
      }
      // v1: flat folder only. Nested folders can be walked later if needed.
    }
    return map;
  }

  private async buildBundle(files: Map<string, File>): Promise<OrbitCaptureBundle> {
    const manifestEntry = [...files.entries()].find(([k]) => this.basename(k) === 'manifest.json');
    if (!manifestEntry) {
      throw new Error('manifest.json not found in the selected folder/files.');
    }

    const manifestText = await manifestEntry[1].text();
    let manifest: OrbitCaptureManifest;
    try {
      manifest = JSON.parse(manifestText) as OrbitCaptureManifest;
    } catch {
      throw new Error('manifest.json is not valid JSON.');
    }

    const byName = new Map<string, File>();
    for (const [path, file] of files) {
      byName.set(this.basename(path).toLowerCase(), file);
    }

    const objectUrls: string[] = [];
    const urlFor = (name?: string): string | undefined => {
      if (!name) return undefined;
      const file = byName.get(this.basename(name).toLowerCase());
      if (!file) return undefined;
      const url = URL.createObjectURL(file);
      objectUrls.push(url);
      return url;
    };

    // Carousel frames are optional now — skip any listed image that isn't present.
    const yawUrls = (manifest.images ?? [])
      .map((name) => urlFor(name))
      .filter((url): url is string => !!url);

    // Prefer the manifest's model field; otherwise fall back to any *.glb present.
    let modelUrl = urlFor(manifest.model);
    if (!modelUrl) {
      const glb = [...byName.keys()].find((n) => n.endsWith('.glb'));
      modelUrl = urlFor(glb);
    }

    if (!yawUrls.length && !modelUrl) {
      throw new Error('Capture has no yaw images and no model (.glb).');
    }

    return {
      manifest,
      yawUrls,
      topUrl: urlFor(manifest.top),
      bottomUrl: urlFor(manifest.bottom),
      modelUrl,
      revoke: () => objectUrls.forEach((u) => URL.revokeObjectURL(u)),
    };
  }
}
