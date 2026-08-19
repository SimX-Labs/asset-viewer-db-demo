/**
 * Turn an export field name into a readable label:
 * `EnvironmentAssetKey` -> `Environment Asset Key`, `AssetGUID` -> `Asset GUID`.
 */
export function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    // Keep runs of capitals together, but split the last one off a following word.
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}
