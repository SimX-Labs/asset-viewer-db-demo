// Models for the "Unity Asset DB" paradigm — the database-shaped JSON graph emitted by the
// unity-asset-documentation pipeline. Unlike the classic DBO format (a single base object type
// with a generic `Data` bag), this graph has a distinct row shape per asset type and links rows
// together via UUID foreign-key arrays.
//
// See gitbooks/data/db/schemas/*.md in the source repo for the authoritative schema.
//
// Interaction fields (current schema):
//   interactions/* rows                       (standalone location-keyed interactions + options)
//   character / equipment → interactionLocations[]  (interactionId + assetIds → tools)
//   tool.interactions[]                             (outbound; interactionId + assetIds → mixed)
//   tool.interactionLocations[]                     (inbound; interactionId + assetIds → tools)
//
// Legacy aliases still accepted by the loader:
//   character / equipment.interactions  → interactionLocations
//   tool.interactionTargets             → tool.interactions (outbound)
//   relationship entries with `location` (pre-standalone) → resolved via location string

export type UnityRowType =
  | 'character'
  | 'equipment'
  | 'tool'
  | 'clothing'
  | 'medication'
  | 'waveform'
  | 'scenario'
  | 'interaction'
  | 'characterMetadata'
  | 'toolMetadata';

/** Authored option triple on a standalone interaction row. */
export interface UnityInteractionOption {
  interactionType: 'Patient' | 'Other' | string;
  info: string | null;
  metadata: string | null;
}

/** Standalone interaction catalog row (db/interactions/*). */
export interface UnityInteractionRow {
  id: string;
  type: 'interaction';
  name: string;
  location: string;
  options: UnityInteractionOption[];
  /** Free-form labels for sorting / filtering. */
  tags?: string[];
  /** Tools that declare this interaction as an outbound sender. */
  canSendAssetIds: string[];
  /** Characters, equipment, and tools that expose this interaction as a location. */
  canReceiveAssetIds: string[];
}

/**
 * Relationship entry on character / equipment / tool rows.
 * New shape uses interactionId; legacy shape used location.
 */
export interface UnityInteractionRef {
  interactionId?: string;
  /** @deprecated Prefer interactionId; kept for older scrapes */
  location?: string;
  assetIds: string[];
  availableIn: string[] | null;
}

/** @deprecated Use UnityInteractionRef */
export type UnityInteraction = UnityInteractionRef;

export interface UnityMetadataObject {
  id: string;
  key: string;
  valueType: string | null;
  valueShape: string | null;
  possibleValues: string[] | null;
  defaultValue: string | null;
  examples?: string[];
  description: string | null;
  sourceScripts: string | null;
  complexSchema: unknown | null;
  controllerType?: string | null;
}

export interface UnityCharacter {
  id: string;
  type: 'character';
  name: string;
  assetKey: string;
  baseAddressable: string;
  isVariant: boolean;
  isPrimaryInGroup: boolean;
  groupFolder: string;
  prefabPath: string;
  /** Free-form labels for sorting / filtering. */
  tags?: string[];
  interactionLocations: UnityInteractionRef[];
  /** @deprecated Prefer interactionLocations */
  interactions?: UnityInteractionRef[];
  availableEquipment: string[];
  availableClothing: string[];
}

export interface UnityEquipment {
  id: string;
  type: 'equipment';
  name: string;
  assetKey: string;
  prefabPath: string;
  /** Free-form labels for sorting / filtering. */
  tags?: string[];
  primaryMetadata?: UnityMetadataObject | null;
  metadata: UnityMetadataObject[];
  interactionLocations: UnityInteractionRef[];
  /** @deprecated Prefer interactionLocations */
  interactions?: UnityInteractionRef[];
  characterIds: string[];
}

export interface UnityTool {
  id: string;
  type: 'tool';
  kind: 'tool' | 'kit' | 'group' | 'vessel' | 'scene';
  name: string;
  assetKey: string;
  toolId: string;
  prefabPath: string;
  /** Free-form labels for sorting / filtering. */
  tags?: string[];
  metadata: UnityMetadataObject[];
  /** Outbound actions (ToolInteractions). */
  interactions: UnityInteractionRef[];
  /** Inbound trigger locations on this tool. */
  interactionLocations: UnityInteractionRef[];
  /** @deprecated Legacy outbound field; prefer interactions */
  interactionTargets?: UnityInteractionRef[];
  usedInGroupIds: string[];
  scenarioIds: string[];
}

export interface UnityClothing {
  id: string;
  type: 'clothing';
  name: string;
  assetKey: string;
  /** Free-form labels for sorting / filtering. */
  tags?: string[];
}

