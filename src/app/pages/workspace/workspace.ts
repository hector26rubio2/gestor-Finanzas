import { HlmButton } from '@spartan-ng/helm/button';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MovementsBookService } from '../../shared/movements/movements-book.service';
import { HeaderActionsService } from '../../shared/header-actions.service';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { AccountFormComponent } from '../../features/account-form/account-form';
import { ManagementFormComponent } from '../../features/management-form/management-form';
import { IconComponent } from '../../ui/icon/icon';
import { SinAccesoComponent } from '../../ui/sin-acceso/sin-acceso';
import { P } from '../../core/session/permissions';
import { CAPABILITIES, AppStore } from '../../core/state/store';
import { InspectorComponent } from './inspector/inspector';
import { I18nService } from '../../core/i18n';

/*
 * Sin rotulo sobre el titulo. Un «LIBRO CENTRAL» en versales encima de «Movimientos» no
 * dice nada que el titulo no diga ya, y es el adorno mas repetido de las interfaces
 * generadas. La estructura tiene que codificar informacion, no decorarla.
 */
const paginasConMeta = [
  'movements',
  'calendar',
  'accounts',
  'people',
  'portfolio',
  'planning',
  'reports',
  'notifications',
  'admin',
  'settings',
] as const;

@Component({
  imports: [
    HlmButton,
    RouterOutlet,
    InspectorComponent,
    AccountFormComponent,
    ManagementFormComponent,
    SinAccesoComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace.html',
})
export class WorkspaceComponent {
  readonly Math = Math;
  readonly i18n = inject(I18nService);
  readonly store = inject(AppStore);
  readonly movementsBook = inject(MovementsBookService);
  private readonly capabilities = inject(CAPABILITIES);
  readonly P = P;
  /**
   * Vistas cuyo contenido son bloques sueltos, cada uno con su permiso.
   *
   * Las demas se sostienen solas: llegar a Movimientos exige `movimientos.ver`, y ese
   * codigo ya trae la tabla. Estas dos no tienen nada equivalente —Reportes es un
   * conjunto de bloques y Planificacion un conjunto de simuladores—, asi que sin ninguno
   * concedido quedan en blanco.
   *
   * Antes hacia falta ademas un `X.listar` en las siete, y concederlo se olvidaba: la
   * entrada aparecia en el menu lateral y dentro no habia nada, sin decir por que.
   */
  private readonly bloquesPorVista: Readonly<Record<string, readonly string[]>> = {
    reports: [
      P.reportes.comparativo.ver,
      P.reportes.categorias.ver,
      P.reportes.tendencia.ver,
      P.reportes.deuda.ver,
      P.reportes.patrimonio.ver,
      P.reportes.hallazgos.ver,
      P.reportes.exportar,
    ],
    planning: [
      P.planificacion.deudas.ver,
      P.planificacion.compras.ver,
      P.planificacion.vacaciones.ver,
      P.planificacion.inversiones.ver,
    ],
  };

  /** La vista activa no tiene ni uno de sus bloques concedido. */
  readonly sinNingunBloque = computed(() => {
    const bloques = this.bloquesPorVista[this.page()];
    return !!bloques && !bloques.some((codigo) => this.can(codigo));
  });

  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }
  private route = inject(ActivatedRoute);
  readonly page = computed(() => this.route.snapshot.url[0]?.path ?? 'movements');
  readonly meta = computed(() => {
    const page = (paginasConMeta as readonly string[]).includes(this.page()) ? this.page() : 'movements';
    return {
      title: this.i18n.t(`workspace.labels.${page}.title`),
      description: this.i18n.t(`workspace.labels.${page}.description`),
    };
  });
  private readonly headerActions = inject(HeaderActionsService);
  /** El boton vive en la cabecera compartida; la pestaña activa registra la logica real. */
  exportReport(): void {
    this.headerActions.exportReport()?.();
  }
  exportMovements(): void {
    this.headerActions.exportMovements()?.();
  }

  /** El boton vive en la cabecera compartida; la pestaña activa registra la logica real. */
  readAll(): void {
    this.headerActions.readAll()?.();
  }
}
