import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DboAsset } from '../models/dbo.models';
import { DboLoadResult } from './dbo-data.service';
import {
  UNITY_DB_FILE,
  UNITY_VIRTUAL_FILE,
  UnityCharacter,
  UnityClothing,
  UnityDbBundle,
  UnityEquipment,
  UnityInteraction,
  UnityMetadataObject,
  UnityTool,
} from '../models/unity-asset.models';

// Category order for the sidebar. Tool rows are split by their `kind`.
const CATEGORY_ORDER = [
  'Characters',
  'Equipment',
  'Clothing',
  'Tools',
  'Kits',
  'Groups',
  'Vessels',
  'Scenes',
  'Character Metadata',
  'Tool Metadata',
];

interface ReverseIndex {
  clothingWornBy: Record<string, string[]>;
  containedTools: Record<string, string[]>;
  metadataUsedBy: Record<string, string[]>;
  /** tool id → equipment ids whose interactions list that tool */
  equipmentByTool: Record<string, string[]>;
  charByAssetKey: Record<string, UnityCharacter>;
}

@Injectable({ providedIn: 'root' })
export class UnityDataService {
  private readonly http = inject(HttpClient);

  async loadBundle(): Promise<DboLoadResult> {
    const bundle = await firstValueFrom(
      this.http.get<UnityDbBundle>(`/${UNITY_DB_FILE}`)
    );
    if (!bundle || !Array.isArray(bundle.characters)) {
      throw new Error('Invalid Unity asset DB bundle');
    }
    return this.buildFromText(bundle);
  }

  parseText(text: string): UnityDbBundle {
    const bundle = JSON.parse(text) as UnityDbBundle;
    if (!bundle || !Array.isArray(bundle.characters)) {
      throw new Error('Invalid Unity asset DB bundle');
    }
    return bundle;
  }

  buildFromText(bundle: UnityDbBundle): DboLoadResult {
    const reverse = this.buildReverseIndex(bundle);
    const assetMap: Record<string, DboAsset> = {};
    const categories: Record<string, DboAsset[]> = {};
    for (const cat of CATEGORY_ORDER) categories[cat] = [];

    const push = (cat: string, asset: DboAsset) => {
      // Guard against duplicate ids in the source graph (two rows can share a
      // UUID). Colliding ids would overwrite each other in assetMap and produce
      // duplicate @for track keys (NG0955), so suffix later occurrences to keep
      // every row independently listable and openable.
      if (assetMap[asset.AssetId]) {
        let n = 2;
        let uniqueId = `${asset.AssetId}#${n}`;
        while (assetMap[uniqueId]) uniqueId = `${asset.AssetId}#${++n}`;
        asset = { ...asset, AssetId: uniqueId };
      }
      (categories[cat] ??= []).push(asset);
      assetMap[asset.AssetId] = asset;
    };

    for (const c of bundle.characters ?? []) {
      push('Characters', this.adaptCharacter(c, reverse));
    }
    for (const e of bundle.equipment ?? []) {
      push('Equipment', this.adaptEquipment(e));
    }
    for (const cl of bundle.clothing ?? []) {
      push('Clothing', this.adaptClothing(cl, reverse));
    }
    for (const t of bundle.tools ?? []) {
      push(this.toolCategory(t.kind), this.adaptTool(t, reverse));
    }
    for (const m of bundle.characterMetadata ?? []) {
      push('Character Metadata', this.adaptMetadata(m, 'Character Metadata', reverse));
    }
    for (const m of bundle.toolMetadata ?? []) {
      push('Tool Metadata', this.adaptToolMetadata(m));
    }

    const fileData: Record<string, DboAsset[]> = {};
    for (const cat of CATEGORY_ORDER) {
      if (categories[cat]?.length) fileData[cat] = categories[cat];
    }

    const rawData = { [UNITY_VIRTUAL_FILE]: fileData };
    return {
      rawData,
      loadedFileNames: [UNITY_VIRTUAL_FILE],
      assetMap,
      allToolsMap: {},
    };
  }

