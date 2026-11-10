import { DestroyRef, Injectable, computed, inject } from '@angular/core';
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
  readonly cargando = computed(
    () => this.recurso.estado() === 'cargando' || this.recurso.estado() === 'inactivo' || this.recurso.refrescando(),
  );
  readonly items = computed(() =>
    (this.recurso.valor() ?? this.store.avisosRecientes()).map((aviso) => toViewNotification(this.i18n, aviso)),
  );

  solicitar(destruccion?: DestroyRef): void {
    this.recurso.solicitar(destruccion);
  }

  soltar(destruccion?: DestroyRef): void {
    this.recurso.soltar(destruccion);
  }

  marcarLeidas(ids: ReadonlySet<string>): void {
    const leidaEn = new Date().toISOString();
    this.store.sinLeerMarcadas.update((marcadas) => new Set([...marcadas, ...ids]));
    this.recurso.actualizar((avisos) =>
      avisos.map((aviso) => (ids.has(aviso.id) ? { ...aviso, readAt: aviso.readAt ?? leidaEn } : aviso)),
    );
  }

  recargar(): void {
    this.recurso.recargar();
  }
}
