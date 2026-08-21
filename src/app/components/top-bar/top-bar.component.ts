import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/app-state.service';
import { ThemeService } from '../../services/theme.service';
import { TagTaxonomyService } from '../../services/tag-taxonomy.service';
import { AuthenticationService } from '../../services/authentication.service';
import { AssetMetaService } from '../../services/asset-meta.service';
import { OrbitOpenButtonComponent } from '../../orbit-capture/components/orbit-open-button/orbit-open-button.component';
import { environment } from '../../environment';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule, OrbitOpenButtonComponent],
  template: `
    <header class="top-bar">
      <div class="top-bar-brand">
        <img
          src="/assets/images/simx-logo-red.png"
          class="brand-logo"
          alt="SimX Logo"
          draggable="false"
        />
        <div class="brand-divider"></div>
        <h1 class="app-title">SimX Asset Database</h1>
        <span class="status" [class.error]="state.statusError()">{{ state.statusMessage() }}</span>
      </div>
      <div class="top-bar-actions">
        <app-orbit-open-button />
        <button
          class="header-btn"
          [class.active]="tagTaxonomy.pageOpen()"
          title="Manage global and type-specific tags"
          (click)="openTags()"
        >
          <i class="pi pi-tags btn-icon" aria-hidden="true"></i>
          <span class="btn-label">Tags</span>
        </button>
        <button class="header-btn" (click)="theme.toggle()" [title]="theme.themeLabel()">
          @if (theme.resolvedTheme() === 'dark') {
            <i class="pi pi-sun btn-icon" aria-hidden="true"></i><span class="btn-label">Light</span>
          } @else {
            <i class="pi pi-moon btn-icon" aria-hidden="true"></i><span class="btn-label">Dark</span>
          }
        </button>
        @if (auth.authConfigured) {
          @if (auth.isAuthenticated()) {
            <div class="auth-user" [title]="auth.displayName()">
              @if (auth.picture(); as pic) {
                <img class="auth-avatar" [src]="pic" alt="" />
              } @else {
                <i class="pi pi-user btn-icon" aria-hidden="true"></i>
              }
              <span class="btn-label auth-name">{{ auth.displayName() }}</span>
            </div>
            <button class="header-btn" title="Log out" (click)="auth.requestLogout()">
              <i class="pi pi-sign-out btn-icon" aria-hidden="true"></i>
              <span class="btn-label">Log Out</span>
            </button>
          } @else {
            <button class="header-btn" title="Log in" (click)="auth.requestLogin()">
              <i class="pi pi-sign-in btn-icon" aria-hidden="true"></i>
              <span class="btn-label">Log In</span>
            </button>
          }
        }
        <div class="dropdown-wrap">
          <button class="header-btn icon-only" (click)="showFiles.set(!showFiles())" title="Loaded files">
            <i class="pi pi-info-circle" aria-hidden="true"></i>
          </button>
          @if (showFiles()) {
            <div class="dropdown-panel">
              <div class="dropdown-title">Loaded Files</div>
              @for (name of state.loadedFileNames(); track name) {
                <div class="dropdown-item">{{ name }}</div>
              } @empty {
                <div class="dropdown-item muted">No files loaded.</div>
              }
            </div>
          }
        </div>
        <div class="dropdown-wrap">
          <button class="header-btn" (click)="showSettings.set(!showSettings())">
            <i class="pi pi-cog btn-icon" aria-hidden="true"></i><span class="btn-label">Settings</span>
          </button>
          @if (showSettings()) {
            <div class="dropdown-panel dropdown-panel--wide dropdown-panel--scroll">
              <div class="dropdown-title">File</div>
              <button class="dropdown-action" (click)="folderInput.click()">Load Unity DB folder...</button>
              <p class="dropdown-hint">
                Select a <code>db/</code> folder (<code>characters/</code>, <code>equipment/</code>,
                <code>tools/</code>). Defaults to the linked Unity asset DB on startup.
              </p>
              <hr />
              <div class="dropdown-title">Tags</div>
              <button
                class="dropdown-action"
                (click)="openTags(); showSettings.set(false)"
              >
                Manage global, custom, and type tags…
              </button>
              <p class="dropdown-hint">
                Opens a dedicated page for global tags, custom overlay tags
                (any asset type), and tags specific to each type. Edits stay
                local until you leave, so the viewer does not reload on every
                change.
              </p>
              @if (meta.canEditMeta()) {
                <hr />
                <div class="dropdown-title">Testing</div>
                <button
                  type="button"
                  class="dropdown-action dropdown-action--danger"
                  [disabled]="meta.savingDraft()"
                  (click)="clearAllMetadata()"
                >
                  Clear all asset metadata…
                </button>
                <p class="dropdown-hint">
                  Deletes curated status, tags, notes, comments, and uploaded
                  media for every asset. ID aliases are kept. For early testing
                  only.
                </p>
              }
              <hr />
              <div class="dropdown-title">Theme</div>
              <label class="setting-option">
                <input
                  type="radio"
                  name="theme"
                  [checked]="theme.preference() === 'system'"
                  (change)="theme.setPreference('system')"
                />
                Follow system
              </label>
              <label class="setting-option">
                <input
                  type="radio"
                  name="theme"
                  [checked]="theme.preference() === 'light'"
                  (change)="theme.setPreference('light')"
                />
                Light
              </label>
              <label class="setting-option">
                <input
                  type="radio"
                  name="theme"
                  [checked]="theme.preference() === 'dark'"
                  (change)="theme.setPreference('dark')"
                />
                Dark
              </label>
              <hr />
              <div class="dropdown-title">WebGL Payload</div>
              <label class="setting-option">
                <input
                  type="radio"
                  name="msgMode"
                  [checked]="state.messageMode() === 'package'"
                  (change)="state.messageMode.set('package')"
                />
                Send Full Package
              </label>
              <label class="setting-option">
                <input
                  type="radio"
                  name="msgMode"
                  [checked]="state.messageMode() === 'address'"
                  (change)="state.messageMode.set('address')"
                />
                Send Addressable Only
              </label>
            </div>
          }
        </div>
      </div>
      <input
        #folderInput
        type="file"
        hidden
        webkitdirectory
        directory
        (change)="onFolderSelected($event)"
      />
    </header>
  `,
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
  readonly state = inject(AppStateService);
  readonly theme = inject(ThemeService);
  readonly tagTaxonomy = inject(TagTaxonomyService);
  readonly auth = inject(AuthenticationService);
  readonly meta = inject(AssetMetaService);
  readonly showSettings = signal(false);
  readonly showFiles = signal(false);
  readonly authEnabled = environment.authEnabled;

  openTags(): void {
    if (this.tagTaxonomy.pageOpen()) {
      void this.tagTaxonomy.closePage();
      return;
    }
    this.tagTaxonomy.openPage();
  }

  async onFolderSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    await this.state.loadUnityDbFolder(input.files);
    input.value = '';
    this.showSettings.set(false);
  }

  async clearAllMetadata(): Promise<void> {
    if (!this.meta.canEditMeta() || this.meta.savingDraft()) return;
    const ok = window.confirm(
      'Delete curated metadata for EVERY asset (status, tags, notes, comments, and uploaded media)? This cannot be undone.',
    );
    if (!ok) return;
    try {
      const result = await this.meta.clearAllRecords();
      const n = result.deleted;
      this.state.statusMessage.set(
        n === 1
          ? 'Cleared metadata for 1 asset.'
          : `Cleared metadata for ${n} assets.`,
      );
      this.showSettings.set(false);
    } catch (err: unknown) {
      this.state.statusMessage.set(
        `Error: ${err instanceof Error ? err.message : 'Failed to clear metadata.'}`,
      );
    }
  }
}
