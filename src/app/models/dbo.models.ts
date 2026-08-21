import { DataSource } from './data-source';

export interface DboAsset {
  AssetId: string;
  AssetName: string;
  AssetType: string;
  Data: Record<string, unknown>;
  /** Free-form labels from Unity export; used for sorting / filtering. */
  Tags?: string[];
  _Category?: string;
  _File?: string;
  /** Scrape origin for this row (client, shared library, API/DB, …). */
  _Source?: DataSource;
  ToolHierarchyData?: ToolHierarchy;
}

export interface ToolHierarchy {
  Roots: ToolNode[];
}

export interface ToolNode {
  ToolId: string;
  Position?: { x: number; y: number; z: number };
  Rotation?: { x: number; y: number; z: number };
  Asset: unknown;
  Children?: ToolNode[];
  /** Authored-environment custom-vessel shell metadata. */
  PlacementKind?: 'tool' | 'custom-vessel';
  SharedLibrary?: boolean;
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
