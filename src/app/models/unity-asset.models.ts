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
  | 'BodyTexture'
  | 'OverlayTexture'
  | 'equipment'
  | 'tool'
  | 'clothing'
  | 'medication'
  | 'waveform'
  | 'scenario'
  | 'interaction'
  | 'characterMetadata'
  | 'toolMetadata'
  | 'audio'
  | 'video';

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
  tags?: string[];
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
  /** Unique BodyTexture ids from this prefab's TextureStateController. */
  bodyTextureIds?: string[];
  /** Unique OverlayTexture ids from overlay / global overlay / Unity decalTextures. */
  overlayTextureIds?: string[];
  /** BodyTexture used in the most baseTexture slots. Null when there is no controller. */
  defaultBodyTextureId?: string | null;
}

/** Albedo assigned as a base on a character TextureStateController. */
export interface UnityBodyTexture {
  id: string;
  type: 'BodyTexture';
  category?: 'character';
  name: string;
  assetKey: string;
  guid: string;
  texturePath?: string | null;
  isDefault?: boolean;
  characterIds?: string[];
  tags?: string[];
}

/** Albedo used as an overlay on a character TextureStateController. */
export interface UnityOverlayTexture {
  id: string;
  type: 'OverlayTexture';
  category?: 'character';
  name: string;
  assetKey: string;
  guid: string;
  texturePath?: string | null;
  baseTextureIds?: string[];
  characterIds?: string[];
  tags?: string[];
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

/** Per-drawer / state group on a custom vessel row. */
export interface UnityVesselContainer {
  state: string;
  toolIds: string[];
  toolAssetKeys: string[];
}

/** Color / label customization packet on a custom vessel row. */
export interface UnityVesselPacket {
  key: string;
  type: string;
  value: string;
}

export interface UnityTool {
  id: string;
  type: 'tool';
  kind: 'tool' | 'kit' | 'group' | 'vessel' | 'scene';
  /** Vessel source classification. Empty vessels come from the client `vessel` label. */
  vesselType?: 'empty' | 'custom';
  name: string;
  /**
   * Tool addressable, or `custom_vessel/<authoringId>` for custom vessels.
   * Orbit capture folders for custom vessels use the flat key `custom_vessel_<authoringId>`.
   */
  assetKey: string;
  toolId: string;
  /** Null for custom vessels (no Unity prefab path). */
  prefabPath: string | null;
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

