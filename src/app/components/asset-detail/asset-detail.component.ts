import { Component, inject, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DboAsset, MetadataObject } from '../../models/dbo.models';
import { resolveOrbitCaptureKey } from '../../models/custom-vessel.util';
import { AppStateService } from '../../services/app-state.service';
import { DboDataService } from '../../services/dbo-data.service';
import { copyToClipboard } from '../../utils/property.util';
import { humanizeKey } from '../../utils/key-label.util';
import {
  DataSource,
  dataSourceHint,
  dataSourceLabel,
  sourceForUnityAsset,
} from '../../models/data-source';
import { ValueRendererComponent } from '../value-renderer/value-renderer.component';
import { ProcedureGraphComponent } from '../procedure-graph/procedure-graph.component';
import { ToolVisualizationComponent } from '../tool-visualization/tool-visualization.component';
import { OrbitViewerService } from '../../orbit-capture/services/orbit-viewer.service';
import { OrbitModelControlsService } from '../../orbit-capture/services/orbit-model-controls.service';
import { OrbitInlineViewerComponent } from '../../orbit-capture/components/orbit-inline-viewer/orbit-inline-viewer.component';
import { WaveformChartComponent } from '../waveform-chart/waveform-chart.component';

interface EquipmentInteraction {
  Interaction?: { AssetId: string };
  Location?: string;
  AvailableIn?: string[];
  Assets?: { AssetId: string }[];
}

interface VesselContainerGroup {
  State?: string;
  Tools?: { AssetId: string }[];
}

/** One placed copy of a tool in an authored environment layout. */
interface PlacedToolInstance {
  ToolId?: string;
  ParentToolId?: string;
  PositionData?: {
    worldPosition?: { x: number; y: number; z: number };
    worldRotation?: { x: number; y: number; z: number };
  };
}

interface PlacedToolGroup {
  AssetId?: string;
  AssetKey: string;
  Kind?: 'tool' | 'custom-vessel';
  CustomVesselKey?: string;
  SharedLibrary?: boolean;
  Count: number;
  Instances: PlacedToolInstance[];
}

/** Export bookkeeping that is rarely useful — collapsed under Advanced, not the prop table. */
const ADVANCED_DATA_KEYS = new Set([
  'SourceFile',
  'RootToolEntryCount',
  'AuthoringToolVersion',
]);

/** Data keys rendered in dedicated custom-vessel sections (not the prop table). */
const CUSTOM_VESSEL_SECTION_KEYS = new Set([
  'BaseEmptyVessel',
  'ContainedTools',
  'Containers',
  'Customization',
]);

/** Data keys rendered by the inline video player (not the prop table). */
const VIDEO_SECTION_KEYS = new Set(['VideoUrl', 'PosterUrl']);

@Component({
  selector: 'app-asset-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ValueRendererComponent,
    ProcedureGraphComponent,
    ToolVisualizationComponent,
    OrbitInlineViewerComponent,
    WaveformChartComponent,
  ],
  templateUrl: './asset-detail.component.html',
  styleUrl: './asset-detail.component.scss',
  // Own the selection for this asset's inline viewer so an open orbit modal,
  // which resolves the root instance, cannot overwrite it.
  providers: [OrbitModelControlsService],
})
export class AssetDetailComponent {
  @Input({ required: true }) asset!: DboAsset;

  readonly state = inject(AppStateService);
  readonly orbitViewer = inject(OrbitViewerService);
  readonly modelControls = inject(OrbitModelControlsService);
  private readonly dboData = inject(DboDataService);

