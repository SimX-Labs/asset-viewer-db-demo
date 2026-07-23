// orbit-inline-viewer.component.ts
import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrbitCaptureBundle } from '../../models/orbit-manifest';
import { OrbitViewerService } from '../../services/orbit-viewer.service';
import { OrbitTurntableComponent } from '../orbit-turntable/orbit-turntable.component';

type InlineStatus = 'idle' | 'loading' | 'ready' | 'blocked' | 'none';

/**
 * Inline, page-embedded orbit/model viewer (Wikipedia-infobox style). Resolves a
 * capture by addressable from the configured models root and shows the GLB inline.
 * Renders nothing when no models folder is set or no matching capture/model exists.
 */
@Component({
  selector: 'app-orbit-inline-viewer',
  standalone: true,
  imports: [CommonModule, OrbitTurntableComponent],
  template: `
    @if (status() !== 'none') {
      <figure class="model-infobox">
        @if (status() === 'ready' && bundle()) {
          <button
            type="button"
            class="fullscreen-btn"
            title="Open full-screen"
            (click)="openFullscreen()"
          >⛶</button>
          <app-orbit-turntable [bundle]="bundle()!" [preferModel]="true" [showToolbar]="false" />
        } @else if (status() === 'loading') {
          <div class="infobox-note">Loading 3D model…</div>
        } @else if (status() === 'blocked') {
          <div class="infobox-note">
            <button type="button" class="infobox-btn" (click)="grant()">Load 3D model</button>
            <span class="infobox-hint">Grant access to the models folder.</span>
          </div>
        }
      </figure>
    }
  `,
  styles: [
    `
      .model-infobox {
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1;
        margin: 0;
        padding: 0;
        border: 1px solid var(--border, #d5d9e2);
        border-radius: var(--radius-lg, 8px);
        background: var(--bg-panel, #f0f2f4);
        box-sizing: border-box;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        isolation: isolate;
      }
      .model-infobox app-orbit-turntable {
        /* Must stay a flex column here: the turntable's inner .viewport relies on
           flex:1 to fill the square. Overriding this to display:block silently
           collapses the canvas to its min-height (~half the box). */
        display: flex;
        flex-direction: column;
        position: absolute;
        inset: 0;
        min-height: 0;
      }
      .fullscreen-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 2;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: var(--radius-default, 4px);
        background: rgba(0, 0, 0, 0.45);
        color: #fff;
        font-size: 16px;
        line-height: 1;
        cursor: pointer;
      }
      .fullscreen-btn:hover {
        background: rgba(0, 0, 0, 0.7);
      }
      .infobox-note {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 120px;
        text-align: center;
        color: var(--text-muted, #6b7280);
        font-size: var(--text-caption, 12px);
      }
      .infobox-btn {
        font: inherit;
        padding: 6px 12px;
        border: none;
        border-radius: var(--radius-default, 4px);
        background: var(--simx-procedure-blue, #007cc0);
        color: #fff;
        cursor: pointer;
      }
      @media (max-width: 720px) {
        .model-infobox {
          width: 100%;
        }
      }
    `,
  ],
})
export class OrbitInlineViewerComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) addressable!: string;

  private readonly viewer = inject(OrbitViewerService);

  readonly status = signal<InlineStatus>('idle');
  readonly bundle = signal<OrbitCaptureBundle | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['addressable']) {
      this.reset();
      void this.resolve();
    }
  }

  ngOnDestroy(): void {
    this.reset();
  }

  async grant(): Promise<void> {
    if (await this.viewer.requestRootAccess()) {
      await this.load();
    }
  }

  /** Open the same capture in the large, near-fullscreen modal. */
  async openFullscreen(): Promise<void> {
    await this.viewer.openByAddressable(this.addressable);
  }

  private async resolve(): Promise<void> {
    if (!this.addressable || !this.viewer.supported || !this.viewer.hasRoot) {
      this.status.set('none');
      return;
    }
    if (await this.viewer.isRootReadable()) {
      await this.load();
    } else {
      // Folder set but not yet readable this session — offer a one-click grant.
      this.status.set('blocked');
    }
  }

  private async load(): Promise<void> {
    this.status.set('loading');
    try {
      const bundle = await this.viewer.loadEntry(this.addressable);
      // Infobox is GLB-focused: hide when the capture has no model.
      if (!bundle.modelUrl) {
        bundle.revoke();
        this.status.set('none');
        return;
      }
      this.bundle.set(bundle);
      this.status.set('ready');
    } catch {
      // No matching folder / manifest — just don't show an infobox.
      this.status.set('none');
    }
  }

  private reset(): void {
    this.bundle()?.revoke();
    this.bundle.set(null);
    this.status.set('idle');
  }
}
