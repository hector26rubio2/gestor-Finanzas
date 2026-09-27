import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdministrationApi, ApiAuditEvent, ApiAuditFilter, ApiClientError, ApiPage } from '@core/api';
import { CAPABILITIES, AppStore } from '@core/state';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';

@Injectable()
export class AdminAuditStore {
  private readonly api = inject(AdministrationApi);
  private readonly app = inject(AppStore);
  private readonly caps = inject(CAPABILITIES);
  private readonly i18n = inject(I18nService);

  readonly events = signal<readonly ApiAuditEvent[]>([]);
  readonly page = signal(1);
  readonly total = signal(0);
  readonly size = signal(25);
  readonly filter = signal<ApiAuditFilter>({});
  readonly erroresDeLaAccion = signal<readonly ApiClientError[]>([]);

  primeraPagina(): Promise<ApiPage<ApiAuditEvent>> {
    return firstValueFrom(this.api.superAdminAudit(1, this.size(), this.filter()));
  }

  aplicar(page: ApiPage<ApiAuditEvent>): void {
    this.events.set(page.items);
    this.page.set(page.page);
    this.total.set(page.total);
  }

  async cargar(page: number, filter: ApiAuditFilter = this.filter()): Promise<void> {
    if (!this.caps.allows(P.administracion.auditoria.listar)) return;
    try {
      this.filter.set(filter);
      const [auditoria, errores] = await Promise.all([
        firstValueFrom(this.api.superAdminAudit(page, this.size(), filter)),
        filter.traceId && this.caps.allows(P.administracion.errores.listar)
          ? firstValueFrom(this.api.adminErrors(1, 50, '', filter.traceId)).then((pagina) => pagina.items)
          : Promise.resolve([] as readonly ApiClientError[]),
      ]);
      this.aplicar(auditoria);
      this.erroresDeLaAccion.set(errores);
    } catch {
      this.app.toast.set(this.i18n.t('admin.toast.loadFailed'));
    }
  }
}
