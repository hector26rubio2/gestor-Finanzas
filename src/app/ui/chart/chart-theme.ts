import { Injectable, signal } from '@angular/core';

export interface ChartPalette {
  accent: string;
  danger: string;
  warn: string;
  success: string;
  text: string;
  muted: string;
  line: string;
  surface: string;
  categorical: readonly string[];
}

const leer = (estilo: CSSStyleDeclaration, nombre: string, respaldo: string) =>
  estilo.getPropertyValue(nombre).trim() || respaldo;

@Injectable({ providedIn: 'root' })
export class ChartThemeService {
  private readonly interna = signal<ChartPalette>(this.medir());
  readonly palette = this.interna.asReadonly();

  constructor() {
    if (typeof document === 'undefined') return;
    new MutationObserver(() => this.interna.set(this.medir())).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style', 'data-density'],
    });
    window
      .matchMedia?.('(prefers-color-scheme: dark)')
      .addEventListener('change', () => this.interna.set(this.medir()));
  }

  private medir(): ChartPalette {
    if (typeof document === 'undefined' || typeof getComputedStyle !== 'function')
      return {
        accent: '#4f46e5',
        danger: '#e11d48',
        warn: '#d97706',
        success: '#059669',
        text: '#1e2130',
        muted: '#64748b',
        line: '#e4e7ec',
        surface: '#ffffff',
        categorical: ['#4f46e5', '#0ea5e9', '#d97706', '#7c3aed', '#e11d48', '#0d9488', '#64748b'],
      };
    const estilo = getComputedStyle(document.documentElement);
    const accent = leer(estilo, '--accent', '#4f46e5');
    const danger = leer(estilo, '--danger', '#e11d48');
    const warn = leer(estilo, '--warning', '#d97706');
    const success = leer(estilo, '--success', '#059669');
    return {
      accent,
      danger,
      warn,
      success,
      text: leer(estilo, '--text', '#1e2130'),
      muted: leer(estilo, '--muted', '#64748b'),
      line: leer(estilo, '--line', '#e4e7ec'),
      surface: leer(estilo, '--surface', '#ffffff'),
      categorical: [accent, '#0ea5e9', warn, '#7c3aed', danger, '#0d9488', '#64748b'],
    };
  }
}
