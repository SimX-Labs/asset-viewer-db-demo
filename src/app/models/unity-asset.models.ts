// Models for the "Unity Asset DB" paradigm — the database-shaped JSON graph emitted by the
// unity-asset-documentation pipeline. Unlike the classic DBO format (a single base object type
// with a generic `Data` bag), this graph has a distinct row shape per asset type and links rows
// together via UUID foreign-key arrays.
//
// See gitbooks/data/db/schemas/*.md in the source repo for the authoritative schema.

export type UnityRowType =
  | 'character'
  | 'equipment'
  | 'tool'
  | 'clothing'
  | 'characterMetadata'
  | 'toolMetadata';

export interface UnityInteraction {
  location: string;
  assetIds: string[];
  availableIn: string[] | null;
}

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
  interactions: UnityInteraction[];
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
  interactions: UnityInteraction[];
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
  interactions: UnityInteraction[];
  interactionTargets: UnityInteraction[];
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
  clothing: UnityClothing[];
  characterMetadata: UnityCharacterMetadata[];
  toolMetadata: UnityToolMetadata[];
}

export const UNITY_DB_FILE = 'unity-asset-db.json';
export const UNITY_VIRTUAL_FILE = 'Unity Asset DB';
