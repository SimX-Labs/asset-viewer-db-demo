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

interface VisibleToolNode {
  tool: ToolNode;
  level: number;
}

/** vis-network dot radius for individual tool circles. */
const TOOL_NODE_SIZE = 7;
/** Default tool node colors. */
const TOOL_COLOR = { background: '#22406E', border: '#11284C' };
const TOOL_CHILD_COLOR = { background: '#405E92', border: '#22406E' };
const TOOL_HOVER_COLOR = { background: '#405E92', border: '#B2BFD9' };
const TOOL_SELECTED_COLOR = { background: '#091D3C', border: '#B2BFD9' };
const CLUSTER_COLOR = { background: '#22406E', border: '#11284C' };
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
      <div class="tool-visualization-toolbar">
        <button type="button" class="tool-fullscreen-button" (click)="toggleFullscreen()">
          {{ isFullscreen() ? 'Exit Fullscreen' : 'Fullscreen' }}
        </button>
      </div>
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
          <button class="tool-back-button" (click)="backToRoot()">← Back to Root Tools</button>
        }
        <div class="tool-graph-wrapper">
          <div class="tool-hover-panel">
            @if (hoverPanelParentId()) {
              <p class="tool-hover-child-of">Child of {{ hoverPanelParentId() }}</p>
            }
            @if (hoveredToolIds().length === 1) {
              <p class="tool-hover-id">{{ hoveredToolIds()[0] }}</p>
            } @else if (hoveredToolIds().length > 1) {
              <ul class="tool-hover-list">
                @for (toolId of hoveredToolIds(); track toolId) {
                  <li>{{ toolId }}</li>
                }
              </ul>
            } @else if (!hoverPanelParentId()) {
              <span class="tool-hover-hint">Hover a tool</span>
            }
          </div>
          <div class="tool-graph-legend">
            Circles group tools sharing the same position. Click a numbered circle to expand.
          </div>
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
        gap: var(--space-3);
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
        display: flex;
        justify-content: flex-end;
        margin-bottom: var(--space-2);
      }
      .tool-fullscreen-button {
        padding: var(--space-1) var(--space-3);
        background: transparent;
        color: var(--text-main);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-family: var(--font-graphic);
        font-size: var(--text-caption);
        font-weight: 500;
      }
      .tool-fullscreen-button:hover {
        border-color: var(--simx-content-light);
        color: var(--simx-content);
      }
      .tool-visualization-root.fullscreen .tool-visualization-container {
        flex: 1;
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
        gap: var(--space-3);
        min-height: 400px;
      }
      .tool-visualization-left {
        width: 40%;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .tool-visualization-right {
        flex: 1;
        position: relative;
      }
      .tool-search-input {
        width: 100%;
        box-sizing: border-box;
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--bg-input);
        color: var(--text-main);
        font-family: var(--font-body);
        font-size: var(--text-copy);
      }
      .tool-search-input:focus {
        outline: none;
        border-color: var(--simx-content-light);
      }
      .tool-hierarchy-list {
        list-style: none;
        margin: 0;
        padding: 0;
        overflow-y: auto;
        max-height: 360px;
        background: var(--bg-main);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
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
        margin-bottom: var(--space-2);
        padding: var(--space-2) var(--space-3);
        background: var(--accent);
        color: var(--simx-white);
        border: none;
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-family: var(--font-graphic);
        font-size: var(--text-caption);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .tool-graph-wrapper {
        position: relative;
        flex: 1;
        min-height: 360px;
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
        padding: var(--space-1) 0;
        border-bottom: 1px solid var(--border-light);
      }
      .tool-hover-list li:last-child {
        border-bottom: none;
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
      .tool-hover-hint {
        font-family: var(--font-body);
        font-size: var(--text-caption);
        color: var(--text-muted);
        font-style: italic;
      }
      .tool-graph-legend {
        position: absolute;
        bottom: var(--space-3);
        left: var(--space-3);
        z-index: 2;
        max-width: min(320px, calc(100% - 24px));
        padding: var(--space-2) var(--space-3);
        background: var(--bg-main);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        font-family: var(--font-body);
        font-size: var(--text-caption);
        color: var(--text-muted);
        line-height: 1.35;
        pointer-events: none;
        opacity: 0.92;
      }
      .tool-graph {
        width: 100%;
        height: 360px;
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
  private network: Network | null = null;
  private nodesDataSet: DataSet<any> | null = null;
  private zoomDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private fitDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private listHoverTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private currentLevelNodeIds: string[] = [];
  private spatialClusterIds: string[] = [];
  private basePositions = new Map<string, { x: number; y: number }>();
  private nodeBaseStyles = new Map<string, NodeBaseStyle>();
  private parentByToolId = new Map<string, string | null>();
  private rootToolIds = new Set<string>();
  private graphHoveredNodeId: string | null = null;
  private graphReady = false;
  private isClusteredView = false;
  private lastSyncedSelectedId: string | null = null;
  private lastSyncedHoveredId: string | null = null;
  private shouldFitOnResize = false;

  /** Zoom target when expanding a cluster on click. */
  private readonly clusterExpandScale = 1.2;
  /** Model-space tolerance for tools sharing the same scene position. */
  private readonly samePositionEpsilon = 0.5;
  /** Extra screen-space padding before overlapping nodes are merged into a cluster. */
  private readonly clusterScreenPaddingPx = 8;
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
  readonly listHoveredToolId = signal<string | null>(null);
  readonly isFullscreen = signal(false);

  private readonly onFullscreenChange = (): void => {
    this.isFullscreen.set(document.fullscreenElement === this.host.nativeElement);
    this.shouldFitOnResize = true;
    this.scheduleFitToView();
  };

  ngAfterViewInit(): void {
    this.buildHierarchyIndexes();
    this.initializeCollapsedState();
    this.rebuildList();
    setTimeout(() => this.renderGraph(), 0);

    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    if (typeof ResizeObserver !== 'undefined' && this.graphContainer) {
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
      if (this.graphContainer) {
        setTimeout(() => this.renderGraph(), 0);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.zoomDebounceTimer) clearTimeout(this.zoomDebounceTimer);
    if (this.fitDebounceTimer) clearTimeout(this.fitDebounceTimer);
    if (this.listHoverTimer) clearTimeout(this.listHoverTimer);
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    this.resizeObserver?.disconnect();
    if (document.fullscreenElement === this.host.nativeElement) {
      document.exitFullscreen().catch(() => undefined);
    }
    this.network?.destroy();
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
    this.updateHoverPanelForTool(tool.ToolId);
    if (this.listHoverTimer) clearTimeout(this.listHoverTimer);
    this.listHoverTimer = setTimeout(() => this.syncNodeHighlights(), 32);
  }

  onListItemLeave(): void {
    if (this.listHoverTimer) clearTimeout(this.listHoverTimer);
    this.listHoveredToolId.set(null);
    this.hoverPanelParentId.set(null);
    this.hoveredToolIds.set([]);
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
    if (!this.network || !this.graphReady) {
      this.pendingFocusToolId = toolId;
      return;
    }
    this.focusToolOnMap(toolId);
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

    this.network?.destroy();
    this.network = null;
    this.nodesDataSet = null;
    this.graphReady = false;
    this.isClusteredView = false;
    this.lastSyncedSelectedId = null;
    this.lastSyncedHoveredId = null;
    this.spatialClusterIds = [];
    this.basePositions.clear();
    this.nodeBaseStyles.clear();
    this.graphHoveredNodeId = null;
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
        },
        nodes: {
          borderWidth: 2,
          shape: 'dot',
          size: TOOL_NODE_SIZE,
          font: { size: 0, color: 'transparent' },
          scaling: {
            min: TOOL_NODE_SIZE,
            max: TOOL_NODE_SIZE,
            label: { enabled: false },
          },
        },
      }
    );

    this.network.on('hoverNode', (params) => {
      const nodeId = String(params.node);
      if (this.graphHoveredNodeId === nodeId) return;
      this.graphHoveredNodeId = nodeId;
      this.updateHoveredTools(nodeId);
      this.syncNodeHighlights();
    });

    this.network.on('blurNode', () => {
      if (!this.graphHoveredNodeId) return;
      this.graphHoveredNodeId = null;
      this.hoveredToolIds.set([]);
      this.hoverPanelParentId.set(null);
      this.syncNodeHighlights();
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

    this.network.on('click', (params) => {
      if (params.nodes.length === 0) return;
      const clickedId = params.nodes[0] as string;

      if (this.network?.isCluster(clickedId)) {
        this.onClusterClick(clickedId);
        return;
      }

      this.selectedToolId.set(clickedId);
      this.syncNodeHighlights();
    });

    this.network.on('doubleClick', (params) => {
      if (params.nodes.length === 0 || this.network?.isCluster(params.nodes[0])) return;
      const clickedId = params.nodes[0] as string;
      const tool = this.state.allToolsMap()[clickedId] ?? this.findTool(clickedId, hierarchy.Roots);
      if (tool?.Children?.length) {
        this.drillInto(clickedId);
      }
    });
  }

  private layoutTools(tools: ToolNode[], positionScale: number): Map<string, { x: number; y: number }> {
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
    setTimeout(() => this.updateSpatialClusters(), 520);
  }

  private scheduleFitToView(): void {
    if (!this.graphReady || !this.network) return;
    if (this.fitDebounceTimer) clearTimeout(this.fitDebounceTimer);
    this.fitDebounceTimer = setTimeout(() => this.fitGraphToView(), 80);
  }

  private fitGraphToView(): void {
    if (!this.network || !this.nodesDataSet) return;
    const nodeIds = this.nodesDataSet.getIds();
    if (nodeIds.length === 0) return;

    this.network.fit({
      nodes: nodeIds,
      animation: { duration: 400, easingFunction: 'easeInOutQuad' },
    });

    setTimeout(() => {
      if (!this.network) return;
      const scale = this.network.getScale();
      if (scale < 0.08) {
        this.network.moveTo({ scale: 0.08, animation: { duration: 200, easingFunction: 'easeInOutQuad' } });
        setTimeout(() => this.finishFitToView(), 220);
        return;
      }
      this.finishFitToView();
    }, 420);
  }

  private finishFitToView(): void {
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
    const childCount = tool.Children?.length ?? 0;
    const baseColor = isParentHub ? TOOL_COLOR : isDrillChild ? TOOL_CHILD_COLOR : TOOL_COLOR;
    const size = isParentHub ? TOOL_NODE_SIZE + 2 : TOOL_NODE_SIZE;

    this.nodeBaseStyles.set(tool.ToolId, {
      background: baseColor.background,
      border: baseColor.border,
      size,
    });

    return {
      id: tool.ToolId,
      label: '',
      title: `ID: ${tool.ToolId}${childCount ? `\nChildren: ${childCount}` : ''}`,
      shape: 'dot',
      x,
      y,
      fixed: { x: true, y: true },
      size,
      borderWidth: 2,
      color: this.buildNodeColor(baseColor.background, baseColor.border),
      font: { size: 0, color: 'transparent' },
      shadow: false,
    };
  }

  private updateNodeHighlight(nodeId: string, mode: 'default' | 'hover' | 'selected'): void {
    if (!this.nodesDataSet) return;

    const base = this.nodeBaseStyles.get(nodeId) ?? CLUSTER_BASE_STYLE;
    let background = base.background;
    let border = base.border;
    let size = base.size;
    let borderWidth = 2;

    if (mode === 'selected') {
      background = TOOL_SELECTED_COLOR.background;
      border = TOOL_SELECTED_COLOR.border;
      size = base.size + 2;
      borderWidth = 3;
    } else if (mode === 'hover') {
      background = TOOL_HOVER_COLOR.background;
      border = TOOL_HOVER_COLOR.border;
      size = base.size + 1;
      borderWidth = 3;
    }

    this.nodesDataSet.update({
      id: nodeId,
      size,
      borderWidth,
      color: this.buildNodeColor(background, border),
    });
  }

  private syncNodeHighlights(): void {
    if (!this.nodesDataSet || !this.network) return;

    const selectedMapId = this.getMapHighlightId(this.selectedToolId());
    const hoveredMapId = this.getMapHighlightId(
      this.listHoveredToolId() ?? this.graphHoveredNodeId
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

  private updateHoveredTools(nodeId: string): void {
    if (!this.network) return;

    if (this.network.isCluster(nodeId)) {
      this.hoverPanelParentId.set(null);
      this.setHoveredToolIds(this.network.getNodesInCluster(nodeId).map(String));
      return;
    }

    this.updateHoverPanelForTool(nodeId);

    const base = this.basePositions.get(nodeId);
    if (!base) return;

    const overlapping = this.currentLevelNodeIds.filter((id) => {
      const pos = this.basePositions.get(id);
      if (!pos) return id === nodeId;
      return Math.hypot(pos.x - base.x, pos.y - base.y) <= this.samePositionEpsilon;
    });

    if (overlapping.length > 1) {
      this.setHoveredToolIds(overlapping);
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
    this.zoomDebounceTimer = setTimeout(() => this.updateSpatialClusters(), 150);
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
  }

  private applySpatialClusterGroups(groups: string[][]): void {
    if (!this.network || !this.graphReady) return;

    this.releaseSpatialClusters();
    this.resetNodePositions();

    for (const group of groups) {
      if (group.length < 2) continue;

      const count = group.length;
      const size = this.clusterSizeForCount(count);
      const fontSize = this.clusterFontSizeForCount(count);

      this.network.cluster({
        joinCondition: (nodeOptions) => group.includes(String(nodeOptions.id)),
        clusterNodeProperties: {
          label: String(count),
          shape: 'circle',
          size,
          font: {
            color: '#ffffff',
            size: fontSize,
            face: 'Quicksand',
            align: 'center',
            vadjust: 0,
            strokeWidth: 0,
            bold: { color: '#ffffff', size: fontSize, mod: 'bold' },
          },
          color: {
            background: CLUSTER_COLOR.background,
            border: CLUSTER_COLOR.border,
            highlight: { background: '#405E92', border: '#B2BFD9' },
            hover: { background: '#405E92', border: '#B2BFD9' },
          },
          shadow: false,
        },
        processProperties: (clusterOptions, childNodes) => {
          clusterOptions.label = String(childNodes.length);
          return clusterOptions;
        },
      });

      const clusterId = this.network.findNode(group[0]).find((id) => this.network!.isCluster(id));
      if (clusterId !== undefined) {
        const clusterKey = String(clusterId);
        this.spatialClusterIds.push(clusterKey);
        this.nodeBaseStyles.set(clusterKey, {
          background: CLUSTER_COLOR.background,
          border: CLUSTER_COLOR.border,
          size,
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

      const radiusA = (this.nodeBaseStyles.get(idA)?.size ?? TOOL_NODE_SIZE) * scale;

      for (let j = i + 1; j < nodeIds.length; j++) {
        const idB = nodeIds[j];
        const posB = positions[idB] ?? this.basePositions.get(idB);
        if (!posB) continue;

        const radiusB = (this.nodeBaseStyles.get(idB)?.size ?? TOOL_NODE_SIZE) * scale;
        const screenDistance = Math.hypot(posA.x - posB.x, posA.y - posB.y) * scale;
        const overlapThreshold = radiusA + radiusB + this.clusterScreenPaddingPx;

        if (screenDistance <= overlapThreshold) {
          if (!neighbors.has(idA)) neighbors.set(idA, []);
          if (!neighbors.has(idB)) neighbors.set(idB, []);
          neighbors.get(idA)!.push(idB);
          neighbors.get(idB)!.push(idA);
        }
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

    setTimeout(() => {
      if (!this.network?.isCluster(clusterId)) return;
      this.network.openCluster(clusterId);
      this.spatialClusterIds = this.spatialClusterIds.filter((id) => id !== clusterId);
      this.isClusteredView = this.spatialClusterIds.length > 0;
      this.updateSpatialClusters();
      this.resetHighlightCache();
      this.syncNodeHighlights();
    }, 420);
  }

  private buildNodeColor(background: string, border: string) {
    return {
      background,
      border,
      highlight: { background: TOOL_HOVER_COLOR.background, border: TOOL_HOVER_COLOR.border },
      hover: { background: TOOL_HOVER_COLOR.background, border: TOOL_HOVER_COLOR.border },
    };
  }

  private clusterSizeForCount(count: number): number {
    return Math.max(CLUSTER_SIZE_MIN, Math.min(CLUSTER_SIZE_MAX, 18 + count * 2));
  }

  private clusterFontSizeForCount(count: number): number {
    if (count >= 10) return 11;
    if (count >= 6) return 12;
    return 13;
  }

  private findVisibleNodeId(toolId: string): string {
    if (!this.network) return toolId;
    if (this.network.findNode(toolId).length > 0) return toolId;

    for (const clusterId of this.spatialClusterIds) {
      if (!this.network.isCluster(clusterId)) continue;
      if (this.network.getNodesInCluster(clusterId).includes(toolId)) {
        return clusterId;
      }
    }
    return toolId;
  }
}
