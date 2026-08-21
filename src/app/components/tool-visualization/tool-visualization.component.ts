import {
  Component,
  Input,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  AfterViewInit,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Network, DataSet } from 'vis-network/standalone';
import { DboAsset, ToolNode } from '../../models/dbo.models';
import { AppStateService } from '../../services/app-state.service';
import { authoredEnvironmentBirdsEyeKey } from '../../models/authored-environment.util';
import { OrbitViewerService } from '../../orbit-capture/services/orbit-viewer.service';
import {
  BirdsEyeCapture,
  OrbitHttpCaptureService,
} from '../../orbit-capture/services/orbit-http-capture.service';
import {
  BirdsEyeProjection,
  isInsideCapture,
  worldToGraphPoint,
} from '../../orbit-capture/models/birdseye-projection';
import {
  colorWithAlpha,
  filterNodeAlpha,
  OVERLAY_NODE_ALPHA,
  preferMatchingToolId,
  toolIdMatchesFilter,
} from './tool-filter.util';
import { centeredCanvasTextOrigin, clusterCountFontSize } from './canvas-text.util';
import { isToolEligibleForDatabaseEntry, toolCatalogAssetId } from '../../models/tool-entry.util';

const BIRDS_EYE_ALPHA_KEY = 'assetViewer.birdsEyeAlpha';

interface VisibleToolNode {
  tool: ToolNode;
  level: number;
}

/** vis-network dot radius for individual tool circles. */
const TOOL_NODE_SIZE = 7;
/** On-screen radius for a single tool on a bird's-eye photo. */
const OVERLAY_TOOL_NODE_SIZE = 12;
/** Default tool node colors. */
const TOOL_COLOR = { background: '#007CC0', border: '#00669E' };
const TOOL_CHILD_COLOR = { background: '#405E92', border: '#22406E' };
const TOOL_HOVER_COLOR = { background: '#4DABE3', border: '#B2BFD9' };
const TOOL_SELECTED_COLOR = { background: '#091D3C', border: '#4DABE3' };
const CLUSTER_COLOR = { background: '#007CC0', border: '#00669E' };
/** High-contrast overlay colors: bright fill + white ring reads on light floors and dark props. */
const OVERLAY_TOOL_COLOR = { background: '#3EC6FF', border: '#FFFFFF' };
const OVERLAY_TOOL_CHILD_COLOR = { background: '#7EB3FF', border: '#FFFFFF' };
const OVERLAY_HOVER_COLOR = { background: '#FFE27A', border: '#FFFFFF' };
const OVERLAY_SELECTED_COLOR = { background: '#FFC107', border: '#FFFFFF' };
const OVERLAY_CLUSTER_COLOR = { background: '#3EC6FF', border: '#FFFFFF' };
const OVERLAY_SHADOW = {
  enabled: true,
  color: 'rgba(0, 0, 0, 0.55)',
  size: 8,
  x: 0,
  y: 0,
};
/** Minimum vis-network circle radius for a cluster badge. */
const CLUSTER_SIZE_MIN = 22;
/** Maximum vis-network circle radius for a cluster badge. */
const CLUSTER_SIZE_MAX = 40;
/** Default vis-network circle radius for a cluster badge. */
const CLUSTER_NODE_SIZE = 28;
const CLUSTER_BASE_STYLE: NodeBaseStyle = {
  background: CLUSTER_COLOR.background,
  border: CLUSTER_COLOR.border,
  size: CLUSTER_NODE_SIZE,
};

interface NodeBaseStyle {
  background: string;
  border: string;
  size: number;
}

