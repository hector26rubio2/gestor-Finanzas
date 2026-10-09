import { InjectionToken, signal } from '@angular/core';

export interface TemaPropio {
  name: string;
  primary: string;
  secondary: string;
  text: string;
  surface: string;
  border: string;
  background: string;
  radius: number;
}

export interface Preferences {
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
  background: string;
  custom: boolean;
  customSaved?: TemaPropio;
}
export const IDIOMAS_ADMITIDOS = ['es-CO', 'en-US', 'pt-BR', 'fr-FR'] as const;

export function idiomaInicial(preferidos: readonly string[] = navigator.languages ?? []): string {
  for (const preferido of preferidos) {
    const exacto = IDIOMAS_ADMITIDOS.find((idioma) => idioma.toLowerCase() === preferido.toLowerCase());
    if (exacto) return exacto;
    const mismoIdioma = IDIOMAS_ADMITIDOS.find(
      (idioma) => idioma.split('-')[0] === preferido.split('-')[0].toLowerCase(),
    );
    if (mismoIdioma) return mismoIdioma;
  }
  return IDIOMAS_ADMITIDOS[0];
}

export const PREFERENCES = new InjectionToken('Preferences', {
  providedIn: 'root',
  factory: () =>
    signal<Preferences>({
      theme: 'system',
      accent: '#4f46e5',
      font: 'Public Sans, system-ui, sans-serif',
      locale: idiomaInicial(),
      density: 'comfortable',
      radius: 16,
      name: 'Mi tema indigo',
      primary: '#4f46e5',
      secondary: '#d97706',
      text: '#1e2130',
      surface: '#ffffff',
      border: '#e4e7ec',
      background: '#f7f8fb',
      custom: false,
    }),
});

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
  background?: string;
  radius?: number;
  custom?: boolean;
  saved?: TemaPropio;
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
  background: '#f7f8fb',
  radius: 16,
} as const;

const THEME_IDS: readonly string[] = ['system', 'light', 'dark', 'ocean', 'sand', 'berry'];
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const PALETTE_CSS_VARIABLES = [
  '--accent',
  '--accent-soft',
  '--accent-contrast',
  '--secondary',
  '--panel',
  '--text',
  '--muted',
  '--surface',
  '--nav',
  '--line',
  '--control-line',
  '--bg',
  '--radius',
];
const OVERRIDDEN_VARIABLES = ['--font', ...PALETTE_CSS_VARIABLES];
const PALETTE_VARIABLES: readonly (readonly [Exclude<keyof StoredPalette, 'custom' | 'saved'>, string])[] = [
  ['accent', '--accent'],
  ['primary', '--accent'],
  ['secondary', '--secondary'],
  ['text', '--text'],
  ['surface', '--surface'],
  ['border', '--line'],
  ['background', '--bg'],
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
  > &
    Partial<Pick<Preferences, 'background' | 'custom' | 'customSaved'>>,
): StoredPalette {
  const guardado = preferences.customSaved ? { saved: preferences.customSaved } : {};
  if (preferences.custom)
    return {
      ...guardado,
      custom: true,
      name: preferences.name,
      accent: preferences.primary,
      primary: preferences.primary,
      secondary: preferences.secondary,
      text: preferences.text,
      surface: preferences.surface,
      border: preferences.border,
      background: preferences.background ?? DEFAULT_PALETTE.background,
      radius: preferences.radius,
    };
  const overrides: StoredPalette = { ...guardado };
  if (preferences.name !== DEFAULT_PALETTE.name) overrides.name = preferences.name;
  for (const key of ['accent', 'primary', 'secondary', 'text', 'surface', 'border', 'background'] as const) {
    const value = preferences[key];
    if (value !== undefined && !sameColor(value, DEFAULT_PALETTE[key])) overrides[key] = value;
  }
  if (preferences.radius !== DEFAULT_PALETTE.radius) overrides.radius = preferences.radius;
  return overrides;
}

export function clearPaletteOverrides(): void {
  const style = document.documentElement.style;
  for (const variable of PALETTE_CSS_VARIABLES) style.removeProperty(variable);
}

function luminancia(hex: string): number {
  const limpio = hex.replace('#', '');
  const completo = limpio.length === 3 ? [...limpio].map((c) => c + c).join('') : limpio.slice(0, 6);
  const canal = (i: number) => {
    const v = parseInt(completo.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
}

export function esColorOscuro(hex: string): boolean {
  return HEX_COLOR.test(hex) && luminancia(hex) < 0.2;
}

export function contraste(a: string, b: string): number {
  if (!HEX_COLOR.test(a) || !HEX_COLOR.test(b)) return 21;
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

export function variablesDePaleta(palette: StoredPalette): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const [key, variable] of PALETTE_VARIABLES) {
    const value = palette[key];
    const isDefault = !palette.custom && key !== 'name' && key !== 'radius' && sameColor(value, DEFAULT_PALETTE[key]);
    if (typeof value === 'string' && HEX_COLOR.test(value) && !isDefault) variables[variable] = value;
  }
  const acento = variables['--accent'];
  if (acento) {
    variables['--accent-soft'] = `color-mix(in srgb, ${acento} 16%, var(--surface))`;
    variables['--accent-contrast'] =
      contraste('#111418', acento) > contraste('#ffffff', acento) ? '#111418' : '#ffffff';
  }
  if (variables['--secondary']) variables['--panel'] = variables['--secondary'];
  if (variables['--text']) variables['--muted'] = `color-mix(in srgb, ${variables['--text']} 64%, var(--surface))`;
  if (variables['--surface']) variables['--nav'] = variables['--surface'];
  if (variables['--line']) variables['--control-line'] = variables['--line'];
  if (
    typeof palette.radius === 'number' &&
    palette.radius >= 0 &&
    palette.radius <= 48 &&
    (palette.custom || palette.radius !== DEFAULT_PALETTE.radius)
  )
    variables['--radius'] = `${palette.radius}px`;
  return variables;
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
  aplicarPaleta(palette);
}

export function aplicarPaleta(palette: StoredPalette): void {
  const style = document.documentElement.style;
  for (const variable of PALETTE_CSS_VARIABLES) style.removeProperty(variable);
  for (const [variable, value] of Object.entries(variablesDePaleta(palette))) style.setProperty(variable, value);
}
