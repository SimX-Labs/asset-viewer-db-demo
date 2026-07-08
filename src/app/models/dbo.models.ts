export interface DboEnvelope {
  data: {
    value: Record<string, DboAsset[]>;
  };
}

export interface DboAsset {
  AssetId: string;
  AssetName: string;
  AssetType: string;
  Data: Record<string, unknown>;
  _Category?: string;
  _File?: string;
  ToolHierarchyData?: ToolHierarchy;
}

export interface ToolHierarchy {
  Roots: ToolNode[];
}

export interface ToolNode {
  ToolId: string;
  Position?: { x: number; y: number; z: number };
  Asset: unknown;
  Children?: ToolNode[];
  _SceneAssetId?: string;
  _ParentToolId?: string | null;
}

export interface AssetRef {
  AssetId: string;
  AssociationData?: Record<string, unknown>;
}

export interface MetadataObject {
  Key?: string;
  Value?: string;
  Options?: string[];
  SetMetadataSnippet?: string;
  MetadataComparisonSnippet?: string;
  InteractionSnippet?: string;
}

export interface ProcedureState {
  Id: string;
  StateType?: number;
  ValidTransitions?: ProcedureTransition[];
}

export interface ProcedureTransition {
  ResultingStateId: string;
  ValidMessageTriggers?: string[];
  RequiredInteractions?: {
    InteractionTypeId: string;
    validInteractionReceiverIds?: string[];
  }[];
}

export interface TabState {
  rootAssetId: string;
  history: string[];
}

export type MessageMode = 'package' | 'address';
export type ThemePreference = 'system' | 'light' | 'dark';

export const DEFAULT_DBO_FILES = [
  'DBO_Tools.json',
  'DBO_Authoring.json',
  'DBO_Cases.json',
  'DBO_Characters.json',
  'DBO_Dialog.json',
  'DBO_Other.json',
  'DBO_Scenes.json',
];
