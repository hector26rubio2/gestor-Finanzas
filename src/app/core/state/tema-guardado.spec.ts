import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PALETTE,
  applyStoredAppearance,
  clearAppearanceOverrides,
  paletteOverrides,
  parsePalette,
} from './theme';

const root = document.documentElement;

describe('restaurar la apariencia guardada', () => {
  afterEach(() => {
    clearAppearanceOverrides();
    delete root.dataset['theme'];
    delete root.dataset['density'];
  });

  it('aplica tema, densidad, tipografía y toda la paleta propia', () => {
    const palette = parsePalette(
      JSON.stringify({
        accent: '#112233',
        secondary: '#445566',
        text: '#778899',
        surface: '#aabbcc',
        border: '#ddeeff',
        radius: 8,
      }),
    );

    applyStoredAppearance({ theme: 'ocean', font: "'DM Sans', system-ui, sans-serif", density: 'compact' }, palette);

    expect(root.dataset['theme']).toBe('ocean');
    expect(root.dataset['density']).toBe('compact');
    expect(root.style.getPropertyValue('--font')).toBe("'DM Sans', system-ui, sans-serif");
    expect(root.style.getPropertyValue('--accent')).toBe('#112233');
    expect(root.style.getPropertyValue('--secondary')).toBe('#445566');
    expect(root.style.getPropertyValue('--text')).toBe('#778899');
    expect(root.style.getPropertyValue('--surface')).toBe('#aabbcc');
    expect(root.style.getPropertyValue('--line')).toBe('#ddeeff');
    expect(root.style.getPropertyValue('--radius')).toBe('8px');
  });

  it('sin paleta guardada limpia lo que dejó otra sesión', () => {
    root.style.setProperty('--accent', '#ff0000');
    applyStoredAppearance({ theme: 'dark', font: 'Inter', density: 'comfortable' }, null);

    expect(root.style.getPropertyValue('--accent')).toBe('');
    expect(root.style.getPropertyValue('--font')).toBe('');
    expect(root.dataset['theme']).toBe('dark');
  });

  it('ignora colores inválidos, temas desconocidos y JSON roto', () => {
    applyStoredAppearance(
      { theme: 'emerald', font: 'Inter', density: 'x' },
      parsePalette('{"accent":"red; x:y","radius":900}'),
    );

    expect(root.style.getPropertyValue('--accent')).toBe('');
    expect(root.style.getPropertyValue('--radius')).toBe('');
    expect(root.dataset['theme']).toBeUndefined();
    expect(parsePalette('no es json')).toBeNull();
    expect(parsePalette('[1]')).toBeNull();
    expect(parsePalette(null)).toBeNull();
  });

  it('una paleta guardada con los valores por defecto no pisa el tema oscuro', () => {
    const guardada = parsePalette(
      JSON.stringify({
        name: 'Mi tema indigo',
        accent: '#4F46E5',
        primary: '#4f46e5',
        secondary: '#d97706',
        text: '#1e2130',
        surface: '#ffffff',
        border: '#e4e7ec',
        radius: 16,
      }),
    );

    applyStoredAppearance({ theme: 'dark', font: 'Inter', density: 'comfortable' }, guardada);

    expect(root.dataset['theme']).toBe('dark');
    for (const variable of ['--accent', '--secondary', '--text', '--surface', '--line', '--radius']) {
      expect(root.style.getPropertyValue(variable)).toBe('');
    }
  });

  it('solo se guardan los colores que la persona cambió', () => {
    const base = { ...DEFAULT_PALETTE, name: DEFAULT_PALETTE.name };
    expect(paletteOverrides(base)).toEqual({});
    expect(paletteOverrides({ ...base, surface: '#101010', radius: 8 })).toEqual({ surface: '#101010', radius: 8 });
  });
});
