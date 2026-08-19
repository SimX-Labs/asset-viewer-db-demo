import { Component, Input } from '@angular/core';

/**
 * Full-area loading cover modeled on Scenario Creator's processing-indicator
 * overlay: spinner + watermark-style label over the content beneath.
 */
@Component({
  selector: 'app-loading-coverage',
  standalone: true,
  template: `
    <div
      class="loading-coverage"
      [class.loading-coverage--dark]="dark"
      role="status"
      aria-live="polite"
    >
      <div class="loading-coverage-block">
        <div class="loading-coverage-spinner" aria-hidden="true"></div>
        <div class="loading-coverage-label">{{ label }}</div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        inset: 0;
        pointer-events: all;
        position: absolute;
        z-index: 50;
      }

      .loading-coverage {
        align-items: center;
        background: color-mix(in srgb, var(--bg-app, #f6f7f8) 72%, transparent);
        display: flex;
        height: 100%;
        justify-content: center;
        width: 100%;
      }

      .loading-coverage--dark {
        background: color-mix(in srgb, var(--bg-main, #0b1220) 72%, transparent);
      }

      .loading-coverage-block {
        align-items: center;
        display: flex;
        flex-direction: column;
        gap: 20px;
        justify-content: center;
      }

      .loading-coverage-spinner {
        animation: LoadingCoverageSpinner 1.5s ease-in-out infinite;
        border-bottom-color: rgba(0, 0, 0, 0.2);
        border-left-color: rgba(0, 0, 0, 0.2);
        border-radius: 50%;
        border-right-color: rgba(0, 0, 0, 0.2);
        border-style: solid;
        border-top-color: var(--simx-color-bright-accent, #e31f2f);
        border-width: 7px;
        box-sizing: border-box;
        height: 50px;
        width: 50px;
      }

      .loading-coverage--dark .loading-coverage-spinner {
        border-bottom-color: rgba(255, 255, 255, 0.25);
        border-left-color: rgba(255, 255, 255, 0.25);
        border-right-color: rgba(255, 255, 255, 0.25);
      }

      .loading-coverage-label {
        color: var(--simx-content-light, #bbc4cd);
        font-family: var(--font-graphic, 'Quicksand', sans-serif);
        font-size: 24px;
        font-weight: 300;
        letter-spacing: 0.01em;
        opacity: 0.85;
        text-align: center;
      }

      .loading-coverage--dark .loading-coverage-label {
        color: rgba(255, 255, 255, 0.72);
        opacity: 1;
      }

      @keyframes LoadingCoverageSpinner {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class LoadingCoverageComponent {
  @Input() label = 'Loading…';
  /** Use the dark-surface spinner/label treatment (model-only preview). */
  @Input() dark = false;
}
