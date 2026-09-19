import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Tarjeta base de un widget: encabezado con kicker/titulo, y dos huecos de
 * proyeccion para lo que cambia por tipo (fila de exploracion de categoria,
 * controles de personalizar) mas el contenido -grafica, lista o lo que sea-
 * que decide el padre. Antes esta cascara se repetia entera, inline, en cada
 * vuelta del `@for` de dashboard.html.
 *
 * El host mismo es la caja `.widget` -no `display: contents`-: una grafica
 * `chart` adentro observa su propio ancho con `ResizeObserver` para
 * seguir el tamaño de la tarjeta, y con un antecesor `display: contents` de
 * por medio ese observador nunca vuelve a disparar tras el primer layout, asi
 * que la grafica se queda pintada a la mitad del ancho real (#dashboard-wide).
 */
@Component({
  selector: 'fin-widget-card',
  templateUrl: './widget-card.html',
  host: {
    '[class]': 'hostClass()',
    '[class.col-span-full]': 'wide()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetCardComponent {
  readonly kicker = input.required<string>();
  readonly title = input.required<string>();
  readonly wide = input(false);
  readonly fill = input(false);
  readonly hostClass = computed(() =>
    this.fill()
      ? 'flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card px-5 py-4'
      : 'flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card px-6 py-[22px] max-[700px]:col-auto',
  );
}