  private buildReverseIndex(bundle: UnityDbBundle): ReverseIndex {
    const clothingWornBy: Record<string, string[]> = {};
    const containedTools: Record<string, string[]> = {};
    const metadataUsedBy: Record<string, string[]> = {};
    const equipmentByTool: Record<string, string[]> = {};
    const charByAssetKey: Record<string, UnityCharacter> = {};

    for (const c of bundle.characters ?? []) {
      charByAssetKey[c.assetKey] = c;
      for (const clothingId of c.availableClothing ?? []) {
        (clothingWornBy[clothingId] ??= []).push(c.id);
      }
    }
    for (const t of bundle.tools ?? []) {
      for (const groupId of t.usedInGroupIds ?? []) {
        (containedTools[groupId] ??= []).push(t.id);
      }
      for (const m of t.metadata ?? []) {
        if (m?.id) (metadataUsedBy[m.id] ??= []).push(t.id);
      }
    }
    for (const e of bundle.equipment ?? []) {
      if (e.primaryMetadata?.id) (metadataUsedBy[e.primaryMetadata.id] ??= []).push(e.id);
      for (const m of e.metadata ?? []) {
        if (m?.id) (metadataUsedBy[m.id] ??= []).push(e.id);
      }
      // Cross-ref: each tool listed on an equipment interaction is "compatible"
      // with that equipment (inverse of Compatible Tools on the equipment page).
      const seen = new Set<string>();
      for (const it of e.interactions ?? []) {
        for (const toolId of it.assetIds ?? []) {
          if (seen.has(toolId)) continue;
          seen.add(toolId);
          (equipmentByTool[toolId] ??= []).push(e.id);
        }
      }
    }

    return { clothingWornBy, containedTools, metadataUsedBy, equipmentByTool, charByAssetKey };
  }

  private toolCategory(kind: string): string {
    switch (kind) {
      case 'kit':
        return 'Kits';
      case 'group':
        return 'Groups';
      case 'vessel':
        return 'Vessels';
      case 'scene':
        return 'Scenes';
      default:
        return 'Tools';
    }
  }

  private toRefs(ids: string[] | undefined): { AssetId: string }[] {
    return (ids ?? []).map((id) => ({ AssetId: id }));
  }

  private adaptInteractions(list: UnityInteraction[] | undefined): unknown[] {
    return (list ?? []).map((it) => {
      const out: Record<string, unknown> = { Location: it.location };
      if (it.availableIn && it.availableIn.length) out['AvailableIn'] = it.availableIn;
      out['Assets'] = this.toRefs(it.assetIds);
      return out;
    });
  }

  private compactMetadata(m: UnityMetadataObject): Record<string, unknown> {
    const out: Record<string, unknown> = { Key: m.key };
    if (m.description) out['Description'] = m.description;
    if (m.valueType) out['ValueType'] = m.valueType;
    if (m.valueShape && m.valueShape !== m.valueType) out['ValueShape'] = m.valueShape;
    if (m.possibleValues && m.possibleValues.length) out['PossibleValues'] = m.possibleValues;
    if (m.defaultValue !== null && m.defaultValue !== undefined && m.defaultValue !== '')
      out['DefaultValue'] = m.defaultValue;
    if (m.examples && m.examples.length) out['Examples'] = m.examples;
    if (m.controllerType) out['ControllerType'] = m.controllerType;
    if (m.sourceScripts) out['SourceScripts'] = m.sourceScripts;
    if (m.complexSchema) out['ComplexSchema'] = m.complexSchema;
    return out;
  }

  private adaptCharacter(c: UnityCharacter, reverse: ReverseIndex): DboAsset {
    const data: Record<string, unknown> = {
      AssetKey: c.assetKey,
      GroupFolder: c.groupFolder,
      IsVariant: c.isVariant,
      IsPrimaryInGroup: c.isPrimaryInGroup,
      PrefabPath: c.prefabPath,
    };

    // Family links ("kids"): base <-> variants within the same group.
    if (c.isVariant && c.baseAddressable && c.baseAddressable !== c.assetKey) {
      const base = reverse.charByAssetKey[c.baseAddressable];
      if (base) data['BaseCharacter'] = { AssetId: base.id };
    }
    const variants = Object.values(reverse.charByAssetKey)
      .filter((o) => o.id !== c.id && o.baseAddressable === c.assetKey)
      .map((o) => ({ AssetId: o.id }));
    if (variants.length) data['Variants'] = variants;

    if (c.interactions?.length) data['Interactions'] = this.adaptInteractions(c.interactions);
    data['AvailableEquipment'] = this.toRefs(c.availableEquipment);
    data['AvailableClothing'] = this.toRefs(c.availableClothing);

    return {
      AssetId: c.id,
      AssetName: c.name,
      AssetType: c.isVariant ? 'Character (variant)' : 'Character',
      Data: data,
      _Category: 'Characters',
      _File: UNITY_VIRTUAL_FILE,
    };
  }

