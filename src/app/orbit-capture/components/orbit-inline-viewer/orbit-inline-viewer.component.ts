// orbit-inline-viewer.component.ts
import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrbitCaptureBundle } from '../../models/orbit-manifest';
import { OrbitViewerService } from '../../services/orbit-viewer.service';
import { OrbitHttpCaptureService } from '../../services/orbit-http-capture.service';
import { OrbitSessionState } from '../../services/orbit-session-state';
import { OrbitTurntableComponent } from '../orbit-turntable/orbit-turntable.component';
import { localFolderDataEnabled } from '../../../utils/runtime-host.util';

type InlineStatus = 'idle' | 'loading' | 'ready' | 'blocked' | 'none';

/**
 * Inline, page-embedded orbit/model viewer (Wikipedia-infobox style). Resolves a
 * capture by addressable from the configured models root and shows the GLB inline.
 * Renders nothing when no models folder is set or no matching capture/model exists.
 *
 * Expand fills the detail panel only so the asset list stays usable for browsing.
 */
@Component({
  selector: 'app-orbit-inline-viewer',
  standalone: true,
  imports: [CommonModule, OrbitTurntableComponent],
  host: {
    // Parent layouts key off this (not inner .model-infobox) so encapsulation
    // still sees whether a capture actually rendered.
    '[class.has-infobox]': 'status() !== "none" || diagnostic',
  },
  template: `
    @if (status() !== 'none' || diagnostic) {
      <figure
        class="model-infobox"
        [class.expanded]="expanded()"
        [ngStyle]="expandedStyle()"
      >
        @if (status() === 'ready' && bundle()) {
          <app-orbit-turntable
            [bundle]="bundle()!"
            [preferModel]="true"
            [showToolbar]="false"
            [showSpinControls]="showControls"
            [showExpandButton]="showControls"
            [expanded]="expanded()"
            (expand)="toggleExpanded()"
          />
        } @else if (status() === 'loading') {
          <div class="infobox-note">Loading 3D model…</div>
        } @else if (status() === 'blocked') {
          <div class="infobox-note">
            <button type="button" class="infobox-btn" (click)="grant()">
              Load 3D model
            </button>
            <span class="infobox-hint">{{
              reason() || 'Grant access to the models folder.'
            }}</span>
          </div>
        } @else if (diagnostic) {
          <div class="infobox-note">
            <span class="infobox-hint">{{
              reason() || 'No 3D model available.'
            }}</span>
          </div>
        }
      </figure>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      :host:not(:has(.model-infobox)) {
        display: none;
      }
      .model-infobox {
        position: relative;
        width: 100%;
        height: 100%;
        aspect-ratio: 1 / 1;
        margin: 0;
        padding: 0;
        border: 1px solid var(--border, #b2bfd9);
        border-radius: var(--radius-heavy, 8px);
        background: var(--bg-panel, #f0f2f4);
        box-sizing: border-box;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        isolation: isolate;
      }
      .model-infobox.expanded {
        aspect-ratio: auto;
        border-radius: 0;
        border: none;
        background: var(--bg-main, #0b1220);
        z-index: 40;
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
      .infobox-note {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 120px;
        height: 100%;
        text-align: center;
        color: var(--text-muted, #6b7280);
        font-size: var(--text-caption, 12px);
      }
      .infobox-btn {
        font: inherit;
        padding: 6px 12px;
        border: none;
        border-radius: var(--radius-default, 4px);
        background: var(--accent, #007cc0);
        color: rgba(255, 255, 255, 0.95);
        cursor: pointer;
        font-family: var(--font-graphic, sans-serif);
        font-weight: 500;
      }
      @media (max-width: 720px) {
        .model-infobox:not(.expanded) {
          width: 100%;
        }
      }
    `,
  ],
})
export class OrbitInlineViewerComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) addressable!: string;
  /** Show why no model rendered instead of hiding silently (embeds/pickers). */
  @Input() diagnostic = false;
  /**
   * Overlay chrome (spin speed, pause/play, expand). Off for compact
   * scenario-creator thumbnails; on for the full detail-panel infobox.
   */
  @Input() showControls = true;

  private readonly viewer = inject(OrbitViewerService);
  private readonly http = inject(OrbitHttpCaptureService);
  private readonly session = inject(OrbitSessionState);
  private readonly host = inject(ElementRef<HTMLElement>);
  private lastRootRevision = 0;

  readonly status = signal<InlineStatus>('none');
  /** Why the viewer is not showing a model; surfaced when `diagnostic` is set. */
  readonly reason = signal<string>('');
  readonly bundle = signal<OrbitCaptureBundle | null>(null);
  readonly expanded = this.session.panelExpanded;
  readonly expandedStyle = signal<Record<string, string> | null>(null);

  private panelRo?: ResizeObserver;

  constructor() {
    effect(() => {
      const rev = this.http.rootRevision();
      if (rev === this.lastRootRevision) return;
      this.lastRootRevision = rev;
      if (this.addressable) void this.resolve();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['addressable']) {
      this.reset();
      void this.resolve();
    }
  }

  ngOnDestroy(): void {
    this.teardownPanelObserver();
    this.reset();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.expanded()) this.syncExpandedBounds();
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.collapse();
  }

  async grant(): Promise<void> {
    try {
      if (await this.viewer.requestRootAccess()) {
        await this.load();
        return;
      }
      this.reason.set('Access to the models folder was denied.');
    } catch (e) {
      // Cross-origin iframes cannot prompt for file system access.
      this.reason.set(
        e instanceof Error
          ? e.message
          : 'Could not request folder access here.',
      );
    }
  }

  toggleExpanded(): void {
    if (this.expanded()) {
      this.collapse();
      return;
    }
    this.session.panelExpanded.set(true);
    this.syncExpandedBounds();
    this.observeDetailPanel();
  }

  /**
   * Single exit path for expanded mode. The fixed-position bounds are inline
   * styles, so clearing the flag without clearing them leaves the infobox
   * pinned over the panel.
   */
  private collapse(): void {
    if (!this.expanded()) return;
    this.session.panelExpanded.set(false);
    this.expandedStyle.set(null);
    this.teardownPanelObserver();
  }

  private async resolve(): Promise<void> {
    if (!this.addressable) {
      this.fail('This asset has no addressable key to look up.');
      return;
    }

    // Hosted empty viewer: a picked folder wins when it is already readable.
    // Localhost always uses HTTP so a stale IndexedDB handle cannot shadow the
    // API manifests (container / tool-state toggles live there).
    const localReady =
      localFolderDataEnabled() &&
      this.viewer.supported &&
      this.viewer.hasRoot &&
      (await this.viewer.isRootReadable());

    if (localReady) {
      await this.load('local');
      return;
    }

    if (this.http.configured) {
      await this.load('http');
      return;
    }

    if (localFolderDataEnabled() && this.viewer.hasRoot) {
      // Folder set but not yet readable this session — offer a one-click grant.
      this.reason.set('Grant access to the models folder.');
      this.status.set('blocked');
      return;
    }

    this.fail('No models folder or models server is configured.');
  }

  private async load(source: 'local' | 'http' = 'local'): Promise<void> {
    this.status.set('loading');
    try {
      const bundle =
        source === 'http'
          ? await this.http.loadBundle(this.addressable)
          : await this.viewer.loadEntry(this.addressable);
      // Infobox is GLB-focused: hide when the capture has no model.
      if (!bundle.modelUrl) {
        bundle.revoke();
        this.fail(`Capture "${this.addressable}" has no .glb model.`);
        return;
      }
      this.bundle.set(bundle);
      this.reason.set('');
      this.status.set('ready');
      if (this.expanded()) {
        // Recreated after asset switch while still expanded — reattach bounds.
        queueMicrotask(() => {
          this.syncExpandedBounds();
          this.observeDetailPanel();
        });
      }
    } catch (e) {
      // No matching folder / manifest — just don't show an infobox.
      this.fail(
        e instanceof Error
          ? e.message
          : `No capture folder named "${this.addressable}".`,
      );
    }
  }

  /** Record why nothing rendered, then collapse to the hidden/diagnostic state. */
  private fail(reason: string): void {
    this.reason.set(reason);
    this.status.set('none');
    this.exitExpandedIfNeeded();
  }

  private reset(): void {
    this.bundle()?.revoke();
    this.bundle.set(null);
    this.reason.set('');
    this.status.set('none');
  }

  private exitExpandedIfNeeded(): void {
    this.collapse();
  }

  private detailPanelEl(): HTMLElement | null {
    return this.host.nativeElement.closest('.detail-panel');
  }

  private syncExpandedBounds(): void {
    if (!this.expanded()) {
      this.expandedStyle.set(null);
      return;
    }
    const panel = this.detailPanelEl();
    if (!panel) {
      this.expandedStyle.set(null);
      return;
    }
    const r = panel.getBoundingClientRect();
    this.expandedStyle.set({
      position: 'fixed',
      top: `${Math.round(r.top)}px`,
      left: `${Math.round(r.left)}px`,
      width: `${Math.round(r.width)}px`,
      height: `${Math.round(r.height)}px`,
    });
  }

  private observeDetailPanel(): void {
    this.teardownPanelObserver();
    const panel = this.detailPanelEl();
    if (!panel) return;
    this.panelRo = new ResizeObserver(() => this.syncExpandedBounds());
    this.panelRo.observe(panel);
  }

  private teardownPanelObserver(): void {
    this.panelRo?.disconnect();
    this.panelRo = undefined;
  }
}
