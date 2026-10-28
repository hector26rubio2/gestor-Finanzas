import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { NgTemplateOutlet } from '@angular/common';
import { Component, Injector, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormField, FormRoot, form, type FieldTree } from '@angular/forms/signals';
import {
  AccountViewType,
  type CardBucket,
  FinanceApiClient,
  PRIORIDAD_EN_DOLARES,
  PRIORIDAD_EN_PESOS,
  claveDeConcepto,
  completarPrioridad,
} from '@core/api';
import { Account, CAPABILITIES, AppStore, type Movement, CatalogCommands } from '@core/state';
import { aplicarAbono, comprasPendientes, saldosPorConcepto, traerMovimientosDeTarjetas } from '@shared/tarjetas';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import { OverlayComponent } from '@ui/overlay';
import { UiOption, UiSelectComponent } from '@ui/select';
import { UiSelectOrCreateComponent } from '@ui/select-or-create';
import { NumericInputDirective } from '@ui/numeric-input';
import { FieldComponent } from '@ui/field';
import { IconComponent } from '@ui/icon';
import { AsyncActionService } from '@core/utils';
import { mensualDesdeAnual } from '@core/utils/tasas';
import { type DatosDeCuenta, esquemaDeCuenta } from './account-form.schema';

export function permisoParaEditarCuenta(tipo: AccountViewType): string {
  return tipo === 'credit' ? P.cuentas.tarjetas.editar : P.cuentas.editar;
}

function datosIniciales(cuenta: Account | null, tipoNuevo: AccountViewType): DatosDeCuenta {
  return {
    name: cuenta?.name ?? '',
    type: cuenta?.type ?? tipoNuevo,
    currency: cuenta?.currency ?? 'COP',
    opening: 0,
    lastFour: cuenta?.lastFour ?? '',
    exchangeRate: 4168.35,
    issuerId: cuenta?.issuerId ?? '',
    limit: cuenta?.limit ?? 5000000,
    cutDay: cuenta?.cutDay ?? 20,
    dueDay: cuenta?.dueDay ?? 5,
    monthlyRate: cuenta?.annualRate !== undefined ? mensualDesdeAnual(cuenta.annualRate) : 2.11,
    monthlyFee: cuenta?.monthlyFee ?? 0,
    monedaDePrioridad: 'pesos',
    abonoDePrueba: 300000,
  };
}

function permisoParaTipoDeCuenta(tipo: AccountViewType): string {
  if (tipo === 'credit') return P.cuentas.tarjetas.crear;
  if (tipo === 'savings' || tipo === 'checking') return P.cuentas.ahorro.crear;
  if (tipo === 'cash' || tipo === 'wallet') return P.cuentas.efectivo.crear;
  return P.cuentas.crear;
}

@Component({
  selector: 'fin-account-form',
  imports: [
    HlmButton,
    HlmCheckbox,
    HlmInput,
    FormField,
    FormRoot,
    NgTemplateOutlet,
    OverlayComponent,
    UiSelectComponent,
    UiSelectOrCreateComponent,
    NumericInputDirective,
    FieldComponent,
    IconComponent,
  ],
  templateUrl: './account-form.html',
})
export class AccountFormComponent {
  private readonly capabilities = inject(CAPABILITIES);
  private readonly store = inject(AppStore);
  private readonly catalogCommands = inject(CatalogCommands);
  readonly i18n = inject(I18nService);
  readonly error = signal('');
  readonly editing = this.store.form()?.account ?? null;
  readonly modelo = signal(datosIniciales(this.editing, this.store.form()?.accountType ?? 'savings'));
  readonly formulario = form(
    this.modelo,
    esquemaDeCuenta((clave) => this.i18n.t(clave)),
    { name: 'cuenta', submission: { action: async () => this.save() } },
  );

