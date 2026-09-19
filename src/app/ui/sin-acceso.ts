import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../core/i18n';

/**
 * Lo que se enseña cuando se puede entrar a una pantalla y no se ha concedido ni uno de
 * sus bloques.
 *
 * Reportes y Planificación no tienen un listado propio: son un conjunto de bloques, cada
 * uno con su permiso. Sin ninguno la pantalla se pintaba entera y vacía —título, cabecera
 * y nada más—, y una pantalla vacía sin explicación se lee como averiada: quien la ve
 * reporta un fallo que no existe en vez de pedir lo que le falta.
 */
@Component({
  selector: 'fin-sin-acceso',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="grid justify-items-start gap-2 rounded-lg border border-border bg-card p-7" role="status">
      <h2 class="text-[1.05rem] font-semibold">{{ i18n.t('sinAcceso.title') }}</h2>
      <p class="max-w-[60ch] text-muted-foreground">{{ i18n.t('sinAcceso.detail') }}</p>
    </section>
  `,
})
export class SinAccesoComponent {
  readonly i18n = inject(I18nService);
}
