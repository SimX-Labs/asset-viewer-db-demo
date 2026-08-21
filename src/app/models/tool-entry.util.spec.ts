import { DboAsset, ToolNode } from './dbo.models';
import { isToolEligibleForDatabaseEntry, toolCatalogAssetId } from './tool-entry.util';

function asset(id: string): DboAsset {
  return { AssetId: id, AssetName: id, AssetType: 'Tool', Data: {} };
}

function tool(assetRef: unknown): ToolNode {
  return { ToolId: 'inst-1', Asset: assetRef };
}

describe('tool-entry.util', () => {
  const map = { 'scalpel-row': asset('scalpel-row') };

  it('reads the catalog id from ToolNode.Asset', () => {
    expect(toolCatalogAssetId(tool({ AssetId: 'scalpel-row' }))).toBe('scalpel-row');
    expect(toolCatalogAssetId(tool(null))).toBeNull();
    expect(toolCatalogAssetId(tool(undefined))).toBeNull();
  });

  it('is eligible only when that catalog id exists in the asset map', () => {
    expect(isToolEligibleForDatabaseEntry(tool({ AssetId: 'scalpel-row' }), map)).toBeTrue();
    expect(isToolEligibleForDatabaseEntry(tool({ AssetId: 'missing-row' }), map)).toBeFalse();
    expect(isToolEligibleForDatabaseEntry(tool(null), map)).toBeFalse();
  });
});
