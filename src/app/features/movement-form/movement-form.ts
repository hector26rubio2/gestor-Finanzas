import { IconComponent } from '@ui/icon/icon';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '@core/i18n';
import { P } from '@core/session/permissions';
import { CAPABILITIES, CapabilitiesProvider, AppStore, FEATURES } from '@core/state/store';
import { MovementCommands } from '@core/state/movement-commands';
import { OverlayComponent } from '@ui/overlay/overlay';
import { MovementCategoryFieldComponent } from './category-field/category-field';
import { MovementCoreFieldsComponent } from './core-fields/core-fields';
import { MovementCurrencyFieldsComponent } from './currency-fields/currency-fields';
import { MovementInstallmentFieldsComponent } from './installment-fields/installment-fields';
import { SegmentedComponent, SegmentedOption } from '@ui/segmented';
import { MovementRecurrenceFieldsComponent } from './recurrence-fields/recurrence-fields';
import { MovementAttributionFieldComponent } from './attribution-field/attribution-field';
import { MovementCounterpartyFieldComponent } from './counterparty-field/counterparty-field';
import { MovementFinancingFieldsComponent } from './financing-fields/financing-fields';
import { MovementFieldVisibility, MovementVisibilityBuilder } from './movement-visibility-builder';
import { UiOption, UiSelectComponent } from '@ui/select/select';
import { FieldComponent } from '@ui/field/field';
import { AsyncActionService } from '@core/utils/async-action.service';
import { Movement } from '@core/state/view-model';

const MOVEMENT_KINDS = ['', 'income', 'expense', 'payment'] as const;
const MOVEMENT_OPERATION_TYPES = ['normal', 'transfer', 'advance', 'loan', 'credit', 'received'] as const;

export type MovementKind = (typeof MOVEMENT_KINDS)[number];
export type MovementOperationType = (typeof MOVEMENT_OPERATION_TYPES)[number];
export type MovementEffectiveKind = MovementKind | 'transfer' | 'advance';

export type MovementFormModel = {
  [clave: string]: unknown;
  kind: MovementKind;
  operationType: MovementOperationType;
  date: string;
  description: string;
  accountId: string;
  targetId: string;
  category: string;
  person: string;
  counterpartyId: string;
  amount: number;
  id?: string;
  notificationId?: string;
  ownership: Movement['ownership'];
  recurring: string;
  recurrence: Movement['recurrence'];
  installmentCurrent: number;
  installmentTotal: number;
  installmentRate?: number;
  cardBucket?: number;
  loanProduct: NonNullable<Movement['loanProduct']>;
  monthlyRate?: number;
  termMonths?: number;
  cardMode: 'purchase' | 'cashAdvance';
  originalCurrency: Movement['originalCurrency'];
  originalAmount: number;
  exchangeRate: number;
};

const isMovementKind = (value: string): value is MovementKind => MOVEMENT_KINDS.some((kind) => kind === value);

const isMovementOperationType = (value: string): value is MovementOperationType =>
  MOVEMENT_OPERATION_TYPES.some((operationType) => operationType === value);

const OPERACIONES_DE_GASTO: readonly MovementOperationType[] = ['normal', 'transfer', 'advance', 'loan'];
const OPERACIONES_DE_INGRESO: readonly MovementOperationType[] = ['normal', 'received', 'loan', 'credit'];

@Component({
  selector: 'fin-movement-form',
  imports: [
    IconComponent,
    HlmButton,
    HlmInput,
    FormsModule,
    OverlayComponent,
    SegmentedComponent,
    MovementCoreFieldsComponent,
    MovementCategoryFieldComponent,
    MovementCurrencyFieldsComponent,
    MovementInstallmentFieldsComponent,
    MovementRecurrenceFieldsComponent,
    MovementAttributionFieldComponent,
    MovementCounterpartyFieldComponent,
    MovementFinancingFieldsComponent,
    UiSelectComponent,
    FieldComponent,
  ],
  templateUrl: './movement-form.html',
})
export class MovementFormComponent {
  readonly store = inject(AppStore);
  private readonly movementCommands = inject(MovementCommands);
  private readonly capabilities: CapabilitiesProvider = inject(CAPABILITIES);
  private readonly features = inject(FEATURES);
  readonly i18n = inject(I18nService);
  readonly error = signal('');
  readonly actions = inject(AsyncActionService);
  readonly saveActionKey = 'movement:save';

