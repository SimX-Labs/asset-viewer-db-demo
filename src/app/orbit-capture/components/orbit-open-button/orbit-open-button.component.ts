// orbit-open-button.component.ts
import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrbitViewerService } from '../../services/orbit-viewer.service';
import {
  OrbitHttpCaptureService,
  OrbitModelsRoot,
} from '../../services/orbit-http-capture.service';
import { localFolderDataEnabled } from '../../../utils/runtime-host.util';

/**
 * Top-bar control for orbit captures.
 *
 * Hosted empty viewer: pick a local models folder via the File System Access API.
 * Localhost: the API serves GLBs, so this switches the API's folder (EXPORT vs
 * the stale public/models copy) instead of picking a browser handle.
 */
@Component({
  selector: 'app-orbit-open-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dropdown-wrap">
      <button class="orbit-open-btn" (click)="toggleOpen()" title="Orbit captures">
        <i class="pi pi-box btn-icon" aria-hidden="true"></i><span class="btn-label">Orbit</span>
      </button>
      @if (open()) {
        <div class="dropdown-panel">
          @if (localFolderEnabled) {
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
          } @else if (http.configured) {
            <div class="dropdown-title">3D models folder</div>
            <p class="dropdown-hint">
              Localhost loads GLBs from the API, not directly from Unity.
              An older copy at <code>public/models</code> has tools; newer
              character / body / overlay captures live in the env-authoring export.
            </p>
            @if (loadError()) {
              <p class="dropdown-hint error">{{ loadError() }}</p>
            } @else if (!root()) {
              <p class="dropdown-hint">Loading folder info…</p>
            } @else {
              <p class="folder-path" [title]="root()!.dir">{{ root()!.dir }}</p>
              <p class="dropdown-hint">
                {{ root()!.count }} published captures
              </p>
              @if (root()!.staleHint) {
                <p class="dropdown-hint warn">{{ root()!.staleHint }}</p>
              }
              @for (suggestion of root()!.suggestions; track suggestion.id) {
                @if (suggestion.exists) {
                  <button
                    type="button"
                    class="dropdown-action"
                    [class.secondary]="!suggestion.current && suggestion.id !== 'export'"
                    [disabled]="busy() || suggestion.current"
                    (click)="useDir(suggestion.dir)"
                  >
                    @if (suggestion.current) {
                      Using {{ suggestion.label }}
                    } @else {
                      Use {{ suggestion.label }}
                    }
                  </button>
                  <p class="dropdown-hint">
                    {{ suggestion.count }} folders.
                    {{ suggestion.hint }}
                  </p>
                }
              }
              <hr />
              <div class="dropdown-title">Custom path</div>
              <input
                class="path-input"
                [value]="customDir()"
                (input)="customDir.set($any($event.target).value)"
                placeholder="Paste an OrbitCaptures/EXPORT folder path"
                spellcheck="false"
              />
              <button
                type="button"
                class="dropdown-action secondary"
                [disabled]="busy() || !customDir().trim()"
                (click)="useDir(customDir())"
              >
                Use this path
              </button>
            }
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
      .folder-name,
      .folder-path {
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
      .folder-path {
        display: block;
        margin: 0 0 4px;
        white-space: normal;
        word-break: break-all;
        line-height: 1.35;
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
        min-width: 280px;
        max-width: 420px;
        max-height: calc(100vh - var(--header-height, 56px) - 16px);
        overflow-x: hidden;
        overflow-y: auto;
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
        margin-top: var(--space-2, 8px);
      }
      .dropdown-action:hover:not(:disabled) {
        background: var(--accent-hover, #00669e);
      }
      .dropdown-action:disabled {
        opacity: 0.55;
        cursor: default;
      }
      .dropdown-action.secondary {
        background: var(--simx-clinical-indigo, #0f2d5b);
      }
      .dropdown-hint {
        margin: var(--space-2, 8px) 0 0;
        font-size: var(--text-caption, 12px);
        color: var(--text-muted, #6b7280);
        line-height: var(--leading-caption, 16px);
      }
      .dropdown-hint.warn {
        color: var(--text-main, #18171d);
      }
      .dropdown-hint.error {
        color: var(--error, #ca1928);
      }
      .path-input {
        width: 100%;
        box-sizing: border-box;
        margin-top: var(--space-2, 8px);
        padding: 6px 8px;
        font-family: var(--font-mono, monospace);
        font-size: var(--text-caption, 12px);
        border: 1px solid var(--border, #b2bfd9);
        border-radius: var(--radius-default, 4px);
        background: var(--bg-panel, #f0f2f4);
        color: var(--text-main, #18171d);
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
  readonly http = inject(OrbitHttpCaptureService);
  readonly open = signal(false);
  readonly busy = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly customDir = signal('');
  readonly localFolderEnabled = localFolderDataEnabled();

  @ViewChild('folderInput') folderInput?: ElementRef<HTMLInputElement>;

  root(): OrbitModelsRoot | null {
    return this.http.root();
  }

  toggleOpen(): void {
    const next = !this.open();
    this.open.set(next);
    if (next && !this.localFolderEnabled && this.http.configured) {
      void this.refreshRoot();
    }
  }

  private async refreshRoot(): Promise<void> {
    this.loadError.set(null);
    try {
      const info = await this.http.loadRoot();
      if (!this.customDir().trim()) this.customDir.set(info.dir);
    } catch (e) {
      this.loadError.set(
        this.httpErrorMessage(
          e,
          'Could not read the models folder from the API. Is it running on port 4301?',
        ),
      );
    }
  }

  async useDir(dir: string): Promise<void> {
    this.busy.set(true);
    this.loadError.set(null);
    try {
      const info = await this.http.setRoot(dir);
      this.customDir.set(info.dir);
    } catch (e) {
      this.loadError.set(
        this.httpErrorMessage(e, 'Failed to switch the models folder.'),
      );
    } finally {
      this.busy.set(false);
    }
  }

  private httpErrorMessage(e: unknown, fallback: string): string {
    if (e && typeof e === 'object' && 'error' in e) {
      const body = (e as { error?: { message?: string } }).error;
      if (typeof body?.message === 'string' && body.message.trim()) {
        return body.message;
      }
    }
    return e instanceof Error ? e.message : fallback;
  }

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
