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
  templateUrl: './image-lightbox.component.html',
  styleUrl: './image-lightbox.component.scss',
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

  prevIndex(): number {
    const len = this.urls.length;
    if (len < 2) return 0;
    return (this.index - 1 + len) % len;
  }

  nextIndex(): number {
    const len = this.urls.length;
    if (len < 2) return 0;
    return (this.index + 1) % len;
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
    this.goTo(this.prevIndex());
  }

  next(): void {
    this.goTo(this.nextIndex());
  }

  private goTo(next: number): void {
    if (this.urls.length < 2 || next === this.index) return;
    this.index = next;
    this.indexChange.emit(next);
  }
}
