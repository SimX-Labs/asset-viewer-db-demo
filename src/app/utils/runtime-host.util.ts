/** Origins that mean the Angular app is being served from a developer machine. */
const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export function currentOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

/** True when the viewer is served from localhost, not a deployed host. */
export function isLocalDevHost(origin = currentOrigin()): boolean {
  return LOCAL_DEV_ORIGIN.test(origin);
}

/**
 * Folder-picker packs (Settings → View Local Data, Orbit models folder) are
 * for the hosted empty viewer. Localhost already loads catalog + GLBs from the
 * Asset Database API, and a persisted folder handle can shadow those HTTP
 * manifests (which is what carries container / tool-state toggles).
 */
export function localFolderDataEnabled(origin = currentOrigin()): boolean {
  return !isLocalDevHost(origin);
}