  readonly types = computed<readonly SegmentedOption[]>(() =>
    [
      {
        value: 'expense',
        label: this.i18n.t('form.movement.type.expense'),
        icon: 'trendDown' as const,
        permiso: P.movimientos.crear,
      },
      {
        value: 'income',
        label: this.i18n.t('form.movement.type.income'),
        icon: 'trendUp' as const,
        permiso: P.movimientos.crear,
      },
    ].filter((t) => this.capabilities.allows(t.permiso)),
  );

  model: MovementFormModel;

  readonly title = computed(() =>
    this.store.form()?.notificationId
      ? this.i18n.t('form.movement.title.review')
      : this.store.form()?.movement
        ? this.i18n.t('form.movement.title.edit')
        : this.i18n.t('form.movement.title.create'),
  );

  constructor() {
    const context = this.store.form()!;
    const m = context.movement;
    this.model = {
      kind: isMovementKind(context.kind) ? context.kind : '',
      date: m?.date ?? this.store.hoy(),
      accountId: context.accountId ?? m?.accountId ?? this.cuentaPredeterminada(),
      targetId: context.targetId ?? '',
      description: m?.description ?? '',
      amount: Math.abs(m?.amount ?? 0),
      category: m?.category ?? '',
      person: m?.person ?? '',
      counterpartyId: '',
      id: m?.id,
      notificationId: context.notificationId,
      ownership: m?.ownership ?? 'own',
      recurring: String(m?.recurring ?? false),
      recurrence: m?.recurrence ?? 'monthly',
      installmentCurrent: m?.installmentCurrent ?? 1,
      installmentTotal: m?.installmentTotal ?? 1,
      cardBucket: m?.cardBucket,
      loanProduct: m?.loanProduct ?? 'personal',
      cardMode: 'purchase',
      operationType: m ? operacionDe(m) : operacionPedida(context.operationType, context.kind),
      originalCurrency: m?.originalCurrency ?? 'COP',
      originalAmount: m?.originalAmount ?? 0,
      exchangeRate: m?.exchangeRate ?? 4168.35,
    };
  }

  private permitida(operacion: MovementOperationType): boolean {
    switch (operacion) {
      case 'transfer':
        return this.capabilities.allows(P.movimientos.transferencias.crear);
      case 'advance':
        return this.capabilities.allows(P.movimientos.avances.crear) && this.features.enabled('movements.cashAdvance');
      case 'loan':
        return (
          this.capabilities.allows(P.movimientos.prestamos.crear) &&
          this.capabilities.allows(this.model.kind === 'income' ? P.personas.deudas.crear : P.personas.prestamos.crear)
        );
      case 'credit':
        return this.capabilities.allows(P.movimientos.creditos.crear);
      default:
        return true;
    }
  }

  operationTypeOptions(): readonly UiOption[] {
    const kind = this.model.kind;
    const lista = kind === 'income' ? OPERACIONES_DE_INGRESO : OPERACIONES_DE_GASTO;
    return lista
      .filter((operacion) => this.permitida(operacion))
      .map((operacion) => ({
        value: operacion,
        label: this.i18n.t(`form.movement.operationType.${kind}.${operacion}`),
      }));
  }

  operationHint(): string {
    return this.i18n.t(`form.movement.operationHint.${this.model.kind}.${this.model.operationType}`);
  }

  effectiveKind(): MovementEffectiveKind {
    const operationType = this.model.operationType;
    return operationType === 'transfer' || operationType === 'advance' ? operationType : this.model.kind;
  }

  setKind(value: string) {
    if (!isMovementKind(value)) return;
    this.model.kind = value;
    const disponibles = value === 'income' ? OPERACIONES_DE_INGRESO : OPERACIONES_DE_GASTO;
    if (!disponibles.includes(this.model.operationType)) this.setOperationType('normal');
    this.store.form.update((v) => (v ? { ...v, kind: value } : v));
  }

  setOperationType(value: string) {
    if (!isMovementOperationType(value)) return;
    this.model.operationType = value;
    if (value !== 'transfer' && value !== 'advance') this.model.targetId = '';
    if (value !== 'normal') this.model.recurring = 'false';
    if (value !== 'normal' && value !== 'received') this.model.category = '';
    if (value !== 'normal') this.model.person = '';
    if (value === 'normal' || value === 'transfer' || value === 'advance') this.model.counterpartyId = '';
    if (!this.cuentaAdmitida(this.store.account(this.model.accountId)?.type)) this.model.accountId = '';
  }

  private cuentaPredeterminada(): string {
    return this.store.data().accounts.find((cuenta) => cuenta.isDefault)?.id ?? '';
  }

  private cuentaAdmitida(tipo: string | undefined): boolean {
    if (!tipo) return true;
    const operacion = this.model.operationType;
    if (operacion === 'advance') return tipo === 'credit';
    if (tipo !== 'credit') return true;
    return this.model.kind === 'expense' && (operacion === 'normal' || operacion === 'loan');
  }

