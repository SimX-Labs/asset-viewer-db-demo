import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Lightweight line-chart preview for waveform dataPoints.
 * Mirrors legacy asset-database `simx-waveform` (Chart.js line, tension ~0.5,
 * no legend) without adding a chart library dependency.
 */
@Component({
  selector: 'app-waveform-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="waveform-chart" [class.empty]="!hasPoints">
      @if (!hasPoints) {
        <div class="empty-note">No data points</div>
      } @else {
        <svg
          class="chart-svg"
          [attr.viewBox]="'0 0 ' + width + ' ' + height"
          preserveAspectRatio="none"
          role="img"
          [attr.aria-label]="'Waveform with ' + points.length + ' samples'"
        >
          <line
            class="axis"
            [attr.x1]="padL"
            [attr.y1]="padT"
            [attr.x2]="padL"
            [attr.y2]="height - padB"
          />
          <line
            class="axis"
            [attr.x1]="padL"
            [attr.y1]="height - padB"
            [attr.x2]="width - padR"
            [attr.y2]="height - padB"
          />
          <path class="trace" [attr.d]="pathD" fill="none" />
        </svg>
        <div class="meta">
          <span>{{ points.length }} samples</span>
          @if (yMin !== yMax) {
            <span>y {{ yMin.toFixed(3) }} – {{ yMax.toFixed(3) }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .waveform-chart {
        width: 100%;
        background: var(--simx-content-lightest, #f0f2f4);
        border: 1px solid var(--simx-content-lighter, #d8dee3);
        border-radius: var(--radius-default, 4px);
        padding: 8px 10px 6px;
      }
      .waveform-chart.empty {
        min-height: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .empty-note {
        font-family: var(--font-graphic, sans-serif);
        font-size: var(--text-caption, 12px);
        color: var(--text-muted, #6b7785);
      }
      .chart-svg {
        display: block;
        width: 100%;
        height: 125px;
      }
      .axis {
        stroke: var(--simx-content-light, #bbc4cd);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      .trace {
        stroke: rgb(56, 84, 101);
        stroke-width: 1.75;
        stroke-linejoin: round;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
      }
      .meta {
        display: flex;
        justify-content: space-between;
        margin-top: 4px;
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        color: var(--text-muted, #6b7785);
      }
    `,
  ],
})
export class WaveformChartComponent implements OnChanges {
  @Input() dataPoints: number[] | null | undefined;

  readonly width = 600;
  readonly height = 125;
  readonly padL = 8;
  readonly padR = 8;
  readonly padT = 10;
  readonly padB = 10;

  points: number[] = [];
  pathD = '';
  yMin = 0;
  yMax = 1;
  hasPoints = false;

  ngOnChanges(_changes: SimpleChanges): void {
    this.rebuild();
  }

  private rebuild(): void {
    const raw = Array.isArray(this.dataPoints) ? this.dataPoints : [];
    this.points = raw.filter((n) => typeof n === 'number' && Number.isFinite(n));
    this.hasPoints = this.points.length > 0;
    if (!this.hasPoints) {
      this.pathD = '';
      return;
    }

    let min = this.points[0];
    let max = this.points[0];
    for (const p of this.points) {
      if (p < min) min = p;
      if (p > max) max = p;
    }
    if (min === max) {
      min -= 0.5;
      max += 0.5;
    }
    this.yMin = min;
    this.yMax = max;

    const plotW = this.width - this.padL - this.padR;
    const plotH = this.height - this.padT - this.padB;
    const n = this.points.length;
    const coords: { x: number; y: number }[] = this.points.map((v, i) => {
      const x = this.padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
      const y = this.padT + (1 - (v - min) / (max - min)) * plotH;
      return { x, y };
    });

    // Catmull-Rom → cubic Bezier approximation (~ Chart.js tension 0.5 feel).
    this.pathD = this.smoothPath(coords, 0.5);
  }

  private smoothPath(
    pts: { x: number; y: number }[],
    tension: number,
  ): string {
    if (pts.length === 0) return '';
    if (pts.length === 1) {
      const p = pts[0];
      return `M ${p.x} ${p.y}`;
    }
    if (pts.length === 2) {
      return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
    }

    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const t = tension;
      const cp1x = p1.x + ((p2.x - p0.x) / 6) * t * 2;
      const cp1y = p1.y + ((p2.y - p0.y) / 6) * t * 2;
      const cp2x = p2.x - ((p3.x - p1.x) / 6) * t * 2;
      const cp2y = p2.y - ((p3.y - p1.y) / 6) * t * 2;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }
}
