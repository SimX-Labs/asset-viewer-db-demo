import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/app-state.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="top-bar">
      <div class="top-bar-left">
        <h1 class="app-title">SimX DBO Explorer</h1>
        <span class="status" [class.error]="state.statusError()">{{ state.statusMessage() }}</span>
      </div>
      <div class="top-bar-right">
        <button class="top-bar-btn theme-btn" (click)="theme.toggle()" [title]="theme.themeLabel()">
          @if (theme.resolvedTheme() === 'dark') {
            <span>☀ Light</span>
          } @else {
            <span>☾ Dark</span>
          }
        </button>
        <div class="settings-container">
          <button class="top-bar-btn" (click)="showFiles.set(!showFiles())">ℹ</button>
          @if (showFiles()) {
            <div class="settings-dropdown show">
              <div class="dropdown-title">Loaded Files</div>
              @for (name of state.loadedFileNames(); track name) {
                <div class="dropdown-item">{{ name }}</div>
              } @empty {
                <div class="dropdown-item muted">No files loaded.</div>
              }
            </div>
          }
        </div>
        <div class="settings-container">
          <button class="top-bar-btn" (click)="showSettings.set(!showSettings())">⚙ Settings</button>
          @if (showSettings()) {
            <div class="settings-dropdown show">
              <div class="dropdown-title">File</div>
              <button class="dropdown-action" (click)="fileInput.click()">📂 Load DBO File(s)...</button>
              <p class="dropdown-hint">Hold Shift to add files without clearing existing data.</p>
              <hr />
              <div class="dropdown-title">Theme</div>
              <label class="setting-option">
                <input
                  type="radio"
                  name="theme"
                  [checked]="theme.preference() === 'system'"
                  (change)="theme.setPreference('system')"
                />
                Follow system
              </label>
              <label class="setting-option">
                <input
                  type="radio"
                  name="theme"
                  [checked]="theme.preference() === 'light'"
                  (change)="theme.setPreference('light')"
                />
                Light
              </label>
              <label class="setting-option">
                <input
                  type="radio"
                  name="theme"
                  [checked]="theme.preference() === 'dark'"
                  (change)="theme.setPreference('dark')"
                />
                Dark
              </label>
              <hr />
              <div class="dropdown-title">WebGL Payload</div>
              <label class="setting-option">
                <input
                  type="radio"
                  name="msgMode"
                  [checked]="state.messageMode() === 'package'"
                  (change)="state.messageMode.set('package')"
                />
                Send Full Package
              </label>
              <label class="setting-option">
                <input
                  type="radio"
                  name="msgMode"
                  [checked]="state.messageMode() === 'address'"
                  (change)="state.messageMode.set('address')"
                />
                Send Addressable Only
              </label>
            </div>
          }
        </div>
      </div>
      <input
        #fileInput
        type="file"
        accept=".json"
        multiple
        hidden
        (change)="onFilesSelected($event)"
      />
    </header>
  `,
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
  readonly state = inject(AppStateService);
  readonly theme = inject(ThemeService);
  readonly showSettings = signal(false);
  readonly showFiles = signal(false);

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    await this.state.loadFilesFromInput(input.files, (event as KeyboardEvent & { shiftKey?: boolean }).shiftKey ?? false);
    input.value = '';
    this.showSettings.set(false);
  }
}
