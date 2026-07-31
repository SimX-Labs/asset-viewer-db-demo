import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/app-state.service';
import { AssetDetailComponent } from '../asset-detail/asset-detail.component';
import { WebglSidebarComponent } from '../webgl-sidebar/webgl-sidebar.component';

@Component({
  selector: 'app-detail-panel',
  standalone: true,
  imports: [CommonModule, AssetDetailComponent, WebglSidebarComponent],
  template: `
    <section class="detail-panel">
      <div class="tab-strip">
        <button class="close-all-btn" (click)="state.closeAllTabs()">
          <i class="pi pi-times" aria-hidden="true"></i> Close All
        </button>
        <div class="tab-bar">
          @for (tabId of state.openTabIds(); track tabId) {
            <button
              class="tab-header"
              [class.active]="state.activeTabId() === tabId"
              (click)="state.activateTab(tabId)"
            >
              <span class="tab-title" [title]="tabLabel(tabId)">{{ tabLabel(tabId) }}</span>
              <span class="tab-close" (click)="closeTab($event, tabId)" title="Close tab">
                <i class="pi pi-times" aria-hidden="true"></i>
              </span>
            </button>
          }
        </div>
      </div>
      <div class="tab-content-container">
        @if (state.openTabIds().length === 0) {
          <div class="empty-state">Select an asset to view details</div>
        }
        @for (tabId of state.openTabIds(); track tabId) {
          @if (state.activeTabId() === tabId) {
            <div class="tab-pane active">
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
              <div class="tab-scroll-area">
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
          }
        }
      </div>
    </section>
    <app-webgl-sidebar />
  `,
  styleUrl: './detail-panel.component.scss',
})
export class DetailPanelComponent {
  readonly state = inject(AppStateService);

  tabLabel(id: string): string {
    return this.state.assetMap()[id]?.AssetName ?? id;
  }

  closeTab(event: Event, tabId: string): void {
    event.stopPropagation();
    this.state.closeTab(tabId);
  }
}
