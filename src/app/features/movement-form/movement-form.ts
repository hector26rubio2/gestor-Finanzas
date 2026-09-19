import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n';
import { P } from '../../core/permissions';
import { CAPABILITIES, CapabilitiesProvider, AppStore } from '../../core/store';
import { OverlayComponent } from '../../ui/overlay/overlay';
import { MovementCategoryFieldComponent } from './movement-category-field';
import { MovementCoreFieldsComponent } from './movement-core-fields';
import { MovementCurrencyFieldsComponent } from './movement-currency-fields';
import { MovementInstallmentFieldsComponent } from './movement-installment-fields';
import { MovementKindOption, MovementKindSelectorComponent } from './movement-kind-selector';
import { MovementLoanFieldsComponent } from './movement-loan-fields';
import { MovementRecurrenceFieldsComponent } from './movement-recurrence-fields';
import { MovementFieldVisibility, MovementVisibilityBuilder } from './movement-visibility-builder';
import { UiOption, UiSelectComponent } from '../../ui/select';
import { FieldComponent } from '../../ui/field';
import { AsyncActionService } from '../../core/async-action.service';

/**
 * Formulario de movimiento, partido en un componente por grupo de campos.
 *
 * Antes era una sola plantilla que recorría una lista de `FormField` genérica
 * construida por una función de 150 líneas con un `switch` de visibilidad aparte.
 * Cada grupo (cuentas, categoría, moneda, cuotas, préstamo, recurrencia) tiene
 * ahora su propio componente: agregar una regla a "cuotas" ya no obliga a leer las
 * reglas de "préstamo" para no pisarlas.
 *
 * Este componente sigue siendo el único dueño del `model` — los hijos lo reciben
 * por referencia y lo mutan vía `ngModel`, igual que antes lo hacía la plantilla
 * plana. Lo que cambió es quién decide qué mostrar: antes un `fieldVisible(key)`
 * con un `switch`, ahora `MovementVisibilityBuilder`, un objeto con toda la regla
 * de negocio en un solo sitio y sin plantilla de por medio.
 */
