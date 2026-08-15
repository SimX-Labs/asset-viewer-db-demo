import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/app-state.service';

@Component({
  selector: 'app-pinned-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (state.pinnedAssetIds().length > 0) {
      <aside class="pinned-panel">
        <div class="pinned-header">Pinned Assets</div>
        @for (id of state.pinnedAssetIds(); track id) {
          <div class="pinned-item" (click)="state.openAssetTab(id, true)">
            <span>{{ label(id) }}</span>
            <button class="unpin-btn" (click)="unpin($event, id)" title="Unpin">
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </div>
        }
      </aside>
    }
  `,
  styleUrl: './pinned-panel.component.scss',
})
export class PinnedPanelComponent {
  readonly state = inject(AppStateService);

  label(id: string): string {
    return this.state.assetMap()[id]?.AssetName ?? id;
  }

  unpin(event: Event, id: string): void {
    event.stopPropagation();
    this.state.togglePin(id);
  }
}
