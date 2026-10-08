import { Component, computed, input } from '@angular/core';

export type NivelDeAvance = 'ok' | 'alerta' | 'excedido';

const COLOR_POR_NIVEL: Readonly<Record<NivelDeAvance, string>> = {
  ok: 'bg-success',
  alerta: 'bg-warning',
  excedido: 'bg-destructive',
};

@Component({
  selector: 'fin-barra-de-avance',
  host: { class: 'block' },
  template: `
    <div
      class="h-2.5 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-valuenow]="ancho()"
      [attr.aria-label]="etiqueta()"
    >
      <i class="block h-full rounded-full" [class]="color()" [style.width.%]="ancho()"></i>
    </div>
  `,
})
export class BarraDeAvanceComponent {
  readonly porcentaje = input.required<number>();
  readonly nivel = input<NivelDeAvance>('ok');
  readonly etiqueta = input.required<string>();
  readonly ancho = computed(() => Math.min(100, Math.max(0, this.porcentaje())));
  readonly color = computed(() => COLOR_POR_NIVEL[this.nivel()]);
}
