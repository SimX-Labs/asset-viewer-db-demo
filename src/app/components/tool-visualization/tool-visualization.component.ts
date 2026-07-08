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
                [style.padding-left.px]="node.level * 16 + 8"
                (click)="onListItemClick($event, node.tool)"
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
        <div #graphContainer class="tool-graph"></div>
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
      .tool-node-item:hover {
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
  private zoomDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentLevelNodeIds: string[] = [];
  private spatialClusterIds: string[] = [];
  private graphReady = false;

  private readonly clusterRadiusPx = 70;
  private readonly clusterOpenScale = 1.2;

  searchText = '';
  readonly selectedToolId = signal<string | null>(null);
  readonly drillRootId = signal<string | null>(null);
  readonly collapsedIds = signal(new Set<string>());
  readonly visibleNodes = signal<VisibleToolNode[]>([]);

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
    this.graphReady = false;
    this.spatialClusterIds = [];

    const nodes = new DataSet<any>();
    const edges = new DataSet<any>();
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
        nodes.add({
          id: parent.ToolId,
          label: this.formatNodeLabel(parent),
          title: `ID: ${parent.ToolId}`,
          shape: 'dot',
          size: 26,
          x: parentX,
          y: parentY,
          color: {
            background: '#007cc0',
            border: '#0f2d5b',
            highlight: { background: '#e31f2f', border: '#c41a28' },
          },
          font: { color: '#ffffff', size: 12, strokeWidth: 0 },
          shadow: true,
        });
      }
    }

    this.currentLevelNodeIds = levelTools.map((tool) => tool.ToolId);

    for (const tool of levelTools) {
      const x = tool.Position ? tool.Position.x * positionScale : undefined;
      const y = tool.Position ? tool.Position.z * positionScale : undefined;
      const childCount = tool.Children?.length ?? 0;

      nodes.add({
        id: tool.ToolId,
        label: this.formatNodeLabel(tool),
        title: `ID: ${tool.ToolId}${childCount ? `\nChildren: ${childCount}` : ''}`,
        shape: 'dot',
        size: childCount > 0 ? 22 : 16,
        x,
        y,
        color: {
          background: parentId ? '#4daafc' : '#007cc0',
          border: parentId ? '#007cc0' : '#0f2d5b',
          highlight: { background: '#e31f2f', border: '#c41a28' },
        },
        font: { color: '#ffffff', size: 12, strokeWidth: 0 },
        shadow: true,
      });

      if (parentId) {
        edges.add({
          from: parentId,
          to: tool.ToolId,
          arrows: 'to',
          color: { color: '#858585', highlight: '#ffffff' },
          width: 1,
          smooth: { type: 'continuous' },
        });
      }
    }

    this.network = new Network(
      this.graphContainer.nativeElement,
      { nodes, edges },
      {
        physics: { enabled: false },
        interaction: {
          hover: true,
          selectNodes: true,
          dragNodes: true,
          zoomView: true,
          dragView: true,
        },
        nodes: {
          borderWidth: 2,
          scaling: {
            min: 12,
            max: 36,
            label: { enabled: true, min: 10, max: 18 },
          },
        },
      }
    );

    this.network.once('afterDrawing', () => {
      this.graphReady = true;
      this.applySpatialClustering();
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
      if (clickedId === drillId) return;

      const tool = this.state.allToolsMap()[clickedId] ?? this.findTool(clickedId, hierarchy.Roots);
      if (tool?.Children?.length) {
        this.drillInto(clickedId);
      }
    });
  }

  private formatNodeLabel(tool: ToolNode): string {
    const shortName = tool.ToolId.split('.').pop() ?? tool.ToolId;
    const childCount = tool.Children?.length ?? 0;
    return childCount > 0 ? `${shortName}\n(${childCount})` : shortName;
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

    const scale = this.network.getScale();
    const threshold = this.clusterRadiusPx / scale;
    const positions = this.network.getPositions(this.currentLevelNodeIds);
    const ids = this.currentLevelNodeIds.filter((id) => positions[id]);
    const visited = new Set<string>();
    const groups: string[][] = [];

    for (const id of ids) {
      if (visited.has(id)) continue;
      const group = [id];
      visited.add(id);
      const posA = positions[id];

      for (const otherId of ids) {
        if (visited.has(otherId)) continue;
        const posB = positions[otherId];
        const distance = Math.hypot(posA.x - posB.x, posA.y - posB.y);
        if (distance <= threshold) {
          group.push(otherId);
          visited.add(otherId);
        }
      }

      if (group.length > 1) {
        groups.push(group);
      }
    }

    for (const group of groups) {
      this.network.cluster({
        joinCondition: (nodeOptions) => group.includes(String(nodeOptions.id)),
        clusterNodeProperties: {
          label: String(group.length),
          shape: 'dot',
          size: 28,
          font: { color: '#ffffff', size: 18, strokeWidth: 0 },
          color: {
            background: '#005a8c',
            border: '#0f2d5b',
            highlight: { background: '#e31f2f', border: '#c41a28' },
          },
          shadow: true,
        },
        processProperties: (clusterOptions, childNodes) => {
          clusterOptions.label = String(childNodes.length);
          return clusterOptions;
        },
      });

      const clusterId = this.network.findNode(group[0]).find((id) => this.network!.isCluster(id));
      if (clusterId !== undefined) this.spatialClusterIds.push(String(clusterId));
    }
  }

  private onClusterClick(clusterId: string): void {
    if (!this.network) return;

    const currentScale = this.network.getScale();
    const targetScale = Math.min(Math.max(currentScale * 1.8, this.clusterOpenScale), 4);

    this.network.focus(clusterId, {
      scale: targetScale,
      animation: { duration: 400, easingFunction: 'easeInOutQuad' },
    });

    setTimeout(() => {
      if (!this.network?.isCluster(clusterId)) return;

      const scale = this.network.getScale();
      const positions = this.network.getPositions([clusterId]);
      const clusterPos = positions[clusterId];
      if (!clusterPos) return;

      const contained = this.network.getNodesInCluster(clusterId);
      const childPositions = this.network.getPositions(contained);
      let maxDistance = 0;
      for (const childId of contained) {
        const childPos = childPositions[childId];
        if (!childPos) continue;
        maxDistance = Math.max(
          maxDistance,
          Math.hypot(clusterPos.x - childPos.x, clusterPos.y - childPos.y)
        );
      }

      const spreadPx = maxDistance * scale;
      if (scale >= this.clusterOpenScale && spreadPx >= this.clusterRadiusPx * 0.75) {
        this.network.openCluster(clusterId);
        this.spatialClusterIds = this.spatialClusterIds.filter((id) => id !== clusterId);
        this.scheduleSpatialClustering();
        return;
      }

      this.focusCluster(clusterId);
    }, 420);
  }

  private focusCluster(clusterId: string): void {
    if (!this.network) return;
    this.network.focus(clusterId, {
      scale: Math.min(this.network.getScale() * 1.8, 4),
      animation: { duration: 400, easingFunction: 'easeInOutQuad' },
    });
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
