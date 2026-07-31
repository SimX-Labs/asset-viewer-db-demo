/**
 * Maps Unity Asset Export rows → Asset Library response shapes used by
 * scenario-creator (AssetLibrary*Interface).
 *
 * Supported today: tools (kind === 'tool') and equipment.
 */

/** Asset types the Asset Database PoC can serve today. */
export const SUPPORTED_LIBRARY_TYPES = Object.freeze(['tool', 'equipment']);

const UNSUPPORTED_REASONS = Object.freeze({
  character:
    'Character options are not part of the Asset Database PoC yet.',
  environment:
    'Unity Asset Export has no environment assets equivalent to Asset Library "environment".',
  settings:
    'Unity Asset Export has no settings/environment-configuration assets.',
  waveform:
    'Unity Asset Export has no waveform assets.',
});

/**
 * @param {string} assetType
 * @returns {string}
 */
export function unsupportedTypeMessage(assetType) {
  const reason =
    UNSUPPORTED_REASONS[assetType] ??
    'This asset type is not available in the Unity-backed Asset Database yet.';
  return `Asset Database does not yet support asset type "${assetType}". ${reason}`;
}

/**
 * @param {string | undefined} prefabPath
 * @param {string} fallback
 */
function prefabNameFromPath(prefabPath, fallback) {
  if (!prefabPath || typeof prefabPath !== 'string') return fallback;
  const base = prefabPath.split(/[/\\]/).pop() ?? '';
  return base.replace(/\.prefab$/i, '') || fallback;
}

/**
 * @param {object | undefined} m
 */
function mapMetadata(m) {
  if (!m || !m.key) return null;
  return {
    key: m.key,
    label: m.key,
    valueType: m.valueType || 'string',
    exposed: true,
    defaultValue: m.defaultValue ?? undefined,
  };
}

/**
 * @param {object} row Unity tool or equipment row
 * @param {'tool' | 'equipment'} assetType
 * @param {{ includeData?: boolean, includeImages?: boolean }} opts
 */
function mapUnityRowToLibraryAsset(row, assetType, opts = {}) {
  const includeData = opts.includeData !== false;
  const includeImages = !!opts.includeImages;

  /** @type {Record<string, unknown>} */
  const asset = {
    assetId: row.assetKey || row.id,
    assetName: row.name || row.assetKey || row.id,
    assetType,
    dataId: row.id,
    description: '',
    prefabName: prefabNameFromPath(row.prefabPath, row.assetKey || row.id),
    tags: [],
  };

  if (includeData) {
    const metadataSource = [
      ...(row.primaryMetadata ? [row.primaryMetadata] : []),
      ...(row.metadata ?? []),
    ];
    const metadata = metadataSource.map(mapMetadata).filter(Boolean);
    asset.data = { metadata };
  }

  if (includeImages) {
    asset.images = [];
  }

  return asset;
}

/**
 * @param {object} tool Unity tool row
 * @param {{ includeData?: boolean, includeImages?: boolean }} opts
 */
export function mapUnityToolToLibraryAsset(tool, opts = {}) {
  return mapUnityRowToLibraryAsset(tool, 'tool', opts);
}

/**
 * @param {object} equipment Unity equipment row
 * @param {{ includeData?: boolean, includeImages?: boolean }} opts
 */
export function mapUnityEquipmentToLibraryAsset(equipment, opts = {}) {
  return mapUnityRowToLibraryAsset(equipment, 'equipment', opts);
}

/**
 * @param {object} bundle UnityDbBundle
 * @returns {object[]}
 */
export function listUnityTools(bundle) {
  return (bundle.tools ?? []).filter((t) => t && t.kind === 'tool');
}

/**
 * @param {object} bundle UnityDbBundle
 * @returns {object[]}
 */
export function listUnityEquipment(bundle) {
  return (bundle.equipment ?? []).filter((e) => e && e.id);
}
