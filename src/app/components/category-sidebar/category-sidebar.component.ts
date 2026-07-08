import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/app-state.service';

@Component({
  selector: 'app-category-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="sidebar">
      <div class="panel-header">Categories</div>
      @for (fileName of state.loadedFileNames(); track fileName) {
        <div class="accordion">
          <button
            class="accordion-header"
            [class.expanded]="state.expandedFiles()[fileName]"
            (click)="state.toggleFileAccordion(fileName)"
          >
            <span>{{ cleanFileName(fileName) }}</span>
            <span class="accordion-arrow" [class.collapsed]="!state.expandedFiles()[fileName]">▼</span>
          </button>
          @if (state.expandedFiles()[fileName]) {
            <div class="accordion-content">
              @for (cat of getCategories(fileName); track cat.name) {
                <button
                  class="category-item"
                  [class.active]="state.currentCategory() === cat.name && state.currentFile() === fileName"
                  (click)="state.selectCategory(cat.name, fileName)"
                >
                  <div class="cat-name">{{ cat.name }}</div>
                  <div class="cat-count">{{ cat.count }} items</div>
                </button>
              }
            </div>
          }
        </div>
      }
    </aside>
  `,
  styleUrl: './category-sidebar.component.scss',
})
export class CategorySidebarComponent {
  readonly state = inject(AppStateService);

  cleanFileName(name: string): string {
    return name.replace('DBO_', '').replace('.json', '');
  }

  getCategories(fileName: string): { name: string; count: number }[] {
    const fileData = this.state.rawData()[fileName];
    if (!fileData) return [];
    return Object.keys(fileData).map((name) => ({
      name,
      count: fileData[name].length,
    }));
  }
}
