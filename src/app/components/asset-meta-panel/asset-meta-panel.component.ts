import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DboAsset } from '../../models/dbo.models';
import {
  ASSET_META_STATUSES,
  AssetMetaCarouselBlock,
  AssetMetaNoteBlock,
  AssetMetaStatus,
  assetMetaRecordHasContent,
  carouselSlideCaption,
} from '../../models/asset-meta.models';
import { AssetMetaService } from '../../services/asset-meta.service';
import { AuthenticationService } from '../../services/authentication.service';
import { MarkdownHtmlPipe } from '../../pipes/markdown-html.pipe';
import { ImageLightboxComponent } from '../image-lightbox/image-lightbox.component';
import {
  applyMarkdownHeading,
  insertMarkdownLink,
  wrapMarkdownInline,
} from '../../utils/markdown-edit.util';

@Component({
  selector: 'app-asset-meta-panel',
  standalone: true,
  imports: [
    CommonModule,
    NgTemplateOutlet,
    FormsModule,
    MarkdownHtmlPipe,
    ImageLightboxComponent,
  ],
  templateUrl: './asset-meta-panel.component.html',
  styleUrl: './asset-meta-panel.component.scss',
  host: {
    '[class.notes-only]': 'showNotes && !showComments',
    '[class.comments-only]': '!showNotes && showComments',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeStatusMenu()',
  },
})
export class AssetMetaPanelComponent implements OnChanges {
  @Input({ required: true }) asset!: DboAsset;
  @Input() showNotes = true;
  @Input() showComments = true;

  readonly meta = inject(AssetMetaService);
  readonly auth = inject(AuthenticationService);
  readonly statuses = ASSET_META_STATUSES;

  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly pickingNoteType = signal(false);
  readonly commentDraft = signal('');
  readonly carouselIndex = signal<Record<string, number>>({});
  readonly statusMenuOpen = signal(false);

  readonly lightboxOpen = signal(false);
  readonly lightboxUrls = signal<string[]>([]);
  readonly lightboxCaptions = signal<string[]>([]);
  readonly lightboxIndex = signal(0);
  private readonly assetId = signal('');

  /** Re-read when records or the open asset change. */
  readonly record = computed(() => {
    void this.meta.records();
    return this.meta.recordFor(this.assetId()) ?? null;
  });

  readonly canEdit = computed(() => this.meta.canEditMeta());
  readonly editingNoteId = computed(() => {
    void this.meta.drafts();
    return this.meta.draftFor(this.assetId())?.editingNoteId ?? null;
  });

  readonly status = computed(() => {
    void this.meta.records();
    void this.meta.drafts();
    return this.meta.effectiveStatus(this.assetId());
  });

  notes(): AssetMetaNoteBlock[] {
    void this.meta.records();
    void this.meta.drafts();
    return this.meta.effectiveNotes(this.assetId());
  }

  readonly canClearMetadata = computed(() => {
    const id = this.assetId();
    return (
      this.canEdit() &&
      (assetMetaRecordHasContent(this.record()) || this.meta.isDirty(id))
    );
  });

  draftBlock(): AssetMetaNoteBlock | null {
    const id = this.editingNoteId();
    if (!id) return null;
    return this.notes().find((block) => block.id === id) ?? null;
  }

