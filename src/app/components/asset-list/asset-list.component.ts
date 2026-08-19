import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  afterNextRender,
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
  buildContextualTagFilters,
  tagFilterSuggestions,
} from '../../utils/tag-filter.util';

const DRAG_THRESHOLD_PX = 5;
const MOMENTUM_FRICTION = 0.0025;
const MOMENTUM_MIN_VELOCITY = 0.02;
const LETTER_HIDE_DELAY_MS = 450;

@Component({
  selector: 'app-asset-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="list-panel">
      <div class="list-header">
        <div class="search-row">
          <div class="search-wrapper">
            <input
              type="text"
              placeholder="Search names, IDs, or tags…"
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
            @if (suggestOpen() && tagSuggestions().length) {
              <ul class="tag-suggest" role="listbox">
                @for (opt of tagSuggestions(); track opt.label; let i = $index) {
                  <li role="presentation">
                    <button
                      type="button"
                      role="option"
                      class="tag-suggest-item"
                      [class.active]="i === suggestIndex()"
                      (mousedown)="applyTagSuggestion(opt.label, $event)"
                    >
                      <i class="pi pi-tag" aria-hidden="true"></i>
                      <span>Filter by {{ opt.label }}</span>
                      <span class="tag-count">{{ opt.count }}</span>
                    </button>
                  </li>
                }
              </ul>
            }
          </div>
          <button class="export-btn simx-btn simx-btn--small" title="Export filtered list to CSV" (click)="state.exportCsv()">
            <i class="pi pi-download" aria-hidden="true"></i>
            Export
          </button>
        </div>
        @if (tagFilters().length || state.selectedTagLabels().length) {
          <div class="tag-filters" aria-label="Filter by tag">
            <button
              type="button"
              class="tag-picker-btn"
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
            @if (state.selectedTagLabels().length) {
              <button
                type="button"
                class="tag-clear"
                title="Clear tag filters"
                (click)="state.clearTagFilters()"
              >
                Clear
              </button>
            }
          </div>
        }
      </div>
      <div class="list-columns">
        <span>Name</span>
        <span>Type / ID</span>
      </div>
      <div class="asset-list-wrap">
        <div
          #listScroll
          class="asset-list"
          [class.is-dragging]="isDragging()"
        >
          @for (item of state.filteredListItems(); track item.AssetId) {
            <button
              class="asset-item"
              [class.active]="state.activeAssetId() === item.AssetId"
              (click)="onItemClick($event, item.AssetId)"
            >
              <span class="asset-name">{{ item.AssetName }}</span>
              <span class="asset-meta">
                <span class="asset-type">{{ item.AssetType }}</span>
                <span class="asset-id">{{ item.AssetId }}</span>
              </span>
            </button>
          } @empty {
            <div class="empty-list">
              @if (state.searchQuery() || state.selectedTagLabels().length) {
                No assets match this search.
              } @else {
                No assets in this category.
              }
            </div>
          }
        </div>
        @if (showLetter()) {
          <div class="letter-indicator" aria-hidden="true">{{ currentLetter() }}</div>
        }
      </div>
    </section>
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
  styleUrl: './asset-list.component.scss',
})
export class AssetListComponent {
  readonly state = inject(AppStateService);
  private readonly tags = inject(TagTaxonomyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly suggestOpen = signal(false);
  readonly suggestIndex = signal(0);
  readonly pickerOpen = signal(false);
  readonly pickerQuery = signal('');

  readonly tagFilters = computed(() => {
    const cat = this.state.currentCategory();
    return buildContextualTagFilters({
      items: this.state.categoryListItems(),
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

  readonly tagSuggestions = computed(() =>
    tagFilterSuggestions(this.tagFilters(), this.state.searchQuery()),
  );

  private readonly listScroll = viewChild<ElementRef<HTMLDivElement>>('listScroll');
  private readonly pickerSearch = viewChild<ElementRef<HTMLInputElement>>('pickerSearch');

  readonly isDragging = signal(false);
  readonly showLetter = signal(false);
  readonly currentLetter = signal('A');

  private suppressClick = false;
  private wheelActive = false;
  private scrollbarActive = false;
  private momentumActive = false;

  private pointerId: number | null = null;
  private dragStartY = 0;
  private dragStartScrollTop = 0;
  private dragMoved = false;
  private lastMoveY = 0;
  private lastMoveTime = 0;
  private velocity = 0;

  private momentumRaf = 0;
  private hideLetterTimer = 0;
  private wheelResetTimer = 0;

  private readonly onPointerDown = (e: PointerEvent) => this.handlePointerDown(e);
  private readonly onPointerMove = (e: PointerEvent) => this.handlePointerMove(e);
  private readonly onPointerUp = (e: PointerEvent) => this.handlePointerUp(e);
  private readonly onWheel = () => this.handleWheel();
  private readonly onScroll = () => this.handleScroll();

  constructor() {
    void this.tags.ensureLoaded();
    afterNextRender(() => this.bindScrollInteractions());
  }

  onSearchChange(value: string): void {
    this.state.searchQuery.set(value);
    this.suggestOpen.set(true);
    this.suggestIndex.set(0);
  }

  onSearchBlur(): void {
    window.setTimeout(() => this.suggestOpen.set(false), 120);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const suggestions = this.tagSuggestions();
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
      this.applyTagSuggestion(choice.label);
      return;
    }
    if (event.key === 'Escape') {
      this.suggestOpen.set(false);
    }
  }

  applyTagSuggestion(label: string, event?: Event): void {
    event?.preventDefault();
    this.state.toggleTagFilter(label);
    this.state.searchQuery.set('');
    this.suggestOpen.set(false);
  }

  openPicker(): void {
    this.pickerOpen.set(true);
    this.pickerQuery.set('');
    window.setTimeout(() => this.pickerSearch()?.nativeElement.focus(), 0);
  }

  closePicker(): void {
    this.pickerOpen.set(false);
    this.pickerQuery.set('');
  }

  @HostListener('document:keydown.escape')
  onPickerEscape(): void {
    if (this.pickerOpen()) this.closePicker();
  }

  onItemClick(event: MouseEvent, assetId: string): void {
    if (this.suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      this.suppressClick = false;
      return;
    }
    this.state.previewAsset(assetId);
  }

  private bindScrollInteractions(): void {
    const el = this.listScroll()?.nativeElement;
    if (!el) return;

    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerUp);
    el.addEventListener('wheel', this.onWheel, { passive: true });
    el.addEventListener('scroll', this.onScroll, { passive: true });

    this.destroyRef.onDestroy(() => {
      el.removeEventListener('pointerdown', this.onPointerDown);
      el.removeEventListener('pointermove', this.onPointerMove);
      el.removeEventListener('pointerup', this.onPointerUp);
      el.removeEventListener('pointercancel', this.onPointerUp);
      el.removeEventListener('wheel', this.onWheel);
      el.removeEventListener('scroll', this.onScroll);
      this.stopMomentum();
      window.clearTimeout(this.hideLetterTimer);
      window.clearTimeout(this.wheelResetTimer);
    });
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const el = this.listScroll()?.nativeElement;
    if (!el) return;

    this.stopMomentum();
    this.wheelActive = false;

    if (this.isScrollbarPointer(e, el)) {
      this.scrollbarActive = true;
      this.pointerId = e.pointerId;
      el.setPointerCapture(e.pointerId);
      this.updateLetter(el);
      this.revealLetter();
      return;
    }

    this.pointerId = e.pointerId;
    this.dragStartY = e.clientY;
    this.dragStartScrollTop = el.scrollTop;
    this.dragMoved = false;
    this.lastMoveY = e.clientY;
    this.lastMoveTime = performance.now();
    this.velocity = 0;
  }

  private handlePointerMove(e: PointerEvent): void {
    if (this.pointerId !== e.pointerId) return;
    const el = this.listScroll()?.nativeElement;
    if (!el) return;

    if (this.scrollbarActive) {
      this.updateLetter(el);
      this.revealLetter();
      return;
    }

    const dy = e.clientY - this.dragStartY;
    if (!this.dragMoved && Math.abs(dy) < DRAG_THRESHOLD_PX) return;

    if (!this.dragMoved) {
      this.dragMoved = true;
      this.isDragging.set(true);
      el.setPointerCapture(e.pointerId);
      this.revealLetter();
    }

    e.preventDefault();
    const now = performance.now();
    const frameDy = e.clientY - this.lastMoveY;
    const dt = Math.max(now - this.lastMoveTime, 1);
    this.velocity = frameDy / dt;
    this.lastMoveY = e.clientY;
    this.lastMoveTime = now;

    el.scrollTop = this.dragStartScrollTop - dy;
    this.updateLetter(el);
  }

  private handlePointerUp(e: PointerEvent): void {
    if (this.pointerId !== e.pointerId) return;
    const el = this.listScroll()?.nativeElement;
    this.pointerId = null;

    if (el?.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }

    if (this.scrollbarActive) {
      this.scrollbarActive = false;
      this.scheduleHideLetter();
      return;
    }

    if (!this.dragMoved) return;

    this.isDragging.set(false);
    this.suppressClick = true;
    queueMicrotask(() => {
      this.suppressClick = false;
    });

    if (el && Math.abs(this.velocity) >= MOMENTUM_MIN_VELOCITY) {
      this.startMomentum(el);
    } else {
      this.scheduleHideLetter();
    }
  }

  private handleWheel(): void {
    this.wheelActive = true;
    this.stopMomentum();
    this.hideLetterNow();

    window.clearTimeout(this.wheelResetTimer);
    this.wheelResetTimer = window.setTimeout(() => {
      this.wheelActive = false;
    }, 120);
  }

  private handleScroll(): void {
    const el = this.listScroll()?.nativeElement;
    if (!el) return;

    this.updateLetter(el);

    if (this.wheelActive) return;
    if (this.isDragging() || this.scrollbarActive || this.momentumActive) {
      this.revealLetter();
    }
  }

  private startMomentum(el: HTMLDivElement): void {
    this.momentumActive = true;
    this.revealLetter();
    let last = performance.now();
    let velocity = this.velocity;

    const step = (now: number) => {
      const dt = now - last;
      last = now;
      el.scrollTop -= velocity * dt;
      velocity *= Math.exp(-MOMENTUM_FRICTION * dt);

      if (Math.abs(velocity) < MOMENTUM_MIN_VELOCITY) {
        this.momentumActive = false;
        this.momentumRaf = 0;
        this.scheduleHideLetter();
        return;
      }

      this.updateLetter(el);
      this.momentumRaf = requestAnimationFrame(step);
    };

    this.momentumRaf = requestAnimationFrame(step);
  }

  private stopMomentum(): void {
    if (this.momentumRaf) {
      cancelAnimationFrame(this.momentumRaf);
      this.momentumRaf = 0;
    }
    this.momentumActive = false;
    this.velocity = 0;
  }

  private revealLetter(): void {
    window.clearTimeout(this.hideLetterTimer);
    this.showLetter.set(true);
  }

  private scheduleHideLetter(): void {
    window.clearTimeout(this.hideLetterTimer);
    this.hideLetterTimer = window.setTimeout(() => {
      if (!this.isDragging() && !this.scrollbarActive && !this.momentumActive) {
        this.showLetter.set(false);
      }
    }, LETTER_HIDE_DELAY_MS);
  }

  private hideLetterNow(): void {
    window.clearTimeout(this.hideLetterTimer);
    this.showLetter.set(false);
  }

  private updateLetter(el: HTMLDivElement): void {
    const items = el.querySelectorAll<HTMLElement>('.asset-item');
    if (!items.length) {
      this.currentLetter.set('#');
      return;
    }

    const top = el.scrollTop;
    let letter = '#';
    for (const item of items) {
      if (item.offsetTop + item.offsetHeight > top + 1) {
        const name = item.querySelector('.asset-name')?.textContent?.trim() ?? '';
        letter = this.firstLetter(name);
        break;
      }
    }
    this.currentLetter.set(letter);
  }

  private firstLetter(name: string): string {
    if (!name) return '#';
    const ch = name[0].toLocaleUpperCase();
    return /[A-ZÀ-ÖØ-Þ]/.test(ch) ? ch : '#';
  }

  private isScrollbarPointer(e: PointerEvent, el: HTMLDivElement): boolean {
    const rect = el.getBoundingClientRect();
    return e.clientX >= rect.left + el.clientWidth;
  }
}
