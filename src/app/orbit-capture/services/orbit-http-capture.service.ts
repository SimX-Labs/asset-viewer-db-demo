// services/orbit-http-capture.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  OrbitCaptureBundle,
  OrbitCaptureManifest,
} from '../models/orbit-manifest';
import {
  BirdsEyeCapture,
  BirdsEyeManifest,
  parseBirdsEyeProjection,
} from '../models/birdseye-projection';
import { isLocalDevHost } from '../../utils/runtime-host.util';
import { environment } from '../../environment';

export type { BirdsEyeCapture };

const BIRDS_EYE_MANIFEST = 'birdseye.json';
const BIRDS_EYE_IMAGE = 'birdseye.png';

export interface OrbitModelsSuggestion {
  id: string;
  label: string;
  dir: string;
  hint: string;
  exists: boolean;
  count: number;
  current: boolean;
}

export interface OrbitModelsRoot {
  dir: string;
  count: number;
  usingStaleCopy: boolean;
  staleHint: string | null;
  suggestions: OrbitModelsSuggestion[];
}

/**
 * Loads orbit captures over HTTP instead of from a local folder.
 *
 * The File System Access API cannot be used inside a cross-origin iframe, so
 * embedded viewers (e.g. the scenario-creator tool picker) resolve models from
 * the Asset Database API's `/models` mount instead.
 *
 * Base URL comes from the `?models=` query param, falling back to the API's
 * conventional local port.
 */
@Injectable({ providedIn: 'root' })
export class OrbitHttpCaptureService {
  private readonly http = inject(HttpClient);
  private readonly base = this.resolveBaseUrl();

  /** Bumped after PUT /models-root so inline viewers reload (and cache-bust URLs). */
  readonly rootRevision = signal(0);
  readonly root = signal<OrbitModelsRoot | null>(null);

  get baseUrl(): string {
    return this.base;
  }

  get configured(): boolean {
    return !!this.base;
  }

  async loadRoot(): Promise<OrbitModelsRoot> {
    if (!this.base) throw new Error('No models server is configured.');
    const info = await firstValueFrom(
      this.http.get<OrbitModelsRoot>(`${this.base}/models-root`),
    );
    this.root.set(info);
    return info;
  }

  async setRoot(dir: string): Promise<OrbitModelsRoot> {
    if (!this.base) throw new Error('No models server is configured.');
    const trimmed = dir.trim();
    if (!trimmed) throw new Error('A folder path is required.');
    const info = await firstValueFrom(
      this.http.put<OrbitModelsRoot>(`${this.base}/models-root`, {
        dir: trimmed,
      }),
    );
    this.root.set(info);
    this.rootRevision.update((n) => n + 1);
    return info;
  }

  /** Fetch a capture's manifest and resolve its files to absolute URLs. */
  async loadBundle(addressable: string): Promise<OrbitCaptureBundle> {
    const key = addressable.trim();
    if (!this.base) throw new Error('No models server is configured.');
    if (!key) throw new Error('No addressable provided.');

    const folder = `${this.base}/models/${encodeURIComponent(key)}`;
    const response = await fetch(this.withRevision(`${folder}/manifest.json`));
    if (!response.ok) {
      throw new Error(
        response.status === 404
          ? `No capture published for "${key}".`
          : `Models server returned ${response.status} for "${key}".`,
      );
    }

    const manifest = (await response.json()) as OrbitCaptureManifest;
    const urlFor = (name?: string): string | undefined =>
      name ? this.withRevision(`${folder}/${encodeURIComponent(name)}`) : undefined;

    const modelUrl = urlFor(manifest.model || 'model.glb');
    const yawUrls = (manifest.images ?? [])
      .map((name) => urlFor(name))
      .filter((url): url is string => !!url);

    return {
      manifest,
      yawUrls,
      topUrl: urlFor(manifest.top),
      bottomUrl: urlFor(manifest.bottom),
      modelUrl,
      // Plain https/http URLs — nothing to revoke.
      revoke: () => undefined,
    };
  }

  /**
   * Fetch an authored environment's bird's-eye capture. Returns null when nothing is published for
   * the key or the sidecar cannot describe a projection, so callers can fall back silently.
   */
  async loadBirdsEye(captureKey: string): Promise<BirdsEyeCapture | null> {
    const key = captureKey.trim();
    if (!this.base || !key) return null;

    const folder = `${this.base}/models/${encodeURIComponent(key)}`;
    let manifest: BirdsEyeManifest;
    try {
      const response = await fetch(
        this.withRevision(`${folder}/${BIRDS_EYE_MANIFEST}`),
      );
      if (!response.ok) return null;
      manifest = (await response.json()) as BirdsEyeManifest;
    } catch {
      return null;
    }

    const projection = parseBirdsEyeProjection(manifest);
    if (!projection) return null;

    return {
      imageUrl: this.withRevision(
        `${folder}/${encodeURIComponent(manifest.image || BIRDS_EYE_IMAGE)}`,
      ),
      projection,
      manifest,
    };
  }

  private withRevision(url: string): string {
    const rev = this.rootRevision();
    if (!rev) return url;
    return `${url}${url.includes('?') ? '&' : '?'}r=${rev}`;
  }

  private resolveBaseUrl(): string {
    if (typeof window === 'undefined') return '';
    const fromQuery = new URLSearchParams(window.location.search).get('models');
    if (fromQuery != null && fromQuery !== '') {
      return fromQuery.replace(/\/+$/, '');
    }
    if (isLocalDevHost(window.location.origin)) {
      return environment.apiBaseUrl.replace(/\/+$/, '');
    }
    return '';
  }
}
