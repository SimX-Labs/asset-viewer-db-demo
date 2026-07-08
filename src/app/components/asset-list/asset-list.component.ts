import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../services/app-state.service';

@Component({
  selector: 'app-asset-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="list-panel">
      <div class="list-header">
        <div class="search-wrapper">
          <input
            type="text"
            placeholder="Search by asset name..."
            [ngModel]="state.searchQuery()"
            (ngModelChange)="state.searchQuery.set($event)"
          />
          @if (state.searchQuery()) {
            <button class="search-clear" (click)="state.searchQuery.set('')" title="Clear search">×</button>
          }
        </div>
        <button class="export-btn" title="Export filtered list to CSV" (click)="state.exportCsv()">Export</button>
      </div>
      <div class="search-help">
        <span class="help-icon">?</span>
        Try: <code>ContainedTools.length &lt; 2</code> or <code>AssetAddress != null</code>
      </div>
      <div class="list-columns">
        <span>Name</span>
        <span>Type / ID</span>
      </div>
      <div class="asset-list">
        @for (item of state.filteredListItems(); track item.AssetId) {
          <button
            class="asset-item"
            [class.active]="state.activeAssetId() === item.AssetId"
            (click)="state.openAssetTab(item.AssetId, true)"
          >
            <span class="asset-name">{{ item.AssetName }}</span>
            <span class="asset-meta">
              <span class="asset-type">{{ item.AssetType }}</span>
              <span class="asset-id">{{ item.AssetId }}</span>
            </span>
          </button>
        } @empty {
          <div class="empty-list">No assets in this category.</div>
        }
      </div>
    </section>
  `,
  styleUrl: './asset-list.component.scss',
})
export class AssetListComponent {
  readonly state = inject(AppStateService);
}
