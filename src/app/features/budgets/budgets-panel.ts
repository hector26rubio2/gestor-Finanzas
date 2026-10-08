import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCard } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import { AppStore, CAPABILITIES } from '@core/state';
import { FilaDePresupuesto, filasDePresupuesto, limiteDeTexto } from '@shared/presupuestos';
import { BarraDeAvanceComponent } from '@ui/barra-de-avance';
import { CategoryIconComponent } from '@ui/category-icon';
import { ConfirmDialogComponent } from '@ui/confirm-dialog';
import { EmptyStateComponent } from '@ui/empty-state';
import { FieldComponent } from '@ui/field';
import { IconComponent } from '@ui/icon';
import { NumericInputDirective } from '@ui/numeric-input';
import { SkeletonComponent } from '@ui/skeleton';
import { BudgetsStore } from './budgets.store';
import { crearGastoPorCategoria, rangoDelMes } from './gasto-del-mes';

@Component({
  selector: 'fin-budgets-panel',
  imports: [
    BarraDeAvanceComponent,
    CategoryIconComponent,
    ConfirmDialogComponent,
    EmptyStateComponent,
    FieldComponent,
    HlmAlertImports,
    HlmButton,
    HlmCard,
    HlmInput,
    IconComponent,
    NumericInputDirective,
    SkeletonComponent,
  ],
  templateUrl: './budgets-panel.html',
})
export class BudgetsPanelComponent {
  readonly store = inject(AppStore);
  readonly presupuestos = inject(BudgetsStore);
  readonly i18n = inject(I18nService);
  private readonly capabilities = inject(CAPABILITIES);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly puedeEditar = computed(() => this.capabilities.allows(P.cuentas.categorias.editar));
  private readonly mes = computed(() => rangoDelMes(this.store.hoy()));
  private readonly gasto = crearGastoPorCategoria(this.mes);
  readonly etiquetaDelMes = computed(() =>
    new Intl.DateTimeFormat(this.store.preferences().locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${this.mes().start}T12:00:00Z`)),
  );

  readonly filas = computed(() =>
    filasDePresupuesto({
      categorias: this.store.categories(),
      presupuestos: this.presupuestos.items(),
      gastoPorCategoria: this.gasto.gastoPorCategoria(),
      monedaBase: this.store.baseCurrency(),
    }),
  );
  readonly resumen = computed(() => {
    const conLimite = this.filas().filter((fila) => fila.limite !== null);
    return {
      cantidad: conLimite.length,
      limite: conLimite.reduce((total, fila) => total + (fila.limite ?? 0), 0),
      gastado: conLimite.reduce((total, fila) => total + fila.gastado, 0),
    };
  });

  readonly editando = signal<string | null>(null);
  readonly texto = signal('');
  readonly errorDeCampo = signal('');
  readonly porQuitar = signal<FilaDePresupuesto | null>(null);

  private readonly cargaInicial = effect(() => {
    if (this.store.remoteState() !== 'ready') return;
    untracked(() => void this.presupuestos.asegurarCarga());
  });

  tieneLimite(fila: FilaDePresupuesto): boolean {
    return fila.limite !== null || fila.monedaAjena !== null;
  }

  editar(fila: FilaDePresupuesto): void {
    this.errorDeCampo.set('');
    this.presupuestos.errorDeGuardado.set('');
    this.texto.set(fila.limite !== null ? String(fila.limite) : '');
    this.editando.set(fila.categoria.id);
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLInputElement>('input[data-slot=limite]')?.focus(), {
      injector: this.injector,
    });
  }

  cancelar(): void {
    this.editando.set(null);
    this.errorDeCampo.set('');
  }

  escribir(evento: Event): void {
    this.texto.set((evento.target as HTMLInputElement).value);
  }

  async guardar(evento: Event, fila: FilaDePresupuesto): Promise<void> {
    evento.preventDefault();
    const limite = limiteDeTexto(this.texto(), this.store.baseCurrency());
    if (limite === null) {
      this.errorDeCampo.set(this.i18n.t('budgets.error.invalid'));
      return;
    }
    if (await this.presupuestos.fijar(fila.categoria.id, limite)) {
      this.cancelar();
      this.store.toast.set(this.i18n.t('budgets.toast.saved', { name: fila.categoria.name }));
    }
  }

  async quitar(): Promise<void> {
    const fila = this.porQuitar();
    this.porQuitar.set(null);
    if (fila && (await this.presupuestos.quitar(fila.categoria.id)))
      this.store.toast.set(this.i18n.t('budgets.toast.removed', { name: fila.categoria.name }));
  }

  dinero(valor: number): string {
    return this.store.money(valor);
  }

  textoDeEstado(fila: FilaDePresupuesto): string {
    const estado = fila.estado;
    if (!estado) return '';
    return estado.diferencia >= 0
      ? this.i18n.t('budgets.remaining', { amount: this.dinero(estado.diferencia) })
      : this.i18n.t('budgets.over', { amount: this.dinero(-estado.diferencia) });
  }
}
