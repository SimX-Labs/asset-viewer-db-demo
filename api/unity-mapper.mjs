/**
 * Maps Unity Asset Export rows → Asset Library response shapes used by
 * scenario-creator (AssetLibrary*Interface).
 *
 * Supported today: tools (kind === 'tool'), equipment, and interactions.
 */

/** Asset types the Asset Database PoC can serve today. */
export const SUPPORTED_LIBRARY_TYPES = Object.freeze([
  'tool',
  'equipment',
  'interaction',
]);

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
 * Resolve Unity interaction refs to display rows for pickers.
 * @param {Array<{ interactionId?: string, location?: string }> | undefined} refs
 * @param {{ interactionById?: Map<string, object>, interactionByLocation?: Map<string, object> }} opts
 */
function resolveInteractionRefs(refs, opts = {}) {
  const byId = opts.interactionById;
  const byLocation = opts.interactionByLocation;
  if (!Array.isArray(refs) || refs.length === 0) return [];

  return refs.map((ref) => {
    const row =
      (ref.interactionId && byId?.get(ref.interactionId)) ||
      (ref.location && byLocation?.get(ref.location)) ||
      null;
    const location = row?.location ?? ref.location ?? null;
    const name = row?.name || location || ref.interactionId || 'Unknown';
    return {
      id: ref.interactionId ?? row?.id ?? null,
      name,
      location,
    };
  });
}

/**
 * Outbound (senders) vs inbound (locations) for a Unity tool/equipment row.
 * Matches the viewer: tools use interactions / interactionLocations;
 * equipment only hosts locations. Legacy tools used interactionTargets as outbound.
 * @param {object} row
 * @param {'tool' | 'equipment'} assetType
 */
function interactionColumnsForRow(row, assetType, opts = {}) {
  if (assetType === 'tool') {
    const hasLegacyTargets = Array.isArray(row.interactionTargets);
    const senders = hasLegacyTargets
      ? row.interactionTargets
      : (row.interactions ?? []);
    const locations = hasLegacyTargets
      ? (row.interactions ?? [])
      : (row.interactionLocations ?? []);
    return {
      interactionSenders: resolveInteractionRefs(senders, opts),
      interactionLocations: resolveInteractionRefs(locations, opts),
    };
  }

  // Equipment / hosts: locations only (legacy `interactions` fallback).
  const locations = row.interactionLocations ?? row.interactions ?? [];
  return {
    interactionSenders: [],
    interactionLocations: resolveInteractionRefs(locations, opts),
  };
}

/**
 * @param {object} row Unity tool or equipment row
 * @param {'tool' | 'equipment'} assetType
 * @param {{ includeData?: boolean, includeImages?: boolean, interactionById?: Map<string, object>, interactionByLocation?: Map<string, object> }} opts
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
    const columns = interactionColumnsForRow(row, assetType, opts);
    // Extra Unity fields for richer pickers (scenario-creator Asset DB mode).
    asset.data = {
      metadata,
      assetKey: row.assetKey ?? null,
      toolId: row.toolId ?? null,
      prefabPath: row.prefabPath ?? null,
      kind: row.kind ?? assetType,
      interactionSenders: columns.interactionSenders,
      interactionLocations: columns.interactionLocations,
      interactionCount: columns.interactionSenders.length,
      interactionLocationCount: columns.interactionLocations.length,
      usedInGroupCount: Array.isArray(row.usedInGroupIds)
        ? row.usedInGroupIds.length
        : 0,
    };
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
 * @param {object} interaction Unity interaction catalog row
 * @param {{
 *   includeData?: boolean,
 *   includeImages?: boolean,
 *   toolById?: Map<string, object>,
 *   equipmentById?: Map<string, object>,
 * }} opts
 */
export function mapUnityInteractionToLibraryAsset(interaction, opts = {}) {
  const includeData = opts.includeData !== false;
  const includeImages = !!opts.includeImages;
  const displayName = interaction.name || interaction.location || interaction.id;

  /** @type {Record<string, unknown>} */
  const asset = {
    // Interactions have no assetKey; location is the stable authored key.
    assetId: interaction.location || interaction.id,
    assetName: displayName,
    assetType: 'interaction',
    dataId: interaction.id,
    description: '',
    prefabName: interaction.location || displayName,
    tags: [],
  };

  if (includeData) {
    asset.data = {
      location: interaction.location ?? null,
      options: interaction.options ?? [],
      metadata: [],
      // Tools that declare this interaction as an outbound sender.
      senderTools: resolveAssetRefs(interaction.canSendAssetIds, opts.toolById),
      // Equipment that hosts this interaction as a receive location.
      receiverEquipment: resolveAssetRefs(
        interaction.canReceiveAssetIds,
        opts.equipmentById,
      ),
    };
  }

  if (includeImages) {
    asset.images = [];
  }

  return asset;
}

/**
 * Resolve UUID foreign keys to display rows; skips ids missing from the map
 * (e.g. characters when resolving equipment-only receivers).
 * @param {string[] | undefined} ids
 * @param {Map<string, object> | undefined} byId
 */
function resolveAssetRefs(ids, byId) {
  if (!Array.isArray(ids) || !byId) return [];
  const out = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) continue;
    out.push({
      id,
      name: row.name || row.assetKey || id,
      assetKey: row.assetKey ?? null,
    });
  }
  return out;
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

/**
 * @param {object} bundle UnityDbBundle
 * @returns {object[]}
 */
export function listUnityInteractions(bundle) {
  return (bundle.interactions ?? []).filter(
    (i) => i && i.id && i.type === 'interaction',
  );
}