@Component({
  selector: 'fin-movement-form',
  standalone: true,
  imports: [
    FormsModule,
    OverlayComponent,
    MovementKindSelectorComponent,
    MovementCoreFieldsComponent,
    MovementCategoryFieldComponent,
    MovementCurrencyFieldsComponent,
    MovementInstallmentFieldsComponent,
    MovementLoanFieldsComponent,
    MovementRecurrenceFieldsComponent,
    UiSelectComponent,
    FieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movement-form.html',
  styleUrl: './movement-form.css',
})
export class MovementFormComponent {
  readonly store = inject(AppStore);
  private readonly capabilities: CapabilitiesProvider = inject(CAPABILITIES);
  readonly i18n = inject(I18nService);
  readonly error = signal('');
  readonly actions = inject(AsyncActionService);
  readonly saveActionKey = 'movement:save';

  /**
   * Solo dirección del dinero: gasto o ingreso. Transferencia, avance, préstamo y
   * crédito ya no son botones propios — son opciones de `operationTypeOptions()`,
   * que cargan según cuál de estos dos se eligió primero (ver `effectiveKind`).
   */
  readonly types = computed<readonly MovementKindOption[]>(() =>
    [
      { value: 'expense', label: this.i18n.t('form.movement.type.expense'), permiso: P.movimientos.crear },
      { value: 'income', label: this.i18n.t('form.movement.type.income'), permiso: P.movimientos.crear },
    ].filter((t) => this.capabilities.allows(t.permiso)),
  );

  /**
   * No es un `computed()`: depende de `model['kind']`, una propiedad mutable que no
   * rastrearía un `computed()` (misma razón que en `movement-loan-fields.ts`).
   *
   * Transferencia y avance solo se ofrecen desde Gasto: la pata que se está creando
   * aquí siempre es la que sale de `accountId` hacia `targetId`, así que encaja con
   * "sale dinero de esta cuenta" y no con su espejo. Préstamo y crédito no mueven
   * dinero entre dos cuentas propias, así que aplican a los dos lados.
   */
  operationTypeOptions(): readonly UiOption[] {
    const kind = this.model['kind'];
    return [
      { value: 'normal', label: this.i18n.t('form.movement.operationType.normal') },
      ...(kind === 'expense' && this.capabilities.allows(P.movimientos.transferencias.crear)
        ? [{ value: 'transfer', label: this.i18n.t('form.movement.operationType.transfer') }]
        : []),
      ...(kind === 'expense' && this.capabilities.allows(P.movimientos.avances.crear)
        ? [{ value: 'advance', label: this.i18n.t('form.movement.operationType.advance') }]
        : []),
      ...(this.capabilities.allows(P.movimientos.prestamos.crear)
        ? [{ value: 'loan', label: this.i18n.t('form.movement.operationType.loan') }]
        : []),
      ...(this.capabilities.allows(P.movimientos.creditos.crear)
        ? [{ value: 'credit', label: this.i18n.t('form.movement.operationType.credit') }]
        : []),
    ];
  }

  /** La operación real que se envía a guardar: gasto/ingreso normal, o transferencia/avance. */
  effectiveKind(): string {
    const operationType = this.model['operationType'];
    return operationType === 'transfer' || operationType === 'advance' ? operationType : this.model['kind'];
  }

  model: Record<string, any> = {};

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
      kind: context.kind,
      date: m?.date ?? '2026-08-31',
      accountId: context.accountId ?? m?.accountId ?? '',
      targetId: context.targetId ?? '',
      description: m?.description ?? '',
      amount: Math.abs(m?.amount ?? 0),
      category: m?.category ?? '',
      person: m?.person ?? '',
      id: m?.id,
      notificationId: context.notificationId,
      ownership: m?.ownership ?? 'own',
      recurring: String(m?.recurring ?? false),
      recurrence: m?.recurrence ?? 'monthly',
      installmentCurrent: m?.installmentCurrent ?? 1,
      installmentTotal: m?.installmentTotal ?? 1,
      purchaseApr: m?.purchaseApr,
      loanRole: m?.loanRole ?? '',
      loanProduct: m?.loanProduct ?? '',
      operationType:
        m?.movementSubtype === 'transfer'
          ? 'transfer'
          : m?.movementSubtype === 'advance'
            ? 'advance'
            : m?.loanRole
              ? 'loan'
              : m?.loanProduct
                ? 'credit'
                : 'normal',
      originalCurrency: m?.originalCurrency ?? 'COP',
      originalAmount: m?.originalAmount ?? 0,
      exchangeRate: m?.exchangeRate ?? 4168.35,
    };
  }

  setKind(kind: string) {
    this.model['kind'] = kind;
    // Transferencia y avance solo existen bajo Gasto: si se cambia a Ingreso con uno
    // de los dos elegido, ya no aplica y se vuelve al tipo normal.
    if (kind !== 'expense' && (this.model['operationType'] === 'transfer' || this.model['operationType'] === 'advance'))
      this.model['operationType'] = 'normal';
    this.store.form.update((v) => (v ? { ...v, kind } : v));
  }

  setOperationType(operationType: string) {
    this.model['operationType'] = operationType;
    // Cada tipo trae sus propios campos; limpiar los de los demas evita mandar a
    // guardar un `loanRole`/`targetId` que ya no se ve ni se pudo revisar.
    if (operationType !== 'loan') this.model['loanRole'] = '';
    if (operationType !== 'credit') this.model['loanProduct'] = '';
    if (operationType !== 'transfer' && operationType !== 'advance') this.model['targetId'] = '';
  }

  /**
   * No es un `computed()` a propósito: depende de `model.accountId`, que se muta
   * directo (no es un signal), igual que antes lo hacía `fieldVisible`. Angular
   * vuelve a llamar a los métodos de la plantilla en cada verificación, así que
   * sigue leyendo el valor fresco sin nada más que declarar.
   */
  visibility(): MovementFieldVisibility {
    const account = this.store.account(this.model['accountId']);
    const isEditing = !!this.model['id'];
    return new MovementVisibilityBuilder(this.effectiveKind(), account, isEditing).withAll().build();
  }

  async submit() {
    try {
      this.error.set('');
      // Ultima linea antes de escribir. El servidor tiene la palabra final, pero
      // avisar aqui evita mandar una peticion que va a volver con 403.
      const kind = this.effectiveKind();
      const permiso =
        kind === 'transfer'
          ? P.movimientos.transferencias.crear
          : kind === 'advance'
            ? P.movimientos.avances.crear
            : kind === 'payment'
              ? P.movimientos.pagos.crear
              : this.model['id']
                ? P.movimientos.editar
                : P.movimientos.crear;
      if (!this.capabilities.allows(permiso)) throw new Error(this.i18n.t('form.error.forbidden'));
      if (this.model['loanRole'] && !this.capabilities.allows(P.movimientos.prestamos.crear))
        throw new Error(this.i18n.t('form.movement.error.loanForbidden'));
      if (this.model['loanProduct'] && !this.capabilities.allows(P.movimientos.creditos.crear))
        throw new Error(this.i18n.t('form.movement.error.creditForbidden'));
      const source = this.store.account(this.model['accountId']);
      // Un gasto cargado a una tarjeta se registra como compra a crédito, no como gasto
      // corriente: es otra clase de movimiento y otra concesión.
      if (kind === 'expense' && source?.type === 'credit' && !this.capabilities.allows(P.movimientos.creditos.crear))
        throw new Error(this.i18n.t('form.movement.error.creditPurchaseForbidden'));
      const target = this.store.account(this.model['targetId']);
      if (kind === 'transfer' && (source?.type === 'credit' || target?.type === 'credit'))
        throw new Error(this.i18n.t('form.movement.error.transferCreditForbidden'));
      // Un avance sale de la tarjeta hacia efectivo o ahorro: al reves, o entre dos
      // tarjetas, no es un avance valido.
      if (kind === 'advance' && (source?.type !== 'credit' || target?.type === 'credit'))
        throw new Error(this.i18n.t('form.movement.error.advanceAccountInvalid'));
      if (kind === 'income' && source?.type === 'credit')
        throw new Error(this.i18n.t('form.movement.error.incomeCreditForbidden'));
      await this.actions.run(
        this.saveActionKey,
        () => this.store.save({ ...this.model, kind } as any),
        {
          loading: this.i18n.t('form.movement.toast.loading'),
          success: this.i18n.t('form.movement.toast.success'),
          error: (error) =>
            error instanceof Error ? error.message : this.i18n.t('form.movement.error.saveFailed'),
        },
      );
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : this.i18n.t('form.movement.error.saveFailed'));
    }
  }
}
