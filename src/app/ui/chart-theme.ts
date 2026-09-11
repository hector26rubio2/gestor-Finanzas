import { Injectable, signal } from '@angular/core';

/**
 * Colores vivos del tema, leídos del documento.
 *
 * Las gráficas no pueden usar `var(--accent)`: el lienzo pinta con colores resueltos, no
 * con variables CSS. Así que se leen una vez y se vuelven a leer cuando el tema cambia
 * —el conmutador estampa `data-theme` y la paleta propia escribe variables en el estilo
 * en línea del documento—, de modo que un `computed` que pida la paleta se rehace solo y
 * la gráfica se repinta con él.
 */
export interface ChartPalette {
  accent: string;
  danger: string;
  warn: string;
  text: string;
  muted: string;
  line: string;
  surface: string;
  /** Serie categórica: suficiente para que ninguna repita color antes de la séptima. */
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
    // El tema se aplica de dos formas: `data-theme` en el documento y variables sueltas
    // en su estilo en línea cuando alguien define una paleta propia. Ambas caben en la
    // misma observación de atributos.
    new MutationObserver(() => this.interna.set(this.medir())).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style', 'data-density'],
    });
    // Con el tema en «igual que el sistema» no hay atributo que cambie: manda el medio.
    window
      .matchMedia?.('(prefers-color-scheme: dark)')
      .addEventListener('change', () => this.interna.set(this.medir()));
  }

  private medir(): ChartPalette {
    if (typeof document === 'undefined' || typeof getComputedStyle !== 'function')
      return {
        accent: '#07836b',
        danger: '#c8443c',
        warn: '#b7791f',
        text: '#0f1f1c',
        muted: '#5a6a65',
        line: '#dce6e2',
        surface: '#ffffff',
        categorical: ['#07836b', '#2f7fa6', '#b7791f', '#8a5cd6', '#c8443c', '#2aa39a', '#6b7280'],
      };
    const estilo = getComputedStyle(document.documentElement);
    const accent = leer(estilo, '--accent', '#07836b');
    const danger = leer(estilo, '--danger', '#c8443c');
    const warn = leer(estilo, '--warning', '#b7791f');
    return {
      accent,
      danger,
      warn,
      text: leer(estilo, '--text', '#0f1f1c'),
      muted: leer(estilo, '--muted', '#5a6a65'),
      line: leer(estilo, '--line', '#dce6e2'),
      surface: leer(estilo, '--surface', '#ffffff'),
      categorical: [accent, '#2f7fa6', warn, '#8a5cd6', danger, '#2aa39a', '#6b7280'],
    };
  }
}
