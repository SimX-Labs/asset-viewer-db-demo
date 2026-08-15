// orbit-viewer-host.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrbitViewerService } from '../../services/orbit-viewer.service';
import { OrbitViewerModalComponent } from '../orbit-viewer-modal/orbit-viewer-modal.component';
import { OrbitBrowserModalComponent } from '../orbit-browser-modal/orbit-browser-modal.component';

/**
 * Mounted once at the app root. Renders the orbit modal and error toast based
 * on OrbitViewerService state, so any component can trigger the viewer.
 */
@Component({
  selector: 'app-orbit-viewer-host',
  standalone: true,
  imports: [CommonModule, OrbitViewerModalComponent, OrbitBrowserModalComponent],
  template: `
    @if (viewer.busy()) {
      <div class="orbit-toast orbit-toast--info" role="status">Loading orbit capture…</div>
    }

    @if (viewer.error(); as err) {
      <div class="orbit-toast orbit-toast--error" role="alert">
        {{ err }}
        <button type="button" class="orbit-toast-dismiss" (click)="viewer.error.set(null)">
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </div>
    }

    @if (viewer.browserOpen()) {
      <app-orbit-browser-modal />
    }

    @if (viewer.bundle(); as bundle) {
      <app-orbit-viewer-modal [bundle]="bundle" (close)="viewer.close()" />
    }
  `,
  styles: [
    `
      .orbit-toast {
        position: fixed;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1100;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: min(560px, 92vw);
        padding: 10px 14px;
        color: #fff;
        border-radius: var(--radius-default, 4px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      }
      .orbit-toast--error {
        background: var(--simx-red, #e31f2f);
      }
      .orbit-toast--info {
        background: var(--simx-clinical-indigo, #0f2d5b);
      }
      .orbit-toast-dismiss {
        display: inline-flex;
        align-items: center;
        border: none;
        background: transparent;
        color: #fff;
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
      }
    `,
  ],
})
export class OrbitViewerHostComponent {
  readonly viewer = inject(OrbitViewerService);
}
