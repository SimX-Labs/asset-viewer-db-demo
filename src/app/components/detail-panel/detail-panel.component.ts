import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/app-state.service';
import { AssetDetailComponent } from '../asset-detail/asset-detail.component';
import { AssetContextRailComponent } from '../asset-context-rail/asset-context-rail.component';
import { PinnedPanelComponent } from '../pinned-panel/pinned-panel.component';
import { WebglSidebarComponent } from '../webgl-sidebar/webgl-sidebar.component';

@Component({
  selector: 'app-detail-panel',
  standalone: true,
  imports: [
    CommonModule,
    AssetDetailComponent,
    AssetContextRailComponent,
    PinnedPanelComponent,
    WebglSidebarComponent,
  ],
  template: `
    <section class="detail-panel" [class.embed-mode]="embedMode">
      @if (!embedMode) {
        <app-pinned-panel />
        <div class="tab-strip">
          <button class="close-all-btn" (click)="state.closeAllTabs()">
            <i class="pi pi-times" aria-hidden="true"></i> Close All
          </button>
          <div class="tab-bar">
            @for (tabId of state.openTabIds(); track tabId) {
              <button
                class="tab-header"
                [class.active]="state.activeTabId() === tabId"
                [class.editing]="state.isTabDirty(tabId)"
                (click)="state.activateTab(tabId)"
              >
                @if (state.isTabDirty(tabId)) {
                  <i class="pi pi-pencil tab-edit-icon" title="Unsaved changes" aria-hidden="true"></i>
                }
                <span class="tab-title" [title]="tabLabel(tabId)">{{ tabLabel(tabId) }}</span>
                <span class="tab-close" (click)="closeTab($event, tabId)" title="Close tab">
                  <i class="pi pi-times" aria-hidden="true"></i>
                </span>
              </button>
            }
          </div>
        </div>
      }
      <div class="tab-content-container">
        @if (state.activeTabId(); as tabId) {
          <div
            class="tab-pane active"
            (scroll)="onDetailInteract()"
            (click)="onDetailInteract()"
            (pointerdown)="onDetailInteract()"
            (keydown)="onDetailInteract()"
          >
            <div class="tab-main">
              @if (!embedMode) {
                <nav class="breadcrumb-bar">
                  @for (histId of state.tabHistory()[tabId]; track i; let i = $index; let last = $last) {
                    @if (i > 0) {
                      <i class="pi pi-angle-right crumb-separator" aria-hidden="true"></i>
                    }
                    @if (last) {
                      <span class="crumb current">{{ tabLabel(histId) }}</span>
                    } @else {
                      <button class="crumb" (click)="state.navigateBreadcrumb(tabId, i)">
                        {{ tabLabel(histId) }}
                      </button>
                    }
                  }
                </nav>
              }
              <div class="tab-scroll-area" (scroll)="onDetailInteract()">
                @if (state.getTabAsset(tabId); as asset) {
                  <!-- Recreate the detail view per asset so accordion/search
                       local state and reused child renderers cannot go stale
                       when navigating within a tab's breadcrumb history. -->
                  @for (_ of [asset.AssetId]; track _) {
                    <app-asset-detail [asset]="asset" />
                  }
                }
              </div>
            </div>
            @if (state.getTabAsset(tabId); as asset) {
              @for (_ of [asset.AssetId]; track _) {
                <app-asset-context-rail [asset]="asset" />
              }
            }
          </div>
        } @else {
          <div class="empty-state">Select an asset to view details</div>
        }
      </div>
    </section>
    @if (!embedMode) {
      <app-webgl-sidebar />
    }
  `,
  styleUrl: './detail-panel.component.scss',
})
export class DetailPanelComponent {
  /** When true, hide chrome (tabs / breadcrumb / WebGL sidebar) for iframe embeds. */
  @Input() embedMode = false;

  readonly state = inject(AppStateService);

  tabLabel(id: string): string {
    return this.state.assetMap()[id]?.AssetName ?? id;
  }

  closeTab(event: Event, tabId: string): void {
    event.stopPropagation();
    this.state.closeTab(tabId);
  }

  /** Scroll, click, or keyboard use on the detail page commits a list preview into a tab. */
  onDetailInteract(): void {
    this.state.commitPreviewTab();
  }
}
