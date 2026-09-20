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

export interface StoredPalette {
  name?: string;
  accent?: string;
  primary?: string;
  secondary?: string;
  text?: string;
  surface?: string;
  border?: string;
  radius?: number;
}

export interface StoredAppearance {
  theme: string;
  font: string;
  density: string;
}

export const DEFAULT_PALETTE = {
  name: 'Mi tema indigo',
  accent: '#4f46e5',
  primary: '#4f46e5',
  secondary: '#d97706',
  text: '#1e2130',
  surface: '#ffffff',
  border: '#e4e7ec',
  radius: 16,
} as const;

const THEME_IDS: readonly string[] = ['system', 'light', 'dark', 'ocean', 'sand', 'berry'];
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const OVERRIDDEN_VARIABLES = ['--font', '--accent', '--secondary', '--text', '--surface', '--line', '--radius'];
const PALETTE_VARIABLES: readonly (readonly [keyof StoredPalette, string])[] = [
  ['accent', '--accent'],
  ['primary', '--accent'],
  ['secondary', '--secondary'],
  ['text', '--text'],
  ['surface', '--surface'],
  ['border', '--line'],
];

export function parsePalette(json: string | null | undefined): StoredPalette | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as StoredPalette) : null;
  } catch {
    return null;
  }
}

const sameColor = (a: unknown, b: string): boolean => typeof a === 'string' && a.toLowerCase() === b.toLowerCase();

export function paletteOverrides(
  preferences: Pick<
    Preferences,
    'name' | 'accent' | 'primary' | 'secondary' | 'text' | 'surface' | 'border' | 'radius'
  >,
): StoredPalette {
  const overrides: StoredPalette = {};
  if (preferences.name !== DEFAULT_PALETTE.name) overrides.name = preferences.name;
  for (const key of ['accent', 'primary', 'secondary', 'text', 'surface', 'border'] as const) {
    if (!sameColor(preferences[key], DEFAULT_PALETTE[key])) overrides[key] = preferences[key];
  }
  if (preferences.radius !== DEFAULT_PALETTE.radius) overrides.radius = preferences.radius;
  return overrides;
}

export function clearPaletteOverrides(): void {
  const style = document.documentElement.style;
  for (const variable of ['--accent', '--secondary', '--text', '--surface', '--line', '--radius'])
    style.removeProperty(variable);
}

export function clearAppearanceOverrides(): void {
  const style = document.documentElement.style;
  for (const variable of OVERRIDDEN_VARIABLES) style.removeProperty(variable);
}

export function applyStoredAppearance(appearance: StoredAppearance, palette: StoredPalette | null): void {
  clearAppearanceOverrides();
  const root = document.documentElement;
  if (THEME_IDS.includes(appearance.theme)) applyTheme(appearance.theme as Preferences['theme']);
  if (appearance.density === 'compact' || appearance.density === 'comfortable') {
    root.dataset['density'] = appearance.density;
  }
  if (appearance.font.includes(',')) root.style.setProperty('--font', appearance.font);
  if (!palette) return;
  for (const [key, variable] of PALETTE_VARIABLES) {
    const value = palette[key];
    const isDefault = key !== 'name' && key !== 'radius' && sameColor(value, DEFAULT_PALETTE[key]);
    if (typeof value === 'string' && HEX_COLOR.test(value) && !isDefault) root.style.setProperty(variable, value);
  }
  if (
    typeof palette.radius === 'number' &&
    palette.radius >= 0 &&
    palette.radius <= 48 &&
    palette.radius !== DEFAULT_PALETTE.radius
  ) {
    root.style.setProperty('--radius', `${palette.radius}px`);
  }
}
