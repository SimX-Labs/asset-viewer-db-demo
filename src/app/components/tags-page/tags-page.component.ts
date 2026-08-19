import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TagTaxonomyService } from '../../services/tag-taxonomy.service';
import {
  GLOBAL_TAG_CATEGORY_ID,
  TagCategoryRecord,
  TagRecord,
  isScrapedTag,
} from '../../models/tag.models';

@Component({
  selector: 'app-tags-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="tags-page" aria-label="Tag taxonomy">
      <header class="tags-page-head">
        <div>
          <h2 class="tags-page-title">Tags</h2>
          <p class="tags-page-sub">
            Global tags can be applied to any asset type. Each type also has
            its own tags, which apply only to that type. Changes stay local
            until you leave this page.
          </p>
        </div>
        <button
          type="button"
          class="simx-btn simx-btn--primary simx-btn--small"
          (click)="leave()"
        >
          <i class="pi pi-arrow-left" aria-hidden="true"></i>
          Back to assets
        </button>
      </header>

      <div class="tags-toolbar">
        <input
          type="text"
          class="tags-search"
          placeholder="Search types and tags…"
          [ngModel]="search()"
          (ngModelChange)="onSearch($event)"
        />
      </div>

      @if (tags.statusMessage()) {
        <div class="tags-status" [class.pending]="tags.dirty()">
          {{ tags.statusMessage() }}
        </div>
      }

      <div class="tags-split">
        <nav class="tags-nav" aria-label="Tag groups">
          @if (filteredGlobal(); as global) {
            <button
              type="button"
              class="nav-item nav-item--global"
              [class.active]="selectedId() === global.dataId"
              (click)="select(global.dataId)"
            >
              <span class="nav-item-main">
                <i class="pi pi-globe" aria-hidden="true"></i>
                <span class="nav-label">{{ global.label }}</span>
              </span>
              <span class="nav-meta">
                <span class="nav-badge">All types</span>
                <span class="nav-count">{{ tags.tagsForCategory(global.dataId).length }}</span>
              </span>
            </button>
          }

          @if (filteredTypeCategories().length) {
            <div class="nav-heading">Asset types</div>
            @for (cat of filteredTypeCategories(); track cat.dataId) {
              <button
                type="button"
                class="nav-item"
                [class.active]="selectedId() === cat.dataId"
                (click)="select(cat.dataId)"
              >
                <span class="nav-label">{{ cat.label }}</span>
                <span class="nav-count">{{ tags.tagsForCategory(cat.dataId).length }}</span>
              </button>
            }
          }

          @if (filteredOtherCategories().length) {
            <div class="nav-heading">Other</div>
            @for (cat of filteredOtherCategories(); track cat.dataId) {
              <button
                type="button"
                class="nav-item"
                [class.active]="selectedId() === cat.dataId"
                (click)="select(cat.dataId)"
              >
                <span class="nav-label">{{ cat.label }}</span>
                <span class="nav-count">{{ tags.tagsForCategory(cat.dataId).length }}</span>
              </button>
            }
          }

          @if (!filteredGlobal() && !filteredTypeCategories().length && !filteredOtherCategories().length) {
            <div class="nav-empty">No types match “{{ search() }}”.</div>
          }
        </nav>

        <div class="tags-detail">
          @if (selectedCategory(); as cat) {
            <header class="detail-head">
              <div>
                <h3 class="detail-title">
                  @if (cat.scope === 'global') {
                    <i class="pi pi-globe" aria-hidden="true"></i>
                  }
                  {{ cat.label }}
                </h3>
                <p class="detail-sub">{{ scopeCopy(cat) }}</p>
              </div>
              <span class="detail-count"
                >{{ tags.tagsForCategory(cat.dataId).length }} tags</span
              >
            </header>

            <div class="tag-list-toolbar">
              <button
                type="button"
                class="simx-btn simx-btn--small simx-btn--primary"
                (click)="addTag(cat.dataId)"
              >
                <i class="pi pi-plus" aria-hidden="true"></i>
                Add Tag
              </button>
            </div>

            @for (tag of filteredTags(cat); track tag.dataId) {
              <div class="tag-row">
                @if (editingTagId() === tag.dataId) {
                  <input
                    class="inline-input"
                    [ngModel]="editLabel()"
                    (ngModelChange)="editLabel.set($event)"
                    (keydown.enter)="saveTag(tag)"
                    (keydown.escape)="cancelEdit()"
                  />
                  <button
                    type="button"
                    class="simx-btn simx-btn--small"
                    (click)="saveTag(tag)"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    class="simx-btn simx-btn--small"
                    (click)="cancelEdit()"
                  >
                    Cancel
                  </button>
                } @else {
                  <span class="tag-label">{{ tag.label }}</span>
                  @if (isScraped(tag)) {
                    <span class="tag-badge" title="Written by the Unity scrape; cannot be renamed or deleted">Scraped</span>
                  } @else {
                    <button
                      type="button"
                      class="icon-btn"
                      title="Rename tag"
                      (click)="startEditTag(tag)"
                    >
                      <i class="pi pi-pencil" aria-hidden="true"></i>
                    </button>
                    <button
                      type="button"
                      class="icon-btn danger"
                      title="Delete tag"
                      (click)="removeTag(tag)"
                    >
                      <i class="pi pi-trash" aria-hidden="true"></i>
                    </button>
                  }
                }
              </div>
            } @empty {
              <div class="empty-note">
                @if (search()) {
                  No tags match “{{ search() }}”.
                } @else if (cat.scope === 'global') {
                  No global tags yet. Add one to use it on any asset type.
                } @else {
                  No tags specific to {{ cat.label }} yet.
                }
              </div>
            }
          } @else {
            <div class="empty-panel">Select a tag group to edit its tags.</div>
          }
        </div>
      </div>
    </section>
  `,
  styleUrl: './tags-page.component.scss',
})
export class TagsPageComponent {
  readonly tags = inject(TagTaxonomyService);

  readonly search = signal('');
  readonly selectedId = signal(GLOBAL_TAG_CATEGORY_ID);
  readonly editingTagId = signal<string | null>(null);
  readonly editLabel = signal('');

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.editingTagId()) this.cancelEdit();
  }

  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    void this.tags.flush();
  }

  leave(): void {
    void this.tags.closePage();
  }

  selectedCategory(): TagCategoryRecord | undefined {
    const id = this.selectedId();
    return this.tags.categories().find((c) => c.dataId === id) ?? this.filteredGlobal();
  }

  filteredGlobal(): TagCategoryRecord | undefined {
    const global = this.tags.globalCategory();
    if (!global) return undefined;
    if (this.groupMatches(global)) return global;
    return undefined;
  }

  filteredTypeCategories(): TagCategoryRecord[] {
    return this.tags.typeCategories().filter((c) => this.groupMatches(c));
  }

  filteredOtherCategories(): TagCategoryRecord[] {
    return this.tags.otherCategories().filter((c) => this.groupMatches(c));
  }

  filteredTags(cat: TagCategoryRecord): TagRecord[] {
    const q = this.search().trim().toLowerCase();
    const list = this.tags.tagsForCategory(cat.dataId);
    if (!q) return list;
    if (cat.label.toLowerCase().includes(q)) return list;
    return list.filter((t) => t.label.toLowerCase().includes(q));
  }

  scopeCopy(cat: TagCategoryRecord): string {
    if (cat.scope === 'global') {
      return 'These tags can be applied and accepted on any asset type.';
    }
    return `These tags apply only to ${cat.label} assets.`;
  }

  onSearch(value: string): void {
    this.search.set(value);
    const selected = this.selectedCategory();
    if (selected && this.groupMatches(selected)) return;
    const next =
      this.filteredGlobal() ??
      this.filteredTypeCategories()[0] ??
      this.filteredOtherCategories()[0];
    if (next) this.selectedId.set(next.dataId);
  }

  select(id: string): void {
    this.selectedId.set(id);
    this.cancelEdit();
  }

  async addTag(categoryId: string): Promise<void> {
    const tag = await this.tags.createTag(categoryId);
    this.startEditTag(tag);
  }

  startEditTag(tag: TagRecord): void {
    this.editingTagId.set(tag.dataId);
    this.editLabel.set(tag.label);
  }

  async saveTag(tag: TagRecord): Promise<void> {
    await this.tags.updateTagLabel(tag.dataId, this.editLabel());
    this.cancelEdit();
  }

  async removeTag(tag: TagRecord): Promise<void> {
    if (!confirm(`Delete tag “${tag.label}”?`)) return;
    await this.tags.deleteTag(tag.dataId);
    this.cancelEdit();
  }

  cancelEdit(): void {
    this.editingTagId.set(null);
    this.editLabel.set('');
  }

  isScraped(tag: TagRecord): boolean {
    return isScrapedTag(tag);
  }

  private groupMatches(cat: TagCategoryRecord): boolean {
    const q = this.search().trim().toLowerCase();
    if (!q) return true;
    if (cat.label.toLowerCase().includes(q)) return true;
    return this.tags
      .tagsForCategory(cat.dataId)
      .some((t) => t.label.toLowerCase().includes(q));
  }
}
