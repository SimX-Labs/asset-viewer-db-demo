import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DboAsset } from '../models/dbo.models';
import { DboLoadResult } from './dbo-data.service';
import {
  UNITY_DB_INDEX_FILE,
  UNITY_DB_ROOT,
  UNITY_VIRTUAL_FILE,
  UnityCharacter,
  UnityClothing,
  UnityDbBundle,
  UnityDbIndex,
  UnityEquipment,
  UnityInteractionRef,
  UnityInteractionRow,
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
  'Interactions',
  'Character Metadata',
  'Tool Metadata',
];

const FETCH_BATCH_SIZE = 48;

interface ReverseIndex {
  clothingWornBy: Record<string, string[]>;
  containedTools: Record<string, string[]>;
  metadataUsedBy: Record<string, string[]>;
  /** tool id → equipment ids whose interactionLocations list that tool */
  equipmentByTool: Record<string, string[]>;
  charByAssetKey: Record<string, UnityCharacter>;
  interactionById: Record<string, UnityInteractionRow>;
  interactionByLocation: Record<string, UnityInteractionRow>;
}

@Injectable({ providedIn: 'root' })
export class UnityDataService {
  private readonly http = inject(HttpClient);

  /** Load the per-file db/ tree via index.json, then fetch each row. */
  async loadDb(root = UNITY_DB_ROOT): Promise<DboLoadResult> {
    const base = root.replace(/\/+$/, '');
    const index = await firstValueFrom(
      this.http.get<UnityDbIndex>(`${base}/${UNITY_DB_INDEX_FILE}`)
    );
    if (!index || !Array.isArray(index.characters)) {
      throw new Error(`Invalid Unity asset DB index at ${base}/${UNITY_DB_INDEX_FILE}`);
    }

    const [characters, equipment, tools, interactions, clothing, characterMetadata, toolMetadata] =
      await Promise.all([
        this.fetchJsonFiles<UnityCharacter>(base, index.characters),
        this.fetchJsonFiles<UnityEquipment>(base, index.equipment),
        this.fetchJsonFiles<UnityTool>(base, index.tools),
        this.fetchJsonFiles<UnityInteractionRow>(base, index.interactions ?? []),
        firstValueFrom(this.http.get<UnityClothing[]>(`${base}/${index.clothing}`)),
        firstValueFrom(
          this.http.get<UnityMetadataObject[]>(`${base}/${index.characterMetadata}`)
        ),
        firstValueFrom(
          this.http.get<(UnityMetadataObject & { toolIds?: string[] })[]>(
            `${base}/${index.toolMetadata}`
          )
        ),
      ]);

    return this.buildFromBundle({
      meta: {
        source: index.meta?.source ?? base,
        generatedAt: index.meta?.generatedAt,
        counts: {
          characters: characters.length,
          equipment: equipment.length,
          tools: tools.length,
          interactions: interactions.length,
          clothing: Array.isArray(clothing) ? clothing.length : 0,
          characterMetadata: Array.isArray(characterMetadata) ? characterMetadata.length : 0,
          toolMetadata: Array.isArray(toolMetadata) ? toolMetadata.length : 0,
        },
      },
      characters,
      equipment,
      tools,
      interactions,
      clothing: Array.isArray(clothing) ? clothing : [],
      characterMetadata: (Array.isArray(characterMetadata) ? characterMetadata : []) as UnityDbBundle['characterMetadata'],
      toolMetadata: (Array.isArray(toolMetadata) ? toolMetadata : []) as UnityDbBundle['toolMetadata'],
    });
  }

  /** @deprecated Use loadDb — kept for call sites during transition. */
  loadBundle(): Promise<DboLoadResult> {
    return this.loadDb();
  }

