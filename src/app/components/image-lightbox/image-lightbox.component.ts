import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-lightbox',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      (click)="onBackdrop($event)"
    >
      <button
        type="button"
        class="lightbox-close"
        title="Close (Esc)"
        (click)="close.emit()"
      >
        <i class="pi pi-times" aria-hidden="true"></i>
      </button>

      @if (urls.length > 1) {
        <button
          type="button"
          class="lightbox-nav lightbox-nav--prev"
          title="Previous"
          (click)="$event.stopPropagation(); prev()"
        >
          <i class="pi pi-chevron-left" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="lightbox-nav lightbox-nav--next"
          title="Next"
          (click)="$event.stopPropagation(); next()"
        >
          <i class="pi pi-chevron-right" aria-hidden="true"></i>
        </button>
      }

      <img
        class="lightbox-image"
        [src]="urls[index] || urls[0]"
        [alt]="currentCaption() || alt || ''"
        (click)="$event.stopPropagation()"
      />

      @if (currentCaption(); as caption) {
        <div class="lightbox-caption" (click)="$event.stopPropagation()">
          {{ caption }}
        </div>
      }

      @if (urls.length > 1) {
        <div class="lightbox-counter" (click)="$event.stopPropagation()">
          {{ index + 1 }} / {{ urls.length }}
        </div>
      }
    </div>
  `,
  styles: [
    `
      .lightbox-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1200;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.78);
        padding: 24px;
        cursor: pointer;
      }
      .lightbox-image {
        max-width: min(96vw, 1400px);
        max-height: 90vh;
        object-fit: contain;
        border-radius: 4px;
        box-shadow: 0 8px 40px rgba(0, 0, 0, 0.45);
        cursor: default;
        user-select: none;
      }
      .lightbox-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.12);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
      }
      .lightbox-close:hover {
        background: rgba(255, 255, 255, 0.22);
      }
      .lightbox-nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 48px;
        height: 48px;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.12);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
      }
      .lightbox-nav:hover {
        background: rgba(255, 255, 255, 0.22);
      }
      .lightbox-nav--prev {
        left: 16px;
      }
      .lightbox-nav--next {
        right: 16px;
      }
      .lightbox-caption {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        max-width: min(80vw, 720px);
        color: rgba(255, 255, 255, 0.95);
        font-size: 0.9rem;
        line-height: 1.4;
        text-align: center;
        background: rgba(0, 0, 0, 0.55);
        padding: 8px 14px;
        border-radius: 8px;
        cursor: default;
      }
      .lightbox-backdrop:has(.lightbox-counter) .lightbox-caption {
        bottom: 56px;
      }
      .lightbox-counter {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        color: rgba(255, 255, 255, 0.9);
        font-size: 0.85rem;
        background: rgba(0, 0, 0, 0.45);
        padding: 4px 12px;
        border-radius: 999px;
        cursor: default;
      }
    `,
  ],
})
export class ImageLightboxComponent {
  @Input({ required: true }) urls: string[] = [];
  @Input() captions: string[] = [];
  @Input() index = 0;
  @Input() alt = '';
  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly indexChange = new EventEmitter<number>();

  currentCaption(): string {
    return (this.captions[this.index] ?? this.alt ?? '').trim();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close.emit();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.prev();
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();
    }
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  prev(): void {
    if (this.urls.length < 2) return;
    const next = (this.index - 1 + this.urls.length) % this.urls.length;
    this.index = next;
    this.indexChange.emit(next);
  }

  next(): void {
    if (this.urls.length < 2) return;
    const next = (this.index + 1) % this.urls.length;
    this.index = next;
    this.indexChange.emit(next);
  }
}
