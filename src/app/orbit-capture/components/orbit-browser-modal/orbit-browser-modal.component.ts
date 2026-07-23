// orbit-browser-modal.component.ts
import { Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrbitCaptureBundle } from '../../models/orbit-manifest';
import { OrbitViewerService } from '../../services/orbit-viewer.service';
import { OrbitTurntableComponent } from '../orbit-turntable/orbit-turntable.component';

/**
 * Model-library browser: a searchable list of capture folders on the left and
 * the reused turntable viewer on the right. Owns the lifecycle of the currently
 * selected bundle (revokes blob URLs when switching / closing).
 */
@Component({
  selector: 'app-orbit-browser-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, OrbitTurntableComponent],
  template: `
    <div class="orbit-backdrop" (click)="onBackdrop()">
      <div class="orbit-dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <header class="orbit-dialog-head">
          <h2 class="orbit-dialog-title">
            Model Library <span class="root-name">· {{ viewer.rootName() }}</span>
          </h2>
          <button type="button" class="orbit-close" title="Close (Esc)" (click)="viewer.closeBrowser()">×</button>
        </header>

        <div class="orbit-dialog-body">
          <aside class="library-sidebar">
            <input
              type="text"
              class="library-search"
              placeholder="Search models…"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
            />
            <div class="library-count">{{ filtered().length }} of {{ viewer.captureNames().length }}</div>
            <ul class="library-list">
              @for (name of filtered(); track name) {
                <li>
                  <button
                    type="button"
                    class="library-item"
                    [class.active]="name === selected()"
                    (click)="select(name)"
                    [title]="name"
                  >
                    {{ name }}
                  </button>
                </li>
              } @empty {
                <li class="library-empty">
                  {{ viewer.captureNames().length ? 'No matches.' : 'No model folders found.' }}
                </li>
              }
            </ul>
          </aside>

          <section class="library-viewer">
            @if (loading()) {
              <div class="viewer-note">Loading {{ selected() }}…</div>
            } @else if (error()) {
              <div class="viewer-note error">{{ error() }}</div>
            } @else if (selectedBundle()) {
              <app-orbit-turntable [bundle]="selectedBundle()!" />
            } @else {
              <div class="viewer-note">Select a model from the list to preview it.</div>
            }
          </section>
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
        background: rgba(0, 0, 0, 0.55);
        padding: 16px;
      }
      .orbit-dialog {
        display: flex;
        flex-direction: column;
        width: min(1200px, 96vw);
        height: min(800px, 92vh);
        background: var(--bg-card, #fff);
        color: var(--text-main, #18171d);
        border-radius: var(--radius-heavy, 8px);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        overflow: hidden;
      }
      .orbit-dialog-head {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border, #e0e4ee);
        background: var(--bg-header, #091d3c);
        color: #fff;
      }
      .orbit-dialog-title {
        margin: 0;
        font-size: var(--text-headline-copy, 18px);
        font-family: var(--font-graphic, sans-serif);
      }
      .root-name {
        opacity: 0.7;
        font-family: var(--font-mono, monospace);
        font-size: var(--text-caption, 12px);
      }
      .orbit-close {
        margin-left: auto;
        border: none;
        background: transparent;
        color: #fff;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
        padding: 0 4px;
        border-radius: var(--radius-default, 4px);
      }
      .orbit-close:hover {
        background: rgba(255, 255, 255, 0.15);
      }
      .orbit-dialog-body {
        flex: 1;
        min-height: 0;
        display: flex;
      }
      .library-sidebar {
        width: 280px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        border-right: 1px solid var(--border, #e0e4ee);
        background: var(--bg-panel, #f0f2f4);
        padding: 12px;
        gap: 8px;
      }
      .library-search {
        width: 100%;
        box-sizing: border-box;
        padding: 6px 10px;
        border: 1px solid var(--border, #ccc);
        border-radius: var(--radius-default, 4px);
        background: var(--bg-input, #fff);
        color: var(--text-main, #18171d);
        font: inherit;
      }
      .library-count {
        font-size: var(--text-caption, 12px);
        color: var(--text-muted, #6b7280);
      }
      .library-list {
        list-style: none;
        margin: 0;
        padding: 0;
        overflow-y: auto;
        flex: 1;
      }
      .library-item {
        width: 100%;
        text-align: left;
        border: none;
        background: transparent;
        color: var(--text-main, #18171d);
        padding: 7px 10px;
        border-radius: var(--radius-default, 4px);
        cursor: pointer;
        font: inherit;
        font-size: var(--text-caption, 13px);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .library-item:hover {
        background: var(--bg-hover, rgba(0, 124, 192, 0.08));
      }
      .library-item.active {
        background: var(--simx-procedure-blue, #007cc0);
        color: #fff;
      }
      .library-empty {
        color: var(--text-muted, #6b7280);
        font-size: var(--text-caption, 12px);
        padding: 8px 10px;
        font-style: italic;
      }
      .library-viewer {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        padding: 0 16px 16px;
      }
      .library-viewer app-orbit-turntable {
        flex: 1;
        min-height: 0;
      }
      .viewer-note {
        margin: auto;
        color: var(--text-muted, #6b7280);
        font-size: var(--text-copy, 16px);
        text-align: center;
        padding: 24px;
      }
      .viewer-note.error {
        color: var(--simx-red, #e31f2f);
      }
    `,
  ],
})
export class OrbitBrowserModalComponent implements OnDestroy {
  readonly viewer = inject(OrbitViewerService);

  readonly search = signal('');
  readonly selected = signal<string | null>(null);
  readonly selectedBundle = signal<OrbitCaptureBundle | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const names = this.viewer.captureNames();
    return q ? names.filter((n) => n.toLowerCase().includes(q)) : names;
  });

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.viewer.closeBrowser();
  }

  onBackdrop(): void {
    this.viewer.closeBrowser();
  }

  async select(name: string): Promise<void> {
    if (name === this.selected() && this.selectedBundle()) return;
    this.selected.set(name);
    this.error.set(null);
    this.loading.set(true);
    // Revoke the previous capture's blob URLs before loading the next.
    this.selectedBundle()?.revoke();
    this.selectedBundle.set(null);
    try {
      const bundle = await this.viewer.loadEntry(name);
      this.selectedBundle.set(bundle);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : `Failed to load ${name}.`);
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.selectedBundle()?.revoke();
  }
}
