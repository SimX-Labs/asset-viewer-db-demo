import { Component, Input, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { Network, DataSet } from 'vis-network/standalone';
import { DboAsset } from '../../models/dbo.models';
import { wrapText } from '../../utils/property.util';

@Component({
  selector: 'app-procedure-graph',
  standalone: true,
  template: `<div #graphContainer class="procedure-graph"></div>`,
  styles: [
    `
      .procedure-graph {
        width: 100%;
        height: 500px;
        background: var(--bg-graph);
        border: 1px solid var(--border-light);
        border-radius: var(--radius-md);
      }
    `,
  ],
})
export class ProcedureGraphComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) asset!: DboAsset;
  @ViewChild('graphContainer') graphContainer!: ElementRef<HTMLDivElement>;

  private network: Network | null = null;

  ngAfterViewInit(): void {
    setTimeout(() => this.render(), 0);
  }

  ngOnDestroy(): void {
    this.network?.destroy();
  }

  private render(): void {
    const stateMap = this.asset.Data?.['StateMap'] as {
      States?: {
        Id: string;
        StateType?: number;
        ValidTransitions?: {
          ResultingStateId: string;
          ValidMessageTriggers?: string[];
          RequiredInteractions?: {
            InteractionTypeId: string;
            validInteractionReceiverIds?: string[];
          }[];
        }[];
      }[];
    };
    if (!stateMap?.States || !this.graphContainer) return;

    const nodes = new DataSet<any>();
    const edges = new DataSet<any>();

    const colorStandard = { background: '#dce0e5', border: '#9aa8bc' };
    const colorFailure = { background: '#fca5a5', border: '#e31f2f' };
    const colorSuccess = { background: '#86efac', border: '#15803d' };
    const colorStart = { background: '#007cc0', border: '#0f2d5b' };

    stateMap.States.forEach((state, index) => {
      let color = colorStandard;
      if (index === 0) color = colorStart;
      else if (state.StateType === 1) color = colorFailure;
      else if (state.StateType === 2) color = colorSuccess;

      nodes.add({
        id: state.Id,
        label: state.Id.replace('state_', ''),
        color,
        shape: 'box',
        font: { color: index === 0 ? '#ffffff' : '#091d3c', size: 14, face: 'Lato', strokeWidth: 0 },
        margin: 10,
        shadow: { enabled: true, color: 'rgba(0,0,0,0.2)', size: 5, x: 2, y: 2 },
      });

      state.ValidTransitions?.forEach((trans) => {
        let label = '';
        if (trans.ValidMessageTriggers?.length) {
          label = trans.ValidMessageTriggers.join('\n');
        } else if (trans.RequiredInteractions?.length) {
          label = trans.RequiredInteractions.map((i) => {
            let text = i.InteractionTypeId;
            if (i.validInteractionReceiverIds?.length) {
              text += ' ' + i.validInteractionReceiverIds.join(' or ');
            }
            return wrapText(text, 20);
          }).join('\n\n');
        }

        edges.add({
          from: state.Id,
          to: trans.ResultingStateId,
          arrows: { to: { enabled: true, scaleFactor: 1 } },
          label,
          font: {
            align: 'horizontal',
            size: 11,
            color: '#e4e4e7',
            background: '#121212',
            strokeWidth: 0,
          },
          color: { color: '#71717a', highlight: '#007cc0' },
          smooth: { type: 'curvedCW', roundness: 0.2 },
        });
      });
    });

    this.network = new Network(
      this.graphContainer.nativeElement,
      { nodes, edges },
      {
        layout: {
          hierarchical: {
            enabled: true,
            direction: 'UD',
            sortMethod: 'directed',
            levelSeparation: 200,
            nodeSpacing: 300,
            treeSpacing: 300,
            blockShifting: true,
            edgeMinimization: true,
            parentCentralization: true,
          },
        },
        physics: false,
        interaction: { dragNodes: true, zoomView: true, dragView: true },
      }
    );

    this.network.once('stabilizationIterationsDone', () => {
      this.network?.fit({ animation: { duration: 1000, easingFunction: 'easeInOutQuad' } });
      this.network?.setOptions({ layout: { hierarchical: { enabled: false } } });
    });
    setTimeout(() => this.network?.fit(), 500);
  }
}
