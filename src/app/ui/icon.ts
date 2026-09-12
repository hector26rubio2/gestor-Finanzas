import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Trazos de cada icono sobre una rejilla de 24 x 24.
 *
 * Antes cada icono era un carácter Unicode suelto —◈ para el panel, ♧ para personas, ♜
 * para la organización, ⌕ para buscar—, tomados de bloques distintos: figuras
 * geométricas, palos de baraja, piezas de ajedrez. Cada uno traía su propio grosor y su
 * propio tamaño óptico, ninguno se alineaba con el texto, y varios dependen de que la
 * tipografía del sistema los cubra: en Windows unos cuantos caían a una fuente de
 * reserva o a un rectángulo vacío.
 *
 * Aquí todos comparten rejilla, grosor y remates, y heredan el color del texto, así que
 * se integran con el control que los contiene en vez de flotar dentro.
 */
const TRAZOS: Readonly<Record<string, string>> = {
  // Navegación
  dashboard: 'M4 4h6v7H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 15h6v5H4z',
  movements: 'M4 9h13M14 6l3 3-3 3M20 15H7M10 12l-3 3 3 3',
  calendar: 'M4 6h16v14H4zM4 10h16M9 4v4M15 4v4',
  accounts: 'M3 7h18v11H3zM3 11h18M7 15h4',
  people:
    'M10 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4M4 20a6 6 0 0 1 12 0M17 10.5a2.6 2.6 0 1 0 0-5.2M18.5 20a5.4 5.4 0 0 0-2.4-4.4',
  portfolio: 'M12 12V4a8 8 0 1 1-8 8zM12 12l6.9 4',
  planning: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M12 12h.01',
  reports: 'M5 20V11M12 20V4M19 20v-6M3 20h18',
  notifications: 'M18 9a6 6 0 1 0-12 0c0 5-2 7-2 7h16s-2-2-2-7M10.2 20a2.2 2.2 0 0 0 3.6 0',
  admin: 'M12 3l8 3v6c0 5.2-3.6 8.4-8 9.6C7.6 20.4 4 17.2 4 12V6z',
  settings: 'M4 8h9M17 8h3M4 16h3M11 16h9M15 8a2 2 0 1 0 0-.01M9 16a2 2 0 1 0 0-.01',

  // Barra superior y acciones
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-3.9-3.9',
  plus: 'M12 5v14M5 12h14',
  download: 'M12 4v11M8 11l4 4 4-4M5 19h14',
  organization: 'M4 20V8l5-3 5 3v12M14 20v-8h6v8M4 20h16M8 12h2M8 16h2',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  chevronDown: 'M6 9.5l6 6 6-6',
  chevronUp: 'M6 14.5l6-6 6 6',
  edit: 'M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z',
  flag: 'M6 21V4h12l-2.5 4L18 12H6',
  list: 'M4 6h16M4 12h16M4 18h10',
  shield: 'M12 3l8 3v6c0 5.2-3.6 8.4-8 9.6C7.6 20.4 4 17.2 4 12V6z',

  // Paginación
  first: 'M13 6l-6 6 6 6M19 6l-6 6 6 6',
  previous: 'M14.5 6l-6 6 6 6',
  next: 'M9.5 6l6 6-6 6',
  last: 'M11 6l6 6-6 6M5 6l6 6-6 6',
};

export type IconName = keyof typeof TRAZOS;

/**
 * Icono de trazo, alineado con el texto que lo acompaña.
 *
 * Es decorativo por defecto: `aria-hidden`. El nombre accesible lo pone el control que
 * lo contiene, con su propio texto o su `aria-label`, porque es el control el que
 * significa algo, no el dibujo.
 */
@Component({
  selector: 'demo-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon.html',
  styleUrl: './icon.css',
})
export class IconComponent {
  readonly name = input.required<string>();
  /** Un nombre desconocido no rompe la pantalla: no dibuja nada. */
  readonly trazo = computed(() => TRAZOS[this.name()] ?? '');
}
