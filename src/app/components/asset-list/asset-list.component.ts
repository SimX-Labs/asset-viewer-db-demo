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
      <div class="search-wrapper">
        <input
          type="text"
          placeholder="Search Name or ID..."
          [ngModel]="state.searchQuery()"
          (ngModelChange)="state.searchQuery.set($event)"
        />
        @if (state.searchQuery()) {
          <button class="search-clear" (click)="state.searchQuery.set('')">×</button>
        }
        <button class="export-btn" title="Export Filtered List to CSV" (click)="state.exportCsv()">⬇</button>
      </div>
      <div class="search-help">
        <span class="help-icon">?</span>
        Try: <code>ContainedTools.length &lt; 2</code> or <code>AssetAddress != null</code>
      </div>
      <div class="asset-list">
        @for (item of state.filteredListItems(); track item.AssetId) {
          <button class="asset-item" (click)="state.openAssetTab(item.AssetId, true)">
            <span class="asset-name">{{ item.AssetName }}</span>
            <span class="asset-id">{{ item.AssetId }}</span>
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
