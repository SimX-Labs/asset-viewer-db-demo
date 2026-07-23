import { Injectable, signal, computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ThemePreference } from '../models/dbo.models';

const STORAGE_KEY = 'simx-asset-viewer-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private mediaQuery: MediaQueryList | null = null;

  readonly preference = signal<ThemePreference>(this.loadPreference());
  readonly systemDark = signal(false);

  readonly resolvedTheme = computed<'light' | 'dark'>(() => {
    const pref = this.preference();
    if (pref === 'system') {
      return this.systemDark() ? 'dark' : 'light';
    }
    return pref;
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemDark.set(this.mediaQuery.matches);
      this.mediaQuery.addEventListener('change', (e) => this.systemDark.set(e.matches));

      effect(() => {
        const theme = this.resolvedTheme();
        document.documentElement.setAttribute('data-theme', theme);
        // Style-guide convention: dark mode is a class toggle on <html>.
        document.documentElement.classList.toggle('simx-dark', theme === 'dark');
      });
    }
  }

  private loadPreference(): ThemePreference {
    if (!isPlatformBrowser(this.platformId)) return 'system';
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'system';
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_KEY, pref);
    }
  }

  toggle(): void {
    const current = this.resolvedTheme();
    this.setPreference(current === 'dark' ? 'light' : 'dark');
  }

  cyclePreference(): void {
    const order: ThemePreference[] = ['system', 'light', 'dark'];
    const idx = order.indexOf(this.preference());
    this.setPreference(order[(idx + 1) % order.length]);
  }

  themeLabel(): string {
    const pref = this.preference();
    if (pref === 'system') return `System (${this.resolvedTheme()})`;
    return pref.charAt(0).toUpperCase() + pref.slice(1);
  }
}
