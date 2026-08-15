// orbit-viewer-modal.component.ts
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrbitCaptureBundle } from '../../models/orbit-manifest';
import { OrbitTurntableComponent } from '../orbit-turntable/orbit-turntable.component';

@Component({
  selector: 'app-orbit-viewer-modal',
  standalone: true,
  imports: [CommonModule, OrbitTurntableComponent],
  template: `
    <div class="orbit-backdrop" (click)="onBackdrop($event)">
      <div class="orbit-dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <header class="orbit-dialog-head">
          <h2 class="orbit-dialog-title">
            {{ bundle.manifest.addressableKey || 'Orbit capture' }}
          </h2>
          <button type="button" class="orbit-close" title="Close (Esc)" (click)="close.emit()">
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        </header>
        <div class="orbit-dialog-body">
          <app-orbit-turntable [bundle]="bundle" [preferModel]="true" />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .orbit-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--overlay, rgba(0, 0, 0, 0.6));
        padding: 16px;
      }
      .orbit-dialog {
        display: flex;
        flex-direction: column;
        width: 96vw;
        height: 94vh;
        background: var(--bg-card, #fff);
        color: var(--text-main, #18171d);
        border-radius: var(--radius-heavy, 8px);
        box-shadow: var(--shadow-dialog);
        overflow: hidden;
        border: 4px solid var(--simx-clinical-indigo, #0f2d5b);
      }
      .orbit-dialog-head {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.25);
        background: var(--bg-header, #091d3c);
        color: rgba(255, 255, 255, 0.95);
      }
      .orbit-dialog-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        text-transform: uppercase;
        font-family: var(--font-graphic, sans-serif);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        border-left: 5px solid var(--simx-red, #e31f2f);
        padding-left: 12px;
      }
      .orbit-close {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: transparent;
        color: rgba(255, 255, 255, 0.95);
        font-size: 16px;
        line-height: 1;
        cursor: pointer;
        padding: 6px 8px;
        border-radius: var(--radius-default, 4px);
      }
      .orbit-close:hover {
        background: rgba(255, 255, 255, 0.15);
      }
      .orbit-dialog-body {
        flex: 1;
        min-height: 0;
        padding: 0 16px 16px;
        display: flex;
        flex-direction: column;
      }
      .orbit-dialog-body app-orbit-turntable {
        flex: 1;
        min-height: 0;
      }
    `,
  ],
})
export class OrbitViewerModalComponent {
  @Input({ required: true }) bundle!: OrbitCaptureBundle;
  @Output() close = new EventEmitter<void>();

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }

  onBackdrop(_event: MouseEvent): void {
    this.close.emit();
  }
}
