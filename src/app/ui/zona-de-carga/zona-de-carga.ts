import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '@core/i18n';
import { SkeletonComponent, TipoDeSkeleton } from '@ui/skeleton';

export type EstadoDeZona = 'esqueleto' | 'datos' | 'vacio';

export function estadoDeZona(cargando: boolean, hayDatos: boolean): EstadoDeZona {
  if (hayDatos) return 'datos';
  return cargando ? 'esqueleto' : 'vacio';
}

@Component({
  selector: 'fin-zona-de-carga',
  imports: [SkeletonComponent],
  host: { class: 'relative block min-w-0', '[attr.aria-busy]': 'cargando()' },
  template: `
    @switch (estado()) {
      @case ('esqueleto') {
        <fin-skeleton [tipo]="tipo()" [filas]="filas()" [columnas]="columnas()" />
      }
      @case ('vacio') {
        <ng-content select="[finVacio]" />
      }
      @default {
        @if (cargando()) {
          <div
            class="pointer-events-none absolute inset-x-0 top-0 z-[2] h-0.5 overflow-hidden bg-primary/20"
            data-testid="barra-de-zona"
            aria-hidden="true"
          >
            <div class="fin-barra-fina h-full w-full bg-primary"></div>
          </div>
          <span role="status" class="sr-only">{{ i18n.t('skeleton.refreshing') }}</span>
        }
        <ng-content />
      }
    }
  `,
})
export class ZonaDeCargaComponent {
  readonly i18n = inject(I18nService);
  readonly cargando = input.required<boolean>();
  readonly hayDatos = input.required<boolean>();
  readonly tipo = input<TipoDeSkeleton>('tabla');
  readonly filas = input(5);
  readonly columnas = input(0);
  readonly estado = computed(() => estadoDeZona(this.cargando(), this.hayDatos()));
}
