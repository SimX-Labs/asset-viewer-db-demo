// orbit-open-button.component.ts
import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrbitViewerService } from '../../services/orbit-viewer.service';

/**
 * Top-bar control for orbit captures: configure the models root folder (used for
 * per-tool lookup by addressable) and manually open a single capture folder.
 */
@Component({
  selector: 'app-orbit-open-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dropdown-wrap">
      <button class="orbit-open-btn" (click)="open.set(!open())" title="Orbit captures">
        <i class="pi pi-box btn-icon" aria-hidden="true"></i><span class="btn-label">Orbit</span>
      </button>
      @if (open()) {
        <div class="dropdown-panel">
          <div class="dropdown-title">Models Folder</div>
          @if (viewer.rootName(); as name) {
            <div class="folder-row">
              <span class="folder-name" [title]="name"><i class="pi pi-folder" aria-hidden="true"></i> {{ name }}</span>
              <button class="link-btn" (click)="viewer.clearRootFolder()">Clear</button>
            </div>
          } @else {
            <p class="dropdown-hint">No folder set. Pick a folder whose subfolders are named by tool addressable.</p>
          }
          <button class="dropdown-action" (click)="setRoot()">
            {{ viewer.rootName() ? 'Change models folder…' : 'Set models folder…' }}
          </button>
          @if (viewer.rootName()) {
            <button class="dropdown-action secondary" (click)="browse()">Browse model library…</button>
          }

          <hr />

          <div class="dropdown-title">Manual</div>
          <button class="dropdown-action" (click)="openSingle()">Open single capture…</button>
          <p class="dropdown-hint">Select a folder that directly contains <code>manifest.json</code>.</p>

          @if (!viewer.supported) {
            <hr />
            <p class="dropdown-hint">
              This browser lacks the folder picker; using the file-input fallback.
            </p>
          }
        </div>
      }
    </div>

    <!-- webkitdirectory fallback for browsers without showDirectoryPicker -->
    <input
      #folderInput
      type="file"
      webkitdirectory
      multiple
      hidden
      (change)="onFolderPicked($event)"
    />
  `,
  styles: [
    `
      .dropdown-wrap {
        position: relative;
      }
      /* Match Scenario Creator's glass icon-button treatment on app chrome. */
      .orbit-open-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2, 6px);
        background: transparent;
        border: none;
        color: var(--header-text, #fff);
        padding: 8px 12px;
        cursor: pointer;
        border-radius: var(--radius-sm, 4px);
        font-family: var(--font-graphic, sans-serif);
        font-size: var(--text-copy, 16px);
        font-weight: 500;
        transition: background 0.2s;
      }
      .orbit-open-btn:hover {
        background: var(--header-btn-hover, rgba(255, 255, 255, 0.12));
      }
      .orbit-open-btn .btn-icon {
        font-size: 17px;
        line-height: 1;
      }
      .folder-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 4px 0;
      }
      .folder-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: var(--font-mono, monospace);
        font-size: var(--text-caption, 12px);
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .link-btn {
        border: none;
        background: transparent;
        color: var(--link, #007cc0);
        cursor: pointer;
        font: inherit;
        padding: 0;
      }
      /* Dropdown styles (scoped copy of the top-bar look). */
      .dropdown-panel {
        position: absolute;
        top: calc(100% + var(--space-2, 8px));
        right: 0;
        background: var(--bg-main, #fff);
        color: var(--text-main, #18171d);
        border: 1px solid var(--border, #b2bfd9);
        border-radius: var(--radius-heavy, 8px);
        padding: var(--space-4, 16px);
        min-width: 260px;
        z-index: 200;
        box-shadow: var(--shadow-dropdown);
      }
      .dropdown-title {
        font-family: var(--font-graphic, sans-serif);
        font-weight: 600;
        font-size: var(--text-caption, 12px);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: var(--space-3, 12px);
        color: var(--text-label, #007cc0);
      }
      .dropdown-action {
        width: 100%;
        text-align: left;
        background: var(--accent, #007cc0);
        color: rgba(255, 255, 255, 0.95);
        border: none;
        cursor: pointer;
        padding: 8px 12px;
        font-family: var(--font-graphic, sans-serif);
        font-size: var(--text-copy, 16px);
        font-weight: 500;
        border-radius: var(--radius-default, 4px);
        transition: background 0.2s;
      }
      .dropdown-action:hover {
        background: var(--accent-hover, #00669e);
      }
      .dropdown-action.secondary {
        margin-top: var(--space-2, 8px);
        background: var(--simx-clinical-indigo, #0f2d5b);
      }
      .dropdown-hint {
        margin: var(--space-2, 8px) 0 0;
        font-size: var(--text-caption, 12px);
        color: var(--text-muted, #6b7280);
        line-height: var(--leading-caption, 16px);
      }
      hr {
        border: none;
        border-top: 1px solid var(--border-light, #e0e4ee);
        margin: var(--space-3, 12px) 0;
      }
    `,
  ],
})
export class OrbitOpenButtonComponent {
  readonly viewer = inject(OrbitViewerService);
  readonly open = signal(false);

  @ViewChild('folderInput') folderInput?: ElementRef<HTMLInputElement>;

  async setRoot(): Promise<void> {
    await this.viewer.setRootFolder();
    this.open.set(false);
  }

  async browse(): Promise<void> {
    this.open.set(false);
    await this.viewer.openBrowser();
  }

  async openSingle(): Promise<void> {
    this.open.set(false);
    if (this.viewer.supported) {
      await this.viewer.openSingleFolder();
    } else {
      this.folderInput?.nativeElement.click();
    }
  }

  async onFolderPicked(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    try {
      if (input.files?.length) await this.viewer.openFromFileList(input.files);
    } finally {
      input.value = '';
    }
  }
}
