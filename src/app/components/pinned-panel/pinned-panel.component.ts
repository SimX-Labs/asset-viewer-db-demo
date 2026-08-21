import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/app-state.service';

@Component({
  selector: 'app-pinned-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (state.pinnedAssetIds().length > 0) {
      <div class="pinned-tabs" aria-label="Pinned assets">
        <div class="pinned-tab-list">
          @for (id of state.pinnedAssetIds(); track id) {
            <div class="pinned-chip" [class.active]="state.activeAssetId() === id">
              <button
                type="button"
                class="pinned-tab"
                (click)="state.openAssetTab(id, true)"
                [title]="label(id)"
              >
                <i class="pi pi-star-fill" aria-hidden="true"></i>
                <span class="pinned-tab-title">{{ label(id) }}</span>
              </button>
              <button
                type="button"
                class="unpin-btn"
                title="Unpin"
                (click)="state.togglePin(id)"
              >
                <i class="pi pi-times" aria-hidden="true"></i>
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
  styleUrl: './pinned-panel.component.scss',
})
export class PinnedPanelComponent {
  readonly state = inject(AppStateService);

  label(id: string): string {
    return this.state.assetMap()[id]?.AssetName ?? id;
  }
}
