/**
 * Maps Unity Asset Export rows → Asset Library response shapes used by
 * scenario-creator (AssetLibrary*Interface).
 *
 * Supported today: tools (kind === 'tool'), equipment, interactions, and medications.
 */

/** Asset types the Asset Database PoC can serve today. */
export const SUPPORTED_LIBRARY_TYPES = Object.freeze([
  'tool',
  'equipment',
  'interaction',
  'medication',
  'waveform',
  'scenario',
]);

const UNSUPPORTED_REASONS = Object.freeze({
  character:
    'Character options are not part of the Asset Database PoC yet.',
  environment:
    'Unity Asset Export has no environment assets equivalent to Asset Library "environment".',
  settings:
    'Unity Asset Export has no settings/environment-configuration assets.',
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
 * Normalize a Unity row's tags field to a string array.
 * @param {unknown} tags
 * @returns {string[]}
 */
function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t) => typeof t === 'string' && t.length > 0);
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
    tags: normalizeTags(row.tags),
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
    tags: normalizeTags(interaction.tags),
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
 * Map a medication catalog row → Asset Library shape.
 * @param {object} med
 * @param {{ includeData?: boolean, includeImages?: boolean }} opts
 */
export function mapUnityMedicationToLibraryAsset(med, opts = {}) {
  const includeData = opts.includeData !== false;
  const includeImages = !!opts.includeImages;

  /** @type {Record<string, unknown>} */
  const asset = {
    assetId: med.id,
    assetName: med.name || med.medId || med.id,
    assetType: 'medication',
    dataId: med.id,
    description: '',
    prefabName: null,
    tags: normalizeTags(med.tags),
  };

  if (includeData) {
    asset.data = {
      medId: med.medId ?? null,
      name: med.name ?? null,
      medContainer: med.medContainer ?? null,
      legacyIds: med.legacyIds ?? null,
      displayStrings: med.displayStrings ?? null,
      textureInfo: med.textureInfo ?? null,
      liquidInfo: med.liquidInfo ?? null,
      pillInfo: med.pillInfo ?? null,
      ivBagInfo: med.ivBagInfo ?? null,
      syringeInfo: med.syringeInfo ?? null,
      vialInfo: med.vialInfo ?? null,
      additional: med.additional ?? null,
    };
  }

  if (includeImages) {
    asset.images = [];
  }

  return asset;
}

/**
 * Map a waveform catalog row → Asset Library shape.
 * @param {object} wave
 * @param {{ includeData?: boolean, includeImages?: boolean }} opts
 */
export function mapUnityWaveformToLibraryAsset(wave, opts = {}) {
  const includeData = opts.includeData !== false;
  const includeImages = !!opts.includeImages;

  /** @type {Record<string, unknown>} */
  const asset = {
    assetId: wave.id,
    assetName: wave.name || wave.id,
    assetType: 'waveform',
    dataId: wave.id,
    description: wave.description ?? '',
    prefabName: null,
    tags: normalizeTags(wave.tags),
  };

  if (includeData) {
    asset.data = {
      dataPoints: wave.dataPoints ?? [],
      waveCount: wave.waveCount ?? 1,
      name: wave.name ?? null,
      description: wave.description ?? null,
      maxHr: wave.maxHr ?? null,
      maxRr: wave.maxRr ?? null,
      pacer: wave.pacer ?? null,
      pvcs: wave.pvcs ?? null,
      type: wave.waveformType ?? null,
      alternateIds: wave.alternateIds ?? [],
      scenarioIds: wave.scenarioIds ?? [],
    };
  }

  if (includeImages) {
    asset.images = [];
  }

  return asset;
}

/**
 * Collect unique tag strings across Unity rows (sorted).
 * @param {...object[]} rowLists
 * @returns {string[]}
 */
export function collectUniqueTags(...rowLists) {
  const set = new Set();
  for (const list of rowLists) {
    for (const row of list ?? []) {
      for (const tag of normalizeTags(row?.tags)) {
        set.add(tag);
      }
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
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

/**
 * @param {object} bundle UnityDbBundle
 * @returns {object[]}
 */
export function listUnityMedications(bundle) {
  return (bundle.medications ?? []).filter((m) => m && m.id);
}

/**
 * @param {object} bundle UnityDbBundle
 * @returns {object[]}
 */
export function listUnityWaveforms(bundle) {
  return (bundle.waveforms ?? []).filter((w) => w && w.id);
}

/**
 * Map a scenario catalog row → Asset Library shape.
 * @param {object} scenario
 * @param {{ includeData?: boolean, includeImages?: boolean }} opts
 */
export function mapUnityScenarioToLibraryAsset(scenario, opts = {}) {
  const includeData = opts.includeData !== false;
  const includeImages = !!opts.includeImages;

  /** @type {Record<string, unknown>} */
  const asset = {
    assetId: scenario.id,
    assetName: scenario.name || scenario.id,
    assetType: 'scenario',
    dataId: scenario.id,
    description: scenario.description ?? '',
    prefabName: null,
    tags: normalizeTags(scenario.tags),
  };

  if (includeData) {
    asset.data = {
      scenarioCreatorId: scenario.scenarioCreatorId ?? null,
      author: scenario.author ?? null,
      createdBy: scenario.createdBy ?? null,
      createdAt: scenario.createdAt ?? null,
      learnerDescription: scenario.learnerDescription ?? null,
      roleBased: !!scenario.roleBased,
      startingState: scenario.startingState ?? null,
      thumbnail: scenario.thumbnail ?? null,
      sourceFile: scenario.sourceFile ?? null,
      counts: scenario.counts ?? null,
      patients: scenario.patients ?? [],
      npcs: scenario.npcs ?? [],
      environments: scenario.environments ?? [],
      characterModels: scenario.characterModels ?? [],
      environmentModels: scenario.environmentModels ?? [],
      assetBundlesByType: scenario.assetBundlesByType ?? {},
    };
  }

  if (includeImages) {
    asset.images = [];
  }

  return asset;
}

/**
 * @param {object} bundle UnityDbBundle
 * @returns {object[]}
 */
export function listUnityScenarios(bundle) {
  return (bundle.scenarios ?? []).filter((s) => s && s.id);
}