  // --- Custom vessel fields (db/tools/custom_vessel_*.json) ---
  /** Id of the `.vessel` asset in env-authoring-library. */
  authoringId?: string | null;
  /** Path relative to env-authoring-library. */
  sourceFile?: string | null;
  /** ISO-8601 UTC from ES3 LastSaved. */
  lastSaved?: string | null;
  /** FK to the empty vessel tool row this definition fills. */
  emptyVesselId?: string | null;
  /** Addressables key of the empty vessel prefab. */
  emptyVesselAssetKey?: string | null;
  /** Tool row ids placed inside containers. */
  containedToolIds?: string[];
  /** Addressable keys of contained tools. */
  containedToolAssetKeys?: string[];
  /** Per-drawer/state composition. */
  containers?: UnityVesselContainer[];
  /** Authored environments that reference this library vessel. */
  usedInAuthoredEnvironmentIds?: string[];
  usedInAuthoredEnvironmentKeys?: string[];
  /** Color/label customization packets. */
  packets?: UnityVesselPacket[];
  /** Empty vessels only: custom vessel rows that use this empty vessel as their base. */
  customVesselIds?: string[];
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
    /** RRGGBB hex, or a legacy enum name (`red`, `blue`, …) for material swapping. */
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

/** Unity environment scene ("model" of an environment) from simx_environments. */
export interface UnityEnvironment {
  id: string;
  type: 'environment';
  name: string;
  assetKey: string;
  guid?: string | null;
  addressableGroup?: string | null;
  addressableLabels?: string[];
  scenePath?: string | null;
  /** Authored environments built on top of this scene. */
  authoredEnvironmentIds?: string[];
  authoredEnvironmentKeys?: string[];
  tags?: string[];
}

/**
 * One placed tool instance inside an authored environment layout, so the same
 * addressable can appear several times with distinct runtime ids.
 */
export interface UnityToolPlacement {
  /** Regular layout tool or custom-vessel instance shell. */
  kind?: 'tool' | 'custom-vessel';
  /** Addressables key of the placed tool. */
  assetKey: string;
  /** Tool row id (FK to tools/*.json). */
  toolRowId?: string | null;
  /** Runtime instance id from the layout, e.g. `handle_inside`. */
  toolId?: string | null;
  /** Enclosing group or vessel instance id, when this tool sits inside another. */
  parentToolId?: string | null;
  /** Authoring-library id for a custom-vessel instance. */
  customVesselKey?: string | null;
  /** Whether that custom vessel has a matching shared-library row. */
  sharedLibrary?: boolean;
  /** Full saved pose; the overhead inspector consumes worldPosition. */
  positionData?: UnityPositionData | null;
}

export interface UnityVector3 {
  x: number;
  y: number;
  z: number;
}

export interface UnityPositionData {
  anchorId?: string | null;
  worldPosition?: UnityVector3 | null;
  worldRotation?: UnityVector3 | null;
  anchorPosition?: UnityVector3 | null;
  anchorRotation?: UnityVector3 | null;
}

/** Environment layout authored in the env-authoring tool (.env file). */
export interface UnityAuthoredEnvironment {
  id: string;
  type: 'authored-environment';
  name: string;
  assetKey: string;
  authoringId?: string | null;
  description?: string | null;
  /** Unity scene this layout is placed in. */
  environmentId?: string | null;
  environmentAssetKey?: string | null;
  sourceFile?: string | null;
  lastSaved?: string | null;
  authoringToolVersion?: string | null;
  rootToolEntryCount?: number;
  toolIds?: string[];
  toolAssetKeys?: string[];
  /** Per-instance placements; richer than `toolIds`, which is deduped. */
  toolPlacements?: UnityToolPlacement[];
  customVesselIds?: string[];
  customVesselKeys?: string[];
  emptyVesselIds?: string[];
  emptyVesselAssetKeys?: string[];
  /** Vessel snapshots embedded in the layout with no matching library vessel. */
  unresolvedVesselSnapshotIds?: string[];
  customVesselInstanceToolIds?: string[];
  tags?: string[];
}

export type UnityAudioKind = 'music' | 'sound-effect' | 'background-audio';

/** Audio clip addressable (environment_music / environment_sounds). */
export interface UnityAudio {
  id: string;
  type: 'audio';
  category?: 'audio';
  audioKind: UnityAudioKind;
  name: string;
  assetKey: string;
  guid?: string | null;
  addressableGroup?: string | null;
  addressableLabels?: string[];
  clipPath?: string | null;
  /** Path under db/ to the copied clip, e.g. audio/media/foo.ogg */
  audioPath?: string | null;
  copyStatus?: string | null;
  tags?: string[];
}

export type UnityVideoKind = 'ultrasound';

/** Animation-clip video (ultrasound_videos Addressables). */
export interface UnityVideo {
  id: string;
  type: 'video';
  category?: 'video';
  videoKind: UnityVideoKind;
  name: string;
  assetKey: string;
  guid?: string | null;
  addressableGroup?: string | null;
  addressableLabels?: string[];
  animPath?: string | null;
  duration?: number | null;
  fps?: number | null;
  loop?: boolean;
  frameCount?: number | null;
  resolvedFrames?: number | null;
  /** Path under db/ to the encoded MP4, e.g. videos/media/foo.mp4 */
  videoPath?: string | null;
  /** Path under db/ to a first-frame still. */
  posterPath?: string | null;
  encodeStatus?: string | null;
  tags?: string[];
}

export interface UnityCharacterMetadata extends UnityMetadataObject {
  type: 'characterMetadata';
}

export interface UnityToolMetadata extends UnityMetadataObject {
  type: 'toolMetadata';
  toolIds: string[];
}

/** One row's git creator + top contributors (`db/git-authorship.json`). */
export interface UnityGitPerson {
  name: string;
  email: string;
  date?: string;
}

export interface UnityGitContributor extends UnityGitPerson {
  commits: number;
}

export interface UnityGitAuthorship {
  createdBy: UnityGitPerson | null;
  lastTouchedBy?: UnityGitPerson | null;
  contributors: UnityGitContributor[];
  /** Commits from authors outside the top-N contributor list. */
  otherCommits?: number;
}

export interface UnityGitAuthorshipFile {
  meta?: {
    generatedAt?: string;
    counts?: Record<string, number>;
  };
  byAssetId: Record<string, UnityGitAuthorship>;
}

export interface UnityDbBundle {
  meta?: {
    source?: string;
    generatedAt?: string;
    counts?: Record<string, number>;
  };
  /** Sidecar keyed by row id; omitted when git-authorship.json is absent. */
  gitAuthorship?: Record<string, UnityGitAuthorship>;
  characters: UnityCharacter[];
  /** Optional so a bundle generated before body-texture scrape still loads. */
  bodyTextures?: UnityBodyTexture[];
  overlayTextures?: UnityOverlayTexture[];
  equipment: UnityEquipment[];
  tools: UnityTool[];
  interactions: UnityInteractionRow[];
  environments: UnityEnvironment[];
  authoredEnvironments: UnityAuthoredEnvironment[];
  audio: UnityAudio[];
  videos?: UnityVideo[];
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
  /** Optional so an index.json generated before body-texture scrape still loads. */
  bodyTextures?: string[];
  overlayTextures?: string[];
  equipment: string[];
  tools: string[];
  interactions: string[];
  /** Optional so an index.json generated before these categories still loads. */
  environments?: string[];
  authoredEnvironments?: string[];
  audio?: string[];
  videos?: string[];
  clothing: string;
  medications: string;
  waveforms: string;
  scenarios: string;
  characterMetadata: string;
  toolMetadata: string;
  /** Curated overlay record paths: meta/<uuid>/record.json */
  assetMeta?: string[];
  /** Optional oldId → newId map at meta/aliases.json */
  assetMetaAliases?: string;
  /** Sidecar with creator + top git contributors. */
  gitAuthorship?: string;
}

/**
 * Sidebar category order. Multi-categories (UNITY_SUBCATEGORY_DEFS) first,
 * then flat categories. Tool/kit/group rows share Tooling; vessels/scenes stay separate.
 * Also used as the built-in type-scoped tag groups on the Tags page.
 */
export const UNITY_CATEGORY_ORDER = [
  'Tooling',
  'Vessels',
  'Audio',
  'Videos',
  'Characters',
  'Equipment',
  'Clothing',
  'Medications',
  'Waveforms',
  'Scenarios',
  'Scenes',
  'Environments',
  'Authored Environments',
  'Interactions',
  'Character Metadata',
  'Tool Metadata',
] as const;

export type UnityCategoryName = (typeof UNITY_CATEGORY_ORDER)[number];

/** A category that renders as an accordion of subcategories instead of a flat button. */
export interface UnitySubcategoryDef {
  /** Row `Data` field holding the subcategory value. */
  field: string;
  /** Value assumed when the field is absent. */
  fallback: string;
  options: { key: string; name: string }[];
}

/**
 * Shared by the sidebar tree and the filtered asset list so subcategory counts
 * and filtering always agree. Subcategories with no rows still render (count 0),
 * which is how reserved kinds like Background Audio stay visible.
 */
export const UNITY_SUBCATEGORY_DEFS: Record<string, UnitySubcategoryDef> = {
  Tooling: {
    field: 'Kind',
    fallback: 'tool',
    options: [
      { key: 'tool', name: 'Tools' },
      { key: 'kit', name: 'Kits' },
      { key: 'group', name: 'Groups' },
    ],
  },
  Vessels: {
    field: 'VesselType',
    fallback: 'empty',
    options: [
      { key: 'empty', name: 'Empty' },
      { key: 'custom', name: 'Custom' },
    ],
  },
  Audio: {
    field: 'AudioKind',
    fallback: 'sound-effect',
    options: [
      { key: 'music', name: 'Music' },
      { key: 'sound-effect', name: 'Sound Effects' },
      { key: 'background-audio', name: 'Background Audio' },
    ],
  },
  Videos: {
    field: 'VideoKind',
    fallback: 'ultrasound',
    options: [
      { key: 'ultrasound', name: 'Ultrasound Videos' },
    ],
  },
  Characters: {
    field: 'CharacterKind',
    fallback: 'character',
    options: [
      { key: 'character', name: 'Characters' },
      { key: 'body-texture', name: 'Body Textures' },
      { key: 'overlay-texture', name: 'Overlay Textures' },
    ],
  },
};

/** Root URL path (or absolute URL) of the db folder.
 * Locally served via db-link → UNITY_ASSET_DB_DIR junction (copied to /db).
 * Point this at an S3/HTTPS URL once the bucket is ready. */
export const UNITY_DB_ROOT = 'db';
export const UNITY_DB_INDEX_FILE = 'index.json';
export const UNITY_VIRTUAL_FILE = 'Unity Asset DB';
