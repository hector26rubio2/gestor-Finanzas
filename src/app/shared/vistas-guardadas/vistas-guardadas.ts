import { Component, computed, effect, inject, input, output, signal, untracked, Injector } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmInput } from '@spartan-ng/helm/input';
import { firstValueFrom } from 'rxjs';
import { type ApiSavedDashboard, type ApiDashboardMember, DashboardsApi, type TipoDeVista } from '@core/api';
import { I18nService } from '@core/i18n';
import { AppStore, CAPABILITIES } from '@core/state';
import { ConfirmDialogComponent } from '@ui/confirm-dialog';
import { IconComponent } from '@ui/icon';
import { UiSelectComponent, type UiOption } from '@ui/select';

export interface PlantillaDeVista {
  readonly id: string;
  readonly nombre: string;
  readonly json: string;
}

export interface VistaCargada {
  readonly json: string | null;
  readonly soloLectura: boolean;
}

const PERMISOS: Record<TipoDeVista, { crear: string; compartir: string }> = {
  dashboard: { crear: 'dashboard.tableros.crear', compartir: 'dashboard.tableros.accesos.editar' },
  'plan.deudas': { crear: 'planificacion.planes.crear', compartir: 'planificacion.planes.accesos.editar' },
  'plan.compras': { crear: 'planificacion.planes.crear', compartir: 'planificacion.planes.accesos.editar' },
  'plan.vacaciones': { crear: 'planificacion.planes.crear', compartir: 'planificacion.planes.accesos.editar' },
  'plan.inversiones': { crear: 'planificacion.planes.crear', compartir: 'planificacion.planes.accesos.editar' },
  reporte: { crear: 'reportes.propios.crear', compartir: 'reportes.propios.accesos.editar' },
};

const SIN_VISTA = '';
const PREFIJO_PLANTILLA = 'plantilla:';

type Panel = 'nuevo' | 'renombrar' | 'compartir' | null;

@Component({
  selector: 'fin-vistas-guardadas',
  imports: [FormsModule, HlmButton, HlmCheckbox, HlmInput, ConfirmDialogComponent, IconComponent, UiSelectComponent],
  host: { class: 'grid gap-2' },
  templateUrl: './vistas-guardadas.html',
})
export class VistasGuardadasComponent {
  readonly i18n = inject(I18nService);
  private readonly injector = inject(Injector);

  private get api(): DashboardsApi {
    return this.injector.get(DashboardsApi);
  }
  private readonly store = inject(AppStore);
  private readonly capabilities = inject(CAPABILITIES);

  readonly tipo = input.required<TipoDeVista>();
  readonly estado = input.required<string>();
  readonly etiqueta = input.required<string>();
  readonly vacia = input.required<string>();
  readonly plantillas = input<readonly PlantillaDeVista[]>([]);
  readonly cargar = output<VistaCargada>();

  readonly vistas = signal<readonly ApiSavedDashboard[]>([]);
  readonly miembros = signal<readonly ApiDashboardMember[]>([]);
  readonly seleccion = signal(SIN_VISTA);
  readonly guardado = signal<string | null>(null);
  readonly panel = signal<Panel>(null);
  readonly nombre = signal('');
  readonly elegidos = signal<ReadonlySet<string>>(new Set());
  readonly confirmarBorrado = signal(false);
  readonly error = signal('');
  private readonly fijarAlCargar = signal(false);
  private readonly fijarLineaBase = effect(() => {
    const estado = this.estado();
    if (!this.fijarAlCargar()) return;
    untracked(() => {
      this.guardado.set(estado);
      this.fijarAlCargar.set(false);
    });
  });

  readonly disponible = computed(() => this.store.remoteState() === 'ready');
  readonly puedeCrear = computed(() => this.disponible() && this.capabilities.allows(PERMISOS[this.tipo()].crear));
  readonly puedeCompartir = computed(
    () => this.disponible() && this.capabilities.allows(PERMISOS[this.tipo()].compartir),
  );
  readonly activa = computed(() => this.vistas().find((v) => v.id === this.seleccion()) ?? null);
  readonly esPropia = computed(() => this.activa()?.isMine === true);
  readonly sinGuardar = computed(
    () => this.esPropia() && this.guardado() !== null && this.guardado() !== this.estado(),
  );

