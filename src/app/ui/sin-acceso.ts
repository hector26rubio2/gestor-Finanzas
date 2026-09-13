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
  selector: 'demo-sin-acceso',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sin-acceso.html',
  styleUrl: './sin-acceso.css',
})
export class SinAccesoComponent {
  readonly i18n = inject(I18nService);
}