  readonly accountTypes = computed(() =>
    (['savings', 'checking', 'cash', 'wallet', 'other', 'credit'] as const)
      .map((value) => ({
        value,
        label: this.i18n.t(`form.account.type.${value}`),
        permiso: permisoParaTipoDeCuenta(value),
      }))
      .filter((option) => this.capabilities.allows(option.permiso)),
  );
  readonly currencyOptions = computed<readonly UiOption[]>(() => [
    { value: 'COP', label: this.i18n.t('form.currency.cop') },
    { value: 'USD', label: this.i18n.t('form.currency.usd') },
  ]);
  readonly bimoneda = signal(this.editing?.dualCurrency === true);
  readonly monedasDePrioridad = computed<readonly UiOption[]>(() => [
    { value: 'pesos', label: this.i18n.t('form.account.priority.local') },
    { value: 'dolares', label: this.i18n.t('form.account.priority.foreign') },
  ]);
  readonly prioridadEnPesos = signal<CardBucket[]>(
    completarPrioridad(this.editing?.paymentPriority, PRIORIDAD_EN_PESOS),
  );
  readonly prioridadEnDolares = signal<CardBucket[]>(
    completarPrioridad(this.editing?.foreignPaymentPriority, PRIORIDAD_EN_DOLARES),
  );
  private prioridadActiva() {
    const { currency, monedaDePrioridad } = this.modelo();
    const moneda = this.bimoneda() ? monedaDePrioridad : currency === 'USD' ? 'dolares' : 'pesos';
    return moneda === 'pesos' ? this.prioridadEnPesos : this.prioridadEnDolares;
  }