  /**
   * Build from a folder selection (webkitdirectory). Expects relative paths such as
   * `characters/*.json`, `equipment/*.json`, `tools/*.json`, plus root array files.
   */
  async buildFromFolderFiles(files: File[]): Promise<DboLoadResult> {
    const byRel = new Map<string, File>();
    for (const f of files) {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      // Strip a leading folder segment if the user picked the db/ parent or db itself.
      const normalized = rel.replace(/\\/g, '/').replace(/^[^/]+\/db\//, '').replace(/^db\//, '');
      byRel.set(normalized, f);
    }

    const readJson = async <T>(rel: string): Promise<T | null> => {
      const file = byRel.get(rel);
      if (!file) return null;
      return JSON.parse(await file.text()) as T;
    };

    const listDir = (prefix: string): string[] =>
      [...byRel.keys()].filter(
        (p) => p.startsWith(prefix + '/') && p.toLowerCase().endsWith('.json') && !p.slice(prefix.length + 1).includes('/')
      );

    const readDir = async <T>(prefix: string): Promise<T[]> => {
      const paths = listDir(prefix);
      const rows: T[] = [];
      for (let i = 0; i < paths.length; i += FETCH_BATCH_SIZE) {
        const batch = paths.slice(i, i + FETCH_BATCH_SIZE);
        const part = await Promise.all(
          batch.map(async (p) => {
            try {
              return (await readJson<T>(p)) as T;
            } catch {
              return null;
            }
          })
        );
        for (const row of part) if (row) rows.push(row);
      }
      return rows;
    };

    const clothing = (await readJson<UnityClothing[]>('clothing.json')) ?? [];
    const characterMetadata =
      (await readJson<UnityDbBundle['characterMetadata']>('character-metadata.json')) ?? [];
    const toolMetadata =
      (await readJson<UnityDbBundle['toolMetadata']>('tool-metadata.json')) ?? [];

    const bundle: UnityDbBundle = {
      meta: { source: 'folder', generatedAt: new Date().toISOString() },
      characters: await readDir<UnityCharacter>('characters'),
      equipment: await readDir<UnityEquipment>('equipment'),
      tools: await readDir<UnityTool>('tools'),
      interactions: await readDir<UnityInteractionRow>('interactions'),
      clothing: Array.isArray(clothing) ? clothing : [],
      characterMetadata: Array.isArray(characterMetadata) ? characterMetadata : [],
      toolMetadata: Array.isArray(toolMetadata) ? toolMetadata : [],
    };

    if (!bundle.characters.length && !bundle.equipment.length && !bundle.tools.length) {
      throw new Error(
        'No Unity asset DB rows found. Select the db folder (with characters/, equipment/, tools/).'
      );
    }

    return this.buildFromBundle(bundle);
  }

  parseText(text: string): UnityDbBundle {
    const bundle = JSON.parse(text) as UnityDbBundle;
    if (!bundle || !Array.isArray(bundle.characters)) {
      throw new Error('Invalid Unity asset DB bundle');
    }
    return bundle;
  }

  buildFromText(bundle: UnityDbBundle): DboLoadResult {
    return this.buildFromBundle(bundle);
  }

  buildFromBundle(bundle: UnityDbBundle): DboLoadResult {
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
      push('Equipment', this.adaptEquipment(e, reverse));
    }
    for (const cl of bundle.clothing ?? []) {
      push('Clothing', this.adaptClothing(cl, reverse));
    }
    for (const t of bundle.tools ?? []) {
      push(this.toolCategory(t.kind), this.adaptTool(t, reverse));
    }
    for (const i of bundle.interactions ?? []) {
      push('Interactions', this.adaptInteractionRow(i));
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

  private async fetchJsonFiles<T>(base: string, relPaths: string[]): Promise<T[]> {
    const out: T[] = [];
    for (let i = 0; i < relPaths.length; i += FETCH_BATCH_SIZE) {
      const batch = relPaths.slice(i, i + FETCH_BATCH_SIZE);
      const part = await Promise.all(
        batch.map((rel) =>
          firstValueFrom(this.http.get<T>(`${base}/${rel.replace(/^\/+/, '')}`))
        )
      );
      out.push(...part);
    }
    return out;
  }

  /** Character/equipment locations — new field, with legacy `interactions` fallback. */
  private hostLocations(
    row: { interactionLocations?: UnityInteractionRef[]; interactions?: UnityInteractionRef[] }
  ): UnityInteractionRef[] {
    return row.interactionLocations ?? row.interactions ?? [];
  }

  /**
   * Tool outbound vs inbound.
   * New: interactions = outbound, interactionLocations = inbound.
   * Legacy: interactionTargets = outbound, interactions = inbound.
   */
  private toolOutbound(t: UnityTool): UnityInteractionRef[] {
    if (Array.isArray(t.interactionTargets)) return t.interactionTargets;
    return t.interactions ?? [];
  }

  private toolInbound(t: UnityTool): UnityInteractionRef[] {
    if (Array.isArray(t.interactionTargets)) return t.interactions ?? [];
    return t.interactionLocations ?? [];
  }

  private buildReverseIndex(bundle: UnityDbBundle): ReverseIndex {
    const clothingWornBy: Record<string, string[]> = {};
    const containedTools: Record<string, string[]> = {};
    const metadataUsedBy: Record<string, string[]> = {};
    const equipmentByTool: Record<string, string[]> = {};
    const charByAssetKey: Record<string, UnityCharacter> = {};
    const interactionById: Record<string, UnityInteractionRow> = {};
    const interactionByLocation: Record<string, UnityInteractionRow> = {};

    for (const i of bundle.interactions ?? []) {
      interactionById[i.id] = i;
      if (i.location) interactionByLocation[i.location] = i;
    }

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
      // Cross-ref: each tool listed on an equipment interaction location is
      // "compatible" with that equipment (inverse of Compatible Tools).
      const seen = new Set<string>();
      for (const it of this.hostLocations(e)) {
        for (const toolId of it.assetIds ?? []) {
          if (seen.has(toolId)) continue;
          seen.add(toolId);
          (equipmentByTool[toolId] ??= []).push(e.id);
        }
      }
    }

    return {
      clothingWornBy,
      containedTools,
      metadataUsedBy,
      equipmentByTool,
      charByAssetKey,
      interactionById,
      interactionByLocation,
    };
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

  private adaptInteractions(
    list: UnityInteractionRef[] | undefined,
    reverse: ReverseIndex
  ): unknown[] {
    return (list ?? []).map((it) => {
      const row =
        (it.interactionId ? reverse.interactionById[it.interactionId] : undefined) ??
        (it.location ? reverse.interactionByLocation[it.location] : undefined);
      const out: Record<string, unknown> = {};
      if (it.interactionId || row?.id) {
        out['Interaction'] = { AssetId: it.interactionId ?? row!.id };
      }
      const loc = row?.location ?? it.location;
      if (loc) out['Location'] = loc;
      if (it.availableIn && it.availableIn.length) out['AvailableIn'] = it.availableIn;
      out['Assets'] = this.toRefs(it.assetIds);
      return out;
    });
  }

  private adaptInteractionRow(i: UnityInteractionRow): DboAsset {
    const data: Record<string, unknown> = {
      Location: i.location,
    };
    if (i.options?.length) {
      data['Options'] = i.options.map((o) => {
        const opt: Record<string, unknown> = { InteractionType: o.interactionType };
        if (o.info != null && o.info !== '') opt['Info'] = o.info;
        if (o.metadata != null && o.metadata !== '') opt['Metadata'] = o.metadata;
        return opt;
      });
    }
    if (i.canSendAssetIds?.length) {
      data['Can Send'] = this.toRefs(i.canSendAssetIds);
    }
    if (i.canReceiveAssetIds?.length) {
      data['Can Receive'] = this.toRefs(i.canReceiveAssetIds);
    }

    return {
      AssetId: i.id,
      AssetName: i.name || i.location,
      AssetType: 'Interaction',
      Data: data,
      _Category: 'Interactions',
      _File: UNITY_VIRTUAL_FILE,
    };
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

    const locations = this.hostLocations(c);
    if (locations.length) data['Interactions'] = this.adaptInteractions(locations, reverse);
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

  private adaptEquipment(e: UnityEquipment, reverse: ReverseIndex): DboAsset {
    const data: Record<string, unknown> = {
      AssetKey: e.assetKey,
      PrefabPath: e.prefabPath,
    };
    if (e.primaryMetadata) data['PrimaryMetadata'] = this.compactMetadata(e.primaryMetadata);
    if (e.metadata?.length) data['Metadata'] = e.metadata.map((m) => this.compactMetadata(m));
    const locations = this.hostLocations(e);
    if (locations.length) data['Interactions'] = this.adaptInteractions(locations, reverse);
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

    const outbound = this.toolOutbound(t);
    const inbound = this.toolInbound(t);
    if (outbound.length) data['InteractionSenders'] = this.adaptInteractions(outbound, reverse);
    if (inbound.length) data['InteractionLocations'] = this.adaptInteractions(inbound, reverse);

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
