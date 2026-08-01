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
  characterMetadata: string;
  toolMetadata: string;
}

/** Root URL path (or absolute URL) of the db folder. Override later for a remote host. */
export const UNITY_DB_ROOT = 'db';
export const UNITY_DB_INDEX_FILE = 'index.json';
export const UNITY_VIRTUAL_FILE = 'Unity Asset DB';