  alternarBimoneda(valor: boolean): void {
    this.bimoneda.set(valor);
    if (!valor)
      this.modelo.update((datos) => ({ ...datos, monedaDePrioridad: datos.currency === 'USD' ? 'dolares' : 'pesos' }));
  }
  readonly paymentPriorityOrder = computed(() => this.prioridadActiva()());
  etiquetaDeConcepto(concepto: number): string {
    return this.i18n.t(`card.bucket.${claveDeConcepto(concepto) ?? 'fees'}`);
  }
  private readonly draggedPriorityIndex = signal<number | null>(null);
  movePriority(index: number, delta: -1 | 1): void {
    const target = index + delta;
    this.prioridadActiva().update((order) => {
      if (target < 0 || target >= order.length) return order;
      const next = [...order];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  startDragPriority(index: number): void {
    this.draggedPriorityIndex.set(index);
  }
  dropPriority(index: number): void {
    const from = this.draggedPriorityIndex();
    this.draggedPriorityIndex.set(null);
    if (from === null || from === index) return;
    this.prioridadActiva().update((order) => {
      const next = [...order];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
  }
  esTarjeta(): boolean {
    return this.modelo().type === 'credit';
  }
  private readonly injector = inject(Injector);
  readonly abonoDePrueba = computed(() => this.modelo().abonoDePrueba ?? 0);
  private readonly comprasDeLaTarjeta = signal<readonly Movement[]>([]);
  private readonly traerCompras = effect(() => {
    const tarjeta = this.editing;
    if (!tarjeta || tarjeta.type !== 'credit' || this.store.remoteState() !== 'ready') return;
    untracked(() => {
      void traerMovimientosDeTarjetas(this.injector.get(FinanceApiClient), this.i18n, this.store.kindCatalog(), [
        tarjeta.id,
      ])
        .then((lista) => this.comprasDeLaTarjeta.set(lista))
        .catch(() => this.comprasDeLaTarjeta.set([]));
    });
  });
  readonly vistaPrevia = computed(() => {
    const prioridad =
      this.editing?.currency && this.editing.currency !== 'COP' ? this.prioridadEnDolares() : this.prioridadEnPesos();
    const saldos = saldosPorConcepto(comprasPendientes(this.comprasDeLaTarjeta(), prioridad), prioridad);
    return aplicarAbono(saldos, this.abonoDePrueba());
  });
  dinero(valor: number): string {
    return this.store.money(valor);
  }
  primerosConceptos(): string {
    return this.paymentPriorityOrder()
      .slice(0, 6)
      .map((concepto, i) => `${i + 1}. ${this.etiquetaDeConcepto(concepto)}`)
      .join(' · ');
  }
  restablecerPrioridad(): void {
    const activa = this.prioridadActiva();
    activa.set(activa === this.prioridadEnPesos ? [...PRIORIDAD_EN_PESOS] : [...PRIORIDAD_EN_DOLARES]);
  }
  readonly issuerOptions = computed<readonly UiOption[]>(() =>
    this.store
      .data()
      .people.filter((persona) => persona.kind === 'institution')
      .map((persona) => ({ value: persona.id, label: persona.name })),
  );
  readonly puedeCrearEmisor = computed(() => this.capabilities.allows(P.personas.crear));

  elegirEmisor(issuerId: string): void {
    this.modelo.update((datos) => ({ ...datos, issuerId }));
  }

  async crearEmisor(nombre: string): Promise<void> {
    const creado = await this.actions
      .run(`account:issuer:${nombre}`, () => this.catalogCommands.createCounterparty(nombre, 'institution'), {
        loading: this.i18n.t('form.account.issuer.creating'),
        success: this.i18n.t('form.account.issuer.created', { name: nombre }),
        error: (error) => (error instanceof Error ? error.message : this.i18n.t('form.movement.error.saveFailed')),
      })
      .catch(() => null);
    if (creado) this.elegirEmisor(creado.id);
  }
  readonly actions = inject(AsyncActionService);
  readonly saveActionKey = this.editing ? `account:update:${this.editing.id}` : 'account:create';
  readonly title = computed(() =>
    this.i18n.t(
      this.editing
        ? this.editing.type === 'credit'
          ? 'form.account.title.editCard'
          : 'form.account.title.edit'
        : 'form.account.title.create',
    ),
  );
  readonly typeLabel = computed(() => (this.editing ? this.i18n.t(`form.account.type.${this.editing.type}`) : ''));

  mensaje(campo: FieldTree<unknown>): string {
    const estado = campo();
    return estado.touched() ? (estado.errors()[0]?.message ?? '') : '';
  }

  escribirAbono(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.modelo.update((datos) => ({ ...datos, abonoDePrueba: Number(valor) || 0 }));
  }

  closed = () => this.store.form.set(null);
  private datosDeCredito(datos: DatosDeCuenta) {
    return {
      limit: Number(datos.limit),
      cutDay: Number(datos.cutDay),
      dueDay: Number(datos.dueDay),
      monthlyRate: Number(datos.monthlyRate),
      issuerId: datos.issuerId,
      paymentPriority: this.prioridadEnPesos(),
      foreignPaymentPriority: this.prioridadEnDolares(),
      monthlyFee: Number(datos.monthlyFee) || 0,
      dualCurrency: this.bimoneda(),
    };
  }

  async save() {
    if (this.editing) return this.saveChanges(this.editing);
    const datos = this.modelo();
    try {
      this.error.set('');
      const permiso = permisoParaTipoDeCuenta(datos.type);
      if (!this.capabilities.allows(permiso)) throw new Error(this.i18n.t('form.account.error.forbidden'));
      await this.actions.run(
        this.saveActionKey,
        () =>
          this.catalogCommands.createAccount(
            datos.name,
            datos.type,
            datos.type === 'credit' ? 0 : Number(datos.opening),
            datos.currency,
            Number(datos.exchangeRate),
            this.datosDeCredito(datos),
            datos.lastFour,
            datos.type === 'credit' ? undefined : datos.issuerId,
          ),
        {
          loading: this.i18n.t('form.account.toast.loading'),
          success: this.i18n.t('form.account.toast.success'),
          error: (error) => (error instanceof Error ? error.message : this.i18n.t('form.account.error.saveFailed')),
        },
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : this.i18n.t('form.account.error.saveFailed'));
    }
  }

  private async saveChanges(account: Account) {
    const datos = this.modelo();
    try {
      this.error.set('');
      if (!this.capabilities.allows(permisoParaEditarCuenta(account.type)))
        throw new Error(this.i18n.t('form.account.error.forbidden'));
      await this.actions.run(
        this.saveActionKey,
        () =>
          this.catalogCommands.updateAccount(account, {
            name: datos.name,
            lastFour: datos.lastFour,
            issuerId: datos.issuerId,
            credit: this.datosDeCredito(datos),
          }),
        {
          loading: this.i18n.t('form.account.toast.updating'),
          success: this.i18n.t('form.account.toast.updated'),
          error: (error) => (error instanceof Error ? error.message : this.i18n.t('form.account.error.saveFailed')),
        },
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : this.i18n.t('form.account.error.saveFailed'));
    }
  }
}
