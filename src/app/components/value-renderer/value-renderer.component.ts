import {
  Component,
  Output,
  EventEmitter,
  inject,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/app-state.service';
import { AssetRef } from '../../models/dbo.models';
import { formatDateTime, isDateTimeString } from '../../utils/datetime.util';
import { liquidColorCss } from '../../utils/liquid-color.util';

@Component({
  selector: 'app-value-renderer',
  standalone: true,
  imports: [CommonModule, ValueRendererComponent],
  template: `
    @if (isNull()) {
      <span class="clean-empty">null</span>
    } @else if (isLinkGroup()) {
      <div class="link-group-wrapper">
        @if (linkItems().length > 5) {
          <input
            type="text"
            class="link-group-search"
            placeholder="Filter {{ linkItems().length }} items..."
            [value]="linkFilter()"
            (input)="linkFilter.set($any($event.target).value)"
          />
        }
        <div class="link-group-list">
          @for (item of filteredLinkItems(); track item.AssetId + $index) {
            <div
              class="link-group-item"
              [class.link-invalid-item]="!hasAsset(item.AssetId)"
              (click)="onLinkClick(item.AssetId)"
            >
              <span class="link-name" [class.link-invalid]="!hasAsset(item.AssetId)">
                {{ linkLabel(item.AssetId) }}
              </span>
              @if (item.AssociationData && objectKeys(item.AssociationData).length) {
                <div class="link-meta">
                  Data:
                  <app-value-renderer [value]="item.AssociationData" [depth]="depth() + 1" />
                </div>
              }
            </div>
          }
        </div>
      </div>
    } @else if (isSingleLink()) {
      <div class="assoc-container">
        <a class="assoc-link" (click)="onLinkClick(linkObject()!.AssetId); $event.preventDefault()">
          {{ linkLabel(linkObject()!.AssetId) }}
        </a>
        @if (linkObject()!.AssociationData && objectKeys(linkObject()!.AssociationData!).length) {
          <div class="assoc-meta">
            Data:
            <app-value-renderer [value]="linkObject()!.AssociationData" [depth]="depth() + 1" />
          </div>
        }
      </div>
    } @else if (isCustomization()) {
      <div class="customization-list">
        @for (item of customizationItems(); track $index) {
          <div class="customization-cell">
            @for (key of objectKeys(item); track key) {
              <div class="custom-row">
                <span class="custom-key">{{ key }}:</span>
                <span class="custom-val">{{ item[key] }}</span>
              </div>
            }
          </div>
        }
      </div>
    } @else if (isArray()) {
      @if (arrayValue().length === 0) {
        <span class="clean-empty">[]</span>
      } @else {
        <div class="clean-list">
          @for (item of arrayValue(); track $index) {
            <div class="clean-item">
              <app-value-renderer [value]="item" [depth]="depth() + 1" />
            </div>
          }
        </div>
      }
    } @else if (isObject()) {
      @if (objectKeys(objectValue()).length === 0) {
        <span class="clean-empty">&#123;&#125;</span>
      } @else {
        <div class="clean-object">
          @for (key of objectKeys(objectValue()); track key) {
            <div class="clean-row">
              <span class="clean-key">{{ key }}:</span>
              <span class="clean-val">
                <app-value-renderer
                  [value]="objectValue()[key]"
                  [propertyKey]="key"
                  [depth]="depth() + 1"
                />
              </span>
            </div>
          }
        </div>
      }
    } @else if (isDateTime()) {
      <span class="datetime-value" [title]="rawText()">{{ primitiveValue() }}</span>
    } @else if (colorCss()) {
      <span class="color-value" [title]="rawText()">
        <span class="color-swatch" [style.background-color]="colorCss()"></span>
        {{ primitiveValue() }}
      </span>
    } @else {
      {{ primitiveValue() }}
    }
  `,
})
export class ValueRendererComponent {
  // Signal inputs so nested computeds invalidate when the parent rebinds a
  // reused renderer (e.g. AssetKey row kept across equipment → tool navigation).
  readonly value = input<unknown>(undefined);
  readonly propertyKey = input('');
  readonly depth = input(0);
  @Output() linkClick = new EventEmitter<string>();

  private readonly state = inject(AppStateService);
  readonly linkFilter = signal('');

  readonly objectKeys = Object.keys;

  isNull = computed(() => {
    const v = this.value();
    return v === null || v === undefined;
  });

  isArray = computed(() => Array.isArray(this.value()));
  arrayValue = computed(() => (this.value() ?? []) as unknown[]);

  isObject = computed(() => {
    const v = this.value();
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  });
  objectValue = computed(() => (this.value() ?? {}) as Record<string, unknown>);

  isLinkGroup = computed(() => {
    const arr = this.arrayValue();
    return arr.length > 0 && this.isAssetRef(arr[0]);
  });

  linkItems = computed(() => this.arrayValue() as AssetRef[]);

  filteredLinkItems = computed(() => {
    const filter = this.linkFilter().toLowerCase();
    if (!filter) return this.linkItems();
    return this.linkItems().filter((item) => {
      const label = this.linkLabel(item.AssetId).toLowerCase();
      return label.includes(filter);
    });
  });

  isSingleLink = computed(() => this.isObject() && 'AssetId' in this.objectValue());
  linkObject = computed(() => (this.isSingleLink() ? (this.value() as AssetRef) : null));

  isCustomization = computed(
    () => this.propertyKey() === 'Customizations' && this.isArray()
  );

  customizationItems = computed(
    () => this.arrayValue() as Record<string, unknown>[]
  );

  isDateTime = computed(() => isDateTimeString(this.value()));
  rawText = computed(() => String(this.value() ?? ''));
  colorCss = computed(() => liquidColorCss(this.value(), this.propertyKey()));

  primitiveValue = computed(() => {
    const v = this.value();
    return isDateTimeString(v) ? formatDateTime(v) : String(v ?? '');
  });

  private isAssetRef(val: unknown): val is AssetRef {
    return !!val && typeof val === 'object' && 'AssetId' in (val as object);
  }

  hasAsset(id: string): boolean {
    return !!this.state.assetMap()[id];
  }

  linkLabel(id: string): string {
    const asset = this.state.assetMap()[id];
    return asset?.AssetName ?? id;
  }

  onLinkClick(id: string): void {
    if (!id || !this.hasAsset(id)) return;
    this.state.openAssetTab(id, false);
  }
}
