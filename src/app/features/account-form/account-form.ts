import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { Component, Injector, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { NumericInputDirective } from '@ui/numeric-input';
import { FieldComponent } from '@ui/field';
import { IconComponent } from '@ui/icon';
import { AsyncActionService, baseCurrency, isForeignCurrency, opcionesDeMoneda } from '@core/utils';
import { mensualDesdeAnual } from '@core/utils/tasas';

export function permisoParaEditarCuenta(tipo: AccountViewType): string {
  return tipo === 'credit' ? P.cuentas.tarjetas.editar : P.cuentas.editar;
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
    FormsModule,
    OverlayComponent,
    UiSelectComponent,
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
  name = 'Ahorro principal';

  readonly accountTypes = computed(() =>
    (['savings', 'checking', 'cash', 'wallet', 'other', 'credit'] as const)
      .map((value) => ({
        value,
        label: this.i18n.t(`form.account.type.${value}`),
        permiso: permisoParaTipoDeCuenta(value),
      }))
      .filter((option) => this.capabilities.allows(option.permiso)),
  );
  type: AccountViewType = this.store.form()?.accountType ?? 'savings';
  currency = baseCurrency();
  readonly currencyOptions = computed<readonly UiOption[]>(() => opcionesDeMoneda((clave) => this.i18n.t(clave)));
  readonly bimoneda = signal(false);
  readonly monedaDePrioridad = signal<'pesos' | 'dolares'>('pesos');
  readonly monedasDePrioridad = computed<readonly UiOption[]>(() => [
    { value: 'pesos', label: this.i18n.t('form.account.priority.local') },
    { value: 'dolares', label: this.i18n.t('form.account.priority.foreign') },
  ]);
  readonly prioridadEnPesos = signal<CardBucket[]>([...PRIORIDAD_EN_PESOS]);
  readonly prioridadEnDolares = signal<CardBucket[]>([...PRIORIDAD_EN_DOLARES]);
  private prioridadActiva() {
    const moneda = this.bimoneda() ? this.monedaDePrioridad() : this.currency === 'USD' ? 'dolares' : 'pesos';
    return moneda === 'pesos' ? this.prioridadEnPesos : this.prioridadEnDolares;
  }

  alternarBimoneda(valor: boolean): void {
    this.bimoneda.set(valor);
    if (!valor) this.monedaDePrioridad.set(this.currency === 'USD' ? 'dolares' : 'pesos');
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
    return (this.editing?.type ?? this.type) === 'credit';
  }
  private readonly injector = inject(Injector);
  readonly abonoDePrueba = signal(300000);
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
      this.editing?.currency && isForeignCurrency(this.editing.currency)
        ? this.prioridadEnDolares()
        : this.prioridadEnPesos();
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
  exchangeRate = 4168.35;
  opening = 0;
  limit = 5000000;
  cutDay = 20;
  dueDay = 5;
  monthlyRate = 2.11;
  issuerId = '';
  readonly issuerOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('form.account.issuer.none') },
    ...this.store
      .data()
      .people.filter((persona) => persona.kind === 'institution')
      .map((persona) => ({ value: persona.id, label: persona.name })),
  ]);
  monthlyFee = 0;
  readonly actions = inject(AsyncActionService);
  readonly editing = this.store.form()?.account ?? null;
  readonly saveActionKey = this.editing ? `account:update:${this.editing.id}` : 'account:create';
  lastFour = '';
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

  constructor() {
    const account = this.editing;
    if (!account) return;
    this.name = account.name;
    this.type = account.type;
    this.currency = account.currency;
    this.lastFour = account.lastFour ?? '';
    if (account.limit !== undefined) this.limit = account.limit;
    if (account.cutDay !== undefined) this.cutDay = account.cutDay;
    if (account.dueDay !== undefined) this.dueDay = account.dueDay;
    if (account.annualRate !== undefined) this.monthlyRate = mensualDesdeAnual(account.annualRate);
    this.issuerId = account.issuerId ?? '';
    this.monthlyFee = account.monthlyFee ?? 0;
    this.bimoneda.set(account.dualCurrency === true);
    this.prioridadEnPesos.set(completarPrioridad(account.paymentPriority, PRIORIDAD_EN_PESOS));
    this.prioridadEnDolares.set(completarPrioridad(account.foreignPaymentPriority, PRIORIDAD_EN_DOLARES));
  }

  closed = () => this.store.form.set(null);
  async save() {
    if (this.editing) return this.saveChanges(this.editing);
    try {
      this.error.set('');
      const permiso = permisoParaTipoDeCuenta(this.type);
      if (!this.capabilities.allows(permiso)) throw new Error(this.i18n.t('form.account.error.forbidden'));
      await this.actions.run(
        this.saveActionKey,
        () =>
          this.catalogCommands.createAccount(
            this.name,
            this.type,
            this.type === 'credit' ? 0 : Number(this.opening),
            this.currency,
            Number(this.exchangeRate),
            {
              limit: Number(this.limit),
              cutDay: Number(this.cutDay),
              dueDay: Number(this.dueDay),
              monthlyRate: Number(this.monthlyRate),
              issuerId: this.issuerId,
              paymentPriority: this.prioridadEnPesos(),
              foreignPaymentPriority: this.prioridadEnDolares(),
              monthlyFee: Number(this.monthlyFee) || 0,
              dualCurrency: this.bimoneda(),
            },
            this.lastFour,
            this.type === 'credit' ? undefined : this.issuerId,
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
    try {
      this.error.set('');
      if (!this.capabilities.allows(permisoParaEditarCuenta(account.type)))
        throw new Error(this.i18n.t('form.account.error.forbidden'));
      await this.actions.run(
        this.saveActionKey,
        () =>
          this.catalogCommands.updateAccount(account, {
            name: this.name,
            lastFour: this.lastFour,
            issuerId: this.issuerId,
            credit: {
              limit: Number(this.limit),
              cutDay: Number(this.cutDay),
              dueDay: Number(this.dueDay),
              monthlyRate: Number(this.monthlyRate),
              issuerId: this.issuerId,
              paymentPriority: this.prioridadEnPesos(),
              foreignPaymentPriority: this.prioridadEnDolares(),
              monthlyFee: Number(this.monthlyFee) || 0,
              dualCurrency: this.bimoneda(),
            },
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
