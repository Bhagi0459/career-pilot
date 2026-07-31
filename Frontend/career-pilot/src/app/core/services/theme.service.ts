import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'careerpilot.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  // Null means "follow the OS" - only set once the user explicitly toggles, at which point their
  // choice sticks regardless of what the OS preference does afterward.
  private explicitChoice: Theme | null = readStoredTheme();

  readonly theme = signal<Theme>(this.explicitChoice ?? (this.mediaQuery.matches ? 'dark' : 'light'));

  constructor() {
    // index.html's inline script already set the attribute before first paint - this just keeps
    // the Angular-side signal and the DOM attribute in sync from here on.
    this.mediaQuery.addEventListener('change', (event) => {
      if (this.explicitChoice === null) {
        this.applyTheme(event.matches ? 'dark' : 'light');
      }
    });
  }

  toggle(): void {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.explicitChoice = next;
    localStorage.setItem(STORAGE_KEY, next);
    this.applyTheme(next);
  }

  private applyTheme(theme: Theme): void {
    this.theme.set(theme);
    document.documentElement.setAttribute('data-theme', theme);
  }
}

function readStoredTheme(): Theme | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === 'light' || raw === 'dark' ? raw : null;
}