  visibility(): MovementFieldVisibility {
    const account = this.store.account(this.model.accountId);
    return new MovementVisibilityBuilder(
      this.model.kind,
      account,
      !!this.model.id,
      this.model.operationType,
      this.monedaDeCompra(),
    )
      .withAll()
      .build();
  }

  readonly monedasDeCompra = computed<readonly UiOption[]>(() => [
    { value: 'COP', label: this.i18n.t('form.currency.cop') },
    { value: 'USD', label: this.i18n.t('form.currency.usd') },
  ]);

  monedaDeCompra(): 'COP' | 'USD' {
    const tarjeta = this.store.account(this.model.accountId);
    if (tarjeta?.type === 'credit' && !tarjeta.dualCurrency) return tarjeta.currency === 'USD' ? 'USD' : 'COP';
    return this.model.originalCurrency === 'USD' ? 'USD' : 'COP';
  }

  elegirMonedaDeCompra(moneda: 'COP' | 'USD'): void {
    this.model.originalCurrency = moneda;
  }

  private permisoDeGuardado(): string {
    if (this.model.id) return P.movimientos.editar;
    switch (this.model.operationType) {
      case 'transfer':
        return P.movimientos.transferencias.crear;
      case 'advance':
        return P.movimientos.avances.crear;
      case 'loan':
        return P.movimientos.prestamos.crear;
      case 'credit':
        return P.movimientos.creditos.crear;
      default:
        return P.movimientos.crear;
    }
  }

  private validar(): void {
    if (!this.capabilities.allows(this.permisoDeGuardado())) throw new Error(this.i18n.t('form.error.forbidden'));
    const operacion = this.model.operationType;
    const source = this.store.account(this.model.accountId);
    const target = this.store.account(this.model.targetId);
    const compraConTarjeta = this.model.kind === 'expense' && operacion === 'normal' && source?.type === 'credit';
    if (compraConTarjeta && !this.capabilities.allows(P.movimientos.creditos.crear))
      throw new Error(this.i18n.t('form.movement.error.creditPurchaseForbidden'));
    if (operacion === 'transfer' && (source?.type === 'credit' || target?.type === 'credit'))
      throw new Error(this.i18n.t('form.movement.error.transferCreditForbidden'));
    if (operacion === 'advance' && (source?.type !== 'credit' || target?.type === 'credit'))
      throw new Error(this.i18n.t('form.movement.error.advanceAccountInvalid'));
    if (this.model.kind === 'income' && source?.type === 'credit')
      throw new Error(this.i18n.t('form.movement.error.incomeCreditForbidden'));
    if ((operacion === 'loan' || operacion === 'credit' || operacion === 'received') && !this.model.counterpartyId)
      throw new Error(this.i18n.t('form.movement.error.counterpartyRequired'));
    const tasa = Number(this.model.monthlyRate ?? 0);
    if ((operacion === 'loan' || operacion === 'credit') && (!Number.isFinite(tasa) || tasa < 0 || tasa > 100))
      throw new Error(this.i18n.t('form.movement.error.rateInvalid'));
  }

  async submit() {
    try {
      this.error.set('');
      this.validar();
      const kind = this.effectiveKind();
      const originalCurrency = this.visibility().showCurrency ? 'USD' : this.monedaDeCompra();
      await this.actions.run(
        this.saveActionKey,
        () => this.movementCommands.save({ ...this.model, kind, originalCurrency }),
        {
          loading: this.i18n.t('form.movement.toast.loading'),
          success: this.i18n.t('form.movement.toast.success'),
          error: (error) => (error instanceof Error ? error.message : this.i18n.t('form.movement.error.saveFailed')),
        },
      );
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : this.i18n.t('form.movement.error.saveFailed'));
    }
  }
}

function operacionPedida(pedida: string | undefined, kind: string): MovementOperationType {
  if (!pedida || !isMovementOperationType(pedida)) return 'normal';
  const disponibles = kind === 'income' ? OPERACIONES_DE_INGRESO : OPERACIONES_DE_GASTO;
  return disponibles.includes(pedida) ? pedida : 'normal';
}

function operacionDe(movimiento: Movement | undefined): MovementOperationType {
  if (movimiento?.movementSubtype === 'transfer') return 'transfer';
  if (movimiento?.movementSubtype === 'advance') return 'advance';
  if (movimiento?.loanProduct) return 'credit';
  if (movimiento?.loanRole) return 'loan';
  return 'normal';
}
