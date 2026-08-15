import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TagTaxonomyService } from '../../services/tag-taxonomy.service';
import { TagCategoryRecord, TagRecord } from '../../models/tag.models';

@Component({
  selector: 'app-tags-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tags-backdrop" (click)="onBackdrop()">
      <div
        class="tags-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Tags"
        (click)="$event.stopPropagation()"
      >
        <header class="tags-dialog-head">
          <div>
            <h2 class="tags-dialog-title">Tags</h2>
            <p class="tags-dialog-sub">
              Manage tag categories and tags. Assigning tags to assets comes later.
            </p>
          </div>
          <button
            type="button"
            class="tags-close"
            title="Close (Esc)"
            (click)="tags.closeModal()"
          >
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        </header>

        <div class="tags-toolbar">
          <input
            type="text"
            class="tags-search"
            placeholder="Search categories and tags…"
            [ngModel]="search()"
            (ngModelChange)="search.set($event)"
          />
          <button
            type="button"
            class="simx-btn simx-btn--primary simx-btn--small"
            (click)="addCategory()"
          >
            <i class="pi pi-plus" aria-hidden="true"></i>
            Add Category
          </button>
        </div>

        @if (tags.statusMessage()) {
          <div class="tags-status">{{ tags.statusMessage() }}</div>
        }

        <div class="tags-body">
          @for (cat of filteredCategories(); track cat.dataId) {
            <section class="category-card">
              <header class="category-head">
                <button
                  type="button"
                  class="expand-btn"
                  (click)="toggleExpand(cat.dataId)"
                  [attr.aria-expanded]="expanded()[cat.dataId] !== false"
                >
                  <i
                    class="pi"
                    [class.pi-chevron-down]="expanded()[cat.dataId] !== false"
                    [class.pi-chevron-right]="expanded()[cat.dataId] === false"
                    aria-hidden="true"
                  ></i>
                </button>

                @if (editingCategoryId() === cat.dataId) {
                  <input
                    class="inline-input"
                    [ngModel]="editLabel()"
                    (ngModelChange)="editLabel.set($event)"
                    (keydown.enter)="saveCategory(cat)"
                    (keydown.escape)="cancelEdit()"
                  />
                  <button
                    type="button"
                    class="simx-btn simx-btn--small"
                    (click)="saveCategory(cat)"
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
                  <span class="category-label">{{ cat.label }}</span>
                  <span class="category-count"
                    >{{ tags.tagsForCategory(cat.dataId).length }} tags</span
                  >
                  <button
                    type="button"
                    class="icon-btn"
                    title="Rename category"
                    (click)="startEditCategory(cat)"
                  >
                    <i class="pi pi-pencil" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    class="icon-btn danger"
                    title="Delete category"
                    (click)="removeCategory(cat)"
                  >
                    <i class="pi pi-trash" aria-hidden="true"></i>
                  </button>
                }
              </header>

              @if (expanded()[cat.dataId] !== false) {
                <div class="category-body">
                  <div class="tag-list-toolbar">
                    <button
                      type="button"
                      class="simx-btn simx-btn--small"
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
                    </div>
                  } @empty {
                    <div class="empty-note">No tags in this category yet.</div>
                  }
                </div>
              }
            </section>
          } @empty {
            <div class="empty-panel">
              @if (search()) {
                No categories match “{{ search() }}”.
              } @else {
                No tag categories yet. Create one to get started.
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './tags-modal.component.scss',
})
export class TagsModalComponent {
  readonly tags = inject(TagTaxonomyService);

  readonly search = signal('');
  readonly expanded = signal<Record<string, boolean>>({});
  readonly editingCategoryId = signal<string | null>(null);
  readonly editingTagId = signal<string | null>(null);
  readonly editLabel = signal('');

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.editingCategoryId() || this.editingTagId()) {
      this.cancelEdit();
      return;
    }
    this.tags.closeModal();
  }

  onBackdrop(): void {
    this.tags.closeModal();
  }

  filteredCategories(): TagCategoryRecord[] {
    const q = this.search().trim().toLowerCase();
    const cats = this.tags.categories();
    if (!q) return cats;
    return cats.filter((c) => {
      if (c.label.toLowerCase().includes(q)) return true;
      return this.tags
        .tagsForCategory(c.dataId)
        .some((t) => t.label.toLowerCase().includes(q));
    });
  }

  filteredTags(cat: TagCategoryRecord): TagRecord[] {
    const q = this.search().trim().toLowerCase();
    const list = this.tags.tagsForCategory(cat.dataId);
    if (!q) return list;
    if (cat.label.toLowerCase().includes(q)) return list;
    return list.filter((t) => t.label.toLowerCase().includes(q));
  }

  toggleExpand(id: string): void {
    const cur = { ...this.expanded() };
    cur[id] = cur[id] === false;
    this.expanded.set(cur);
  }

  async addCategory(): Promise<void> {
    const cat = await this.tags.createCategory();
    this.expanded.update((e) => ({ ...e, [cat.dataId]: true }));
    this.startEditCategory(cat);
  }

  startEditCategory(cat: TagCategoryRecord): void {
    this.editingTagId.set(null);
    this.editingCategoryId.set(cat.dataId);
    this.editLabel.set(cat.label);
  }

  async saveCategory(cat: TagCategoryRecord): Promise<void> {
    await this.tags.updateCategoryLabel(cat.dataId, this.editLabel());
    this.cancelEdit();
  }

  async removeCategory(cat: TagCategoryRecord): Promise<void> {
    if (
      !confirm(
        `Delete category “${cat.label}”? Tags that only belong to this category will also be deleted.`,
      )
    ) {
      return;
    }
    await this.tags.deleteCategory(cat.dataId);
    this.cancelEdit();
  }

  async addTag(categoryId: string): Promise<void> {
    const tag = await this.tags.createTag(categoryId);
    this.expanded.update((e) => ({ ...e, [categoryId]: true }));
    this.startEditTag(tag);
  }

  startEditTag(tag: TagRecord): void {
    this.editingCategoryId.set(null);
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
    this.editingCategoryId.set(null);
    this.editingTagId.set(null);
    this.editLabel.set('');
  }
}
