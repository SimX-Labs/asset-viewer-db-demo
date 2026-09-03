import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../services/app-state.service';
import { TagTaxonomyService } from '../../services/tag-taxonomy.service';
import {
  assetMatchesTags,
  buildContextualTagFilters,
  tagFilterSuggestions,
} from '../../utils/tag-filter.util';
import {
  assetMatchesStatuses,
  buildStatusFilters,
  StatusFilterOption,
  statusFilterSuggestions,
} from '../../utils/status-filter.util';

type SearchSuggestion =
  | { kind: 'status'; label: string; count: number; value: StatusFilterOption['value'] }
  | { kind: 'tag'; label: string; count: number };

@Component({
  selector: 'app-browser-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="browser-toolbar">
      <div class="toolbar-row">
        <div class="search-wrapper">
          <input
            type="text"
            placeholder="Search names, IDs, tags, or status…"
            [ngModel]="state.searchQuery()"
            (ngModelChange)="onSearchChange($event)"
            (focus)="suggestOpen.set(true)"
            (blur)="onSearchBlur()"
            (keydown)="onSearchKeydown($event)"
          />
          @if (state.searchQuery()) {
            <button class="search-clear" (click)="state.searchQuery.set('')" title="Clear search">
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          }
          @if (suggestOpen() && searchSuggestions().length) {
            <ul class="tag-suggest" role="listbox">
              @for (opt of searchSuggestions(); track suggestionTrack(opt); let i = $index) {
                <li role="presentation">
                  <button
                    type="button"
                    role="option"
                    class="tag-suggest-item"
                    [class.active]="i === suggestIndex()"
                    (mousedown)="applySuggestion(opt, $event)"
                  >
                    <i
                      class="pi"
                      [class.pi-flag]="opt.kind === 'status'"
                      [class.pi-tag]="opt.kind === 'tag'"
                      aria-hidden="true"
                    ></i>
                    <span>Filter by {{ opt.label }}</span>
                    <span class="tag-count">{{ opt.count }}</span>
                  </button>
                </li>
              }
            </ul>
          }
        </div>
        <div class="toolbar-tools">
          <div class="filter-actions">
            <button
              type="button"
              class="tag-picker-btn"
              data-filter="status"
              [class.open]="statusPickerOpen()"
              [attr.aria-expanded]="statusPickerOpen()"
              aria-haspopup="dialog"
              title="Choose statuses to include or exclude"
              (click)="openStatusPicker()"
            >
              <i class="pi pi-flag" aria-hidden="true"></i>
              Status
              @if (state.selectedStatuses().length) {
                <span class="tag-count">{{ state.selectedStatuses().length }}</span>
              }
              <span class="tag-mode">{{
                state.statusMatchMode() === 'exclude' ? 'Exclude' : 'Include'
              }}</span>
            </button>
            @if (tagFilters().length || state.selectedTagLabels().length) {
              <button
                type="button"
                class="tag-picker-btn"
                data-filter="tags"
                [class.open]="pickerOpen()"
                [attr.aria-expanded]="pickerOpen()"
                aria-haspopup="dialog"
                title="Choose tags to filter"
                (click)="openPicker()"
              >
                <i class="pi pi-tags" aria-hidden="true"></i>
                Tags
                @if (state.selectedTagLabels().length) {
                  <span class="tag-count">{{ state.selectedTagLabels().length }}</span>
                }
                <span class="tag-mode">{{ state.tagMatchMode() === 'or' ? 'OR' : 'AND' }}</span>
              </button>
            }
          </div>
          <button
            class="export-btn simx-btn simx-btn--small"
            title="Export filtered list to CSV"
            (click)="state.exportCsv()"
          >
            <i class="pi pi-download" aria-hidden="true"></i>
            Export
          </button>
        </div>
      </div>
      @if (hasActiveFilters()) {
        <div class="active-filters">
          <div class="status-filters" aria-label="Active status filters">
            @for (opt of selectedStatusFilters(); track opt.value) {
              <button
                type="button"
                class="status-filter active"
                [attr.data-status]="opt.value"
                [class.exclude]="state.statusMatchMode() === 'exclude'"
                aria-pressed="true"
                title="Remove status filter"
                (click)="state.toggleStatusFilter(opt.value)"
              >
                <span class="status-dot" aria-hidden="true"></span>
                {{ opt.label }}
                <span class="tag-count">{{ opt.count }}</span>
              </button>
            }
            @if (state.selectedStatuses().length) {
              <button
                type="button"
                class="tag-clear"
                title="Clear status filters"
                (click)="state.clearStatusFilters()"
              >
                Clear
              </button>
            }
          </div>
          @if (state.selectedTagLabels().length) {
            <div class="tag-filters" aria-label="Active tag filters">
              @for (opt of selectedTagFilters(); track opt.label) {
                <button
                  type="button"
                  class="tag-filter active"
                  aria-pressed="true"
                  title="Remove tag filter"
                  (click)="state.toggleTagFilter(opt.label)"
                >
                  {{ opt.label }}
                  <span class="tag-count">{{ opt.count }}</span>
                </button>
              }
              <button
                type="button"
                class="tag-clear"
                title="Clear tag filters"
                (click)="state.clearTagFilters()"
              >
                Clear
              </button>
            </div>
          }
        </div>
      }
    </div>
    @if (statusPickerOpen()) {
      <div class="tag-picker-backdrop" (click)="closeStatusPicker()">
        <div
          class="tag-picker status-picker"
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-picker-title"
          (click)="$event.stopPropagation()"
        >
          <header class="tag-picker-head">
            <h2 id="status-picker-title" class="tag-picker-title">Filter by status</h2>
            <button
              type="button"
              class="tag-picker-close"
              title="Close (Esc)"
              (click)="closeStatusPicker()"
            >
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </header>
          <div class="tag-picker-toolbar">
            <div class="match-toggle" role="group" aria-label="Status match mode">
              <button
                type="button"
                data-mode="include"
                [class.active]="state.statusMatchMode() === 'include'"
                [attr.aria-pressed]="state.statusMatchMode() === 'include'"
                title="Show assets with any selected status"
                (click)="state.setStatusMatchMode('include')"
              >
                Include
              </button>
              <button
                type="button"
                data-mode="exclude"
                [class.active]="state.statusMatchMode() === 'exclude'"
                [attr.aria-pressed]="state.statusMatchMode() === 'exclude'"
                title="Hide assets with any selected status"
                (click)="state.setStatusMatchMode('exclude')"
              >
                Exclude
              </button>
            </div>
          </div>
          <p class="tag-picker-hint">
            @if (state.statusMatchMode() === 'exclude') {
              Hide assets that have any of the selected statuses.
            } @else {
              Show assets that have any of the selected statuses.
            }
          </p>
          <ul class="tag-picker-list" role="listbox" aria-multiselectable="true">
            @for (opt of statusFilters(); track opt.value) {
              <li>
                <label
                  class="tag-picker-option"
                  [class.selected]="opt.selected"
                  [attr.data-status]="opt.value"
                >
                  <input
                    type="checkbox"
                    [checked]="opt.selected"
                    (change)="state.toggleStatusFilter(opt.value)"
                  />
                  <span class="status-dot" aria-hidden="true"></span>
                  <span class="tag-picker-label">{{ opt.label }}</span>
                  <span class="tag-count">{{ opt.count }}</span>
                </label>
              </li>
            }
          </ul>
        </div>
      </div>
    }
    @if (pickerOpen()) {
      <div class="tag-picker-backdrop" (click)="closePicker()">
        <div
          class="tag-picker"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tag-picker-title"
          (click)="$event.stopPropagation()"
        >
          <header class="tag-picker-head">
            <h2 id="tag-picker-title" class="tag-picker-title">Filter by tags</h2>
            <button
              type="button"
              class="tag-picker-close"
              title="Close (Esc)"
              (click)="closePicker()"
            >
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </header>
          <div class="tag-picker-toolbar">
            <input
              #pickerSearch
              type="text"
              class="tag-picker-search"
              placeholder="Search tags…"
              [ngModel]="pickerQuery()"
              (ngModelChange)="pickerQuery.set($event)"
            />
            <div class="match-toggle" role="group" aria-label="Tag match mode">
              <button
                type="button"
                data-mode="and"
                [class.active]="state.tagMatchMode() === 'and'"
                [attr.aria-pressed]="state.tagMatchMode() === 'and'"
                title="Assets must have all selected tags"
                (click)="state.setTagMatchMode('and')"
              >
                AND
              </button>
              <button
                type="button"
                data-mode="or"
                [class.active]="state.tagMatchMode() === 'or'"
                [attr.aria-pressed]="state.tagMatchMode() === 'or'"
                title="Assets that have any of the selected tags"
                (click)="state.setTagMatchMode('or')"
              >
                OR
              </button>
            </div>
          </div>
          <p class="tag-picker-hint">
            @if (state.tagMatchMode() === 'or') {
              Show assets that have any of the selected tags.
            } @else {
              Show assets that have all selected tags.
            }
          </p>
          @if (selectedTagFilters().length) {
            <div class="tag-picker-selected" aria-label="Selected tags">
              @for (opt of selectedTagFilters(); track opt.label) {
                <button
                  type="button"
                  class="tag-filter active"
                  title="Remove tag filter"
                  (click)="state.toggleTagFilter(opt.label)"
                >
                  {{ opt.label }}
                  <span class="tag-count">{{ opt.count }}</span>
                </button>
              }
              <button type="button" class="tag-clear" (click)="state.clearTagFilters()">
                Clear
              </button>
            </div>
          }
          <ul class="tag-picker-list" role="listbox" aria-multiselectable="true">
            @for (opt of pickerTagFilters(); track opt.label) {
              <li>
                <label class="tag-picker-option" [class.selected]="opt.selected">
                  <input
                    type="checkbox"
                    [checked]="opt.selected"
                    (change)="state.toggleTagFilter(opt.label)"
                  />
                  <span class="tag-picker-label">{{ opt.label }}</span>
                  <span class="tag-count">{{ opt.count }}</span>
                </label>
              </li>
            } @empty {
              <li class="tag-picker-empty">No tags match.</li>
            }
          </ul>
        </div>
      </div>
    }
  `,
  styleUrl: './browser-toolbar.component.scss',
})
export class BrowserToolbarComponent {
  readonly state = inject(AppStateService);
  private readonly tags = inject(TagTaxonomyService);

  readonly suggestOpen = signal(false);
  readonly suggestIndex = signal(0);
  readonly pickerOpen = signal(false);
  readonly pickerQuery = signal('');
  readonly statusPickerOpen = signal(false);

  private readonly pickerSearch = viewChild<ElementRef<HTMLInputElement>>('pickerSearch');

  readonly statusFilters = computed(() =>
    buildStatusFilters({
      items: this.state
        .categoryListItemsWithTags()
        .filter((item) =>
          assetMatchesTags(
            item,
            this.state.selectedTagLabels(),
            this.state.tagMatchMode(),
          ),
        ),
      selected: this.state.selectedStatuses(),
      query: this.state.searchQuery(),
    }),
  );

  readonly selectedStatusFilters = computed(() =>
    this.statusFilters().filter((opt) => opt.selected),
  );

  readonly tagFilters = computed(() => {
    const cat = this.state.currentCategory();
    return buildContextualTagFilters({
      items: this.state
        .categoryListItemsWithTags()
        .filter((item) =>
          assetMatchesStatuses(
            item,
            this.state.selectedStatuses(),
            this.state.statusMatchMode(),
          ),
        ),
      selectedLabels: this.state.selectedTagLabels(),
      query: this.state.searchQuery(),
      taxonomyTags: cat ? this.tags.tagsAvailableForAssetType(cat) : [],
      matchMode: this.state.tagMatchMode(),
    });
  });

  readonly selectedTagFilters = computed(() =>
    this.tagFilters().filter((opt) => opt.selected),
  );

  readonly pickerTagFilters = computed(() => {
    const q = this.pickerQuery().trim().toLowerCase();
    const options = this.tagFilters();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  });

  readonly hasActiveFilters = computed(
    () =>
      this.state.selectedStatuses().length > 0 ||
      this.state.selectedTagLabels().length > 0,
  );

  readonly searchSuggestions = computed((): SearchSuggestion[] => {
    const query = this.state.searchQuery();
    const statuses = statusFilterSuggestions(this.statusFilters(), query).map(
      (opt) => ({
        kind: 'status' as const,
        label: opt.label,
        count: opt.count,
        value: opt.value,
      }),
    );
    const tags = tagFilterSuggestions(this.tagFilters(), query).map((opt) => ({
      kind: 'tag' as const,
      label: opt.label,
      count: opt.count,
    }));
    return [...statuses, ...tags];
  });

  openPicker(): void {
    this.closeStatusPicker();
    this.pickerOpen.set(true);
    this.pickerQuery.set('');
    window.setTimeout(() => this.pickerSearch()?.nativeElement.focus(), 0);
  }

  closePicker(): void {
    this.pickerOpen.set(false);
    this.pickerQuery.set('');
  }

  openStatusPicker(): void {
    this.closePicker();
    this.statusPickerOpen.set(true);
  }

  closeStatusPicker(): void {
    this.statusPickerOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onPickerEscape(): void {
    if (this.pickerOpen()) this.closePicker();
    if (this.statusPickerOpen()) this.closeStatusPicker();
  }

  onSearchChange(value: string): void {
    this.state.searchQuery.set(value);
    this.suggestOpen.set(true);
    this.suggestIndex.set(0);
  }

  onSearchBlur(): void {
    window.setTimeout(() => this.suggestOpen.set(false), 120);
  }

  suggestionTrack(opt: SearchSuggestion): string {
    return opt.kind === 'status' ? `status:${opt.value}` : `tag:${opt.label}`;
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const suggestions = this.searchSuggestions();
    if (!suggestions.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.suggestOpen.set(true);
      this.suggestIndex.update((i) => (i + 1) % suggestions.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.suggestOpen.set(true);
      this.suggestIndex.update((i) =>
        i <= 0 ? suggestions.length - 1 : i - 1,
      );
      return;
    }
    if (event.key === 'Enter') {
      const choice = suggestions[this.suggestIndex()] ?? suggestions[0];
      if (!choice) return;
      event.preventDefault();
      this.applySuggestion(choice);
      return;
    }
    if (event.key === 'Escape') {
      this.suggestOpen.set(false);
    }
  }

  applySuggestion(opt: SearchSuggestion, event?: Event): void {
    event?.preventDefault();
    if (opt.kind === 'status') {
      this.state.toggleStatusFilter(opt.value);
    } else {
      this.state.toggleTagFilter(opt.label);
    }
    this.state.searchQuery.set('');
    this.suggestOpen.set(false);
  }
}
