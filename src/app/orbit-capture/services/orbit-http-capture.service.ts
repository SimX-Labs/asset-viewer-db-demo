// services/orbit-http-capture.service.ts
import { Injectable } from '@angular/core';
import {
  OrbitCaptureBundle,
  OrbitCaptureManifest,
} from '../models/orbit-manifest';

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
  private readonly base = this.resolveBaseUrl();

  get baseUrl(): string {
    return this.base;
  }

  get configured(): boolean {
    return !!this.base;
  }

  /** Fetch a capture's manifest and resolve its files to absolute URLs. */
  async loadBundle(addressable: string): Promise<OrbitCaptureBundle> {
    const key = addressable.trim();
    if (!this.base) throw new Error('No models server is configured.');
    if (!key) throw new Error('No addressable provided.');

    const folder = `${this.base}/models/${encodeURIComponent(key)}`;
    const response = await fetch(`${folder}/manifest.json`);
    if (!response.ok) {
      throw new Error(
        response.status === 404
          ? `No capture published for "${key}".`
          : `Models server returned ${response.status} for "${key}".`,
      );
    }

    const manifest = (await response.json()) as OrbitCaptureManifest;
    const urlFor = (name?: string): string | undefined =>
      name ? `${folder}/${encodeURIComponent(name)}` : undefined;

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

  private resolveBaseUrl(): string {
    if (typeof window === 'undefined') return '';
    const fromQuery = new URLSearchParams(window.location.search).get('models');
    const raw = fromQuery ?? 'http://localhost:4301';
    return raw.replace(/\/+$/, '');
  }
}
