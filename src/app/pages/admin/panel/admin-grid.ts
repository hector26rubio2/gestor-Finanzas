import { Component, input } from '@angular/core';
import { ZonaDeCargaComponent } from '@ui/zona-de-carga';

@Component({
  selector: 'app-admin-grid',
  imports: [ZonaDeCargaComponent],
  host: {
    class:
      'flex min-h-0 min-w-0 flex-col [height:max(24rem,calc(100dvh-17rem))] max-[700px]:[height:min(36rem,calc(100dvh-13rem))] [&_fin-table]:rounded-none [&_fin-table]:border-0 [&_[data-testid=table-scroll]]:max-[520px]:overflow-auto!',
  },
  template: `
    <fin-zona-de-carga
      class="flex min-h-0 flex-1 flex-col"
      tipo="tabla"
      [cargando]="cargando()"
      [hayDatos]="hayDatos()"
      [filas]="filas()"
      [columnas]="columnas()"
      [vacioEnContenido]="true"
    >
      <ng-content />
    </fin-zona-de-carga>
  `,
})
export class AdminGridComponent {
  readonly cargando = input(false);
  readonly hayDatos = input(true);
  readonly filas = input(8);
  readonly columnas = input(5);
}
