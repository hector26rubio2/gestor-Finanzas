import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, inject } from '@angular/core';
import { MovementsBookService } from '@shared/movements';
import { HeaderActionsService } from '@shared/header-actions.service';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { AccountFormComponent } from '@features/account-form';
import { ManagementFormComponent } from '@features/management-form';
import { IconComponent } from '@ui/icon';
import { SinAccesoComponent } from '@ui/sin-acceso';
import { P } from '@core/session';
import { CAPABILITIES, AppStore } from '@core/state';
import { InspectorComponent } from './inspector/inspector';
import { I18nService } from '@core/i18n';

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
  templateUrl: './workspace.html',
})
export class WorkspaceComponent {
  readonly Math = Math;
  readonly i18n = inject(I18nService);
  readonly store = inject(AppStore);
  readonly movementsBook = inject(MovementsBookService);
  private readonly capabilities = inject(CAPABILITIES);
  readonly P = P;
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
  exportReport(): void {
    this.headerActions.exportReport()?.();
  }
  exportMovements(): void {
    this.headerActions.exportMovements()?.();
  }

  readAll(): void {
    this.headerActions.readAll()?.();
  }
}
