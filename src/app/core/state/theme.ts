import { InjectionToken, signal } from '@angular/core';

export interface Preferences {
  /** `system` no estampa data-theme y deja que mande prefers-color-scheme. */
  theme: 'system' | 'light' | 'dark' | 'ocean' | 'sand' | 'berry';
  accent: string;
  font: string;
  locale: string;
  density: 'comfortable' | 'compact';
  radius: number;
  name: string;
  primary: string;
  secondary: string;
  text: string;
  surface: string;
  border: string;
}
export const PREFERENCES = new InjectionToken('Preferences', {
  providedIn: 'root',
  factory: () =>
    signal<Preferences>({
      theme: 'system',
      accent: '#4f46e5',
      font: 'Public Sans, system-ui, sans-serif',
      locale: 'es-CO',
      density: 'comfortable',
      radius: 16,
      name: 'Mi tema indigo',
      primary: '#4f46e5',
      secondary: '#d97706',
      text: '#1e2130',
      surface: '#ffffff',
      border: '#e4e7ec',
    }),
});

/**
 * Estampa el tema elegido. Con `system` retira el atributo para que la consulta
 * `prefers-color-scheme` de styles.css decida: antes se estampaba siempre
 * `light` y quien tenia el sistema en oscuro recibia la aplicacion en claro.
 */
export function applyTheme(theme: Preferences['theme']): void {
  if (theme === 'system') delete document.documentElement.dataset['theme'];
  else document.documentElement.dataset['theme'] = theme;
}
