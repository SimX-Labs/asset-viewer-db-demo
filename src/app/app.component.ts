import { Component, OnInit, inject, HostListener } from '@angular/core';
import { TopBarComponent } from './components/top-bar/top-bar.component';
import { CategorySidebarComponent } from './components/category-sidebar/category-sidebar.component';
import { PinnedPanelComponent } from './components/pinned-panel/pinned-panel.component';
import { AssetListComponent } from './components/asset-list/asset-list.component';
import { DetailPanelComponent } from './components/detail-panel/detail-panel.component';
import { OrbitViewerHostComponent } from './orbit-capture/components/orbit-viewer-host/orbit-viewer-host.component';
import { AppStateService } from './services/app-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    TopBarComponent,
    CategorySidebarComponent,
    PinnedPanelComponent,
    AssetListComponent,
    DetailPanelComponent,
    OrbitViewerHostComponent,
  ],
  template: `
    <app-top-bar />
    <main class="main-container" [class.loaded]="state.loaded()">
      <app-category-sidebar />
      <app-pinned-panel />
      <app-asset-list />
      <app-detail-panel />
    </main>
    <app-orbit-viewer-host />
  `,
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  readonly state = inject(AppStateService);

  ngOnInit(): void {
    this.state.loadDefaults();
  }

  @HostListener('window:hashchange')
  onHashChange(): void {
    this.state.handleHashChange();
  }
}
