import { DboAsset, ToolNode } from './dbo.models';

/**
 * Catalog row id attached to a placed tool, when the Unity/DBO adapter mapped one.
 * `ToolNode.Asset` is `{ AssetId }` from `toolRowId` (Unity) or left unset for
 * unexported prefabs and inline vessel snapshots.
 */
export function toolCatalogAssetId(tool: ToolNode | null | undefined): string | null {
  const asset = tool?.Asset;
  if (!asset || typeof asset !== 'object' || !('AssetId' in asset)) return null;
  const id = (asset as { AssetId?: unknown }).AssetId;
  return typeof id === 'string' && id.trim() ? id : null;
}

/**
 * Eligible for a database-entry link when the placed tool has a catalog id that
 * exists in the loaded asset map — the same rule as `placedToolIsLinked`.
 */
export function isToolEligibleForDatabaseEntry(
  tool: ToolNode | null | undefined,
  assetMap: Record<string, DboAsset>,
): boolean {
  const id = toolCatalogAssetId(tool);
  return !!id && !!assetMap[id];
}