  readonly metaSearch = signal('');
  /** Whether the contained-tool list follows the open containers or lists everything. */
  readonly containedToolScope = signal<'open' | 'all'>('open');
  readonly expandedMeta = signal<Record<string, boolean>>({});
  readonly expandedMetaItems = signal<Record<string, boolean>>({});
  readonly expandedOptions = signal<Record<string, boolean>>({});
  readonly advancedOpen = signal(false);
  readonly expandedPlacedTools = signal<Record<string, boolean>>({});

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
    const isEquip = this.isEquipment();
    const isToolLike = this.isToolLike();
    const isWave = this.isWaveform();
    const isCustomVessel = this.isCustomVessel();
    const isVideo = this.isVideo();
    // The Vessels section covers grouped placements; hide the raw tool link list too.
    const hasPlacements = this.placedTools().length > 0;
    return Object.keys(this.asset.Data).filter(
      (k) =>
        !(this.asset.AssetType === 'Procedure' && k === 'StateMap') &&
        k !== 'MetadataObjects' &&
        k !== 'ToolHierarchy' &&
        // Chart section renders the point array; keep the table free of a huge list.
        !(isWave && k === 'DataPoints') &&
        // Equipment renders these in dedicated Compatible Characters / Compatible Tools sections.
        !(isEquip && (k === 'CompatibleCharacters' || k === 'Interactions')) &&
        // Tools render Compatible Equipment in a dedicated section.
        // Equipment is tool-like for orbit viewing but has no reverse-compat list.
        !(isToolLike && !isEquip && k === 'CompatibleEquipment') &&
        // Custom vessels render composition beside the inline model.
        !(isCustomVessel && CUSTOM_VESSEL_SECTION_KEYS.has(k)) &&
        !(isVideo && VIDEO_SECTION_KEYS.has(k)) &&
        !(hasPlacements && (k === 'PlacedTools' || k === 'Tools')) &&
        !ADVANCED_DATA_KEYS.has(k),
    );
  }

  advancedKeys(): string[] {
    if (!this.asset.Data) return [];
    return Object.keys(this.asset.Data).filter((k) => ADVANCED_DATA_KEYS.has(k));
  }

  toggleAdvanced(): void {
    this.advancedOpen.set(!this.advancedOpen());
  }

  keyLabel(key: string): string {
    return humanizeKey(key);
  }

  sourceId(): DataSource {
    return this.asset._Source ?? sourceForUnityAsset(this.asset);
  }

  sourceLabel(): string {
    return dataSourceLabel(this.sourceId());
  }

  sourceHint(): string {
    return dataSourceHint(this.sourceId());
  }

  isEquipment(): boolean {
    return this.asset.AssetType === 'Equipment';
  }

  isAuthoredEnvironment(): boolean {
    return (
      this.asset.AssetType === 'Authored Environment' ||
      this.asset._Category === 'Authored Environments'
    );
  }

  placedTools(): PlacedToolGroup[] {
    const list = this.asset.Data?.['PlacedTools'];
    return Array.isArray(list) ? (list as PlacedToolGroup[]) : [];
  }

  /** Custom vessels and empty-vessel prefabs — ordinary tools stay in the overhead map. */
  placedVessels(): PlacedToolGroup[] {
    return this.placedTools().filter((group) => this.isVesselGroup(group));
  }

  placedToolTotal(): number {
    return this.placedTools().reduce((sum, g) => sum + (g.Count ?? 0), 0);
  }

  isLocalVessel(group: PlacedToolGroup): boolean {
    return group.Kind === 'custom-vessel' && !group.SharedLibrary;
  }

  /** Placements can point at addressables with no tool row (unexported prefabs). */
  placedToolIsLinked(group: PlacedToolGroup): boolean {
    return !!group.AssetId && !!this.state.assetMap()[group.AssetId];
  }

  placedVesselName(group: PlacedToolGroup): string {
    if (this.isLocalVessel(group)) {
      const inst = this.soleInstance(group) ?? group.Instances?.[0];
      if (inst?.ToolId) return inst.ToolId;
    }
    const asset = group.AssetId ? this.state.assetMap()[group.AssetId] : null;
    return asset?.AssetName ?? group.AssetKey;
  }

  private isVesselGroup(group: PlacedToolGroup): boolean {
    if (group.Kind === 'custom-vessel') return true;
    const asset = group.AssetId ? this.state.assetMap()[group.AssetId] : null;
    if (!asset) return false;
    return (
      asset.AssetType === 'Empty Vessel' ||
      asset.AssetType === 'Custom Vessel' ||
      asset._Category === 'Vessels'
    );
  }

  /** A lone placement shows its runtime id inline instead of a quantity. */
  soleInstance(group: PlacedToolGroup): PlacedToolInstance | null {
    return group.Count === 1 ? group.Instances?.[0] ?? null : null;
  }

  isPlacedToolOpen(group: PlacedToolGroup): boolean {
    return !!this.expandedPlacedTools()[group.AssetKey];
  }

  togglePlacedTool(group: PlacedToolGroup): void {
    const current = { ...this.expandedPlacedTools() };
    current[group.AssetKey] = !current[group.AssetKey];
    this.expandedPlacedTools.set(current);
  }

  openAsset(assetId: string | undefined): void {
    if (!assetId || !this.state.assetMap()[assetId]) return;
    this.state.openAssetTab(assetId, false);
  }

  isWaveform(): boolean {
    return (
      this.asset._Category === 'Waveforms' ||
      this.asset.AssetType === 'Waveform' ||
      (typeof this.asset.AssetType === 'string' &&
        this.asset.AssetType.startsWith('Waveform'))
    );
  }

  waveformDataPoints(): number[] {
    const pts = this.asset.Data?.['DataPoints'];
    return Array.isArray(pts)
      ? pts.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
      : [];
  }

  isToolLike(): boolean {
    return [
      'Tool',
      'Kit',
      'Group',
      'Vessel',
      'Empty Vessel',
      'Custom Vessel',
      'Scene',
      'Equipment',
    ].includes(this.asset.AssetType);
  }

  /** Inverse of Compatible Tools: which equipment lists this tool as a provider. */
  showCompatibleEquipment(): boolean {
    return this.isToolLike() && !this.isEquipment();
  }

  isCustomVessel(): boolean {
    return (
      this.asset.AssetType === 'Custom Vessel' ||
      this.asset.Data?.['VesselType'] === 'custom'
    );
  }

  baseEmptyVessel(): { AssetId: string } | null {
    const ref = this.asset.Data?.['BaseEmptyVessel'];
    if (ref && typeof ref === 'object' && 'AssetId' in (ref as object)) {
      return ref as { AssetId: string };
    }
    return null;
  }

  vesselContainedTools(): { AssetId: string }[] {
    const list = this.asset.Data?.['ContainedTools'];
    return Array.isArray(list) ? (list as { AssetId: string }[]) : [];
  }

  vesselContainers(): VesselContainerGroup[] {
    const list = this.asset.Data?.['Containers'];
    return Array.isArray(list) ? (list as VesselContainerGroup[]) : [];
  }

  vesselCustomization(): unknown[] {
    const list = this.asset.Data?.['Customization'];
    return Array.isArray(list) ? list : [];
  }

  showInlineModelControls(): boolean {
    return this.showInlineModel() && this.modelControls.hasControls();
  }

  /** Contained tools sit beside the container controls; otherwise they need their own block. */
  showCustomVesselComposition(): boolean {
    if (!this.isCustomVessel()) return false;
    if (this.vesselCustomization().length) return true;
    return this.vesselContainedTools().length > 0 && !this.showInlineModelControls();
  }

  /** Scoping tools to open containers only means something when the model has container toggles. */
  toolScopeToggleAvailable(): boolean {
    return (
      this.showInlineModelControls() &&
      this.modelControls.containerOptions().length > 0 &&
      this.vesselContainers().length > 0
    );
  }

  toggleContainedToolScope(): void {
    this.containedToolScope.set(this.containedToolScope() === 'open' ? 'all' : 'open');
  }

  /**
   * Tools in the containers that are currently open, or every contained tool. Container states
   * come from the DB row and match the manifest container ids the viewer toggles.
   */
  visibleContainedTools(): { AssetId: string }[] {
    const all = this.vesselContainedTools();
    if (!this.toolScopeToggleAvailable() || this.containedToolScope() === 'all') return all;

    const seen = new Set<string>();
    const open: { AssetId: string }[] = [];
    for (const group of this.vesselContainers()) {
      if (!this.modelControls.isContainerOpen(group.State ?? '')) continue;
      for (const tool of group.Tools ?? []) {
        if (!tool?.AssetId || seen.has(tool.AssetId)) continue;
        seen.add(tool.AssetId);
        open.push(tool);
      }
    }
    return open;
  }

  compatibleCharacters(): { AssetId: string }[] {
    const chars = this.asset.Data?.['CompatibleCharacters'];
    return Array.isArray(chars) ? (chars as { AssetId: string }[]) : [];
  }

  compatibleEquipment(): { AssetId: string }[] {
    const list = this.asset.Data?.['CompatibleEquipment'];
    return Array.isArray(list) ? (list as { AssetId: string }[]) : [];
  }

  // Each received interaction carries the tools that provide it (assetIds -> Assets),
  // so the cross-reference of "Compatible Tools" is a list per interaction.
  equipmentInteractions(): EquipmentInteraction[] {
    const list = this.asset.Data?.['Interactions'];
    return Array.isArray(list) ? (list as EquipmentInteraction[]) : [];
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
    return this.toolCategoryItems()
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
    for (const tool of this.toolCategoryItems()) {
      const rec = tool.Data?.['InteractionReceivers'] as { AssetId: string }[] | undefined;
      if (rec?.some((r) => r.AssetId === this.asset.AssetId)) {
        receivers.push({ AssetId: tool.AssetId });
      }
    }
    return receivers;
  }

  /** DBO uses `Tools`; Unity mode lumps tools/kits/groups under `Tooling`. */
  private toolCategoryItems(): DboAsset[] {
    const raw = this.state.rawData();
    return [
      ...this.dboData.getCategoryItems(raw, 'Tools'),
      ...this.dboData.getCategoryItems(raw, 'Tooling'),
    ];
  }

  openWebGL(): void {
    this.state.openWebGLView(this.asset.AssetId);
  }

  isVideo(): boolean {
    return this.asset._Category === 'Videos';
  }

  videoUrl(): string | null {
    const val = this.asset.Data?.['VideoUrl'];
    return typeof val === 'string' && val ? val : null;
  }

  videoPosterUrl(): string | null {
    const val = this.asset.Data?.['PosterUrl'];
    return typeof val === 'string' && val ? val : null;
  }

  videoLoops(): boolean {
    return this.asset.Data?.['Loop'] === true;
  }

  showInlineVideo(): boolean {
    return this.isVideo() && (!!this.videoUrl() || !!this.videoPosterUrl());
  }

  playInlineVideo(event: Event): void {
    const el = event.target as HTMLVideoElement | null;
    if (!el) return;
    void el.play();
  }

  /** Capture folder key — flat OrbitCaptureKey for custom vessels, else addressable. */
  orbitAddressable(): string | null {
    return resolveOrbitCaptureKey(this.asset.Data);
  }

  canViewOrbit(): boolean {
    return this.isToolLike() && !!this.orbitAddressable();
  }

  /** Inline (Wikipedia-style) GLB embed shown for Unity tool assets. */
  showInlineModel(): boolean {
    return this.state.dataMode() === 'unity' && this.canViewOrbit();
  }

  async openOrbit(): Promise<void> {
    await this.orbitViewer.openByAddressable(this.orbitAddressable());
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
