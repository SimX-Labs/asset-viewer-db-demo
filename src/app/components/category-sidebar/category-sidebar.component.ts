import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/app-state.service';
import { DboAsset } from '../../models/dbo.models';
import { UNITY_SUBCATEGORY_DEFS } from '../../models/unity-asset.models';
import {
  DataSource,
  dataSourceHint,
  dataSourceLabel,
  sourceForCategory,
} from '../../models/data-source';

interface Subcategory {
  /** Value stored as currentSubCategory (e.g. vesselType). */
  key: string;
  name: string;
  count: number;
  source: DataSource;
}

@Component({
  selector: 'app-category-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="sidebar">
      <div class="panel-header">Categories</div>
      @if (state.dataMode() === 'unity') {
        @for (cat of getUnityCategories(); track cat.name) {
          @if (getSubcategories(cat.name, cat.fileName); as subs) {
            <div class="accordion">
              <button
                class="accordion-header"
                [class.expanded]="state.expandedCategories()[cat.name]"
                (click)="state.toggleCategoryAccordion(cat.name)"
              >
                <span>{{ cat.name }} ({{ cat.count }})</span>
                <i
                  class="pi accordion-arrow"
                  [class.pi-chevron-down]="state.expandedCategories()[cat.name]"
                  [class.pi-chevron-right]="!state.expandedCategories()[cat.name]"
                  aria-hidden="true"
                ></i>
              </button>
              @if (state.expandedCategories()[cat.name]) {
                <div class="accordion-content">
                  @for (sub of subs; track sub.key) {
                    <button
                      class="category-item"
                      [class.active]="
                        state.currentCategory() === cat.name &&
                        state.currentSubCategory() === sub.key &&
                        state.currentFile() === cat.fileName
                      "
                      (click)="state.selectCategory(cat.name, cat.fileName, sub.key)"
                    >
                      <div class="cat-head">
                        <div class="cat-name">{{ sub.name }}</div>
                        <span
                          class="cat-source"
                          [attr.data-source]="sub.source"
                          [title]="sourceHint(sub.source)"
                        >{{ sourceLabel(sub.source) }}</span>
                      </div>
                      <div class="cat-count">{{ sub.count }} items</div>
                    </button>
                  }
                </div>
              }
            </div>
          } @else {
            <button
              class="category-item"
              [class.active]="
                state.currentCategory() === cat.name &&
                !state.currentSubCategory() &&
                state.currentFile() === cat.fileName
              "
              (click)="state.selectCategory(cat.name, cat.fileName)"
            >
              <div class="cat-head">
                <div class="cat-name">{{ cat.name }}</div>
                <span
                  class="cat-source"
                  [attr.data-source]="cat.source"
                  [title]="sourceHint(cat.source)"
                >{{ sourceLabel(cat.source) }}</span>
              </div>
              <div class="cat-count">{{ cat.count }} items</div>
            </button>
          }
        }
      } @else {
        @for (fileName of state.loadedFileNames(); track fileName) {
          <div class="accordion">
            <button
              class="accordion-header"
              [class.expanded]="state.expandedFiles()[fileName]"
              (click)="state.toggleFileAccordion(fileName)"
            >
              <span>{{ cleanFileName(fileName) }}</span>
              <i
                class="pi accordion-arrow"
                [class.pi-chevron-down]="state.expandedFiles()[fileName]"
                [class.pi-chevron-right]="!state.expandedFiles()[fileName]"
                aria-hidden="true"
              ></i>
            </button>
            @if (state.expandedFiles()[fileName]) {
              <div class="accordion-content">
                @for (cat of getCategories(fileName); track cat.name) {
                  <button
                    class="category-item"
                    [class.active]="state.currentCategory() === cat.name && state.currentFile() === fileName"
                    (click)="state.selectCategory(cat.name, fileName)"
                  >
                    <div class="cat-head">
                      <div class="cat-name">{{ cat.name }}</div>
                      <span
                        class="cat-source"
                        data-source="unknown"
                        [title]="sourceHint('unknown')"
                      >{{ sourceLabel('unknown') }}</span>
                    </div>
                    <div class="cat-count">{{ cat.count }} items</div>
                  </button>
                }
              </div>
            }
          </div>
        }
      }
    </aside>
  `,
  styleUrl: './category-sidebar.component.scss',
})
export class CategorySidebarComponent {
  readonly state = inject(AppStateService);

  sourceLabel(source: DataSource): string {
    return dataSourceLabel(source);
  }

  sourceHint(source: DataSource): string {
    return dataSourceHint(source);
  }

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

  getUnityCategories(): {
    name: string;
    count: number;
    fileName: string;
    source: DataSource;
  }[] {
    const fileName = this.state.loadedFileNames()[0];
    if (!fileName) return [];
    // Multi-categories (accordion + subcategories) first; flat categories below.
    return this.getCategories(fileName)
      .map((category) => ({
        ...category,
        fileName,
        source: sourceForCategory(category.name),
      }))
      .sort((a, b) => {
        const aMulti = a.name in UNITY_SUBCATEGORY_DEFS ? 0 : 1;
        const bMulti = b.name in UNITY_SUBCATEGORY_DEFS ? 0 : 1;
        return aMulti - bMulti;
      });
  }

  /**
   * Subcategories for an expandable category, or null when it's a flat category.
   * Counts are derived from the rows so a subcategory with no rows still shows
   * in the tree with a 0 count.
   */
  getSubcategories(categoryName: string, fileName: string): Subcategory[] | null {
    const def = UNITY_SUBCATEGORY_DEFS[categoryName];
    if (!def) return null;
    const rows: DboAsset[] = this.state.rawData()[fileName]?.[categoryName] ?? [];
    return def.options.map((opt) => ({
      key: opt.key,
      name: opt.name,
      count: rows.filter(
        (row) => ((row.Data?.[def.field] as string) ?? def.fallback) === opt.key
      ).length,
      source: sourceForCategory(categoryName, opt.key),
    }));
  }
}
