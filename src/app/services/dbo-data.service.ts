import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_DBO_FILES,
  DboAsset,
  DboEnvelope,
  ToolNode,
} from '../models/dbo.models';

export interface DboLoadResult {
  rawData: Record<string, Record<string, DboAsset[]>>;
  loadedFileNames: string[];
  assetMap: Record<string, DboAsset>;
  allToolsMap: Record<string, ToolNode>;
}

@Injectable({ providedIn: 'root' })
export class DboDataService {
  private readonly http = inject(HttpClient);

  async loadDefaultFiles(): Promise<DboLoadResult> {
    const results = await Promise.all(
      DEFAULT_DBO_FILES.map(async (file) => {
        try {
          const json = await firstValueFrom(this.http.get<DboEnvelope>(`/${file}`));
          if (json?.data?.value) {
            return { name: file, data: json.data.value };
          }
        } catch (e) {
          console.error(`Failed to load ${file}`, e);
        }
        return null;
      })
    );

    const rawData: Record<string, Record<string, DboAsset[]>> = {};
    const loadedFileNames: string[] = [];
    for (const result of results) {
      if (result) {
        rawData[result.name] = result.data;
        loadedFileNames.push(result.name);
      }
    }
    return this.buildIndexes(rawData, loadedFileNames);
  }

  loadFromText(fileText: string, fileName: string): Record<string, DboAsset[]> {
    const json = JSON.parse(fileText) as DboEnvelope;
    if (!json?.data?.value) throw new Error('Invalid DBO format');
    return json.data.value;
  }

  mergeFileData(
    existing: Record<string, Record<string, DboAsset[]>> | null,
    existingNames: string[],
    fileName: string,
    data: Record<string, DboAsset[]>,
    additive: boolean
  ): { rawData: Record<string, Record<string, DboAsset[]>>; loadedFileNames: string[] } {
    if (additive && existing) {
      const rawData = { ...existing };
      const loadedFileNames = [...existingNames];
      if (!loadedFileNames.includes(fileName)) {
        loadedFileNames.push(fileName);
        rawData[fileName] = data;
      }
      return { rawData, loadedFileNames };
    }
    return { rawData: { [fileName]: data }, loadedFileNames: [fileName] };
  }

  mergeMultipleFiles(
    existing: Record<string, Record<string, DboAsset[]>> | null,
    existingNames: string[],
    files: { name: string; data: Record<string, DboAsset[]> }[],
    additive: boolean
  ): DboLoadResult {
    let rawData = additive && existing ? { ...existing } : ({} as Record<string, Record<string, DboAsset[]>>);
    let loadedFileNames = additive && existing ? [...existingNames] : [];

    files.forEach((file, index) => {
      const fileAdditive = additive || index > 0;
      if (fileAdditive && loadedFileNames.includes(file.name)) return;
      if (!fileAdditive) {
        rawData = { [file.name]: file.data };
        loadedFileNames = [file.name];
      } else {
        rawData[file.name] = file.data;
        if (!loadedFileNames.includes(file.name)) loadedFileNames.push(file.name);
      }
    });

    return this.buildIndexes(rawData, loadedFileNames);
  }

  buildIndexes(
    rawData: Record<string, Record<string, DboAsset[]>>,
    loadedFileNames: string[]
  ): DboLoadResult {
    const assetMap: Record<string, DboAsset> = {};
    const allToolsMap: Record<string, ToolNode> = {};

    for (const fileName of Object.keys(rawData)) {
      const fileData = rawData[fileName];
      for (const cat of Object.keys(fileData)) {
        for (const item of fileData[cat]) {
          assetMap[item.AssetId] = { ...item, _Category: cat, _File: fileName };
        }
      }
    }

    for (const asset of Object.values(assetMap)) {
      if (asset.AssetType === 'EnvironmentScene' && asset.Data?.['ToolHierarchy']) {
        const hierarchy = asset.Data['ToolHierarchy'] as { Roots?: ToolNode[] };
        asset.ToolHierarchyData = hierarchy as DboAsset['ToolHierarchyData'];
        const processTools = (tools: ToolNode[], parentId: string | null = null) => {
          for (const tool of tools) {
            allToolsMap[tool.ToolId] = {
              ...tool,
              _SceneAssetId: asset.AssetId,
              _ParentToolId: parentId,
            };
            if (tool.Children?.length) processTools(tool.Children, tool.ToolId);
          }
        };
        if (hierarchy.Roots) processTools(hierarchy.Roots);
      }
    }

    return { rawData, loadedFileNames, assetMap, allToolsMap };
  }

  getCategoryItems(
    rawData: Record<string, Record<string, DboAsset[]>>,
    category: string
  ): DboAsset[] {
    const items: DboAsset[] = [];
    for (const fileData of Object.values(rawData)) {
      if (fileData[category]) items.push(...fileData[category]);
    }
    return items;
  }
}