@Component({
  selector: 'app-tool-visualization',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div #rootContainer class="tool-visualization-root" [class.fullscreen]="isFullscreen()">
      <div class="tool-visualization-container">
      <div class="tool-visualization-left">
        <input
          type="text"
          class="tool-search-input"
          placeholder="Search Tools..."
          [(ngModel)]="searchText"
          (ngModelChange)="onSearchChange()"
        />
        <ul class="tool-hierarchy-list">
          @for (node of visibleNodes(); track node.tool.ToolId) {
            <li>
              <div
                class="tool-node-item"
                [class.active]="selectedToolId() === node.tool.ToolId"
                [class.list-hovered]="listHoveredToolId() === node.tool.ToolId"
                [style.padding-left.px]="node.level * 16 + 8"
                (click)="onListItemClick($event, node.tool)"
                (dblclick)="onListItemDoubleClick($event, node.tool)"
                (mouseenter)="onListItemHover(node.tool)"
                (mouseleave)="onListItemLeave()"
              >
                @if (node.tool.Children?.length) {
                  <button
                    type="button"
                    class="tool-node-item-toggle"
                    [class.expanded]="isExpanded(node.tool.ToolId)"
                    [attr.aria-expanded]="isExpanded(node.tool.ToolId)"
                    [attr.aria-label]="isExpanded(node.tool.ToolId) ? 'Collapse' : 'Expand'"
                    (click)="toggleNode($event, node.tool.ToolId)"
                  ></button>
                } @else {
                  <span class="toggle-spacer"></span>
                }
                <span class="tool-node-label">{{ node.tool.ToolId }}</span>
                @if (node.tool.PlacementKind === 'custom-vessel') {
                  <span
                    class="tool-vessel-badge"
                    [class.shared]="node.tool.SharedLibrary"
                    [class.inline]="!node.tool.SharedLibrary"
                  >
                    {{ node.tool.SharedLibrary ? 'Shared vessel' : 'Local vessel' }}
                  </span>
                }
                @if (node.tool.Children?.length) {
                  <span class="tool-child-count">({{ node.tool.Children!.length }})</span>
                }
              </div>
            </li>
          }
        </ul>
      </div>
      <div class="tool-visualization-right">
        @if (drillRootId()) {
          <button class="tool-back-button" (click)="backToRoot()">
            <i class="pi pi-arrow-left" aria-hidden="true"></i> Back to Root Tools
          </button>
        }
        <div class="tool-graph-wrapper">
          <div class="tool-visualization-toolbar">
            @if (birdsEye()) {
              <label class="birds-eye-alpha">
                <i class="pi pi-eye" aria-hidden="true"></i>
                <span>Bird's-Eye</span>
                <input
                  type="range"
                  class="birds-eye-slider"
                  min="0"
                  max="1"
                  step="0.01"
                  [ngModel]="birdsEyeAlpha()"
                  (ngModelChange)="onBirdsEyeAlphaChange($event)"
                  title="Bird's-eye opacity"
                  aria-label="Bird's-eye opacity"
                />
                <span class="birds-eye-alpha-value">{{ birdsEyeAlphaDisplay() }}</span>
              </label>
            }
            <button
              type="button"
              class="tool-toolbar-button"
              title="Center and fit"
              aria-label="Center and fit"
              (click)="centerAndFit()"
            >
              <i class="pi pi-search-minus" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              class="tool-toolbar-button"
              [title]="isFullscreen() ? 'Exit fullscreen' : 'Fullscreen'"
              [attr.aria-label]="isFullscreen() ? 'Exit fullscreen' : 'Fullscreen'"
              (click)="toggleFullscreen()"
            >
              <i class="pi" [class.pi-times]="isFullscreen()" [class.pi-expand]="!isFullscreen()" aria-hidden="true"></i>
            </button>
          </div>
          @if (hoverPanelParentId() || hoveredToolIds().length) {
            <div class="tool-hover-panel" [class.interactive]="panelPinned()">
              @if (hoverPanelParentId()) {
                <p class="tool-hover-child-of">Child of {{ hoverPanelParentId() }}</p>
              }
              @if (hoveredToolIds().length === 1) {
                <p class="tool-hover-id">{{ hoveredToolIds()[0] }}</p>
                @if (hoveredToolDetail(); as detail) {
                  @if (detail.Position) {
                    <p class="tool-hover-pose">
                      Position: {{ formatVector(detail.Position) }}
                    </p>
                  }
                  @if (detail.Rotation) {
                    <p class="tool-hover-pose">
                      Rotation: {{ formatVector(detail.Rotation) }}
                    </p>
                  }
                }
                @if (inspectorCatalogAssetId(); as catalogId) {
                  <button
                    type="button"
                    class="tool-hover-action"
                    (click)="openToolDatabaseEntry(catalogId); $event.stopPropagation()"
                  >
                    Open in database
                  </button>
                }
              } @else if (hoveredToolIds().length > 1) {
                <ul class="tool-hover-list">
                  @for (toolId of hoveredToolIds(); track toolId) {
                    <li>
                      <button
                        type="button"
                        class="tool-hover-pick"
                        [class.active]="selectedToolId() === toolId"
                        (click)="selectToolFromPanel(toolId); $event.stopPropagation()"
                      >
                        {{ toolId }}
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>
          }
          <div #graphContainer class="tool-graph"></div>
        </div>
      </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .tool-visualization-root {
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      .tool-visualization-root.fullscreen {
        position: fixed;
        inset: 0;
        z-index: 1000;
        background: var(--bg-app);
        padding: var(--space-3);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
      }
      .tool-visualization-toolbar {
        position: absolute;
        bottom: var(--space-2);
        left: var(--space-2);
        z-index: 3;
        display: flex;
        justify-content: flex-start;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        padding: 4px;
        background: color-mix(in srgb, var(--bg-main) 88%, transparent);
        border-radius: var(--radius-default);
      }
      .tool-toolbar-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0;
        width: 28px;
        height: 28px;
        padding: 0;
        background: transparent;
        color: var(--accent);
        border: 1px solid var(--accent);
        border-radius: var(--radius-default);
        cursor: pointer;
        font-family: var(--font-graphic);
        font-size: var(--text-caption);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        transition: background 0.2s;
      }
      .tool-toolbar-button:hover {
        background: var(--bg-hover);
      }
      .birds-eye-alpha {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 4px 10px;
        border: 1px solid var(--accent);
        border-radius: var(--radius-default);
        color: var(--accent);
        font-family: var(--font-graphic);
        font-size: var(--text-caption);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .birds-eye-slider {
        width: 88px;
        height: 18px;
        margin: 0;
        padding: 0;
        accent-color: var(--accent);
        cursor: pointer;
      }
      .birds-eye-alpha-value {
        min-width: 2.4em;
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
      }
      .tool-hover-action {
        pointer-events: auto;
        display: inline-flex;
        align-items: center;
        margin-top: var(--space-2);
        padding: 4px 8px;
        border: 1px solid var(--accent);
        border-radius: var(--radius-default);
        background: transparent;
        color: var(--accent);
        cursor: pointer;
        font-family: var(--font-graphic);
        font-size: var(--text-caption);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .tool-hover-action:hover {
        background: var(--bg-hover);
      }
      .tool-visualization-root.fullscreen .tool-visualization-container {
        flex: 1;
        height: auto;
        min-height: 0;
      }
      .tool-visualization-root.fullscreen .tool-visualization-left {
        display: flex;
        flex-direction: column;
        max-height: none;
      }
      .tool-visualization-root.fullscreen .tool-hierarchy-list {
        max-height: none;
        flex: 1;
      }
      .tool-visualization-root.fullscreen .tool-visualization-right {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .tool-visualization-root.fullscreen .tool-graph-wrapper {
        flex: 1;
        min-height: 0;
      }
      .tool-visualization-root.fullscreen .tool-graph {
        height: 100%;
      }
      .tool-visualization-container {
        display: flex;
        align-items: stretch;
        gap: var(--space-3);
        height: 400px;
      }
      .tool-visualization-left {
        width: 40%;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        min-height: 0;
      }
      .tool-visualization-right {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
      }
      .tool-search-input {
        width: 100%;
        box-sizing: border-box;
        padding: 6px 8px;
        border: 1px solid var(--control-border);
        border-radius: var(--radius-default);
        background: var(--control-bg);
        color: var(--control-value);
        font-family: var(--font-body);
        font-size: 0.9375em;
      }
      .tool-search-input:focus {
        outline: none;
        border-color: var(--control-active-border);
        box-shadow: var(--control-focus-ring);
      }
      .tool-hierarchy-list {
        list-style: none;
        margin: 0;
        padding: 0;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        background: var(--bg-main);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
      }
      .tool-vessel-badge {
        margin-left: 6px;
        padding: 1px 5px;
        border: 1px solid var(--border);
        border-radius: var(--radius-default);
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .tool-vessel-badge.shared {
        color: var(--accent);
        border-color: var(--accent);
      }
      .tool-vessel-badge.inline {
        color: var(--accent-warm);
        border-color: var(--accent-warm);
      }
      .tool-hover-pose {
        margin: 2px 0 0;
        color: var(--text-muted);
        font-family: var(--font-mono);
        font-size: var(--text-caption);
      }
      .tool-node-item {
        padding: var(--space-2) var(--space-3);
        cursor: pointer;
        font-size: var(--text-caption);
        display: flex;
        align-items: center;
        gap: var(--space-1);
        border-bottom: 1px solid var(--border-light);
        border-left: 3px solid transparent;
        transition: background 0.15s, border-color 0.15s;
      }
      .tool-node-item:hover,
      .tool-node-item.list-hovered {
        background: var(--bg-hover);
      }
      .tool-node-item.active {
        background: var(--bg-selected);
        color: var(--text-on-dark);
        border-left-color: var(--active-bar);
      }
      .tool-node-label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tool-child-count {
        color: var(--text-muted);
        flex-shrink: 0;
      }
      .tool-node-item.active .tool-child-count {
        color: rgba(255, 255, 255, 0.75);
      }
      .tool-node-item-toggle {
        width: 12px;
        height: 12px;
        flex-shrink: 0;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-top: 6px solid var(--text-muted);
        transform: rotate(-90deg);
        transition: transform 0.2s;
      }
      .tool-node-item.active .tool-node-item-toggle {
        border-top-color: rgba(255, 255, 255, 0.7);
      }
      .tool-node-item-toggle.expanded {
        transform: rotate(0deg);
      }
      .toggle-spacer {
        display: inline-block;
        width: 12px;
        flex-shrink: 0;
      }
      .tool-back-button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-bottom: var(--space-2);
        padding: 8px 12px;
        background: var(--accent);
        color: var(--text-on-dark);
        border: none;
        border-radius: var(--radius-default);
        cursor: pointer;
        font-family: var(--font-graphic);
        font-size: var(--text-caption);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        transition: background 0.2s;
      }
      .tool-back-button:hover {
        background: var(--accent-hover);
      }
      .tool-graph-wrapper {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      .tool-hover-panel {
        position: absolute;
        top: var(--space-3);
        right: var(--space-3);
        z-index: 2;
        width: min(240px, calc(100% - 24px));
        max-height: calc(100% - 48px);
        padding: var(--space-3);
        box-sizing: border-box;
        background: var(--bg-main);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-dropdown);
        overflow-y: auto;
        pointer-events: none;
      }
      .tool-hover-panel.interactive {
        pointer-events: auto;
      }
      .tool-hover-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .tool-hover-child-of {
        margin: 0 0 var(--space-2);
        font-family: var(--font-graphic);
        font-size: var(--text-caption);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-label);
        overflow-wrap: anywhere;
        line-height: 1.35;
      }
      .tool-hover-list li {
        font-family: var(--font-body);
        font-size: var(--text-caption);
        color: var(--text-main);
        overflow-wrap: anywhere;
        line-height: 1.4;
        padding: 0;
        border-bottom: 1px solid var(--border-light);
      }
      .tool-hover-list li:last-child {
        border-bottom: none;
      }
      .tool-hover-pick {
        pointer-events: auto;
        display: block;
        width: 100%;
        margin: 0;
        padding: var(--space-1) 0;
        border: 0;
        background: transparent;
        color: var(--accent);
        cursor: pointer;
        text-align: left;
        font: inherit;
        overflow-wrap: anywhere;
        line-height: 1.4;
      }
      .tool-hover-pick:hover,
      .tool-hover-pick.active {
        color: var(--text-main);
      }
      .tool-hover-id {
        margin: 0;
        font-family: var(--font-body);
        font-size: var(--text-copy);
        font-weight: 600;
        color: var(--text-main);
        overflow-wrap: anywhere;
        line-height: 1.4;
      }
      .tool-graph {
        flex: 1;
        width: 100%;
        min-height: 0;
        background: var(--bg-graph);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
      }
    `,
  ],
})
export class ToolVisualizationComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) asset!: DboAsset;
  @ViewChild('graphContainer') graphContainer!: ElementRef<HTMLDivElement>;

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly state = inject(AppStateService);
  private readonly orbitHttp = inject(OrbitHttpCaptureService);
  private readonly orbitViewer = inject(OrbitViewerService);
  private network: Network | null = null;
  private nodesDataSet: DataSet<any> | null = null;
  private zoomDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private fitDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private listHoverTimer: ReturnType<typeof setTimeout> | null = null;
  private zoomSizeRaf: number | null = null;
  private zoomSizeSyncUntil = 0;
  private resizeObserver: ResizeObserver | null = null;
  private currentLevelNodeIds: string[] = [];
  private spatialClusterIds: string[] = [];
  private clusterCountById = new Map<string, number>();
  private basePositions = new Map<string, { x: number; y: number }>();
  private nodeBaseStyles = new Map<string, NodeBaseStyle>();
  private parentByToolId = new Map<string, string | null>();
  private rootToolIds = new Set<string>();
  private graphHoveredNodeId: string | null = null;
  private graphReady = false;
  private isClusteredView = false;
  private lastSyncedSelectedId: string | null = null;
  private lastSyncedHoveredId: string | null = null;
  private lastDomPointer: { x: number; y: number } | null = null;
  private pointerTarget: HTMLElement | null = null;
  private shouldFitOnResize = false;
  private birdsEyeImage: HTMLImageElement | null = null;
  /** Guards against a slower earlier request overwriting the current asset's capture. */
  private birdsEyeRequestKey: string | null = null;

  /** Zoom target when expanding a cluster on click. */
  private readonly clusterExpandScale = 1.2;
  /** Graph-space tolerance for tools sharing the same authored position. */
  private readonly samePositionEpsilon = 0.5;
  /** Tools must be this close on screen to share a numbered cluster. */
  private readonly clusterJoinScreenPx = 14;
  /** How aggressively node screen-size shrinks after 1× zoom. */
  private readonly zoomSizeFalloff = 0.6;
  /** Smallest on-screen radius while zoomed in. */
  private readonly minScreenNodeSize = 8;
  /** Extra screen pixels added to vis-network size so the hit target covers the ring. */
  private readonly nodeHitSlopPx = 8;
  /** Hover/click still works inside this radius when the drawn dot is smaller. */
  private readonly minHoverScreenPx = 16;
  /** Target max layout span in model units after normalization. */
  private readonly maxLayoutSpan = 520;
  private pendingFocusToolId: string | null = null;

  searchText = '';
  readonly selectedToolId = signal<string | null>(null);
  readonly drillRootId = signal<string | null>(null);
  readonly collapsedIds = signal(new Set<string>());
  readonly visibleNodes = signal<VisibleToolNode[]>([]);
  readonly hoveredToolIds = signal<string[]>([]);
  readonly hoverPanelParentId = signal<string | null>(null);
  /** Click-pinned hover panel; stays until a blank click or another node. */
  readonly panelPinned = signal(false);
  readonly listHoveredToolId = signal<string | null>(null);
  readonly isFullscreen = signal(false);
  /** Published bird's-eye capture for an authored environment, when one exists. */
  readonly birdsEye = signal<BirdsEyeCapture | null>(null);
  readonly birdsEyeAlpha = signal(this.loadBirdsEyeAlpha());
  /** Tools placed outside the captured footprint (possible with tools+margin framing). */
  readonly outsideCaptureCount = signal(0);

  hoveredToolDetail(): ToolNode | null {
    const ids = this.hoveredToolIds();
    if (ids.length !== 1) return null;
    return this.findTool(ids[0], this.asset.ToolHierarchyData?.Roots ?? []);
  }

  formatVector(vector: { x: number; y: number; z: number }): string {
    return `(${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}, ${vector.z.toFixed(2)})`;
  }

  private readonly onFullscreenChange = (): void => {
    this.isFullscreen.set(document.fullscreenElement === this.host.nativeElement);
    this.shouldFitOnResize = true;
    this.scheduleFitToView();
  };

  private readonly onGraphMouseMove = (event: PointerEvent | MouseEvent): void => {
    const target = (event.currentTarget as HTMLElement | null) ?? this.pointerTarget;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    this.lastDomPointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    this.applyPointerHover();
  };

  private readonly onGraphMouseLeave = (): void => {
    this.lastDomPointer = null;
    this.clearGraphHover();
  };

  private bindPointerTracking(): void {
    this.unbindPointerTracking();
    const canvas = this.graphContainer?.nativeElement.querySelector('canvas');
    this.pointerTarget = canvas ?? this.graphContainer?.nativeElement ?? null;
    if (!this.pointerTarget) return;
    this.pointerTarget.addEventListener('pointermove', this.onGraphMouseMove);
    this.pointerTarget.addEventListener('pointerleave', this.onGraphMouseLeave);
  }

  private unbindPointerTracking(): void {
    this.pointerTarget?.removeEventListener('pointermove', this.onGraphMouseMove);
    this.pointerTarget?.removeEventListener('pointerleave', this.onGraphMouseLeave);
    this.pointerTarget = null;
  }

  ngAfterViewInit(): void {
    this.buildHierarchyIndexes();
    this.initializeCollapsedState();
    this.rebuildList();
    void this.loadBirdsEye();
    setTimeout(() => this.renderGraph(), 0);

    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    if (this.graphContainer && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.onGraphResize());
      this.resizeObserver.observe(this.graphContainer.nativeElement);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['asset'] && !changes['asset'].firstChange) {
      this.buildHierarchyIndexes();
      this.drillRootId.set(null);
      this.selectedToolId.set(null);
      this.pendingFocusToolId = null;
      this.rebuildList();
      void this.loadBirdsEye();
      if (this.graphContainer) {
        setTimeout(() => this.renderGraph(), 0);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.zoomDebounceTimer) clearTimeout(this.zoomDebounceTimer);
    if (this.fitDebounceTimer) clearTimeout(this.fitDebounceTimer);
    if (this.listHoverTimer) clearTimeout(this.listHoverTimer);
    this.stopZoomSizeSync();
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    this.unbindPointerTracking();
    this.resizeObserver?.disconnect();
    if (document.fullscreenElement === this.host.nativeElement) {
      document.exitFullscreen().catch(() => undefined);
    }
    this.network?.destroy();
  }

  centerAndFit(): void {
    this.fitGraphToView();
  }

  toggleFullscreen(): void {
    const root = this.host.nativeElement;
    if (document.fullscreenElement === root) {
      document.exitFullscreen().catch(() => this.isFullscreen.set(false));
      return;
    }

    if (root.requestFullscreen) {
      root.requestFullscreen().catch(() => this.isFullscreen.set(true));
    } else {
      this.isFullscreen.set(true);
      this.shouldFitOnResize = true;
      this.scheduleFitToView();
    }
  }

  onBirdsEyeAlphaChange(value: number | string): void {
    const next = Math.min(1, Math.max(0, Number(value)));
    const alpha = Number.isFinite(next) ? next : 0;
    this.birdsEyeAlpha.set(alpha);
    this.persistBirdsEyeAlpha(alpha);
    this.refreshOverlayNodeStyles();
    this.network?.redraw();
  }

  birdsEyeAlphaDisplay(): string {
    return this.birdsEyeAlpha().toFixed(2);
  }

  /** True while the capture is visible behind the graph. */
  private usesOverlayStyle(): boolean {
    return !!this.projection() && this.birdsEyeAlpha() > 0;
  }

  private loadBirdsEyeAlpha(): number {
    try {
      const raw = localStorage.getItem(BIRDS_EYE_ALPHA_KEY);
      if (raw == null) return 1;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return 1;
      return Math.min(1, Math.max(0, parsed));
    } catch {
      return 1;
    }
  }

  private persistBirdsEyeAlpha(alpha: number): void {
    try {
      localStorage.setItem(BIRDS_EYE_ALPHA_KEY, String(alpha));
    } catch {
      // Ignore quota / private-mode failures.
    }
  }

  inspectorCatalogAssetId(): string | null {
    const tool = this.hoveredToolDetail();
    if (!isToolEligibleForDatabaseEntry(tool, this.state.assetMap())) return null;
    return toolCatalogAssetId(tool);
  }

  openToolDatabaseEntry(assetId: string): void {
    this.state.openAssetTab(assetId, false);
  }

  private viewScale(): number {
    return Math.max(this.network?.getScale() ?? 1, 0.01);
  }

  /**
   * Desired on-screen radius at the current zoom. Past 1×, size falls so tightly packed tools
   * can separate instead of growing with the photo.
   */
  private targetScreenSize(baseSize: number): number {
    const zoomIn = Math.max(this.viewScale(), 1);
    return Math.max(this.minScreenNodeSize, baseSize / Math.pow(zoomIn, this.zoomSizeFalloff));
  }

  /** vis-network size is in graph units and scales with zoom; convert a screen radius. */
  private toGraphSize(screenSize: number): number {
    return screenSize / this.viewScale();
  }

  private graphSizeForBase(baseSize: number, bump = 0): number {
    return this.toGraphSize(this.targetScreenSize(baseSize + bump) + this.nodeHitSlopPx);
  }

  /** Keep vis node radii matching the current zoom so clusters can break apart. */
  private applyZoomScaledSizes(): void {
    if (!this.nodesDataSet) return;
    const updates = this.currentLevelNodeIds.map((id) => {
      const base = this.nodeBaseStyles.get(id);
      return { id, size: this.graphSizeForBase(base?.size ?? TOOL_NODE_SIZE) };
    });
    if (updates.length) this.nodesDataSet.update(updates);
  }

  /**
   * `network.focus` / `moveTo` / `fit` animate scale without firing `zoom`. Wheel already updates
   * sizes via that event; programmatic cameras need an explicit sync for the same duration.
   */
  private syncSizesDuringCameraMove(durationMs: number): void {
    this.zoomSizeSyncUntil = Math.max(this.zoomSizeSyncUntil, performance.now() + durationMs + 40);
    if (this.zoomSizeRaf != null) return;

    const tick = (): void => {
      this.applyZoomScaledSizes();
      if (performance.now() < this.zoomSizeSyncUntil && this.network) {
        this.zoomSizeRaf = requestAnimationFrame(tick);
        return;
      }
      this.zoomSizeRaf = null;
      this.updateSpatialClusters();
      this.applyPointerHover();
    };
    this.zoomSizeRaf = requestAnimationFrame(tick);
  }

  private stopZoomSizeSync(): void {
    this.zoomSizeSyncUntil = 0;
    if (this.zoomSizeRaf != null) {
      cancelAnimationFrame(this.zoomSizeRaf);
      this.zoomSizeRaf = null;
    }
  }

  private pinHoverFromNode(nodeId: string): void {
    this.panelPinned.set(true);
    this.updateHoveredTools(nodeId);
  }

  private unpinHoverPanel(): void {
    this.panelPinned.set(false);
    this.hoveredToolIds.set([]);
    this.hoverPanelParentId.set(null);
  }

  /** Re-apply fill, ring, and glow after showing or hiding the bird's-eye. */
  private refreshOverlayNodeStyles(): void {
    if (!this.nodesDataSet) return;
    this.resetHighlightCache();
    for (const id of this.currentLevelNodeIds) {
      const tool = this.findTool(id, this.asset.ToolHierarchyData?.Roots ?? []);
      if (!tool) continue;
      const isParentHub = this.drillRootId() === id;
      const isDrillChild = !!this.drillRootId() && !isParentHub;
      this.nodesDataSet.update(
        this.createToolNodeOptions(
          tool,
          isDrillChild,
          this.basePositions.get(id)?.x,
          this.basePositions.get(id)?.y,
          isParentHub,
        ),
      );
    }
    this.syncNodeHighlights();
  }

  /** World-space projection of the capture, present only while one is loaded. */
  private projection(): BirdsEyeProjection | null {
    return this.birdsEye()?.projection ?? null;
  }

  private isAuthoredEnvironment(): boolean {
    return (
      this.asset.AssetType === 'Authored Environment' ||
      this.asset._Category === 'Authored Environments'
    );
  }

  /** Flat capture folder published by the Unity bird's-eye export. */
  private birdsEyeCaptureKey(): string {
    if (!this.isAuthoredEnvironment()) return '';
    const authoringId = this.asset.Data?.['AuthoringId'];
    return typeof authoringId === 'string' ? authoredEnvironmentBirdsEyeKey(authoringId) : '';
  }

  /**
   * Fetch the environment's bird's-eye PNG + projection. Absent captures leave the inspector on its
   * normalized layout, so unpublished environments still work.
   */
  private async loadBirdsEye(): Promise<void> {
    const key = this.birdsEyeCaptureKey();
    this.birdsEyeRequestKey = key;
    this.birdsEyeImage = null;
    this.birdsEye.set(null);
    this.outsideCaptureCount.set(0);
    if (!key) return;

    const capture =
      (await this.orbitViewer.loadBirdsEye(key)) ??
      (await this.orbitHttp.loadBirdsEye(key));
    if (!capture || this.birdsEyeRequestKey !== key) return;

    const image = await this.loadImage(capture.imageUrl);
    if (!image || this.birdsEyeRequestKey !== key) return;

    this.birdsEyeImage = image;
    this.birdsEye.set(capture);
    if (this.graphContainer) this.renderGraph();
  }

  private loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
  }

  /** Draws the capture in graph coordinates so nodes stay aligned through zoom and pan. */
  private drawBirdsEye(ctx: CanvasRenderingContext2D): void {
    const projection = this.projection();
    const alpha = this.birdsEyeAlpha();
    if (!projection || !this.birdsEyeImage || alpha <= 0) return;
    const { imageWidth, imageHeight } = projection;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      this.birdsEyeImage,
      -imageWidth / 2,
      -imageHeight / 2,
      imageWidth,
      imageHeight,
    );
    ctx.restore();
  }

  private onGraphResize(): void {
    if (this.shouldFitOnResize) {
      this.scheduleFitToView();
      this.shouldFitOnResize = false;
      return;
    }
    this.network?.redraw();
  }

  private buildHierarchyIndexes(): void {
    this.parentByToolId.clear();
    this.rootToolIds.clear();
    const roots = this.asset.ToolHierarchyData?.Roots ?? [];
    for (const root of roots) {
      this.rootToolIds.add(root.ToolId);
    }

    const walk = (tools: ToolNode[], parentId: string | null): void => {
      for (const tool of tools) {
        this.parentByToolId.set(tool.ToolId, parentId);
        if (tool.Children?.length) {
          walk(tool.Children, tool.ToolId);
        }
      }
    };
    walk(roots, null);
  }

  onSearchChange(): void {
    if (this.searchText.trim()) {
      this.expandAllForSearch();
    }
    this.rebuildList();
    this.applyFilterNodeStyles();
  }

  isExpanded(toolId: string): boolean {
    return !this.collapsedIds().has(toolId);
  }

  onListItemClick(event: Event, tool: ToolNode): void {
    if ((event.target as HTMLElement).closest('.tool-node-item-toggle')) return;
    this.highlightTool(tool.ToolId);
  }

  onListItemDoubleClick(event: Event, tool: ToolNode): void {
    event.preventDefault();
    if ((event.target as HTMLElement).closest('.tool-node-item-toggle')) return;

    if (tool.Children?.length) {
      this.drillInto(tool.ToolId);
      return;
    }

    const parentId = tool._ParentToolId ?? this.parentByToolId.get(tool.ToolId) ?? null;
    if (parentId) {
      this.selectedToolId.set(tool.ToolId);
      this.drillInto(parentId);
    }
  }

  onListItemHover(tool: ToolNode): void {
    this.listHoveredToolId.set(tool.ToolId);
    if (!this.panelPinned()) this.updateHoverPanelForTool(tool.ToolId);
    if (this.listHoverTimer) clearTimeout(this.listHoverTimer);
    this.listHoverTimer = setTimeout(() => this.syncNodeHighlights(), 32);
  }

  onListItemLeave(): void {
    if (this.listHoverTimer) clearTimeout(this.listHoverTimer);
    this.listHoveredToolId.set(null);
    if (!this.panelPinned()) {
      this.hoverPanelParentId.set(null);
      this.hoveredToolIds.set([]);
    }
    this.syncNodeHighlights();
  }

  toggleNode(event: Event, toolId: string): void {
    event.stopPropagation();
    const set = new Set(this.collapsedIds());
    if (set.has(toolId)) set.delete(toolId);
    else set.add(toolId);
    this.collapsedIds.set(set);
    this.rebuildList();
  }

  highlightTool(toolId: string): void {
    this.selectedToolId.set(toolId);
    this.pinHoverFromNode(toolId);
    if (!this.network || !this.graphReady) {
      this.pendingFocusToolId = toolId;
      return;
    }
    this.focusToolOnMap(toolId);
  }

  /** Pin the hover panel to one tool from a multi-node / cluster list. */
  selectToolFromPanel(toolId: string): void {
    this.selectedToolId.set(toolId);
    this.panelPinned.set(true);
    this.updateHoverPanelForTool(toolId);
    if (!this.network || !this.graphReady) {
      this.pendingFocusToolId = toolId;
      return;
    }
    this.focusToolOnMap(toolId);
    this.syncNodeHighlights();
  }

  backToRoot(): void {
    this.drillRootId.set(null);
    this.renderGraph();
  }

  private initializeCollapsedState(): void {
    const collapsed = new Set<string>();
    const walk = (tools: ToolNode[]): void => {
      for (const tool of tools) {
        if (tool.Children?.length) {
          collapsed.add(tool.ToolId);
          walk(tool.Children);
        }
      }
    };
    walk(this.asset.ToolHierarchyData?.Roots ?? []);
    this.collapsedIds.set(collapsed);
  }

  private expandAllForSearch(): void {
    this.collapsedIds.set(new Set());
  }

  private rebuildList(): void {
    const roots = this.asset.ToolHierarchyData?.Roots ?? [];
    const filter = this.searchText.trim().toLowerCase();
    const collapsed = this.collapsedIds();
    const nodes: VisibleToolNode[] = [];

    const walk = (tools: ToolNode[], level: number): void => {
      for (const tool of tools) {
        const selfMatch = !filter || tool.ToolId.toLowerCase().includes(filter);
        const childMatch =
          !!filter &&
          !!tool.Children?.length &&
          tool.Children.some((child) => this.subtreeMatches(child, filter));

        if (!selfMatch && !childMatch) continue;

        nodes.push({ tool, level });

        if (tool.Children?.length && (!collapsed.has(tool.ToolId) || !!filter)) {
          walk(tool.Children, level + 1);
        }
      }
    };

    walk(roots, 0);
    this.visibleNodes.set(nodes);
  }

  private subtreeMatches(tool: ToolNode, filter: string): boolean {
    if (tool.ToolId.toLowerCase().includes(filter)) return true;
    return tool.Children?.some((child) => this.subtreeMatches(child, filter)) ?? false;
  }

  private renderGraph(): void {
    if (!this.graphContainer) return;
    const hierarchy = this.asset.ToolHierarchyData;
    if (!hierarchy?.Roots) return;

    if (this.zoomDebounceTimer) {
      clearTimeout(this.zoomDebounceTimer);
      this.zoomDebounceTimer = null;
    }

    this.stopZoomSizeSync();
    this.unbindPointerTracking();
    this.network?.destroy();
    this.network = null;
    this.nodesDataSet = null;
    this.graphReady = false;
    this.isClusteredView = false;
    this.lastSyncedSelectedId = null;
    this.lastSyncedHoveredId = null;
    this.spatialClusterIds = [];
    this.clusterCountById.clear();
    this.basePositions.clear();
    this.nodeBaseStyles.clear();
    this.graphHoveredNodeId = null;
    this.panelPinned.set(false);
    this.hoveredToolIds.set([]);
    this.hoverPanelParentId.set(null);
    this.listHoveredToolId.set(null);
    this.pendingFocusToolId = null;

    const nodes = new DataSet<any>();
    const positionScale = 50;
    const drillId = this.drillRootId();
    let levelTools: ToolNode[] = hierarchy.Roots;
    let parentId: string | null = null;

    if (drillId) {
      const parent = this.findTool(drillId, hierarchy.Roots);
      if (!parent?.Children?.length) {
        this.drillRootId.set(null);
        levelTools = hierarchy.Roots;
      } else {
        levelTools = parent.Children;
        parentId = parent.ToolId;
      }
    }

    const layoutTools: ToolNode[] = [...levelTools];
    if (parentId) {
      const parentForLayout = this.findTool(parentId, hierarchy.Roots);
      if (parentForLayout) layoutTools.unshift(parentForLayout);
    }
    const layout = this.layoutTools(layoutTools, positionScale);

    if (parentId) {
      const parent = this.findTool(parentId, hierarchy.Roots);
      if (parent) {
        const coords = layout.get(parent.ToolId) ?? { x: 0, y: 0 };
        nodes.add(this.createToolNodeOptions(parent, false, coords.x, coords.y, true));
        this.basePositions.set(parent.ToolId, coords);
      }
    }

    this.currentLevelNodeIds = levelTools.map((tool) => tool.ToolId);

    levelTools.forEach((tool) => {
      const coords = layout.get(tool.ToolId) ?? { x: 0, y: 0 };
      this.basePositions.set(tool.ToolId, coords);
      nodes.add(this.createToolNodeOptions(tool, !!parentId, coords.x, coords.y));
    });

    this.nodesDataSet = nodes;

    this.network = new Network(
      this.graphContainer.nativeElement,
      { nodes },
      {
        physics: { enabled: false },
        interaction: {
          hover: true,
          selectable: true,
          dragNodes: false,
          zoomView: true,
          dragView: true,
          tooltipDelay: 0,
        },
        nodes: {
          borderWidth: this.usesOverlayStyle() ? 3 : 2,
          shape: 'dot',
          size: this.toGraphSize(this.targetScreenSize(
            this.usesOverlayStyle() ? OVERLAY_TOOL_NODE_SIZE : TOOL_NODE_SIZE,
          )),
          font: { size: 0, color: 'transparent' },
          scaling: {
            min: 1,
            max: 200,
            label: { enabled: false },
          },
        },
      }
    );

    this.bindPointerTracking();

    this.network.on('beforeDrawing', (ctx: CanvasRenderingContext2D) => this.drawBirdsEye(ctx));
    this.network.on('afterDrawing', (ctx: CanvasRenderingContext2D) => this.drawClusterCounts(ctx));

    this.network.on('hoverNode', (params) => {
      if (params.pointer?.DOM) this.lastDomPointer = params.pointer.DOM;
      this.applyHoverToNode(this.preferredNodeId(String(params.node)));
    });

    this.network.on('blurNode', (params) => {
      if (params.pointer?.DOM) this.lastDomPointer = params.pointer.DOM;
      const nearby = this.lastDomPointer ? this.nodeIdNearPointer(this.lastDomPointer) : null;
      if (nearby) {
        this.applyHoverToNode(nearby);
        return;
      }
      this.clearGraphHover();
    });

    this.network.once('afterDrawing', () => {
      this.graphReady = true;
      this.shouldFitOnResize = true;
      this.scheduleFitToView();

      const focusId = this.pendingFocusToolId ?? this.selectedToolId();
      this.pendingFocusToolId = null;
      if (focusId) {
        setTimeout(() => this.focusToolOnMap(focusId), 450);
      }
    });

    this.network.on('zoom', () => this.scheduleClusteringUpdate());
    this.network.on('animationFinished', () => {
      this.applyZoomScaledSizes();
      this.updateSpatialClusters();
      this.syncNodeHighlights();
    });

    this.network.on('click', (params) => {
      const pointer = params.pointer?.DOM ?? this.lastDomPointer;
      const clickedId = pointer
        ? this.nodeIdNearPointer(pointer)
        : params.nodes.length
          ? this.preferredNodeId(String(params.nodes[0]))
          : null;

      if (!clickedId) {
        this.selectedToolId.set(null);
        this.unpinHoverPanel();
        this.syncNodeHighlights();
        return;
      }

      this.pinHoverFromNode(clickedId);

      if (this.isClusterId(clickedId)) {
        this.onClusterClick(clickedId);
        return;
      }

      this.selectedToolId.set(clickedId);
      this.syncNodeHighlights();
    });

    this.network.on('doubleClick', (params) => {
      const pointer = params.pointer?.DOM ?? this.lastDomPointer;
      const clickedId = pointer
        ? this.nodeIdNearPointer(pointer)
        : params.nodes.length
          ? String(params.nodes[0])
          : null;
      if (!clickedId || this.isClusterId(clickedId)) return;
      const tool = this.state.allToolsMap()[clickedId] ?? this.findTool(clickedId, hierarchy.Roots);
      if (tool?.Children?.length) {
        this.drillInto(clickedId);
      }
    });
  }

  private layoutTools(tools: ToolNode[], positionScale: number): Map<string, { x: number; y: number }> {
    const projection = this.projection();
    if (projection) return this.layoutToolsOnCapture(tools, projection);

    const positioned: { id: string; x: number; y: number }[] = [];

    for (const tool of tools) {
      if (!tool.Position) continue;
      positioned.push({
        id: tool.ToolId,
        x: tool.Position.x * positionScale,
        y: tool.Position.z * positionScale,
      });
    }

    const layout = new Map<string, { x: number; y: number }>();

    if (positioned.length === 0) {
      tools.forEach((tool, index) => {
        const angle = (2 * Math.PI * index) / Math.max(tools.length, 1);
        layout.set(tool.ToolId, { x: Math.cos(angle) * 20, y: Math.sin(angle) * 20 });
      });
      return layout;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of positioned) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const span = Math.max(maxX - minX, maxY - minY, 1);
    const compress = span > this.maxLayoutSpan ? this.maxLayoutSpan / span : 1;

    for (const point of positioned) {
      layout.set(point.id, {
        x: (point.x - cx) * compress,
        y: (point.y - cy) * compress,
      });
    }

    tools.forEach((tool, index) => {
      if (layout.has(tool.ToolId)) return;
      const angle = (2 * Math.PI * index) / Math.max(tools.length, 1);
      layout.set(tool.ToolId, { x: Math.cos(angle) * 20, y: Math.sin(angle) * 20 });
    });

    return layout;
  }

  /**
   * Place tools at their authored world positions on the capture: graph units are image pixels, so
   * no recentering or compression is applied and dots land where the tools stand in the render.
   */
  private layoutToolsOnCapture(
    tools: ToolNode[],
    projection: BirdsEyeProjection,
  ): Map<string, { x: number; y: number }> {
    const layout = new Map<string, { x: number; y: number }>();
    let outside = 0;

    tools.forEach((tool, index) => {
      if (tool.Position) {
        layout.set(tool.ToolId, worldToGraphPoint(projection, tool.Position));
        if (!isInsideCapture(projection, tool.Position)) outside++;
        return;
      }
      // Unpositioned entries have no place on the image; ring them around its center.
      const angle = (2 * Math.PI * index) / Math.max(tools.length, 1);
      const radius = Math.min(projection.imageWidth, projection.imageHeight) * 0.1;
      layout.set(tool.ToolId, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    });

    this.outsideCaptureCount.set(outside);
    return layout;
  }

  private focusToolOnMap(toolId: string): void {
    if (!this.network || !this.graphReady) return;

    const mapId = this.getMapHighlightId(toolId);
    if (!mapId) return;

    const focusId = this.findVisibleNodeId(mapId);
    const focusScale = Math.max(this.network.getScale(), 1.4);

    this.network.focus(focusId, {
      scale: focusScale,
      animation: { duration: 500, easingFunction: 'easeInOutQuad' },
    });
    this.network.selectNodes([focusId]);
    this.syncNodeHighlights();
    this.syncSizesDuringCameraMove(500);
  }

  private scheduleFitToView(): void {
    if (!this.graphReady || !this.network) return;
    if (this.fitDebounceTimer) clearTimeout(this.fitDebounceTimer);
    this.fitDebounceTimer = setTimeout(() => this.fitGraphToView(), 80);
  }

  private fitGraphToView(): void {
    if (!this.network || !this.nodesDataSet) return;
    if (this.fitCaptureToView()) return;

    const nodeIds = this.nodesDataSet.getIds();
    if (nodeIds.length === 0) return;

    this.network.fit({
      nodes: nodeIds,
      animation: { duration: 400, easingFunction: 'easeInOutQuad' },
    });
    this.syncSizesDuringCameraMove(400);

    setTimeout(() => {
      if (!this.network) return;
      const scale = this.network.getScale();
      if (scale < 0.08) {
        this.network.moveTo({ scale: 0.08, animation: { duration: 200, easingFunction: 'easeInOutQuad' } });
        this.syncSizesDuringCameraMove(200);
        return;
      }
      this.finishFitToView();
    }, 420);
  }

  /** Frames the whole capture rather than the tool dots, so the environment stays readable. */
  private fitCaptureToView(): boolean {
    const projection = this.projection();
    if (!projection || !this.network || !this.graphContainer) return false;

    const element = this.graphContainer.nativeElement;
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (width <= 0 || height <= 0) return false;

    const scale = Math.min(
      width / projection.imageWidth,
      height / projection.imageHeight,
    );
    this.network.moveTo({
      position: { x: 0, y: 0 },
      scale: Math.min(Math.max(scale * 0.98, 0.01), 4),
      animation: { duration: 400, easingFunction: 'easeInOutQuad' },
    });
    this.syncSizesDuringCameraMove(400);
    return true;
  }

  private finishFitToView(): void {
    this.applyZoomScaledSizes();
    this.updateSpatialClusters();
    this.syncNodeHighlights();
  }

  private createToolNodeOptions(
    tool: ToolNode,
    isDrillChild: boolean,
    x?: number,
    y?: number,
    isParentHub = false
  ): Record<string, unknown> {
    const overlay = this.usesOverlayStyle();
    const palette = overlay
      ? isParentHub || !isDrillChild
        ? OVERLAY_TOOL_COLOR
        : OVERLAY_TOOL_CHILD_COLOR
      : isParentHub || !isDrillChild
        ? TOOL_COLOR
        : TOOL_CHILD_COLOR;
    const size = overlay
      ? isParentHub
        ? OVERLAY_TOOL_NODE_SIZE + 2
        : OVERLAY_TOOL_NODE_SIZE
      : isParentHub
        ? TOOL_NODE_SIZE + 2
        : TOOL_NODE_SIZE;

    this.nodeBaseStyles.set(tool.ToolId, {
      background: palette.background,
      border: palette.border,
      size,
    });

    const childCount = tool.Children?.length ?? 0;
    return {
      id: tool.ToolId,
      label: '',
      title: `ID: ${tool.ToolId}${childCount ? `\nChildren: ${childCount}` : ''}`,
      shape: 'dot',
      margin: this.nodeHitSlopPx,
      x,
      y,
      fixed: { x: true, y: true },
      size: this.graphSizeForBase(size),
      borderWidth: overlay ? 3 : 2,
      color: this.buildNodeColor(palette.background, palette.border, this.nodeFilterAlpha(tool.ToolId)),
      font: { size: 0, color: 'transparent' },
      shadow: this.nodeShadow(overlay, tool.ToolId),
    };
  }

  private updateNodeHighlight(nodeId: string, mode: 'default' | 'hover' | 'selected'): void {
    if (!this.nodesDataSet) return;

    const overlay = this.usesOverlayStyle();
    const base = this.nodeBaseStyles.get(nodeId) ?? CLUSTER_BASE_STYLE;
    let background = base.background;
    let border = base.border;
    let sizeBump = 0;
    let borderWidth = overlay ? 3 : 2;

    if (mode === 'selected') {
      const selected = overlay ? OVERLAY_SELECTED_COLOR : TOOL_SELECTED_COLOR;
      background = selected.background;
      border = selected.border;
      sizeBump = 2;
      borderWidth = overlay ? 4 : 3;
    } else if (mode === 'hover') {
      const hover = overlay ? OVERLAY_HOVER_COLOR : TOOL_HOVER_COLOR;
      background = hover.background;
      border = hover.border;
      sizeBump = 1;
      borderWidth = overlay ? 4 : 3;
    }

    const alpha = mode === 'default' ? this.nodeFilterAlpha(nodeId) : 1;
    this.nodesDataSet.update({
      id: nodeId,
      size: this.graphSizeForBase(base.size, sizeBump),
      borderWidth,
      color: this.buildNodeColor(background, border, alpha),
      shadow: this.nodeShadow(overlay, nodeId, alpha),
    });
  }

  private syncNodeHighlights(): void {
    if (!this.nodesDataSet || !this.network) return;

    const selectedMapId = this.getMapHighlightId(this.selectedToolId());
    // A pinned panel owns the highlight so zoom/hover cannot yellow a different node.
    const hoveredMapId = this.getMapHighlightId(
      this.listHoveredToolId() ?? (this.panelPinned() ? null : this.graphHoveredNodeId),
    );

    const nextSelectedVisible = selectedMapId ? this.findVisibleNodeId(selectedMapId) : null;
    const nextHoveredVisible =
      hoveredMapId && hoveredMapId !== selectedMapId ? this.findVisibleNodeId(hoveredMapId) : null;

    if (
      nextSelectedVisible === this.lastSyncedSelectedId &&
      nextHoveredVisible === this.lastSyncedHoveredId
    ) {
      return;
    }

    if (
      this.lastSyncedSelectedId &&
      this.lastSyncedSelectedId !== nextSelectedVisible
    ) {
      this.updateNodeHighlight(this.lastSyncedSelectedId, 'default');
    }
    if (
      this.lastSyncedHoveredId &&
      this.lastSyncedHoveredId !== nextHoveredVisible &&
      this.lastSyncedHoveredId !== nextSelectedVisible
    ) {
      this.updateNodeHighlight(this.lastSyncedHoveredId, 'default');
    }
    if (nextHoveredVisible && nextHoveredVisible !== nextSelectedVisible) {
      this.updateNodeHighlight(nextHoveredVisible, 'hover');
    }
    if (nextSelectedVisible) {
      this.updateNodeHighlight(nextSelectedVisible, 'selected');
    }

    this.lastSyncedSelectedId = nextSelectedVisible;
    this.lastSyncedHoveredId = nextHoveredVisible;
  }

  private setHoveredToolIds(ids: string[]): void {
    const next = [...ids].map(String).sort();
    const current = this.hoveredToolIds();
    if (current.length === next.length && current.every((id, index) => id === next[index])) {
      return;
    }
    this.hoveredToolIds.set(next);
  }

  private isClusterId(nodeId: string): boolean {
    if (!this.network) return this.spatialClusterIds.includes(nodeId);
    return (
      this.network.isCluster(nodeId) ||
      this.spatialClusterIds.includes(nodeId) ||
      nodeId.startsWith('cluster:')
    );
  }

  private toolsInGraphNode(nodeId: string): string[] {
    if (!this.network || !this.isClusterId(nodeId)) return [nodeId];
    try {
      return this.network
        .getNodesInCluster(nodeId)
        .map(String)
        .filter((id) => !this.isClusterId(id));
    } catch {
      return [];
    }
  }

  private updateHoveredTools(nodeId: string): void {
    if (!this.network) return;

    if (this.isClusterId(nodeId)) {
      this.hoverPanelParentId.set(null);
      this.setHoveredToolIds(this.toolsInGraphNode(nodeId));
      return;
    }

    this.updateHoverPanelForTool(nodeId);

    const base = this.basePositions.get(nodeId);
    if (!base) return;

    const overlapping = this.overlappingNodeIds(nodeId);

    if (overlapping.length > 1) {
      this.setHoveredToolIds(this.orderIdsByFilter(overlapping));
    }
  }

  private updateHoverPanelForTool(toolId: string): void {
    if (this.drillRootId() || this.rootToolIds.has(toolId)) {
      this.hoverPanelParentId.set(null);
      this.setHoveredToolIds([toolId]);
      return;
    }

    const rootAncestorId = this.getRootLevelAncestorId(toolId);
    this.hoverPanelParentId.set(rootAncestorId);
    this.setHoveredToolIds([toolId]);
  }

  private getMapHighlightId(toolId: string | null): string | null {
    if (!toolId) return null;

    if (this.drillRootId()) {
      if (this.currentLevelNodeIds.includes(toolId) || this.drillRootId() === toolId) {
        return toolId;
      }
      return null;
    }

    if (this.currentLevelNodeIds.includes(toolId)) {
      return toolId;
    }

    return this.getRootLevelAncestorId(toolId);
  }

  private getRootLevelAncestorId(toolId: string): string | null {
    let currentId: string | null = toolId;

    while (currentId) {
      if (this.rootToolIds.has(currentId)) return currentId;
      currentId = this.parentByToolId.get(currentId) ?? null;
    }

    return null;
  }

  private findTool(toolId: string, tools: ToolNode[]): ToolNode | null {
    for (const tool of tools) {
      if (tool.ToolId === toolId) return tool;
      if (tool.Children?.length) {
        const found = this.findTool(toolId, tool.Children);
        if (found) return found;
      }
    }
    return null;
  }

  private drillInto(toolId: string): void {
    this.drillRootId.set(toolId);
    this.expandListPathTo(toolId);
    this.renderGraph();
  }


  private expandListPathTo(toolId: string): void {
    const hierarchy = this.asset.ToolHierarchyData?.Roots ?? [];
    const path: string[] = [];
    const findPath = (tools: ToolNode[], ancestors: string[]): boolean => {
      for (const tool of tools) {
        const nextPath = [...ancestors, tool.ToolId];
        if (tool.ToolId === toolId) {
          path.push(...nextPath);
          return true;
        }
        if (tool.Children?.length && findPath(tool.Children, nextPath)) return true;
      }
      return false;
    };
    findPath(hierarchy, []);

    const collapsed = new Set(this.collapsedIds());
    for (const id of path) {
      collapsed.delete(id);
    }
    const drillId = this.drillRootId();
    if (drillId) collapsed.delete(drillId);
    this.collapsedIds.set(collapsed);
    this.rebuildList();
  }

  private scheduleClusteringUpdate(): void {
    if (!this.graphReady) return;
    if (this.zoomDebounceTimer) clearTimeout(this.zoomDebounceTimer);
    this.zoomDebounceTimer = setTimeout(() => {
      this.applyZoomScaledSizes();
      this.updateSpatialClusters();
      this.applyPointerHover();
    }, 60);
  }

  private updateSpatialClusters(): void {
    if (!this.network || !this.graphReady || this.currentLevelNodeIds.length < 2) return;

    const visibleNodeIds = this.currentLevelNodeIds.filter((id) => this.network!.findNode(id).length > 0);
    if (visibleNodeIds.length < 2) return;

    const groups = this.groupNodesByScreenOverlap(visibleNodeIds);

    if (groups.length === 0) {
      if (this.isClusteredView) {
        this.releaseSpatialClusters();
        this.isClusteredView = false;
        this.resetHighlightCache();
        this.syncNodeHighlights();
      }
      return;
    }

    this.applySpatialClusterGroups(groups);
    this.isClusteredView = true;
    this.syncNodeHighlights();
  }

  private applyPointerHover(): void {
    if (!this.network || !this.graphReady) return;
    const nodeId = this.lastDomPointer ? this.nodeIdNearPointer(this.lastDomPointer) : null;
    if (!nodeId) {
      this.clearGraphHover();
      return;
    }
    this.applyHoverToNode(nodeId);
  }

  private applyHoverToNode(nodeId: string): void {
    const canvas = this.graphContainer?.nativeElement;
    if (canvas) canvas.style.cursor = 'pointer';
    const sameNode = nodeId === this.graphHoveredNodeId;
    const panelEmpty = !this.hoveredToolIds().length && !this.hoverPanelParentId();
    if (sameNode && (!panelEmpty || this.panelPinned())) return;

    this.graphHoveredNodeId = nodeId;
    if (!this.panelPinned()) this.updateHoveredTools(nodeId);
    this.syncNodeHighlights();
  }

  private clearGraphHover(): void {
    const canvas = this.graphContainer?.nativeElement;
    if (canvas) canvas.style.cursor = '';
    if (!this.graphHoveredNodeId) return;
    this.graphHoveredNodeId = null;
    if (!this.panelPinned()) {
      this.hoveredToolIds.set([]);
      this.hoverPanelParentId.set(null);
    }
    this.syncNodeHighlights();
  }

  /**
   * vis-network hit-tests the drawn radius, which shrinks when zoomed in. Also accept the nearest
   * node within minHoverScreenPx so yellow highlight and the panel share one threshold.
   */
  private nodeIdNearPointer(dom: { x: number; y: number }): string | null {
    if (!this.network) return null;

    const direct = this.network.getNodeAt(dom);
    if (direct != null) return this.preferredNodeId(String(direct));

    const canvas = this.network.DOMtoCanvas(dom);
    const scale = this.viewScale();
    let bestId: string | null = null;
    let bestDist = this.minHoverScreenPx;

    const consider = (id: string, pos: { x: number; y: number } | undefined): void => {
      if (!pos) return;
      const dist = Math.hypot(pos.x - canvas.x, pos.y - canvas.y) * scale;
      if (dist > bestDist) return;
      bestDist = dist;
      bestId = id;
    };

    const ids = [...this.currentLevelNodeIds, ...this.spatialClusterIds];
    const positions = this.network.getPositions(ids);
    for (const id of this.currentLevelNodeIds) {
      const chain = this.network.findNode(id).map(String);
      if (chain.length === 0) continue;
      if (chain.some((cid) => cid !== id && this.isClusterId(cid))) continue;
      consider(id, positions[id] ?? this.basePositions.get(id));
    }
    for (const id of this.spatialClusterIds) {
      consider(id, positions[id]);
    }

    return bestId ? this.preferredNodeId(bestId) : null;
  }

  private resetHighlightCache(): void {
    this.lastSyncedSelectedId = null;
    this.lastSyncedHoveredId = null;
  }

  private releaseSpatialClusters(): void {
    if (!this.network) return;
    for (const clusterId of [...this.spatialClusterIds]) {
      if (this.network.isCluster(clusterId)) {
        this.network.openCluster(clusterId);
      }
    }
    this.spatialClusterIds = [];
    this.clusterCountById.clear();
  }

  private applySpatialClusterGroups(groups: string[][]): void {
    if (!this.network || !this.graphReady) return;

    this.releaseSpatialClusters();
    this.resetNodePositions();

    for (const group of groups) {
      if (group.length < 2) continue;

      const count = group.length;
      const overlay = this.usesOverlayStyle();
      const clusterColor = overlay ? OVERLAY_CLUSTER_COLOR : CLUSTER_COLOR;
      const baseSize = this.clusterSizeForCount(count);
      const size = this.graphSizeForBase(baseSize);
      const clusterMatches = group.some((id) => this.nodeMatchesFilter(id));
      const clusterAlpha = filterNodeAlpha(
        clusterMatches,
        overlay ? OVERLAY_NODE_ALPHA : 1,
      );

      this.network.cluster({
        joinCondition: (nodeOptions) => group.includes(String(nodeOptions.id)),
        clusterNodeProperties: {
          label: '',
          title: group.map((id) => `ID: ${id}`).join('\n'),
          shape: 'dot',
          size,
          borderWidth: overlay ? 3 : 2,
          font: { size: 0, color: 'transparent' },
          color: this.buildNodeColor(clusterColor.background, clusterColor.border, clusterAlpha),
          shadow: overlay
            ? clusterAlpha >= 1
              ? OVERLAY_SHADOW
              : { ...OVERLAY_SHADOW, color: colorWithAlpha('#000000', 0.55 * clusterAlpha) }
            : false,
        },
        processProperties: (clusterOptions, childNodes) => {
          clusterOptions.label = '';
          return clusterOptions;
        },
      });

      const clusterId = this.network.findNode(group[0]).find((id) => this.network!.isCluster(id));
      if (clusterId !== undefined) {
        const clusterKey = String(clusterId);
        this.spatialClusterIds.push(clusterKey);
        this.clusterCountById.set(clusterKey, count);
        this.nodeBaseStyles.set(clusterKey, {
          background: clusterColor.background,
          border: clusterColor.border,
          size: baseSize,
        });
      }
    }

    this.resetHighlightCache();
  }

  private groupNodesByScreenOverlap(nodeIds: string[]): string[][] {
    if (!this.network || nodeIds.length < 2) return [];

    const scale = Math.max(this.network.getScale(), 0.01);
    const positions = this.network.getPositions(nodeIds);
    const neighbors = new Map<string, string[]>();

    for (let i = 0; i < nodeIds.length; i++) {
      const idA = nodeIds[i];
      const posA = positions[idA] ?? this.basePositions.get(idA);
      if (!posA) continue;

      for (let j = i + 1; j < nodeIds.length; j++) {
        const idB = nodeIds[j];
        const posB = positions[idB] ?? this.basePositions.get(idB);
        if (!posB) continue;

        const screenDistance = Math.hypot(posA.x - posB.x, posA.y - posB.y) * scale;
        if (screenDistance > this.clusterJoinScreenPx) continue;

        if (!neighbors.has(idA)) neighbors.set(idA, []);
        if (!neighbors.has(idB)) neighbors.set(idB, []);
        neighbors.get(idA)!.push(idB);
        neighbors.get(idB)!.push(idA);
      }
    }

    return this.collectNeighborGroups(nodeIds, neighbors);
  }

  private collectNeighborGroups(ids: string[], neighbors: Map<string, string[]>): string[][] {
    const groups: string[][] = [];
    const visited = new Set<string>();

    for (const id of ids) {
      if (visited.has(id)) continue;
      if (!neighbors.has(id)) {
        visited.add(id);
        continue;
      }

      const group: string[] = [];
      const queue = [id];
      visited.add(id);

      while (queue.length > 0) {
        const current = queue.shift()!;
        group.push(current);
        for (const neighbor of neighbors.get(current) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      if (group.length >= 2) {
        groups.push(group);
      }
    }

    return groups;
  }

  private resetNodePositions(): void {
    if (!this.nodesDataSet) return;
    const updates = this.currentLevelNodeIds
      .map((id) => {
        const base = this.basePositions.get(id);
        return base ? { id, x: base.x, y: base.y } : null;
      })
      .filter(Boolean);
    if (updates.length) {
      this.nodesDataSet.update(updates);
    }
  }

  private onClusterClick(clusterId: string): void {
    if (!this.network) return;

    const targetScale = Math.min(Math.max(this.network.getScale() * 1.6, this.clusterExpandScale), 5);

    this.network.focus(clusterId, {
      scale: targetScale,
      animation: { duration: 400, easingFunction: 'easeInOutQuad' },
    });
    this.syncSizesDuringCameraMove(400);

    setTimeout(() => {
      if (!this.network || !this.isClusterId(clusterId)) return;
      this.network.openCluster(clusterId);
      this.spatialClusterIds = this.spatialClusterIds.filter((id) => id !== clusterId);
      this.clusterCountById.delete(clusterId);
      this.isClusteredView = this.spatialClusterIds.length > 0;
      this.applyZoomScaledSizes();
      this.updateSpatialClusters();
      this.resetHighlightCache();
      this.syncNodeHighlights();
    }, 420);
  }

  private applyFilterNodeStyles(): void {
    if (!this.nodesDataSet) return;
    this.resetHighlightCache();
    for (const id of this.currentLevelNodeIds) {
      this.updateNodeHighlight(id, 'default');
    }
    for (const clusterId of this.spatialClusterIds) {
      this.updateNodeHighlight(clusterId, 'default');
    }
    this.syncNodeHighlights();
  }

  private nodeMatchesFilter(nodeId: string): boolean {
    const filter = this.searchText;
    if (!filter.trim()) return true;
    if (this.isClusterId(nodeId)) {
      return this.toolsInGraphNode(nodeId).some((id) => this.nodeMatchesFilter(id));
    }
    if (toolIdMatchesFilter(nodeId, filter)) return true;
    const tool = this.findTool(nodeId, this.asset.ToolHierarchyData?.Roots ?? []);
    return !!tool && this.subtreeMatches(tool, filter.trim().toLowerCase());
  }

  private nodeFilterAlpha(nodeId: string): number {
    return filterNodeAlpha(
      this.nodeMatchesFilter(nodeId),
      this.usesOverlayStyle() ? OVERLAY_NODE_ALPHA : 1,
    );
  }

  private nodeShadow(overlay: boolean, nodeId: string, alpha = this.nodeFilterAlpha(nodeId)) {
    if (!overlay) return false;
    if (alpha >= 1) return OVERLAY_SHADOW;
    return { ...OVERLAY_SHADOW, color: colorWithAlpha('#000000', 0.55 * alpha) };
  }

  private overlappingNodeIds(nodeId: string): string[] {
    const base = this.basePositions.get(nodeId);
    if (!base) return [nodeId];
    const overlapping = this.currentLevelNodeIds.filter((id) => {
      const pos = this.basePositions.get(id);
      if (!pos) return id === nodeId;
      return Math.hypot(pos.x - base.x, pos.y - base.y) <= this.samePositionEpsilon;
    });
    return overlapping.length ? overlapping : [nodeId];
  }

  private orderIdsByFilter(ids: string[]): string[] {
    const filter = this.searchText;
    const matching = ids.filter((id) => this.nodeMatchesFilter(id));
    if (!matching.length || !filter.trim()) return ids;
    const rest = ids.filter((id) => !matching.includes(id));
    const preferred = preferMatchingToolId(matching, filter);
    const head = preferred ? [preferred, ...matching.filter((id) => id !== preferred)] : matching;
    return [...head, ...rest];
  }

  /** Prefer a query-matching node when vis-network's pick is ambiguous. */
  private preferredNodeId(nodeId: string): string {
    if (!this.searchText.trim() || this.isClusterId(nodeId)) return nodeId;
    const ordered = this.orderIdsByFilter(this.overlappingNodeIds(nodeId));
    return preferMatchingToolId(ordered, this.searchText) ?? nodeId;
  }

  private buildNodeColor(background: string, border: string, alpha = 1) {
    const fill = colorWithAlpha(background, alpha);
    const ring = colorWithAlpha(border, alpha);
    return {
      background: fill,
      border: ring,
      // vis-network hover/select must not paint a second color; we own highlight state.
      highlight: { background: fill, border: ring },
      hover: { background: fill, border: ring },
    };
  }

  private clusterSizeForCount(count: number): number {
    const min = this.usesOverlayStyle() ? 18 : CLUSTER_SIZE_MIN;
    const max = this.usesOverlayStyle() ? 26 : CLUSTER_SIZE_MAX;
    return Math.max(min, Math.min(max, 18 + count * 0.8));
  }

  /**
   * Draw cluster counts ourselves. vis-network labels sit on the font em-box, so a
   * digit like "2" always looks high-left inside a circle.
   */
  private drawClusterCounts(ctx: CanvasRenderingContext2D): void {
    if (!this.network || this.clusterCountById.size === 0) return;

    const ids = [...this.clusterCountById.keys()];
    const positions = this.network.getPositions(ids);
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    for (const id of ids) {
      const pos = positions[id];
      const count = this.clusterCountById.get(id);
      if (!pos || count == null) continue;

      const fontPx = this.toGraphSize(this.clusterCountScreenSize(id, count));
      ctx.font = `700 ${fontPx}px "Segoe UI", "Source Code Pro", system-ui, sans-serif`;
      const origin = centeredCanvasTextOrigin(pos.x, pos.y, ctx.measureText(String(count)));
      ctx.fillText(String(count), origin.x, origin.y);
    }
    ctx.restore();
  }

  /** Screen-pixel size that keeps the count inside the ring at the current zoom. */
  private clusterCountScreenSize(clusterId: string, count: number): number {
    const base = this.nodeBaseStyles.get(clusterId);
    const radius = this.targetScreenSize(base?.size ?? this.clusterSizeForCount(count));
    const border = this.usesOverlayStyle() ? 3 : 2;
    return clusterCountFontSize(Math.max(10, (radius - border) * 2), count);
  }

  private findVisibleNodeId(toolId: string): string {
    if (!this.network) return toolId;
    if (this.network.findNode(toolId).length > 0) return toolId;

    for (const clusterId of this.spatialClusterIds) {
      if (!this.isClusterId(clusterId)) continue;
      if (this.toolsInGraphNode(clusterId).includes(toolId)) {
        return clusterId;
      }
    }
    return toolId;
  }
}
