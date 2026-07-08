import { Component, inject, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DboAsset, MetadataObject } from '../../models/dbo.models';
import { AppStateService } from '../../services/app-state.service';
import { DboDataService } from '../../services/dbo-data.service';
import { copyToClipboard } from '../../utils/property.util';
import { ValueRendererComponent } from '../value-renderer/value-renderer.component';
import { ProcedureGraphComponent } from '../procedure-graph/procedure-graph.component';
import { ToolVisualizationComponent } from '../tool-visualization/tool-visualization.component';

@Component({
  selector: 'app-asset-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ValueRendererComponent,
    ProcedureGraphComponent,
    ToolVisualizationComponent,
  ],
  templateUrl: './asset-detail.component.html',
  styleUrl: './asset-detail.component.scss',
})
export class AssetDetailComponent {
  @Input({ required: true }) asset!: DboAsset;

  readonly state = inject(AppStateService);
  private readonly dboData = inject(DboDataService);

  readonly metaSearch = signal('');
  readonly expandedMeta = signal<Record<string, boolean>>({});
  readonly expandedMetaItems = signal<Record<string, boolean>>({});
  readonly expandedOptions = signal<Record<string, boolean>>({});

  readonly objectKeys = Object.keys;

  isPinned(): boolean {
    return this.state.isPinned(this.asset.AssetId);
  }

  togglePin(): void {
    this.state.togglePin(this.asset.AssetId);
  }

  deepLink(): string {
    return `${window.location.origin}${window.location.pathname}#${this.asset.AssetId}`;
  }

  async copy(text: string): Promise<void> {
    await copyToClipboard(text);
  }

  missingAddress(): boolean {
    if (!this.asset.Data?.hasOwnProperty('AssetAddress')) return false;
    const addr = this.asset.Data['AssetAddress'];
    return addr === null || addr === undefined || addr === '';
  }

  dataKeys(): string[] {
    if (!this.asset.Data) return [];
    return Object.keys(this.asset.Data).filter(
      (k) =>
        !(this.asset.AssetType === 'Procedure' && k === 'StateMap') &&
        k !== 'MetadataObjects'
    );
  }

  globalTransitions(): { ResultingStateId: string; ValidMessageTriggers?: string[] }[] {
    const stateMap = this.asset.Data?.['StateMap'] as {
      GlobalTransitions?: { ResultingStateId: string; ValidMessageTriggers?: string[] }[];
    };
    return stateMap?.GlobalTransitions ?? [];
  }

  metadataObjects(): MetadataObject[] {
    const list = this.asset.Data?.['MetadataObjects'];
    return Array.isArray(list) ? (list as MetadataObject[]) : [];
  }

  filteredMetadata(): MetadataObject[] {
    const q = this.metaSearch().toLowerCase();
    const list = this.metadataObjects();
    if (!q) return list;
    return list.filter((m) => (m.Key ?? '').toLowerCase().includes(q));
  }

  isTrigger(item: MetadataObject): boolean {
    return item.hasOwnProperty('InteractionSnippet') && !item.hasOwnProperty('Value');
  }

  toggleMetaAccordion(id: string): void {
    const current = { ...this.expandedMeta() };
    current[id] = !current[id];
    this.expandedMeta.set(current);
  }

  toggleMetaItem(id: string): void {
    const current = { ...this.expandedMetaItems() };
    current[id] = !current[id];
    this.expandedMetaItems.set(current);
  }

  toggleOptions(id: string): void {
    const current = { ...this.expandedOptions() };
    current[id] = !current[id];
    this.expandedOptions.set(current);
  }

  characterVariants(): { AssetId: string }[] {
    const variants = this.dboData.getCategoryItems(this.state.rawData(), 'VariantCharacters');
    return variants
      .filter((v) => {
        const base = v.Data?.['BaseCharacter'] as { AssetId?: string } | undefined;
        return base?.AssetId === this.asset.AssetId;
      })
      .map((v) => ({ AssetId: v.AssetId }));
  }

  interactionSenders(): { AssetId: string }[] {
    const tools = this.dboData.getCategoryItems(this.state.rawData(), 'Tools');
    return tools
      .filter((tool) => {
        const senders = tool.Data?.['InteractionSenders'] as { AssetId: string }[] | undefined;
        return senders?.some((s) => s.AssetId === this.asset.AssetId);
      })
      .map((t) => ({ AssetId: t.AssetId }));
  }

  interactionReceivers(): { AssetId: string }[] {
    const receivers: { AssetId: string }[] = [];
    const procedures = this.dboData.getCategoryItems(this.state.rawData(), 'Procedures');
    for (const proc of procedures) {
      let hasRef = false;
      const stateMap = proc.Data?.['StateMap'] as {
        States?: {
          ValidTransitions?: {
            RequiredInteractions?: { InteractionTypeId: string }[];
          }[];
        }[];
      };
      stateMap?.States?.forEach((state) => {
        state.ValidTransitions?.forEach((trans) => {
          if (trans.RequiredInteractions?.some((r) => r.InteractionTypeId === this.asset.AssetId)) {
            hasRef = true;
          }
        });
      });
      const equip = proc.Data?.['EquipmentInteractionReceivers'] as { AssetId: string }[] | undefined;
      if (equip?.some((r) => r.AssetId === this.asset.AssetId)) hasRef = true;
      if (hasRef) receivers.push({ AssetId: proc.AssetId });
    }
    const tools = this.dboData.getCategoryItems(this.state.rawData(), 'Tools');
    for (const tool of tools) {
      const rec = tool.Data?.['InteractionReceivers'] as { AssetId: string }[] | undefined;
      if (rec?.some((r) => r.AssetId === this.asset.AssetId)) {
        receivers.push({ AssetId: tool.AssetId });
      }
    }
    return receivers;
  }

  openWebGL(): void {
    this.state.openWebGLView(this.asset.AssetId);
  }

  isMediaKey(key: string): boolean {
    return (
      key === 'ImageAddress' ||
      key === 'AudioAddress' ||
      (key === 'Address' &&
        ['ImageFile', 'SoundEffect', 'BackgroundAudio'].includes(this.asset.AssetType))
    );
  }

  mediaUrl(key: string): string | null {
    const val = this.asset.Data?.[key];
    return typeof val === 'string' ? val : null;
  }

  isDocumentation(key: string, val: unknown): boolean {
    return key === 'Documentation' && Array.isArray(val) && val.length > 0;
  }

  docLinks(val: unknown): { label: string; url: string }[] {
    const arr = val as (string | [string, string])[];
    return arr.map((link) => {
      if (typeof link === 'string') return { label: link, url: link };
      return { label: link[0], url: link[1] };
    });
  }

  isPrimitive(val: unknown): boolean {
    return val === null || ['string', 'number', 'boolean'].includes(typeof val);
  }

  async copyPropertyValue(val: unknown): Promise<void> {
    await copyToClipboard(String(val ?? ''));
  }
}
