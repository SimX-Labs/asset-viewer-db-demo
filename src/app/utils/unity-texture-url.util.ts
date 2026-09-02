import { environment } from '../environment';

/** Extensions the browser can show in an <img>. PSD / TGA stay path-only. */
const BROWSER_IMAGE_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
]);

/**
 * Preview URL for a Unity-client texture path. Served by the API from
 * UNITY_CLIENT_ROOT; missing files are tolerated by the <img> error handler.
 */
export function unityClientTextureUrl(
  texturePath: string | null | undefined,
  apiBase = environment.apiBaseUrl,
): string | null {
  if (!texturePath || typeof texturePath !== 'string') return null;
  const trimmed = texturePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!trimmed.startsWith('Assets/')) return null;
  const dot = trimmed.lastIndexOf('.');
  const ext = dot >= 0 ? trimmed.slice(dot).toLowerCase() : '';
  if (!BROWSER_IMAGE_EXTS.has(ext)) return null;
  const encoded = trimmed.split('/').map(encodeURIComponent).join('/');
  const base = (apiBase || '').replace(/\/+$/, '');
  if (!base) return `/unity-client/${encoded}`;
  return `${base}/unity-client/${encoded}`;
}
