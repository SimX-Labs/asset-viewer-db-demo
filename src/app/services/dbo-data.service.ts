import { Injectable } from '@angular/core';
import { DboAsset, ToolNode } from '../models/dbo.models';

export interface DboLoadResult {
  rawData: Record<string, Record<string, DboAsset[]>>;
  loadedFileNames: string[];
  assetMap: Record<string, DboAsset>;
  allToolsMap: Record<string, ToolNode>;
}

@Injectable({ providedIn: 'root' })
export class DboDataService {
  getCategoryItems(
    rawData: Record<string, Record<string, DboAsset[]>>,
    category: string,
  ): DboAsset[] {
    const items: DboAsset[] = [];
    for (const fileData of Object.values(rawData)) {
      if (fileData[category]) items.push(...fileData[category]);
    }
    return items;
  }
}