  busy(): boolean {
    return this.saving() || this.meta.savingDraft();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['asset']) {
      this.assetId.set(this.asset?.AssetId ?? '');
      this.closeStatusMenu();
      this.pickingNoteType.set(false);
      this.commentDraft.set('');
      this.carouselIndex.set({});
    }
  }

  snapshot() {
    return {
      assetKey: String(this.asset.Data?.['AssetKey'] ?? ''),
      type: this.asset.AssetType,
      name: this.asset.AssetName,
    };
  }

  statusLabel(status: AssetMetaStatus | undefined): string {
    return status ?? '—';
  }

  toggleStatusMenu(event: Event): void {
    event.stopPropagation();
    if (this.busy()) return;
    this.statusMenuOpen.update((open) => !open);
  }

  closeStatusMenu(): void {
    this.statusMenuOpen.set(false);
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.statusMenuOpen()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.status-picker')) return;
    this.closeStatusMenu();
  }

  pickStatus(value: string): void {
    this.closeStatusMenu();
    const current = this.status() ?? '';
    if (value === current || !this.canEdit() || this.busy()) return;
    this.error.set(null);
    this.meta.setDraftStatus(
      this.asset.AssetId,
      value === '' ? null : (value as AssetMetaStatus),
    );
  }

  startAddNote(): void {
    if (!this.canEdit() || this.editingNoteId() || this.busy()) return;
    this.pickingNoteType.set(true);
    this.error.set(null);
  }

  cancelNoteType(): void {
    this.pickingNoteType.set(false);
    this.error.set(null);
  }

  async clearMetadata(): Promise<void> {
    if (!this.canClearMetadata() || this.busy()) return;
    const ok = window.confirm(
      'Clear all curated metadata for this asset (status, tags, notes, comments, and media)? This cannot be undone.',
    );
    if (!ok) return;
    this.saving.set(true);
    this.error.set(null);
    this.pickingNoteType.set(false);
    try {
      await this.meta.clearRecord(this.asset.AssetId);
    } catch (e: unknown) {
      this.error.set(
        e instanceof Error ? e.message : 'Failed to clear metadata.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  startNewNote(type: AssetMetaNoteBlock['type']): void {
    if (!this.canEdit()) return;
    let block: AssetMetaNoteBlock;
    if (type === 'markdown') {
      block = { id: crypto.randomUUID(), type: 'markdown', markdown: '' };
    } else if (type === 'image') {
      block = { id: crypto.randomUUID(), type: 'image', mediaId: '', alt: '' };
    } else if (type === 'video') {
      block = { id: crypto.randomUUID(), type: 'video', mediaId: '', caption: '' };
    } else {
      block = { id: crypto.randomUUID(), type: 'carousel', mediaIds: [], slideCaptions: {} };
    }
    this.meta.beginNewNote(this.asset.AssetId, block);
    this.pickingNoteType.set(false);
    this.error.set(null);
  }

  startEditNote(block: AssetMetaNoteBlock): void {
    if (!this.canEdit() || this.editingNoteId() || this.busy()) return;
    this.meta.setDraftEditingNote(this.asset.AssetId, block.id);
    this.pickingNoteType.set(false);
    this.error.set(null);
  }

  closeNoteEditor(): void {
    this.meta.setDraftEditingNote(this.asset.AssetId, null);
    this.error.set(null);
  }

  deleteEditingNote(): void {
    const draft = this.draftBlock();
    if (!draft || !this.canEdit() || this.busy()) return;
    this.meta.removeDraftNote(this.asset.AssetId, draft.id);
    this.error.set(null);
  }

  updateMarkdown(markdown: string): void {
    const block = this.draftBlock();
    if (block?.type !== 'markdown') return;
    this.meta.patchDraftNote(this.asset.AssetId, block.id, () => ({
      ...block,
      markdown,
    }));
  }

  applyMarkdownInline(
    el: HTMLTextAreaElement,
    prefix: string,
    suffix: string,
  ): void {
    const result = wrapMarkdownInline(
      el.value,
      el.selectionStart,
      el.selectionEnd,
      prefix,
      suffix,
    );
    this.updateMarkdown(result.value);
    this.restoreMdSelection(el, result.start, result.end);
  }

  onMarkdownStyle(el: HTMLTextAreaElement, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const raw = select.value;
    select.value = '';
    if (raw === '') return;
    const level = Number(raw);
    if (level !== 0 && level !== 1 && level !== 2 && level !== 3) return;
    const result = applyMarkdownHeading(
      el.value,
      el.selectionStart,
      el.selectionEnd,
      level,
    );
    this.updateMarkdown(result.value);
    this.restoreMdSelection(el, result.start, result.end);
  }

  insertMarkdownUrl(el: HTMLTextAreaElement): void {
    const url = window.prompt('Link URL', 'https://');
    if (url == null) return;
    const result = insertMarkdownLink(
      el.value,
      el.selectionStart,
      el.selectionEnd,
      url,
    );
    this.updateMarkdown(result.value);
    this.restoreMdSelection(el, result.start, result.end);
  }

  private restoreMdSelection(
    el: HTMLTextAreaElement,
    start: number,
    end: number,
  ): void {
    queueMicrotask(() => {
      el.focus();
      el.setSelectionRange(start, end);
    });
  }

  updateImageAlt(alt: string): void {
    const block = this.draftBlock();
    if (block?.type !== 'image') return;
    this.meta.patchDraftNote(this.asset.AssetId, block.id, () => ({
      ...block,
      alt,
    }));
  }

  updateVideoCaption(caption: string): void {
    const block = this.draftBlock();
    if (block?.type !== 'video') return;
    this.meta.patchDraftNote(this.asset.AssetId, block.id, () => ({
      ...block,
      caption,
    }));
  }

  updateSlideCaption(mediaId: string, caption: string): void {
    const block = this.draftBlock();
    if (block?.type !== 'carousel') return;
    const slideCaptions = { ...(block.slideCaptions ?? {}) };
    if (caption) slideCaptions[mediaId] = caption;
    else delete slideCaptions[mediaId];
    this.meta.patchDraftNote(this.asset.AssetId, block.id, () => ({
      ...block,
      slideCaptions,
    }));
  }

  async onMediaFile(event: Event, mode: 'image' | 'carousel' | 'video'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const uploaded = await this.meta.uploadMedia(
        this.asset.AssetId,
        file,
        this.snapshot(),
      );
      this.meta.addPendingUpload(this.asset.AssetId, uploaded.id);
      const block = this.draftBlock();
      if (mode === 'image' && block?.type === 'image') {
        this.meta.patchDraftNote(this.asset.AssetId, block.id, () => ({
          ...block,
          mediaId: uploaded.id,
        }));
      } else if (mode === 'video' && block?.type === 'video') {
        this.meta.patchDraftNote(this.asset.AssetId, block.id, () => ({
          ...block,
          mediaId: uploaded.id,
        }));
      } else if (mode === 'carousel' && block?.type === 'carousel') {
        this.meta.patchDraftNote(this.asset.AssetId, block.id, () => ({
          ...block,
          mediaIds: [...(block.mediaIds ?? []), uploaded.id],
        }));
      }
    } catch (e: unknown) {
      this.error.set(
        e instanceof Error ? e.message : 'Failed to upload media.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  removeCarouselSlide(mediaId: string): void {
    const block = this.draftBlock();
    if (block?.type !== 'carousel') return;
    const slideCaptions = { ...(block.slideCaptions ?? {}) };
    delete slideCaptions[mediaId];
    this.meta.patchDraftNote(this.asset.AssetId, block.id, () => ({
      ...block,
      mediaIds: block.mediaIds.filter((id) => id !== mediaId),
      slideCaptions,
    }));
  }

  clearImageBlock(): void {
    const block = this.draftBlock();
    if (block?.type !== 'image') return;
    this.meta.patchDraftNote(this.asset.AssetId, block.id, () => ({
      ...block,
      mediaId: '',
    }));
  }

  clearVideoBlock(): void {
    const block = this.draftBlock();
    if (block?.type !== 'video') return;
    this.meta.patchDraftNote(this.asset.AssetId, block.id, () => ({
      ...block,
      mediaId: '',
    }));
  }

  mediaSrc(mediaId: string | undefined | null): string | null {
    if (!mediaId) return null;
    return this.meta.mediaSrc(this.asset.AssetId, mediaId);
  }

  carouselUrls(block: AssetMetaCarouselBlock): string[] {
    return (block.mediaIds ?? [])
      .map((id) => this.mediaSrc(id))
      .filter((u): u is string => !!u);
  }

  currentCarouselIndex(blockId: string): number {
    return this.carouselIndex()[blockId] ?? 0;
  }

  setCarouselIndex(blockId: string, index: number, len: number): void {
    if (len <= 0) return;
    const wrapped = ((index % len) + len) % len;
    this.carouselIndex.set({ ...this.carouselIndex(), [blockId]: wrapped });
  }

  carouselCaption(block: AssetMetaCarouselBlock): string {
    return carouselSlideCaption(block, this.currentCarouselIndex(block.id));
  }

  openLightbox(urls: string[], index = 0, captions: string[] = []): void {
    if (!urls.length) return;
    this.lightboxUrls.set(urls);
    this.lightboxCaptions.set(captions);
    this.lightboxIndex.set(index);
    this.lightboxOpen.set(true);
  }

  openImageLightbox(mediaId: string, alt = ''): void {
    const src = this.mediaSrc(mediaId);
    if (src) this.openLightbox([src], 0, [alt]);
  }

  openCarouselLightbox(block: AssetMetaCarouselBlock, index: number): void {
    const urls = this.carouselUrls(block);
    const captions = (block.mediaIds ?? []).map((_, i) =>
      carouselSlideCaption(block, i),
    );
    this.openLightbox(urls, index, captions);
  }

  closeLightbox(): void {
    this.lightboxOpen.set(false);
  }

  async submitComment(): Promise<void> {
    if (!this.canEdit() || this.busy()) return;
    const body = this.commentDraft().trim();
    if (!body) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.meta.addComment(
        this.asset.AssetId,
        body,
        this.auth.author(),
        this.snapshot(),
      );
      this.commentDraft.set('');
    } catch (e: unknown) {
      this.error.set(
        e instanceof Error ? e.message : 'Failed to add comment.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  formatDate(iso: string | undefined): string {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }
}
