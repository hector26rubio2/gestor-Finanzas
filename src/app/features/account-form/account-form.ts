import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountViewType, type CardBucket, PRIORIDAD_EN_DOLARES, PRIORIDAD_EN_PESOS, claveDeConcepto, completarPrioridad } from '@core/api';
import { Account, CAPABILITIES, AppStore } from '@core/state';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import { OverlayComponent } from '@ui/overlay';
import { UiOption, UiSelectComponent } from '@ui/select';
import { NumericInputDirective } from '@ui/numeric-input';
import { FieldComponent } from '@ui/field';
import { IconComponent } from '@ui/icon';
import { AsyncActionService } from '@core/utils';
import { mensualDesdeAnual } from '@shared/utils';

/**
 * Permiso que exige el backend para abrir una cuenta de este tipo.
 *
 * Replica `FaltaPermisoDeTipoDeCuenta` de `AccountsEndpoints.cs:70-79`, donde el tipo
 * viaja en el cuerpo y la política de la ruta no puede verlo: sin esta regla, la
 * interfaz ofrecería cuentas que el servidor rechaza con 403 y el error llegaría tarde.
 */
export function permisoParaEditarCuenta(tipo: AccountViewType): string {
  return tipo === 'credit' ? P.cuentas.tarjetas.editar : P.cuentas.editar;
}

export function permisoParaTipoDeCuenta(tipo: AccountViewType): string {
  if (tipo === 'credit') return P.cuentas.tarjetas.crear;
  if (tipo === 'savings' || tipo === 'checking') return P.cuentas.ahorro.crear;
  if (tipo === 'cash' || tipo === 'wallet') return P.cuentas.efectivo.crear;
  return P.cuentas.crear;
}

@Component({
  selector: 'fin-account-form',
  imports: [
    HlmButton,
    HlmInput,
    FormsModule,
    OverlayComponent,
    UiSelectComponent,
    NumericInputDirective,
    FieldComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-form.html',
})
export class AccountFormComponent {
  private readonly capabilities = inject(CAPABILITIES);
  private readonly store = inject(AppStore);
  readonly i18n = inject(I18nService);
  readonly error = signal('');
  name = 'Ahorro principal';

  /**
   * Un tipo de cuenta por permiso: se puede dar el ahorro y retener la tarjeta.
   * El permiso de cada uno sale de `permisoParaTipoDeCuenta`, la regla del backend.
   */
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
  currency = 'COP';
  readonly currencyOptions = computed<readonly UiOption[]>(() => [
    { value: 'COP', label: this.i18n.t('form.currency.cop') },
    { value: 'USD', label: this.i18n.t('form.currency.usd') },
  ]);
  readonly monedaDePrioridad = signal<'pesos' | 'dolares'>('pesos');
  readonly monedasDePrioridad = computed<readonly UiOption[]>(() => [
    { value: 'pesos', label: this.i18n.t('form.account.priority.local') },
    { value: 'dolares', label: this.i18n.t('form.account.priority.foreign') },
  ]);
  readonly prioridadEnPesos = signal<CardBucket[]>([...PRIORIDAD_EN_PESOS]);
  readonly prioridadEnDolares = signal<CardBucket[]>([...PRIORIDAD_EN_DOLARES]);
  private prioridadActiva() {
    return this.monedaDePrioridad() === 'pesos' ? this.prioridadEnPesos : this.prioridadEnDolares;
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
  restablecerPrioridad(): void {
    if (this.monedaDePrioridad() === 'pesos') this.prioridadEnPesos.set([...PRIORIDAD_EN_PESOS]);
    else this.prioridadEnDolares.set([...PRIORIDAD_EN_DOLARES]);
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
  minimumPayment = 50000;
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
    this.prioridadEnPesos.set(completarPrioridad(account.paymentPriority, PRIORIDAD_EN_PESOS));
    this.prioridadEnDolares.set(completarPrioridad(account.foreignPaymentPriority, PRIORIDAD_EN_DOLARES));
  }

  closed = () => this.store.form.set(null);
  async save() {
    if (this.editing) return this.saveChanges(this.editing);
    try {
      this.error.set('');
      // Una tarjeta la crea quien administra tarjetas; una cuenta, quien administra cuentas.
      const permiso = permisoParaTipoDeCuenta(this.type);
      if (!this.capabilities.allows(permiso)) throw new Error(this.i18n.t('form.account.error.forbidden'));
      await this.actions.run(
        this.saveActionKey,
        () =>
          this.store.createAccount(
            this.name,
            this.type,
            Number(this.opening),
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
            },
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
          this.store.updateAccount(account, {
            name: this.name,
            lastFour: this.lastFour,
            credit: {
              limit: Number(this.limit),
              cutDay: Number(this.cutDay),
              dueDay: Number(this.dueDay),
              monthlyRate: Number(this.monthlyRate),
              issuerId: this.issuerId,
              paymentPriority: this.prioridadEnPesos(),
              foreignPaymentPriority: this.prioridadEnDolares(),
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
