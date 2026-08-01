import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../services/app-state.service';

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
        <div class="search-wrapper">
          <input
            type="text"
            placeholder="Search by asset name..."
            [ngModel]="state.searchQuery()"
            (ngModelChange)="state.searchQuery.set($event)"
          />
          @if (state.searchQuery()) {
            <button class="search-clear" (click)="state.searchQuery.set('')" title="Clear search">
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          }
        </div>
        <button class="export-btn simx-btn simx-btn--small" title="Export filtered list to CSV" (click)="state.exportCsv()">
          <i class="pi pi-download" aria-hidden="true"></i>
          Export
        </button>
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
            <div class="empty-list">No assets in this category.</div>
          }
        </div>
        @if (showLetter()) {
          <div class="letter-indicator" aria-hidden="true">{{ currentLetter() }}</div>
        }
      </div>
    </section>
  `,
  styleUrl: './asset-list.component.scss',
})
export class AssetListComponent {
  readonly state = inject(AppStateService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly listScroll = viewChild<ElementRef<HTMLDivElement>>('listScroll');

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
    afterNextRender(() => this.bindScrollInteractions());
  }

  onItemClick(event: MouseEvent, assetId: string): void {
    if (this.suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      this.suppressClick = false;
      return;
    }
    this.state.openAssetTab(assetId, true);
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
