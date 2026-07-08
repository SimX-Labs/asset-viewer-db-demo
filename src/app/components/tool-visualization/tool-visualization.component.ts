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
const TOOL_COLOR = { background: '#007cc0', border: '#0f2d5b' };
const TOOL_CHILD_COLOR = { background: '#4daafc', border: '#007cc0' };
const TOOL_HOVER_COLOR = { background: '#4daafc', border: '#ffffff' };
const TOOL_SELECTED_COLOR = { background: '#86efac', border: '#15803d' };
const CLUSTER_COLOR = { background: '#005a8c', border: '#0f2d5b' };
/** vis-network dot radius for spatial cluster circles. */
const CLUSTER_NODE_SIZE = 14;

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
                (mouseenter)="onListItemHover(node.tool.ToolId)"
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
            @if (hoveredToolIds().length) {
              <ul class="tool-hover-list">
                @for (toolId of hoveredToolIds(); track toolId) {
                  <li>{{ toolId }}</li>
                }
              </ul>
            } @else {
              <span class="tool-hover-hint">Hover a tool</span>
            }
          </div>
          <div #graphContainer class="tool-graph"></div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
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
        border-color: var(--accent);
      }
      .tool-hierarchy-list {
        list-style: none;
        margin: 0;
        padding: 0;
        overflow-y: auto;
        max-height: 360px;
        border: 1px solid var(--border-light);
        border-radius: var(--radius-md);
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
        color: var(--sterile-white);
        border-left-color: var(--procedure-blue);
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
        color: var(--sterile-white);
        border: none;
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-family: var(--font-body);
        font-size: var(--text-caption);
        font-weight: 700;
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
        top: 0;
        left: 0;
        z-index: 2;
        width: 180px;
        max-height: 100%;
        padding: var(--space-2);
        box-sizing: border-box;
        background: rgba(9, 29, 60, 0.92);
        border-right: 1px solid var(--border-light);
        border-radius: var(--radius-md) 0 0 var(--radius-md);
        overflow-y: auto;
        pointer-events: none;
      }
      .tool-hover-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .tool-hover-list li {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--sterile-white);
        word-break: break-all;
        line-height: 1.35;
      }
      .tool-hover-hint {
        font-size: var(--text-caption);
        color: var(--text-muted);
        font-style: italic;
      }
      .tool-graph {
        width: 100%;
        height: 360px;
        background: var(--bg-graph);
        border: 1px solid var(--border-light);
        border-radius: var(--radius-md);
      }
    `,
  ],
})
export class ToolVisualizationComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) asset!: DboAsset;
  @ViewChild('graphContainer') graphContainer!: ElementRef<HTMLDivElement>;

  private readonly state = inject(AppStateService);
  private network: Network | null = null;
  private nodesDataSet: DataSet<any> | null = null;
  private zoomDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentLevelNodeIds: string[] = [];
  private spatialClusterIds: string[] = [];
  private basePositions = new Map<string, { x: number; y: number }>();
  private nodeBaseStyles = new Map<string, NodeBaseStyle>();
  private hoveredNodeId: string | null = null;
  private graphHoveredNodeId: string | null = null;
  private graphReady = false;

  /** Minimum screen-space gap before tool circles merge into a cluster. */
  private readonly clusterGapPx = 4;
  /** Zoom scale at/above which clusters split into individual tool circles. */
  private readonly clusterSplitScale = 0.85;
  /** Model-space tolerance for tools sharing the same scene position. */
  private readonly samePositionEpsilon = 0.5;

  searchText = '';
  readonly selectedToolId = signal<string | null>(null);
  readonly drillRootId = signal<string | null>(null);
  readonly collapsedIds = signal(new Set<string>());
  readonly visibleNodes = signal<VisibleToolNode[]>([]);
  readonly hoveredToolIds = signal<string[]>([]);
  readonly listHoveredToolId = signal<string | null>(null);

  ngAfterViewInit(): void {
    this.initializeCollapsedState();
    this.rebuildList();
    setTimeout(() => this.renderGraph(), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['asset'] && !changes['asset'].firstChange) {
      this.initializeCollapsedState();
      this.drillRootId.set(null);
      this.selectedToolId.set(null);
      this.rebuildList();
      if (this.graphContainer) {
        setTimeout(() => this.renderGraph(), 0);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.zoomDebounceTimer) clearTimeout(this.zoomDebounceTimer);
    this.network?.destroy();
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
    if (tool.Children?.length) {
      this.toggleNode(event, tool.ToolId);
    }
    this.highlightTool(tool.ToolId);
  }

  onListItemHover(toolId: string): void {
    this.listHoveredToolId.set(toolId);
    this.syncNodeHighlights();
  }

  onListItemLeave(): void {
    this.listHoveredToolId.set(null);
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
    if (!this.network || !this.graphReady) return;

    const onCurrentLevel =
      this.currentLevelNodeIds.includes(toolId) ||
      this.drillRootId() === toolId ||
      this.spatialClusterIds.some((clusterId) => {
        return this.network!.isCluster(clusterId) && this.network!.getNodesInCluster(clusterId).includes(toolId);
      });

    if (!onCurrentLevel) {
      this.drillToTool(toolId);
      return;
    }

    const focusId = this.findVisibleNodeId(toolId);
    this.network.focus(focusId, {
      scale: Math.max(this.network.getScale(), 1),
      animation: { duration: 500, easingFunction: 'easeInOutQuad' },
    });
    this.network.selectNodes([focusId]);
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

    this.network?.destroy();
    this.network = null;
    this.nodesDataSet = null;
    this.graphReady = false;
    this.spatialClusterIds = [];
    this.basePositions.clear();
    this.nodeBaseStyles.clear();
    this.hoveredNodeId = null;
    this.graphHoveredNodeId = null;
    this.hoveredToolIds.set([]);
    this.listHoveredToolId.set(null);

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

    if (parentId) {
      const parent = this.findTool(parentId, hierarchy.Roots);
      if (parent) {
        const parentX = parent.Position ? parent.Position.x * positionScale : 0;
        const parentY = parent.Position ? parent.Position.z * positionScale : 0;
        nodes.add(this.createToolNodeOptions(parent, false, parentX, parentY, true));
      }
    }

    this.currentLevelNodeIds = levelTools.map((tool) => tool.ToolId);

    for (const tool of levelTools) {
      const x = tool.Position ? tool.Position.x * positionScale : undefined;
      const y = tool.Position ? tool.Position.z * positionScale : undefined;

      if (x !== undefined && y !== undefined) {
        this.basePositions.set(tool.ToolId, { x, y });
      }

      nodes.add(this.createToolNodeOptions(tool, !!parentId, x, y));
    }

    this.nodesDataSet = nodes;

    this.network = new Network(
      this.graphContainer.nativeElement,
      { nodes },
      {
        physics: { enabled: false },
        interaction: {
          hover: true,
          selectNodes: true,
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
      this.graphHoveredNodeId = nodeId;
      this.bringNodeToFront(nodeId);
      this.updateHoveredTools(nodeId);
      this.syncNodeHighlights();
    });

    this.network.on('blurNode', () => {
      this.hoveredNodeId = null;
      this.graphHoveredNodeId = null;
      this.hoveredToolIds.set([]);
      this.syncNodeHighlights();
    });

    this.network.once('afterDrawing', () => {
      this.graphReady = true;
      this.applySpatialClustering();
      this.syncNodeHighlights();
      this.network?.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
    });

    this.network.on('zoom', () => this.scheduleSpatialClustering());
    this.network.on('dragEnd', () => this.scheduleSpatialClustering());

    this.network.on('click', (params) => {
      if (params.nodes.length === 0) return;
      const clickedId = params.nodes[0] as string;

      if (this.network?.isCluster(clickedId)) {
        this.onClusterClick(clickedId);
        return;
      }

      this.selectedToolId.set(clickedId);
      this.syncNodeHighlights();
      if (clickedId === drillId) return;

      const tool = this.state.allToolsMap()[clickedId] ?? this.findTool(clickedId, hierarchy.Roots);
      if (tool?.Children?.length) {
        this.drillInto(clickedId);
      }
    });
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
      shadow: { enabled: true, color: 'rgba(0,0,0,0.25)', size: 3, x: 1, y: 1 },
    };
  }

  private buildNodeColor(background: string, border: string) {
    return {
      background,
      border,
      highlight: { background: TOOL_HOVER_COLOR.background, border: TOOL_HOVER_COLOR.border },
      hover: { background: TOOL_HOVER_COLOR.background, border: TOOL_HOVER_COLOR.border },
    };
  }

  private syncNodeHighlights(): void {
    if (!this.nodesDataSet || !this.network) return;

    const selectedId = this.selectedToolId();
    const listHoveredId = this.listHoveredToolId();
    const graphHoveredId = this.graphHoveredNodeId;

    for (const id of this.nodesDataSet.getIds().map(String)) {
      const base = this.nodeBaseStyles.get(id) ?? {
        background: CLUSTER_COLOR.background,
        border: CLUSTER_COLOR.border,
        size: CLUSTER_NODE_SIZE,
      };
      const containedIds = this.network.isCluster(id)
        ? this.network.getNodesInCluster(id).map(String)
        : [id];

      const isSelected = !!selectedId && containedIds.includes(selectedId);
      const isListHovered = !!listHoveredId && containedIds.includes(listHoveredId);
      const isGraphHovered = graphHoveredId === id;
      const isHovered = !isSelected && (isListHovered || isGraphHovered);

      let background = base.background;
      let border = base.border;
      let size = base.size;
      let borderWidth = 2;

      if (isSelected) {
        background = TOOL_SELECTED_COLOR.background;
        border = TOOL_SELECTED_COLOR.border;
        size = base.size + 2;
        borderWidth = 3;
      } else if (isHovered) {
        background = TOOL_HOVER_COLOR.background;
        border = TOOL_HOVER_COLOR.border;
        size = base.size + 1;
        borderWidth = 3;
      }

      this.nodesDataSet.update({
        id,
        size,
        borderWidth,
        color: this.buildNodeColor(background, border),
      });
    }
  }

  private updateHoveredTools(nodeId: string): void {
    if (!this.network) return;

    if (this.network.isCluster(nodeId)) {
      this.hoveredToolIds.set(this.network.getNodesInCluster(nodeId).map(String).sort());
      return;
    }

    const base = this.basePositions.get(nodeId);
    if (!base) {
      this.hoveredToolIds.set([nodeId]);
      return;
    }

    const overlapping = this.currentLevelNodeIds.filter((id) => {
      const pos = this.basePositions.get(id);
      if (!pos) return id === nodeId;
      return Math.hypot(pos.x - base.x, pos.y - base.y) <= this.samePositionEpsilon;
    });

    this.hoveredToolIds.set(overlapping.sort());
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

  private drillToTool(toolId: string): void {
    const hierarchy = this.asset.ToolHierarchyData?.Roots ?? [];
    const tool = this.findTool(toolId, hierarchy);
    if (!tool) return;

    const parentId = tool._ParentToolId ?? this.findParentId(toolId, hierarchy);
    if (parentId) {
      this.drillRootId.set(parentId);
    } else if (hierarchy.some((root) => root.ToolId === toolId)) {
      this.drillRootId.set(null);
    }
    this.expandListPathTo(toolId);
    this.renderGraph();

    setTimeout(() => {
      if (!this.network) return;
      this.network.focus(toolId, {
        scale: 1,
        animation: { duration: 500, easingFunction: 'easeInOutQuad' },
      });
      this.network.selectNodes([toolId]);
      this.syncNodeHighlights();
    }, 550);
  }

  private findParentId(toolId: string, tools: ToolNode[], parentId: string | null = null): string | null {
    for (const tool of tools) {
      if (tool.ToolId === toolId) return parentId;
      if (tool.Children?.length) {
        const found = this.findParentId(toolId, tool.Children, tool.ToolId);
        if (found !== null) return found;
      }
    }
    return null;
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

  private scheduleSpatialClustering(): void {
    if (!this.graphReady) return;
    if (this.zoomDebounceTimer) clearTimeout(this.zoomDebounceTimer);
    this.zoomDebounceTimer = setTimeout(() => this.applySpatialClustering(), 120);
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

  private applySpatialClustering(): void {
    if (!this.network || !this.graphReady || this.currentLevelNodeIds.length < 2) return;

    this.releaseSpatialClusters();
    this.resetNodePositions();

    const scale = this.network.getScale();
    if (scale >= this.clusterSplitScale) return;

    const positions = this.getBasePositionsForNodes(this.currentLevelNodeIds);
    const groups = this.groupNodesByScreenOverlap(positions, scale, this.clusterGapPx);

    for (const group of groups) {
      this.network.cluster({
        joinCondition: (nodeOptions) => group.includes(String(nodeOptions.id)),
        clusterNodeProperties: {
          label: String(group.length),
          shape: 'dot',
          size: CLUSTER_NODE_SIZE,
          font: { color: '#ffffff', size: 12, align: 'center', strokeWidth: 0 },
          color: {
            background: '#005a8c',
            border: '#0f2d5b',
            highlight: { background: '#007cc0', border: '#ffffff' },
            hover: { background: '#007cc0', border: '#ffffff' },
          },
          shadow: { enabled: true, color: 'rgba(0,0,0,0.3)', size: 5, x: 1, y: 2 },
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
          size: CLUSTER_NODE_SIZE,
        });
      }
    }

    this.syncNodeHighlights();
  }

  private getBasePositionsForNodes(nodeIds: string[]): Record<string, { x: number; y: number }> {
    const positions: Record<string, { x: number; y: number }> = {};
    for (const id of nodeIds) {
      const base = this.basePositions.get(id);
      if (base) positions[id] = base;
    }
    return positions;
  }

  private groupNodesByScreenOverlap(
    positions: Record<string, { x: number; y: number }>,
    scale: number,
    gapPx: number = this.clusterGapPx
  ): string[][] {
    const ids = Object.keys(positions);
    const neighbors = new Map<string, string[]>();
    const remaining = new Set(ids);

    for (let i = 0; i < ids.length; i++) {
      const posA = positions[ids[i]];
      for (let j = i + 1; j < ids.length; j++) {
        const posB = positions[ids[j]];
        if (this.nodesOverlapOnScreen(ids[i], posA, ids[j], posB, scale, gapPx)) {
          if (!neighbors.has(ids[i])) neighbors.set(ids[i], []);
          if (!neighbors.has(ids[j])) neighbors.set(ids[j], []);
          neighbors.get(ids[i])!.push(ids[j]);
          neighbors.get(ids[j])!.push(ids[i]);
        }
      }
    }

    const groups: string[][] = [];
    while (remaining.size > 0) {
      let seed: string | null = null;
      let bestCount = -1;

      for (const id of remaining) {
        const count = (neighbors.get(id) ?? []).filter((otherId) => remaining.has(otherId)).length;
        if (count > bestCount) {
          seed = id;
          bestCount = count;
        }
      }

      if (!seed || bestCount <= 0) break;

      const group = [
        seed,
        ...(neighbors.get(seed) ?? []).filter((otherId) => remaining.has(otherId)),
      ];
      group.forEach((id) => remaining.delete(id));
      groups.push(group);
    }

    return groups;
  }

  private nodesOverlapOnScreen(
    idA: string,
    posA: { x: number; y: number },
    idB: string,
    posB: { x: number; y: number },
    scale: number,
    gapPx: number
  ): boolean {
    const radiusA = TOOL_NODE_SIZE;
    const radiusB = TOOL_NODE_SIZE;
    const screenDist = Math.hypot(posA.x - posB.x, posA.y - posB.y) * scale;
    const minDist = radiusA + radiusB + gapPx;
    return screenDist < minDist;
  }

  private resetNodePositions(): void {
    if (!this.nodesDataSet) return;
    for (const id of this.currentLevelNodeIds) {
      const base = this.basePositions.get(id);
      if (base) {
        this.nodesDataSet.update({ id, x: base.x, y: base.y });
      }
    }
  }

  private bringNodeToFront(nodeId: string): void {
    if (!this.nodesDataSet || !this.network || this.hoveredNodeId === nodeId) return;

    const node = this.nodesDataSet.get(nodeId);
    if (!node) return;

    this.hoveredNodeId = nodeId;
    this.nodesDataSet.remove(nodeId);
    this.nodesDataSet.add(node);
    this.network.redraw();
  }

  private onClusterClick(clusterId: string): void {
    if (!this.network) return;

    const targetScale = Math.min(Math.max(this.network.getScale() * 1.6, this.clusterSplitScale), 5);

    this.network.focus(clusterId, {
      scale: targetScale,
      animation: { duration: 400, easingFunction: 'easeInOutQuad' },
    });

    setTimeout(() => {
      if (!this.network?.isCluster(clusterId)) return;
      this.network.openCluster(clusterId);
      this.spatialClusterIds = this.spatialClusterIds.filter((id) => id !== clusterId);
      this.applySpatialClustering();
      this.syncNodeHighlights();
    }, 420);
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