  readonly opciones = computed<UiOption[]>(() => [
    { value: SIN_VISTA, label: this.vacia() },
    ...this.plantillas().map((p) => ({
      value: `${PREFIJO_PLANTILLA}${p.id}`,
      label: p.nombre,
      description: this.i18n.t('savedViews.template'),
    })),
    ...this.vistas()
      .filter((v) => v.isMine)
      .map((v) => ({
        value: v.id,
        label: v.name,
        description: v.sharedWith.length
          ? this.i18n.t('savedViews.sharedWithCount', { n: v.sharedWith.length })
          : undefined,
      })),
    ...this.vistas()
      .filter((v) => !v.isMine)
      .map((v) => ({
        value: v.id,
        label: v.name,
        description: this.i18n.t('savedViews.sharedBy', { name: v.owner.name }),
      })),
  ]);

  private readonly traer = effect(() => {
    const tipo = this.tipo();
    if (!this.disponible()) return;
    untracked(() => void this.recargar(tipo));
  });

  async elegir(valor: string): Promise<void> {
    this.error.set('');
    this.seleccion.set(valor);
    if (valor === SIN_VISTA) {
      this.guardado.set(null);
      this.cargar.emit({ json: null, soloLectura: false });
      return;
    }
    if (valor.startsWith(PREFIJO_PLANTILLA)) {
      const plantilla = this.plantillas().find((p) => `${PREFIJO_PLANTILLA}${p.id}` === valor);
      this.guardado.set(null);
      this.cargar.emit({ json: plantilla?.json ?? null, soloLectura: false });
      return;
    }
    try {
      const vista = await firstValueFrom(this.api.una(this.tipo(), valor));
      this.cargar.emit({ json: vista.layoutJson, soloLectura: !vista.isMine });
      this.guardado.set(null);
      this.fijarAlCargar.set(vista.isMine);
    } catch (error) {
      this.error.set(this.mensaje(error));
    }
  }

  abrirPanel(panel: Panel): void {
    this.error.set('');
    if (this.panel() === panel) {
      this.panel.set(null);
      return;
    }
    this.panel.set(panel);
    this.nombre.set(panel === 'renombrar' ? (this.activa()?.name ?? '') : '');
    if (panel === 'compartir') {
      this.elegidos.set(new Set(this.activa()?.sharedWith.map((p) => p.id) ?? []));
      void firstValueFrom(this.api.miembrosPara(this.tipo()))
        .then((lista) => this.miembros.set(lista))
        .catch(() => this.miembros.set([]));
    }
  }

  alternarMiembro(id: string, elegido: boolean): void {
    this.elegidos.update((actual) => {
      const siguiente = new Set(actual);
      if (elegido) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });
  }

  async guardarCambios(): Promise<void> {
    const vista = this.activa();
    if (!vista?.isMine) return;
    try {
      await firstValueFrom(
        this.api.actualizar(this.tipo(), vista.id, {
          name: vista.name,
          layoutJson: this.estado(),
          isPinned: vista.isPinned,
        }),
      );
      this.guardado.set(this.estado());
      await this.recargar(this.tipo());
    } catch (error) {
      this.error.set(this.mensaje(error));
    }
  }

  async confirmar(): Promise<void> {
    this.error.set('');
    try {
      const panel = this.panel();
      const vista = this.activa();
      if (panel === 'nuevo') {
        const creada = await firstValueFrom(
          this.api.crear(this.tipo(), { name: this.nombre(), layoutJson: this.estado() }),
        );
        await this.recargar(this.tipo());
        this.seleccion.set(creada.id);
        this.guardado.set(this.estado());
      }
      if (panel === 'renombrar' && vista?.isMine) {
        await firstValueFrom(
          this.api.actualizar(this.tipo(), vista.id, {
            name: this.nombre(),
            layoutJson: this.estado(),
            isPinned: vista.isPinned,
          }),
        );
        this.guardado.set(this.estado());
        await this.recargar(this.tipo());
      }
      if (panel === 'compartir' && vista?.isMine) {
        await firstValueFrom(this.api.compartirCon(this.tipo(), vista.id, [...this.elegidos()]));
        await this.recargar(this.tipo());
      }
      this.panel.set(null);
    } catch (error) {
      this.error.set(this.mensaje(error));
    }
  }

  async borrar(): Promise<void> {
    this.confirmarBorrado.set(false);
    const vista = this.activa();
    if (!vista?.isMine) return;
    try {
      await firstValueFrom(this.api.borrar(this.tipo(), vista.id));
      await this.recargar(this.tipo());
      await this.elegir(SIN_VISTA);
    } catch (error) {
      this.error.set(this.mensaje(error));
    }
  }

  private async recargar(tipo: TipoDeVista): Promise<void> {
    try {
      this.vistas.set(await firstValueFrom(this.api.lista(tipo)));
    } catch {
      this.vistas.set([]);
    }
  }

  private mensaje(error: unknown): string {
    return (error as { error?: { detail?: string } })?.error?.detail ?? this.i18n.t('savedViews.error');
  }
}