  private adaptEquipment(e: UnityEquipment): DboAsset {
    const data: Record<string, unknown> = {
      AssetKey: e.assetKey,
      PrefabPath: e.prefabPath,
    };
    if (e.primaryMetadata) data['PrimaryMetadata'] = this.compactMetadata(e.primaryMetadata);
    if (e.metadata?.length) data['Metadata'] = e.metadata.map((m) => this.compactMetadata(m));
    if (e.interactions?.length) data['Interactions'] = this.adaptInteractions(e.interactions);
    data['CompatibleCharacters'] = this.toRefs(e.characterIds);

    return {
      AssetId: e.id,
      AssetName: e.name,
      AssetType: 'Equipment',
      Data: data,
      _Category: 'Equipment',
      _File: UNITY_VIRTUAL_FILE,
    };
  }

  private adaptClothing(cl: UnityClothing, reverse: ReverseIndex): DboAsset {
    const data: Record<string, unknown> = { AssetKey: cl.assetKey };
    const wornBy = reverse.clothingWornBy[cl.id];
    data['CompatibleCharacters'] = this.toRefs(wornBy);
    return {
      AssetId: cl.id,
      AssetName: cl.name,
      AssetType: 'Clothing',
      Data: data,
      _Category: 'Clothing',
      _File: UNITY_VIRTUAL_FILE,
    };
  }

  private adaptTool(t: UnityTool, reverse: ReverseIndex): DboAsset {
    const data: Record<string, unknown> = {
      AssetKey: t.assetKey,
      Kind: t.kind,
      ToolId: t.toolId,
      PrefabPath: t.prefabPath,
    };
    if (t.metadata?.length) data['Metadata'] = t.metadata.map((m) => this.compactMetadata(m));
    if (t.interactions?.length) data['InteractionSenders'] = this.adaptInteractions(t.interactions);
    if (t.interactionTargets?.length)
      data['InteractionTargets'] = this.adaptInteractions(t.interactionTargets);
    if (t.usedInGroupIds?.length) data['UsedInGroups'] = this.toRefs(t.usedInGroupIds);

    // "Kids" of a group / kit: tools that declare this row in their usedInGroupIds.
    const contained = reverse.containedTools[t.id];
    if (contained?.length) data['ContainedTools'] = this.toRefs(contained);

    const compatibleEquipment = reverse.equipmentByTool[t.id];
    if (compatibleEquipment?.length) data['CompatibleEquipment'] = this.toRefs(compatibleEquipment);

    if (t.scenarioIds?.length) data['ScenarioIds'] = t.scenarioIds;

    return {
      AssetId: t.id,
      AssetName: t.name,
      AssetType: this.toolCategory(t.kind).replace(/s$/, ''),
      Data: data,
      _Category: this.toolCategory(t.kind),
      _File: UNITY_VIRTUAL_FILE,
    };
  }

  private adaptMetadata(
    m: UnityMetadataObject,
    category: string,
    reverse: ReverseIndex
  ): DboAsset {
    const data = this.compactMetadata(m);
    const usedBy = reverse.metadataUsedBy[m.id];
    if (usedBy?.length) data['UsedBy'] = this.toRefs(usedBy);
    return {
      AssetId: m.id,
      AssetName: m.key,
      AssetType: 'Character Metadata',
      Data: data,
      _Category: category,
      _File: UNITY_VIRTUAL_FILE,
    };
  }

  private adaptToolMetadata(
    m: UnityMetadataObject & { toolIds?: string[] }
  ): DboAsset {
    const data = this.compactMetadata(m);
    data['Tools'] = this.toRefs(m.toolIds);
    return {
      AssetId: m.id,
      AssetName: m.key,
      AssetType: 'Tool Metadata',
      Data: data,
      _Category: 'Tool Metadata',
      _File: UNITY_VIRTUAL_FILE,
    };
  }
}