/** Medication catalog row (from Unity MedicationDatabase export, camelCase). */
export interface UnityMedication {
  id: string;
  type: 'medication';
  name: string;
  medId: string;
  medContainer: string;
  legacyIds?: string[] | null;
  displayStrings?: {
    pyxisName?: string | null;
    pumpName?: string | null;
    labelTitle?: string | null;
    labelSubTitle?: string | null;
    labelSubDose?: string | null;
  } | null;
  textureInfo?: {
    labelTexture: { filepath: string; isNormalMap: boolean };
    boxTexture?: { filepath: string; isNormalMap: boolean } | null;
  } | null;
  liquidInfo?: { liquidColorOverride: string | null } | null;
  pillInfo?: { pillCount: number } | null;
  ivBagInfo?: { bagSize: string } | null;
  syringeInfo?: {
    syringeType: string | null;
    syringeMethod: string | null;
  } | null;
  vialInfo?: {
    isPowder: boolean;
    vialLiquidColorOverride?: string | null;
  } | null;
  /** DB-only fields; omitted from Unity interchange export. */
  additional?: {
    defaultIvPumpUnits?: string | null;
    defaultIvPumpIncrements?: string | null;
    syringeSize?: string | null;
  } | null;
  /** Free-form labels for sorting / filtering (often includes medContainer). */
  tags?: string[];
}

/**
 * Waveform catalog row (scraped from scenario-creator case `waveforms[]`).
 * Maps runtime `value` → `dataPoints`. Physiologic type lives in `waveformType`
 * so it does not collide with the row `type: 'waveform'`.
 */
export interface UnityWaveform {
  id: string;
  type: 'waveform';
  name: string;
  dataPoints: number[];
  waveCount: number;
  description?: string | null;
  maxHr?: number | null;
  maxRr?: number | null;
  pacer?: string | null;
  pvcs?: string | null;
  /** Inferred physiologic kind (ECG, PLETH, RESP, …). */
  waveformType?: string | null;
  /** Other case-instance ids that shared this exact name + dataPoints. */
  alternateIds?: string[];
  /** Scenario ids that embed this waveform library entry. */
  scenarioIds?: string[];
  scenarioNames?: string[];
  tags?: string[];
}

/** Scenario catalog row (summary scraped from scenario-creator case JSON). */
export interface UnityScenario {
  id: string;
  type: 'scenario';
  name: string;
  scenarioCreatorId?: string | null;
  author?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  description?: string | null;
  learnerDescription?: string | null;
  roleBased?: boolean;
  startingState?: string | null;
  thumbnail?: string | null;
  sourceFile?: string | null;
  counts?: {
    patients: number;
    npcs: number;
    states: number;
    actions: number;
    actionGroups: number;
    waveforms: number;
    environments: number;
    assetBundles: number;
  };
  patients?: { id: string | null; name: string | null; model: string | null }[];
  npcs?: { id: string | null; name: string | null; model: string | null }[];
  environments?: {
    id: string | null;
    name: string | null;
    model: string | null;
    settings: string | null;
  }[];
  characterModels?: string[];
  environmentModels?: string[];
  assetBundlesByType?: Record<string, string[]>;
  tags?: string[];
}

export interface UnityCharacterMetadata extends UnityMetadataObject {
  type: 'characterMetadata';
}

export interface UnityToolMetadata extends UnityMetadataObject {
  type: 'toolMetadata';
  toolIds: string[];
}

export interface UnityDbBundle {
  meta?: {
    source?: string;
    generatedAt?: string;
    counts?: Record<string, number>;
  };
  characters: UnityCharacter[];
  equipment: UnityEquipment[];
  tools: UnityTool[];
  interactions: UnityInteractionRow[];
  clothing: UnityClothing[];
  medications: UnityMedication[];
  waveforms: UnityWaveform[];
  scenarios: UnityScenario[];
  characterMetadata: UnityCharacterMetadata[];
  toolMetadata: UnityToolMetadata[];
}

/** Manifest listing relative paths under the db/ folder (browsers cannot list directories). */
export interface UnityDbIndex {
  meta?: {
    source?: string;
    generatedAt?: string;
    counts?: Record<string, number>;
  };
  characters: string[];
  equipment: string[];
  tools: string[];
  interactions: string[];
  clothing: string;
  medications: string;
  waveforms: string;
  scenarios: string;
  characterMetadata: string;
  toolMetadata: string;
}

/** Root URL path (or absolute URL) of the db folder.
 * Locally served via public/db → UNITY_ASSET_DB_DIR junction.
 * Point this at an S3/HTTPS URL once the bucket is ready. */
export const UNITY_DB_ROOT = 'db';
export const UNITY_DB_INDEX_FILE = 'index.json';
export const UNITY_VIRTUAL_FILE = 'Unity Asset DB';
