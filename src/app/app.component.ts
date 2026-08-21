import { Component, OnInit, inject, HostListener, signal, effect } from '@angular/core';
import { TopBarComponent } from './components/top-bar/top-bar.component';
import { BrowserToolbarComponent } from './components/browser-toolbar/browser-toolbar.component';
import { CategorySidebarComponent } from './components/category-sidebar/category-sidebar.component';
import { AssetListComponent } from './components/asset-list/asset-list.component';
import { DetailPanelComponent } from './components/detail-panel/detail-panel.component';
import { OrbitViewerHostComponent } from './orbit-capture/components/orbit-viewer-host/orbit-viewer-host.component';
import { OrbitInlineViewerComponent } from './orbit-capture/components/orbit-inline-viewer/orbit-inline-viewer.component';
import { TagsPageComponent } from './components/tags-page/tags-page.component';
import { LoadingCoverageComponent } from './components/loading-coverage/loading-coverage.component';
import { AppStateService } from './services/app-state.service';
import { TagTaxonomyService } from './services/tag-taxonomy.service';
import { AuthenticationService } from './services/authentication.service';
import { AssetMetaService } from './services/asset-meta.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    TopBarComponent,
    BrowserToolbarComponent,
    CategorySidebarComponent,
    AssetListComponent,
    DetailPanelComponent,
    OrbitViewerHostComponent,
    OrbitInlineViewerComponent,
    TagsPageComponent,
    LoadingCoverageComponent,
  ],
  template: `
    @if (modelOnlyMode()) {
      <main
        class="model-preview-container"
        [class.loaded]="state.loaded()"
      >
        @if (modelAddressable(); as addressable) {
          <app-orbit-inline-viewer
            class="model-preview-viewer"
            [addressable]="addressable"
            [diagnostic]="true"
            [showControls]="false"
          />
        } @else if (state.loaded()) {
          <div class="model-preview-note">
            Asset not found in the Unity Asset DB.
          </div>
        }
        @if (state.showLoadingCover() && !state.statusError()) {
          <app-loading-coverage label="Loading assets…" [dark]="true" />
        }
      </main>
    } @else {
      @if (!embedMode()) {
        <app-top-bar />
      }
      @if (!embedMode() && tagTaxonomy.pageOpen()) {
        <app-tags-page />
      } @else {
        <div class="main-shell">
          <main
            class="main-container"
            [class.loaded]="state.loaded()"
            [class.embed-mode]="embedMode()"
          >
            @if (!embedMode()) {
              <div class="browser-pane">
                <app-browser-toolbar />
                <div class="browser-columns">
                  <app-category-sidebar />
                  <app-asset-list />
                </div>
              </div>
            }
            <app-detail-panel [embedMode]="embedMode()" />
          </main>
          @if (state.showLoadingCover() && !state.statusError()) {
            <app-loading-coverage label="Loading assets…" />
          }
        </div>
        <app-orbit-viewer-host />
      }
    }
  `,
  styleUrl: './app.component.scss',
  host: {
    '[class.embed-host]': 'embedMode()',
  },
})
export class AppComponent implements OnInit {
  readonly state = inject(AppStateService);
  readonly tagTaxonomy = inject(TagTaxonomyService);
  private readonly auth = inject(AuthenticationService);
  private readonly assetMeta = inject(AssetMetaService);

  /** Compact detail-only layout for iframe embeds (scenario-creator tool picker). */
  readonly embedMode = signal(false);
  /** Model-only thumbnail layout for picker header embeds. */
  readonly modelOnlyMode = signal(false);

  constructor() {
    // Privilege hook lives here (not in AuthenticationService) to avoid DI cycles.
    effect(() => {
      this.assetMeta.setCanEdit(this.auth.isAuthenticated());
    });
  }

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    const embed = params.get('embed') === '1';
    const modelOnly = params.get('preview') === 'model';
    this.embedMode.set(embed || modelOnly);
    this.modelOnlyMode.set(modelOnly);
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    await Promise.all([
      this.state.loadDefaults(),
      this.tagTaxonomy.ensureLoaded(),
    ]);
    await this.tagTaxonomy.ensureAuthoredTags(this.assetMeta.overlayTagLabels());
  }

  modelAddressable(): string | null {
    const assetId = this.state.activeAssetId();
    if (!assetId) return null;
    const asset = this.state.assetMap()[assetId];
    const addressable =
      asset?.Data?.['AssetAddress'] ?? asset?.Data?.['AssetKey'];
    return typeof addressable === 'string' && addressable.trim()
      ? addressable.trim()
      : null;
  }

  @HostListener('window:hashchange')
  onHashChange(): void {
    this.state.handleHashChange();
  }
}
