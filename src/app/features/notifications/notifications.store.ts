import { DestroyRef, Injectable, computed, effect, inject } from '@angular/core';
import { NotificationsApi } from '@core/api';
import { I18nService } from '@core/i18n';
import { toViewNotification } from '@core/session';
import { AppStore, crearRecursoRemoto } from '@core/state';

@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private readonly api = inject(NotificationsApi);
  private readonly store = inject(AppStore);
  private readonly i18n = inject(I18nService);

  private readonly recurso = crearRecursoRemoto({
    cargar: () => this.api.notifications(),
    dependencia: () => this.store.sinLeerDelArranque(),
  });

  readonly estado = this.recurso.estado;
  readonly items = computed(() =>
    (this.recurso.valor() ?? this.store.avisosRecientes()).map((aviso) => toViewNotification(this.i18n, aviso)),
  );

  private readonly publicarSinLeer = effect(() => {
    const completas = this.recurso.valor();
    this.store.sinLeerCargados.set(completas ? completas.filter((aviso) => aviso.readAt === null).length : null);
  });

  solicitar(destruccion?: DestroyRef): void {
    this.recurso.solicitar(destruccion);
  }

  soltar(destruccion?: DestroyRef): void {
    this.recurso.soltar(destruccion);
  }

  marcarLeidas(ids: ReadonlySet<string>): void {
    const leidaEn = new Date().toISOString();
    this.recurso.actualizar((avisos) =>
      avisos.map((aviso) => (ids.has(aviso.id) ? { ...aviso, readAt: aviso.readAt ?? leidaEn } : aviso)),
    );
  }

  recargar(): void {
    this.recurso.recargar();
  }
}
