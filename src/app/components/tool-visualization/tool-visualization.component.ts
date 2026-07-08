import {
  Component,
  Input,
  OnDestroy,
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
                (click)="highlightTool(node.tool.ToolId)"
              >
                @if (node.tool.Children?.length) {
                  <span
                    class="tool-node-item-toggle"
                    [class.expanded]="!collapsedIds().has(node.tool.ToolId)"
                    [class.collapsed]="collapsedIds().has(node.tool.ToolId)"
                    (click)="toggleNode($event, node.tool.ToolId)"
                  ></span>
                } @else {
                  <span class="toggle-spacer"></span>
                }
                {{ node.tool.ToolId }}
                @if (node.tool.Children?.length) {
                  ({{ node.tool.Children!.length }})
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
        gap: 12px;
        min-height: 400px;
      }
      .tool-visualization-left {
        width: 40%;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .tool-visualization-right {
        flex: 1;
        position: relative;
      }
      .tool-search-input {
        width: 100%;
        box-sizing: border-box;
        padding: 6px 10px;
        border: 1px solid var(--border);
        border-radius: 4px;
        background: var(--bg-input);
        color: var(--text-main);
        font-family: var(--font-body);
      }
      .tool-hierarchy-list {
        list-style: none;
        margin: 0;
        padding: 0;
        overflow-y: auto;
        max-height: 360px;
      }
      .tool-node-item {
        padding: 6px 8px;
        cursor: pointer;
        font-size: var(--text-caption);
        display: flex;
        align-items: center;
        gap: 4px;
        border-radius: 3px;
      }
      .tool-node-item:hover,
      .tool-node-item.active {
        background: var(--bg-hover);
      }
      .tool-node-item-toggle {
        width: 12px;
        height: 12px;
        display: inline-block;
        cursor: pointer;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-top: 6px solid var(--text-muted);
        transition: transform 0.2s;
      }
      .tool-node-item-toggle.expanded {
        transform: rotate(90deg);
      }
      .toggle-spacer {
        display: inline-block;
        width: 12px;
      }
      .tool-back-button {
        margin-bottom: 8px;
        padding: 4px 10px;
        background: var(--accent);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: var(--font-body);
        font-size: var(--text-caption);
      }
      .tool-graph {
        width: 100%;
        height: 360px;
        background: var(--bg-graph);
        border-radius: 4px;
      }
    `,
  ],
})
export class ToolVisualizationComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) asset!: DboAsset;
  @ViewChild('graphContainer') graphContainer!: ElementRef<HTMLDivElement>;

  private readonly state = inject(AppStateService);
  private network: Network | null = null;

  searchText = '';
  readonly selectedToolId = signal<string | null>(null);
  readonly drillRootId = signal<string | null>(null);
  readonly collapsedIds = signal(new Set<string>());

  readonly visibleNodes = signal<{ tool: ToolNode; level: number }[]>([]);

  ngAfterViewInit(): void {
    this.rebuildList();
    setTimeout(() => this.renderGraph(), 0);
  }

  ngOnDestroy(): void {
    this.network?.destroy();
  }

  onSearchChange(): void {
    this.rebuildList();
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
    this.network?.focus(toolId, {
      scale: 1.0,
      animation: { duration: 500, easingFunction: 'easeInOutQuad' },
    });
    this.network?.selectNodes([toolId]);
  }

  backToRoot(): void {
    this.drillRootId.set(null);
    this.renderGraph();
  }

  private rebuildList(): void {
    const roots = this.asset.ToolHierarchyData?.Roots ?? [];
    const filter = this.searchText.toLowerCase();
    const collapsed = this.collapsedIds();
    const nodes: { tool: ToolNode; level: number }[] = [];

    const walk = (tools: ToolNode[], level: number): boolean => {
      let branchMatch = false;
      for (const tool of tools) {
        const selfMatch = !filter || tool.ToolId.toLowerCase().includes(filter);
        let childMatch = false;
        if (tool.Children?.length && !collapsed.has(tool.ToolId)) {
          childMatch = walk(tool.Children, level + 1);
        } else if (tool.Children?.length && filter) {
          childMatch = tool.Children.some((c) => this.subtreeMatches(c, filter));
        }
        if (selfMatch || childMatch) {
          nodes.push({ tool, level });
          branchMatch = true;
        }
      }
      return branchMatch;
    };

    walk(roots, 0);
    this.visibleNodes.set(nodes);
  }

  private subtreeMatches(tool: ToolNode, filter: string): boolean {
    if (tool.ToolId.toLowerCase().includes(filter)) return true;
    return tool.Children?.some((c) => this.subtreeMatches(c, filter)) ?? false;
  }

  private renderGraph(rootToolId: string | null = null): void {
    if (!this.graphContainer) return;
    const hierarchy = this.asset.ToolHierarchyData;
    if (!hierarchy?.Roots) return;

    this.network?.destroy();
    const nodes = new DataSet<any>();
    const edges = new DataSet<any>();
    const displayed = new Set<string>();
    const positionScale = 50;

    const processNode = (tool: ToolNode, isRootOfView = false, parentId: string | null = null) => {
      if (displayed.has(tool.ToolId)) return;
      displayed.add(tool.ToolId);

      let x = tool.Position ? tool.Position.x * positionScale : 0;
      let y = tool.Position ? tool.Position.z * positionScale : 0;

      nodes.add({
        id: tool.ToolId,
        label: `${tool.ToolId.split('.').pop()}\n(${tool.Children?.length ?? 0})`,
        title: `ID: ${tool.ToolId}`,
        shape: 'circle',
        value: (tool.Children?.length ?? 0) + 1,
        x,
        y,
        color: {
          background: isRootOfView ? '#007cc0' : '#4daafc',
          border: isRootOfView ? '#0f2d5b' : '#007cc0',
          highlight: { background: '#e31f2f', border: '#c41a28' },
        },
        font: { color: 'white', size: 12 },
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

      tool.Children?.forEach((child) => processNode(child, false, tool.ToolId));
    };

    const drillId = rootToolId ?? this.drillRootId();
    if (drillId) {
      const findAndProcess = (tools: ToolNode[]): boolean => {
        for (const tool of tools) {
          if (tool.ToolId === drillId) {
            processNode(tool, true);
            return true;
          }
          if (tool.Children?.length && findAndProcess(tool.Children)) return true;
        }
        return false;
      };
      findAndProcess(hierarchy.Roots);
    } else {
      hierarchy.Roots.forEach((root) => processNode(root, true));
    }

    this.network = new Network(
      this.graphContainer.nativeElement,
      { nodes, edges },
      {
        physics: { enabled: false },
        interaction: { hover: true, selectNodes: true, dragNodes: true, zoomView: true, dragView: true },
        nodes: { borderWidth: 2, scaling: { min: 10, max: 30, label: { enabled: true, min: 10, max: 20 } } },
      }
    );

    this.network.once('afterDrawing', () => {
      this.network?.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
    });

    this.network.on('click', (params) => {
      if (params.nodes.length > 0) {
        const clickedId = params.nodes[0] as string;
        const tool = this.state.allToolsMap()[clickedId];
        if (tool?.Children?.length) {
          this.drillRootId.set(clickedId);
          this.renderGraph(clickedId);
        }
      }
    });
  }
}
