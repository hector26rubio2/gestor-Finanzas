import { Injectable, computed, effect, inject, signal, untracked, Injector } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { type ApiSavedDashboard, type ApiDashboardMember, DashboardsApi } from '@core/api/dashboards.api';
import { P } from '@core/session/permissions';
import { AppStore, CAPABILITIES } from '@core/state/store';
import { DashboardLayoutService } from '@shared/tablero/dashboard-layout.service';

export const TABLERO_PRINCIPAL = 'principal';

@Injectable({ providedIn: 'root' })
export class TablerosService {
  private readonly injector = inject(Injector);

  private get api(): DashboardsApi {
    return this.injector.get(DashboardsApi);
  }
  private readonly store = inject(AppStore);
  private readonly capabilities = inject(CAPABILITIES);
  private readonly layout = inject(DashboardLayoutService);

  readonly tableros = signal<readonly ApiSavedDashboard[]>([]);
  readonly activo = signal<string>(TABLERO_PRINCIPAL);
  readonly miembros = signal<readonly ApiDashboardMember[]>([]);
  readonly propios = computed(() => this.tableros().filter((t) => t.isMine));
  readonly compartidos = computed(() =>
    this.capabilities.allows(P.dashboard.compartidos.ver) ? this.tableros().filter((t) => !t.isMine) : [],
  );
  readonly fijados = computed(() => this.propios().filter((t) => t.isPinned));
  readonly tableroActivo = computed(() => this.tableros().find((t) => t.id === this.activo()) ?? null);
  readonly puedeCrear = computed(() => this.disponible() && this.capabilities.allows(P.dashboard.tableros.crear));
  readonly puedeCompartir = computed(
    () => this.disponible() && this.capabilities.allows(P.dashboard.tableros.accesos.editar),
  );
  readonly disponible = computed(() => this.store.remoteState() === 'ready');

  private readonly cargar = effect(() => {
    if (!this.disponible()) return;
    untracked(() => void this.recargar());
  });

  async recargar(): Promise<void> {
    try {
      this.tableros.set(await firstValueFrom(this.api.dashboards()));
    } catch {
      this.tableros.set([]);
    }
    if (this.activo() !== TABLERO_PRINCIPAL && !this.tableroActivo()) await this.abrir(TABLERO_PRINCIPAL);
  }

  async abrir(id: string): Promise<void> {
    if (id === TABLERO_PRINCIPAL || !this.disponible()) {
      this.activo.set(TABLERO_PRINCIPAL);
      this.layout.usarDiseno({ tipo: 'principal' });
      return;
    }
    const tablero = await firstValueFrom(this.api.dashboard(id));
    this.activo.set(tablero.id);
    this.layout.usarDiseno(
      tablero.isMine
        ? { tipo: 'propio', id: tablero.id, nombre: tablero.name, fijado: tablero.isPinned }
        : { tipo: 'compartido', id: tablero.id },
      tablero.layoutJson,
    );
  }

  async crear(nombre: string, copiarActual: boolean): Promise<void> {
    const origen = this.activo() === TABLERO_PRINCIPAL ? null : this.activo();
    const creado = await firstValueFrom(
      this.api.create({
        name: nombre,
        layoutJson: copiarActual && !origen ? this.layout.disenoActualJson() : null,
        copyFrom: copiarActual ? origen : null,
      }),
    );
    await this.recargar();
    await this.abrir(creado.id);
  }

  async renombrar(nombre: string): Promise<void> {
    await this.actualizar({ name: nombre });
  }

  async alternarFijado(): Promise<void> {
    const tablero = this.tableroActivo();
    if (tablero) await this.actualizar({ isPinned: !tablero.isPinned });
  }

  async borrar(): Promise<void> {
    const tablero = this.tableroActivo();
    if (!tablero?.isMine) return;
    await firstValueFrom(this.api.remove(tablero.id));
    await this.abrir(TABLERO_PRINCIPAL);
    await this.recargar();
  }

  async cargarMiembros(): Promise<void> {
    if (!this.puedeCompartir()) return;
    try {
      this.miembros.set(await firstValueFrom(this.api.members()));
    } catch {
      this.miembros.set([]);
    }
  }

  async compartir(usuarios: readonly string[]): Promise<void> {
    const tablero = this.tableroActivo();
    if (!tablero?.isMine) return;
    await firstValueFrom(this.api.share(tablero.id, usuarios));
    await this.recargar();
  }

  private async actualizar(cambio: { name?: string; isPinned?: boolean }): Promise<void> {
    const tablero = this.tableroActivo();
    if (!tablero?.isMine) return;
    const name = cambio.name?.trim() || tablero.name;
    const isPinned = cambio.isPinned ?? tablero.isPinned;
    await firstValueFrom(this.api.update(tablero.id, { name, layoutJson: this.layout.disenoActualJson(), isPinned }));
    this.layout.renombrarDestino(name, isPinned);
    await this.recargar();
  }
}
