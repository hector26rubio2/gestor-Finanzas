import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmInput } from '@spartan-ng/helm/input';
import { I18nService } from '@core/i18n';
import { sincronizarConLaUrl } from '@core/state';
import { ConfirmDialogComponent } from '@ui/confirm-dialog';
import { IconComponent } from '@ui/icon';
import { UiSelectComponent, type UiOption } from '@ui/select';
import { DashboardLayoutService } from '@pages/dashboard/layout/dashboard-layout.service';
import { TABLERO_PRINCIPAL, TablerosService } from './tableros.service';

type Panel = 'nuevo' | 'renombrar' | 'compartir' | null;

@Component({
  selector: 'fin-selector-de-tableros',
  imports: [FormsModule, HlmButton, HlmCheckbox, HlmInput, ConfirmDialogComponent, IconComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grid gap-2' },
  templateUrl: './selector-de-tableros.html',
})
export class SelectorDeTablerosComponent {
  readonly i18n = inject(I18nService);
  readonly tableros = inject(TablerosService);
  readonly layout = inject(DashboardLayoutService);

  readonly seleccion = signal(TABLERO_PRINCIPAL);
  private readonly url = sincronizarConLaUrl('tablero', this.seleccion, TABLERO_PRINCIPAL, (valor) => valor.length > 0);
  private readonly abrirSeleccion = effect(() => {
    const id = this.seleccion();
    const lista = this.tableros.tableros();
    if (id !== TABLERO_PRINCIPAL && !lista.some((t) => t.id === id)) return;
    if (id === untracked(this.tableros.activo)) return;
    untracked(() => {
      void this.tableros.abrir(id).catch(() => this.seleccion.set(TABLERO_PRINCIPAL));
    });
  });
  private readonly seguirActivo = effect(() => {
    const activo = this.tableros.activo();
    untracked(() => {
      if (this.seleccion() !== activo) this.seleccion.set(activo);
    });
  });

  readonly panel = signal<Panel>(null);
  readonly nombre = signal('');
  readonly copiarActual = signal(true);
  readonly elegidos = signal<ReadonlySet<string>>(new Set());
  readonly confirmarBorrado = signal(false);
  readonly error = signal('');

  readonly opciones = computed<UiOption[]>(() => [
    { value: TABLERO_PRINCIPAL, label: this.i18n.t('dashboard.boards.main') },
    ...this.tableros.propios().map((t) => ({
      value: t.id,
      label: t.isPinned ? `★ ${t.name}` : t.name,
      description: t.sharedWith.length
        ? this.i18n.t('dashboard.boards.sharedWithCount', { n: t.sharedWith.length })
        : undefined,
    })),
    ...this.tableros.compartidos().map((t) => ({
      value: t.id,
      label: t.name,
      description: this.i18n.t('dashboard.boards.sharedBy', { name: t.owner.name }),
    })),
  ]);
  readonly activo = this.tableros.tableroActivo;
  readonly esPropio = computed(() => this.activo()?.isMine === true);

  abrirPanel(panel: Panel): void {
    this.error.set('');
    if (this.panel() === panel) {
      this.panel.set(null);
      return;
    }
    this.panel.set(panel);
    if (panel === 'renombrar') this.nombre.set(this.activo()?.name ?? '');
    if (panel === 'nuevo') this.nombre.set('');
    if (panel === 'compartir') {
      this.elegidos.set(new Set(this.activo()?.sharedWith.map((p) => p.id) ?? []));
      void this.tableros.cargarMiembros();
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

  async confirmar(): Promise<void> {
    this.error.set('');
    try {
      const panel = this.panel();
      if (panel === 'nuevo') await this.tableros.crear(this.nombre(), this.copiarActual());
      if (panel === 'renombrar') await this.tableros.renombrar(this.nombre());
      if (panel === 'compartir') await this.tableros.compartir([...this.elegidos()]);
      this.panel.set(null);
    } catch (error) {
      this.error.set(this.mensaje(error));
    }
  }

  async borrar(): Promise<void> {
    this.confirmarBorrado.set(false);
    try {
      await this.tableros.borrar();
    } catch (error) {
      this.error.set(this.mensaje(error));
    }
  }

  async fijar(): Promise<void> {
    try {
      await this.tableros.alternarFijado();
    } catch (error) {
      this.error.set(this.mensaje(error));
    }
  }

  private mensaje(error: unknown): string {
    const detalle = (error as { error?: { detail?: string } })?.error?.detail;
    return detalle ?? this.i18n.t('dashboard.boards.error');
  }
}
